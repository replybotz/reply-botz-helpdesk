#!/usr/bin/env node

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, execSync } = require('node:child_process');
const os = require('node:os');
const net = require('node:net');

const PORT = parseInt(process.env.INSTALLER_PORT || '4000', 10);
const TOKEN = process.env.INSTALLER_TOKEN || crypto.randomBytes(16).toString('hex');
const ROOT = path.resolve(__dirname, '..');
// Compose interpolates ${VAR} substitutions from `.env` specifically, so the
// generated config MUST live there (not .env.local) or service passwords
// would silently fall back to defaults while the app uses the real ones.
const ENV_FILE = path.join(ROOT, '.env');
const LEGACY_ENV_FILE = path.join(ROOT, '.env.local');
const LOCK_FILE = path.join(ROOT, '.installed');

let installState = { status: 'idle', phase: null, log: [], error: null, appUrl: null };
let installRunning = false;
let sseClients = [];

// ── Utilities ──

function generateSecret(bytes, encoding = 'base64') {
  return crypto.randomBytes(bytes).toString(encoding);
}

function tryExec(cmd, timeout = 10000) {
  try {
    return { ok: true, output: execSync(cmd, { encoding: 'utf8', timeout }).trim() };
  } catch {
    return { ok: false, output: '' };
  }
}

function sendSSE(event, data) {
  // The event name is duplicated into the JSON payload because the browser
  // client parses only `data:` lines.
  const payload = `event: ${event}\ndata: ${JSON.stringify({ event, ...data })}\n\n`;
  installState.log.push({ event, ...data });
  for (const res of sseClients) {
    try { res.write(payload); } catch {}
  }
}

function broadcastPhase(phase, step, status, message, extra = {}) {
  if (status === 'running' || status === 'checking') {
    installState.phase = phase;
  }
  sendSSE('progress', { phase, step, status, message, ...extra });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; if (body.length > 1e6) reject(new Error('Too large')); });
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { reject(new Error('Invalid JSON')); } });
  });
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => { srv.close(); resolve(true); });
    srv.listen(port, '0.0.0.0');
  });
}

function getServerIP() {
  const interfaces = os.networkInterfaces();
  for (const iface of Object.values(interfaces)) {
    for (const alias of iface) {
      if (alias.family === 'IPv4' && !alias.internal) return alias.address;
    }
  }
  return 'localhost';
}

// ── Config validation / env generation ──

/**
 * User-supplied values are interpolated into .env; reject anything that
 * could break out of its line (env-var injection) and quote the rest.
 */
function assertSafeValue(name, value) {
  if (/[\r\n\0]/.test(value)) {
    throw new Error(`${name} must not contain line breaks`);
  }
}

function envQuote(value) {
  // `$` must be doubled or docker compose's env-file interpolation treats it
  // as a variable reference and silently mangles the value.
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\$/g, '$$$$')}"`;
}

function envLine(key, value) {
  assertSafeValue(key, String(value));
  return `${key}=${envQuote(value)}`;
}

const DOMAIN_PATTERN = /^[a-zA-Z0-9]([a-zA-Z0-9.-]*[a-zA-Z0-9])?$/;

function validateConfig(config) {
  if (config.domain && !DOMAIN_PATTERN.test(config.domain)) {
    throw new Error('Domain contains invalid characters');
  }
  if (!config.adminEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.adminEmail)) {
    throw new Error('A valid admin email is required');
  }
  if (!config.adminPassword || config.adminPassword.length < 8) {
    throw new Error('An admin password of at least 8 characters is required');
  }
  for (const [name, value] of Object.entries({
    adminEmail: config.adminEmail,
    adminPassword: config.adminPassword,
    smtpHost: config.smtpHost,
    smtpPort: config.smtpPort,
    smtpUser: config.smtpUser,
    smtpPass: config.smtpPass,
    smtpFrom: config.smtpFrom,
  })) {
    if (value) assertSafeValue(name, String(value));
  }
}

// ── Preflight Checks ──

