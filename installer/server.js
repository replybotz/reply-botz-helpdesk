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
const ENV_FILE = path.join(ROOT, '.env.local');
const LOCK_FILE = path.join(ROOT, '.installed');

let installState = { status: 'idle', phase: null, log: [], error: null, appUrl: null };
let installRunning = false;
let sseClients = [];

// ── Utilities ──

function generateSecret(bytes, encoding = 'base64') {
  return crypto.randomBytes(bytes).toString(encoding);
}

function tryExec(cmd) {
  try {
    return { ok: true, output: execSync(cmd, { encoding: 'utf8', timeout: 10000 }).trim() };
  } catch {
    return { ok: false, output: '' };
  }
}

function sendSSE(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
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

  checks.envExists = { ok: true, exists: fs.existsSync(ENV_FILE), message: fs.existsSync(ENV_FILE) ? '.env.local already exists (will be overwritten)' : '.env.local will be generated' };

  return checks;
}

// ── Installation Pipeline ──

function spawnAndStream(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { cwd: ROOT, ...options });
    let stdout = '', stderr = '';

    if (proc.stdout) {
      proc.stdout.on('data', (data) => {
        const line = data.toString();
        stdout += line;
        sendSSE('log', { text: line.trimEnd() });
      });
    }
    if (proc.stderr) {
      proc.stderr.on('data', (data) => {
        const line = data.toString();
        stderr += line;
        sendSSE('log', { text: line.trimEnd() });
      });
    }

    proc.on('close', (code) => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`Command exited with code ${code}: ${stderr.slice(-500)}`));
    });
    proc.on('error', reject);
  });
}

async function runInstall(config) {
  if (installRunning) throw new Error('Installation already in progress');
  installRunning = true;
  installState = { status: 'running', phase: 'env', log: [], error: null, appUrl: null };

  try {
    // Phase 1: Generate .env.local
    broadcastPhase('env', 'generate', 'running', 'Generating configuration...');

    const jwtSecret = generateSecret(48, 'base64');
    const encryptionKey = generateSecret(32, 'hex');
    const postgresPassword = generateSecret(24, 'base64url').slice(0, 24);
    const redisPassword = generateSecret(24, 'base64url').slice(0, 24);
    const meiliMasterKey = generateSecret(24, 'base64url').slice(0, 24);
    const grafanaPassword = generateSecret(16, 'base64url').slice(0, 16);

    const mode = config.mode || 'production';
    const nodeEnv = mode === 'development' ? 'development' : 'production';
    const appUrl = config.domain ? `https://${config.domain}` : `http://${getServerIP()}:3000`;

    const envContent = `# ===========================================
# Reply Botz HD - Generated Configuration
# Generated on: ${new Date().toISOString()}
# Generated by: GUI Installer
# ===========================================

# App
NODE_ENV=${nodeEnv}
NEXT_PUBLIC_APP_URL=${appUrl}
NEXT_PUBLIC_APP_DOMAIN=${config.domain || `${getServerIP()}`}

# Database (PostgreSQL)
DATABASE_URL=postgresql://replybotz:${postgresPassword}@postgres:5432/replybotz
POSTGRES_PASSWORD=${postgresPassword}

# Redis
REDIS_URL=redis://:${redisPassword}@redis:6379
REDIS_PASSWORD=${redisPassword}

# Auth (JWT)
JWT_SECRET=${jwtSecret}
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Password Hashing (Argon2)
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3

# MFA (TOTP)
MFA_ISSUER=ReplyBotzHD

# Encryption (AES-256-GCM)
ENCRYPTION_KEY=${encryptionKey}

# Meilisearch
MEILI_URL=http://meilisearch:7700
MEILI_MASTER_KEY=${meiliMasterKey}

# Monitoring
GRAFANA_PASSWORD=${grafanaPassword}

# Logging
LOG_LEVEL=info

# Tenant Resolution
TENANT_RESOLUTION_MODE=subdomain
${config.adminEmail ? `\n# Seed Admin\nSEED_ADMIN_EMAIL=${config.adminEmail}` : ''}
${config.adminPassword ? `SEED_ADMIN_PASSWORD=${config.adminPassword}` : ''}
${config.smtpHost ? `
# SMTP
SMTP_HOST=${config.smtpHost}
SMTP_PORT=${config.smtpPort || '587'}
SMTP_USER=${config.smtpUser || ''}
SMTP_PASS=${config.smtpPass || ''}
SMTP_FROM=${config.smtpFrom || config.adminEmail || ''}` : ''}
`;

    fs.writeFileSync(ENV_FILE, envContent, 'utf8');
    broadcastPhase('env', 'generate', 'done', 'Configuration generated');

    // Phase 2: Pull images
    broadcastPhase('pull', 'images', 'running', 'Pulling Docker images...');
    const composeFiles = ['-f', 'docker-compose.yml'];
    const profiles = [];
    if (config.monitoring) profiles.push('--profile', 'monitoring');

    try {
      await spawnAndStream('docker', ['compose', ...composeFiles, 'pull'], { env: { ...process.env, COMPOSE_FILE: '' } });
    } catch {
      sendSSE('log', { text: 'Some images could not be pulled (will build from source)' });
    }
    broadcastPhase('pull', 'images', 'done', 'Docker images ready');

    // Phase 3: Build and start
    broadcastPhase('build', 'start', 'running', 'Building and starting services...');
    await spawnAndStream('docker', ['compose', ...composeFiles, ...profiles, 'up', '-d', '--build']);
    broadcastPhase('build', 'start', 'done', 'Services started');

    // Phase 4: Health checks
    broadcastPhase('health', 'postgres', 'checking', 'Waiting for PostgreSQL...');
    for (let i = 0; i < 30; i++) {
      const pg = tryExec(`docker compose ${composeFiles.join(' ')} exec -T postgres pg_isready -U replybotz -d replybotz`);
      if (pg.ok) break;
      if (i === 29) throw new Error('PostgreSQL failed to start within 30 seconds');
      await new Promise(r => setTimeout(r, 1000));
    }
    broadcastPhase('health', 'postgres', 'done', 'PostgreSQL is ready');

    broadcastPhase('health', 'redis', 'checking', 'Waiting for Redis...');
    for (let i = 0; i < 15; i++) {
      const rd = tryExec(`docker compose ${composeFiles.join(' ')} exec -T redis redis-cli ping`);
      if (rd.ok && rd.output.includes('PONG')) break;
      if (i === 14) throw new Error('Redis failed to start within 15 seconds');
      await new Promise(r => setTimeout(r, 1000));
    }
    broadcastPhase('health', 'redis', 'done', 'Redis is ready');

    broadcastPhase('health', 'app', 'checking', 'Waiting for application...');
    for (let i = 0; i < 60; i++) {
      const app = tryExec('curl -sf http://localhost:3000/api/health');
      if (app.ok) break;
      if (i === 59) throw new Error('Application failed to start within 120 seconds');
      await new Promise(r => setTimeout(r, 2000));
    }
    broadcastPhase('health', 'app', 'done', 'Application is ready');

    // Phase 5: Migrations and seed
    broadcastPhase('migrate', 'run', 'running', 'Running database migrations...');
    const migrateCmd = mode === 'development' ? 'npx prisma migrate dev --name init' : 'npx prisma migrate deploy';
    try {
      await spawnAndStream('docker', ['compose', ...composeFiles, 'exec', '-T', 'app', 'sh', '-c', migrateCmd]);
    } catch {
      sendSSE('log', { text: 'Migrate command failed, trying db push...' });
      await spawnAndStream('docker', ['compose', ...composeFiles, 'exec', '-T', 'app', 'npx', 'prisma', 'db', 'push']);
    }
    broadcastPhase('migrate', 'run', 'done', 'Database migrations complete');

    broadcastPhase('migrate', 'seed', 'running', 'Seeding database...');
    await spawnAndStream('docker', ['compose', ...composeFiles, 'exec', '-T', 'app', 'npx', 'prisma', 'db', 'seed']);
    broadcastPhase('migrate', 'seed', 'done', 'Database seeded');

    // Done
    installState.status = 'complete';
    installState.appUrl = appUrl;
    const loginEmail = config.adminEmail || 'admin@replybotz.com';
    const loginPassword = config.adminPassword || 'Admin@123456';

    sendSSE('complete', {
      url: appUrl,
      credentials: { email: loginEmail, password: loginPassword, tenant: 'system' },
      services: {
        app: appUrl,
        health: `${appUrl}/api/health`,
        meilisearch: 'http://localhost:7700',
        ...(config.monitoring ? { grafana: 'http://localhost:3001', prometheus: 'http://localhost:9090' } : {}),
      },
    });

    fs.writeFileSync(LOCK_FILE, new Date().toISOString(), 'utf8');

    // Auto-shutdown after 120 seconds
    setTimeout(() => {
      console.log('\nInstaller shutting down. Reply Botz HD is running at ' + appUrl);
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

function verifyToken(req) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const urlToken = url.searchParams.get('token');
  const cookieToken = (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith('installer_token='))?.split('=')?.[1];
  return urlToken === TOKEN || cookieToken === TOKEN;
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  // Token check (except for static files on root with valid token)
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
      'Access-Control-Allow-Origin': '*',
    });

    sseClients.push(res);
    req.on('close', () => { sseClients = sseClients.filter(c => c !== res); });

    runInstall(config);
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
      'Access-Control-Allow-Origin': '*',
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

  if (!filePath.startsWith(__dirname)) {
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
  console.log('Reply Botz HD is already installed.');
  console.log('To re-run the installer, use: node installer/server.js --force');
  process.exit(0);
}

server.listen(PORT, '0.0.0.0', () => {
  const ip = getServerIP();
  console.log('');
  console.log('  ╔══════════════════════════════════════════════════╗');
  console.log('  ║  Reply Botz HD - GUI Installer                  ║');
  console.log('  ║                                                  ║');
  console.log('  ║  Open this URL in your browser:                  ║');
  console.log(`  ║  http://${ip}:${PORT}?token=${TOKEN}`);
  console.log('  ║                                                  ║');
  console.log('  ║  This token is required for access.              ║');
  console.log('  ╚══════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Local:   http://localhost:${PORT}?token=${TOKEN}`);
  console.log('');
});