async function runPreflight() {
  const checks = {};

  const docker = tryExec('docker --version');
  checks.docker = { ok: docker.ok, version: docker.output.match(/(\d+\.\d+\.\d+)/)?.[1] || '', message: docker.ok ? `Docker ${docker.output.match(/(\d+\.\d+\.\d+)/)?.[1]} detected` : 'Docker is not installed' };

  const compose = tryExec('docker compose version --short');
  checks.compose = { ok: compose.ok, version: compose.output, message: compose.ok ? `Docker Compose ${compose.output} detected` : 'Docker Compose V2 not available' };

  const daemon = tryExec('docker info');
  checks.daemon = { ok: daemon.ok, message: daemon.ok ? 'Docker daemon is running' : 'Docker daemon is not running' };

  const diskRaw = tryExec("df -BG --output=avail . | tail -1");
  const diskGB = parseInt(diskRaw.output) || 0;
  checks.disk = { ok: diskGB >= 2, available: `${diskGB}GB`, message: diskGB >= 2 ? `${diskGB}GB available` : `Only ${diskGB}GB available (2GB minimum)` };

  const memRaw = tryExec("free -m | awk '/Mem:/ {print $7}'");
  const memMB = parseInt(memRaw.output) || 0;
  const memGB = (memMB / 1024).toFixed(1);
  checks.memory = { ok: memMB >= 512, available: `${memGB}GB`, message: memMB >= 512 ? `${memGB}GB available` : `Only ${memGB}GB available (512MB minimum)` };

  const portFree = await checkPortAvailable(3000);
  checks.port3000 = { ok: portFree, message: portFree ? 'Port 3000 is available' : 'Port 3000 is in use' };

  const envExists = fs.existsSync(ENV_FILE) || fs.existsSync(LEGACY_ENV_FILE);
  checks.envExists = { ok: true, exists: envExists, message: envExists ? 'Existing configuration will be overwritten' : '.env will be generated' };

  return checks;
}

// ── Installation Pipeline ──

function spawnAndStream(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { cwd: ROOT, ...options });
    let stderrTail = '';

    const stream = (data) => {
      const line = data.toString();
      sendSSE('log', { text: line.trimEnd() });
      return line;
    };
    if (proc.stdout) proc.stdout.on('data', stream);
    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        stderrTail = (stderrTail + stream(data)).slice(-500);
      });
    }

    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command exited with code ${code}: ${stderrTail}`));
    });
    proc.on('error', reject);
  });
}

async function runInstall(config) {
  if (installRunning) throw new Error('Installation already in progress');
  installRunning = true;
  installState = { status: 'running', phase: 'env', log: [], error: null, appUrl: null };

  try {
    validateConfig(config);

    const mode = config.mode === 'development' ? 'development' : 'production';
    const composeFiles = ['-f', 'docker-compose.yml'];
    if (mode === 'development') {
      composeFiles.push('-f', 'docker-compose.dev.yml');
    }
    const profiles = [];
    if (config.monitoring) profiles.push('--profile', 'monitoring');

    // Phase 1: Generate .env
    broadcastPhase('env', 'generate', 'running', 'Generating configuration...');

    const jwtSecret = generateSecret(48, 'base64');
    const encryptionKey = generateSecret(32, 'hex');
    const postgresPassword = generateSecret(24, 'base64url');
    const redisPassword = generateSecret(24, 'base64url');
    const meiliMasterKey = generateSecret(24, 'base64url');
    const grafanaPassword = generateSecret(16, 'base64url');

    const appUrl = config.domain ? `https://${config.domain}` : `http://${getServerIP()}:3000`;

    const lines = [
      '# ===========================================',
      '# Reply Botz HD - Generated Configuration',
      `# Generated on: ${new Date().toISOString()}`,
      '# Generated by: GUI Installer',
      '# ===========================================',
      '',
      '# App',
      envLine('NODE_ENV', mode),
      envLine('NEXT_PUBLIC_APP_URL', appUrl),
      envLine('NEXT_PUBLIC_APP_DOMAIN', config.domain || getServerIP()),
      '',
      '# Database (PostgreSQL)',
      envLine('DATABASE_URL', `postgresql://replybotz:${postgresPassword}@postgres:5432/replybotz`),
      envLine('POSTGRES_PASSWORD', postgresPassword),
      '',
      '# Redis',
      envLine('REDIS_URL', `redis://:${redisPassword}@redis:6379`),
      envLine('REDIS_PASSWORD', redisPassword),
      '',
      '# Auth (JWT)',
      envLine('JWT_SECRET', jwtSecret),
      envLine('JWT_ACCESS_EXPIRY', '15m'),
      envLine('JWT_REFRESH_EXPIRY', '7d'),
      '',
      '# Password Hashing (Argon2)',
      envLine('ARGON2_MEMORY_COST', '65536'),
      envLine('ARGON2_TIME_COST', '3'),
      '',
      '# MFA (TOTP)',
      envLine('MFA_ISSUER', 'ReplyBotzHD'),
      '',
      '# Encryption (AES-256-GCM)',
      envLine('ENCRYPTION_KEY', encryptionKey),
      '',
      '# Meilisearch',
      envLine('MEILI_URL', 'http://meilisearch:7700'),
      envLine('MEILI_MASTER_KEY', meiliMasterKey),
      envLine('MEILI_ENV', mode),
      '',
      '# Monitoring',
      envLine('GRAFANA_PASSWORD', grafanaPassword),
      '',
      '# Logging',
      envLine('LOG_LEVEL', 'info'),
      '',
      '# Tenant Resolution',
      envLine('TENANT_RESOLUTION_MODE', 'subdomain'),
      '',
      '# Seed Admin',
      envLine('SEED_ADMIN_EMAIL', config.adminEmail),
      envLine('SEED_ADMIN_PASSWORD', config.adminPassword),
    ];

    if (config.smtpHost) {
      lines.push(
        '',
        '# SMTP',
        envLine('SMTP_HOST', config.smtpHost),
        envLine('SMTP_PORT', config.smtpPort || '587'),
        envLine('SMTP_USER', config.smtpUser || ''),
        envLine('SMTP_PASS', config.smtpPass || ''),
        envLine('SMTP_FROM', config.smtpFrom || config.adminEmail),
      );
    }

    if (fs.existsSync(LEGACY_ENV_FILE)) {
      fs.renameSync(LEGACY_ENV_FILE, `${LEGACY_ENV_FILE}.bak`);
      sendSSE('log', { text: 'Moved legacy .env.local to .env.local.bak' });
    }
    fs.writeFileSync(ENV_FILE, lines.join('\n') + '\n', { encoding: 'utf8', mode: 0o600 });
    broadcastPhase('env', 'generate', 'done', 'Configuration generated');

    // Phase 2: Pull images
    broadcastPhase('pull', 'images', 'running', 'Pulling Docker images...');
    try {
      await spawnAndStream('docker', ['compose', ...composeFiles, 'pull']);
    } catch {
      sendSSE('log', { text: 'Some images could not be pulled (will build from source)' });
    }
    broadcastPhase('pull', 'images', 'done', 'Docker images ready');

    // Phase 3: Build and start
    broadcastPhase('build', 'start', 'running', 'Building and starting services...');
    await spawnAndStream('docker', ['compose', ...composeFiles, ...profiles, 'up', '-d', '--build']);
    broadcastPhase('build', 'start', 'done', 'Services started');

    // Phase 4: Health checks
    const composeCmd = `docker compose ${composeFiles.join(' ')}`;

    broadcastPhase('health', 'postgres', 'checking', 'Waiting for PostgreSQL...');
    for (let i = 0; i < 30; i++) {
      const pg = tryExec(`${composeCmd} exec -T postgres pg_isready -U replybotz -d replybotz`);
      if (pg.ok) break;
      if (i === 29) throw new Error('PostgreSQL failed to start within 30 seconds');
      await new Promise(r => setTimeout(r, 1000));
    }
    broadcastPhase('health', 'postgres', 'done', 'PostgreSQL is ready');

    broadcastPhase('health', 'redis', 'checking', 'Waiting for Redis...');
    for (let i = 0; i < 15; i++) {
      // redis-server runs with --requirepass, so the probe must authenticate
      const rd = tryExec(`${composeCmd} exec -T redis redis-cli -a '${redisPassword}' --no-auth-warning ping`);
      if (rd.ok && rd.output.includes('PONG')) break;
      if (i === 14) throw new Error('Redis failed to start within 15 seconds');
      await new Promise(r => setTimeout(r, 1000));
    }
    broadcastPhase('health', 'redis', 'done', 'Redis is ready');

    // Phase 5: Migrations and seed — run in the builder-stage image, which
    // (unlike the standalone runner) has the Prisma CLI and tsx available.
    broadcastPhase('migrate', 'run', 'running', 'Running database migrations and seed...');
    await spawnAndStream('docker', ['compose', ...composeFiles, 'run', '--rm', '--build', 'migrate']);
    broadcastPhase('migrate', 'run', 'done', 'Database ready');

    broadcastPhase('health', 'app', 'checking', 'Waiting for application...');
    for (let i = 0; i < 60; i++) {
      const app = tryExec('curl -sf http://localhost:3000/api/health');
      if (app.ok) break;
      if (i === 59) throw new Error('Application failed to start within 120 seconds');
      await new Promise(r => setTimeout(r, 2000));
    }
    broadcastPhase('health', 'app', 'done', 'Application is ready');

    // Done. The admin password is deliberately NOT echoed back.
    installState.status = 'complete';
    installState.appUrl = appUrl;

    sendSSE('complete', {
      url: appUrl,
      credentials: { email: config.adminEmail, tenant: 'system' },
      services: {
        app: appUrl,
        health: `${appUrl}/api/health`,
        ...(config.monitoring ? { grafana: 'http://localhost:3001', prometheus: 'http://localhost:9090' } : {}),
      },
    });

    fs.writeFileSync(LOCK_FILE, new Date().toISOString(), 'utf8');

    // Auto-shutdown after 120 seconds
    setTimeout(() => {
      console.warn('\nInstaller shutting down. Reply Botz HD is running at ' + appUrl);
      process.exit(0);
    }, 120000);

  } catch (err) {
    installState.status = 'error';
    installState.error = err.message;
    sendSSE('error', { message: err.message });
  } finally {
    installRunning = false;
  }
}

// ── HTTP Server ──

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
};

function timingSafeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function verifyToken(req) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const urlToken = url.searchParams.get('token');
  const cookieToken = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('installer_token='))?.split('=')?.[1];
  return timingSafeCompare(urlToken ?? '', TOKEN) || timingSafeCompare(cookieToken ?? '', TOKEN);
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  if (!verifyToken(req)) {
    return sendJSON(res, 403, { error: 'Invalid or missing access token' });
  }

  // Set token cookie so subsequent requests don't need the query param
  if (url.searchParams.get('token') === TOKEN) {
    res.setHeader('Set-Cookie', `installer_token=${TOKEN}; Path=/; HttpOnly; SameSite=Strict`);
  }

  // ── API Routes ──

  if (pathname === '/api/preflight' && req.method === 'GET') {
    const checks = await runPreflight();
    return sendJSON(res, 200, checks);
  }

  if (pathname === '/api/defaults' && req.method === 'GET') {
    return sendJSON(res, 200, { serverIP: getServerIP() });
  }

  if (pathname === '/api/install' && req.method === 'POST') {
    if (installRunning) return sendJSON(res, 409, { error: 'Installation already in progress' });

    let config;
    try { config = await parseBody(req); } catch { return sendJSON(res, 400, { error: 'Invalid request body' }); }

    // SSE response
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    sseClients.push(res);
    req.on('close', () => { sseClients = sseClients.filter(c => c !== res); });

    runInstall(config).catch((err) => {
      installState.status = 'error';
      installState.error = err.message;
      sendSSE('error', { message: err.message });
    });
    return;
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    return sendJSON(res, 200, installState);
  }

  if (pathname === '/api/events' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Replay existing log
    for (const entry of installState.log) {
      const event = entry.event || 'progress';
      res.write(`event: ${event}\ndata: ${JSON.stringify(entry)}\n\n`);
    }

    sseClients.push(res);
    req.on('close', () => { sseClients = sseClients.filter(c => c !== res); });
    return;
  }

  if (pathname === '/api/shutdown' && req.method === 'POST') {
    sendJSON(res, 200, { message: 'Shutting down...' });
    setTimeout(() => process.exit(0), 1000);
    return;
  }

  // ── Static Files ──

  let filePath;
  if (pathname === '/' || pathname === '/index.html') {
    filePath = path.join(__dirname, 'index.html');
  } else {
    const safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    filePath = path.join(__dirname, safePath);
  }

  if (!filePath.startsWith(__dirname + path.sep) && filePath !== path.join(__dirname, 'index.html')) {
    return sendJSON(res, 403, { error: 'Forbidden' });
  }

  try {
    const content = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(content);
  } catch {
    sendJSON(res, 404, { error: 'Not found' });
  }
});

// ── Startup ──

if (fs.existsSync(LOCK_FILE) && !process.argv.includes('--force')) {
  console.warn('Reply Botz HD is already installed.');
  console.warn('To re-run the installer, use: node installer/server.js --force');
  process.exit(0);
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getServerIP();
  console.warn('');
  console.warn('  ╔══════════════════════════════════════════════════╗');
  console.warn('  ║  Reply Botz HD - GUI Installer                   ║');
  console.warn('  ║                                                  ║');
  console.warn('  ║  Open this URL in your browser:                  ║');
  console.warn(`  ║  http://${ip}:${PORT}?token=${TOKEN}`);
  console.warn('  ║                                                  ║');
  console.warn('  ║  This token is required for access.              ║');
  console.warn('  ╚══════════════════════════════════════════════════╝');
  console.warn('');
  console.warn(`  Local:   http://localhost:${PORT}?token=${TOKEN}`);
  console.warn('');
});
