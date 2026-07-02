#!/usr/bin/env node
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn, execSync } = require('child_process');
const net = require('net');
const url = require('url');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.env.INSTALLER_PORT || '4000', 10);
const TOKEN = crypto.randomBytes(24).toString('hex');
const LOCK_FILE = path.join(ROOT, '.installed');
const FORCE = process.argv.includes('--force');

let installState = { phase: 'idle', status: 'pending', log: [] };

if (fs.existsSync(LOCK_FILE) && !FORCE) {
  console.error('Reply Botz HD is already installed. Use --force to run the installer again.');
  process.exit(1);
}

function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function checkAuth(req, res) {
  const parsed = url.parse(req.url, true);
  if (parsed.query.token !== TOKEN) {
    sendJSON(res, 403, { error: 'Invalid or missing access token' });
    return false;
  }
  return true;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString())); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function isPortFree(port) {
  return new Promise(resolve => {
    const srv = net.createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => { srv.close(); resolve(true); });
    srv.listen(port, '0.0.0.0');
  });
}

function cmdExists(cmd) {
  try { execSync(`command -v ${cmd}`, { stdio: 'ignore' }); return true; }
  catch { return false; }
}

function cmdOutput(cmd) {
  try { return execSync(cmd, { encoding: 'utf8', timeout: 10000 }).trim(); }
  catch { return null; }
}

async function runPreflight() {
  const dockerInstalled = cmdExists('docker');
  const dockerVersion = dockerInstalled ? cmdOutput('docker --version') : null;

  const composeInstalled = dockerInstalled && !!cmdOutput('docker compose version');
  const composeVersion = composeInstalled ? cmdOutput('docker compose version --short') : null;

  let daemonRunning = false;
  if (dockerInstalled) {
    try { execSync('docker info', { stdio: 'ignore', timeout: 10000 }); daemonRunning = true; }
    catch { /* daemon not running */ }
  }

  const port3000Free = await isPortFree(3000);

  return {
    checks: [
      { name: 'Docker', ok: dockerInstalled, detail: dockerVersion || 'Not installed' },
      { name: 'Docker Compose V2', ok: composeInstalled, detail: composeVersion || 'Not available' },
      { name: 'Docker Daemon', ok: daemonRunning, detail: daemonRunning ? 'Running' : 'Not running' },
      { name: 'Port 3000', ok: port3000Free, detail: port3000Free ? 'Available' : 'In use' },
    ],
    ready: dockerInstalled && composeInstalled && daemonRunning && port3000Free,
  };
}

function genSecret(bytes, encoding) {
  return crypto.randomBytes(bytes).toString(encoding);
}

function runCmd(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; });
    proc.on('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(`${cmd} ${args.join(' ')} exited ${code}: ${stderr || stdout}`));
    });
    proc.on('error', reject);
  });
}

function streamCmd(cmd, args, emit, opts = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], ...opts });
    proc.stdout.on('data', d => {
      d.toString().split('\n').filter(Boolean).forEach(line => emit(line));
    });
    proc.stderr.on('data', d => {
      d.toString().split('\n').filter(Boolean).forEach(line => emit(line));
    });
    proc.on('close', code => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function healthCheck(composeFiles, service, check, timeoutSec, emit) {
  const start = Date.now();
  while (Date.now() - start < timeoutSec * 1000) {
    try {
      await runCmd('docker', ['compose', ...composeFiles, 'exec', '-T', ...check]);
      return true;
    } catch { /* retry */ }
    emit(`Waiting for ${service}...`);
    await new Promise(r => setTimeout(r, 2000));
  }
  return false;
}

async function runInstall(config, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  function emit(phase, status, message) {
    installState = { phase, status, log: [...installState.log, { phase, status, message }] };
    res.write(`data: ${JSON.stringify({ phase, status, message })}\n\n`);
  }

  try {
    // Phase 1: Generate secrets and write .env.local
    emit('env', 'running', 'Generating secure configuration...');

    const secrets = {
      JWT_SECRET: genSecret(48, 'base64'),
      ENCRYPTION_KEY: genSecret(32, 'hex'),
      POSTGRES_PASSWORD: genSecret(24, 'base64url'),
      REDIS_PASSWORD: genSecret(24, 'base64url'),
      MEILI_MASTER_KEY: genSecret(24, 'base64url'),
      GRAFANA_PASSWORD: genSecret(16, 'base64url'),
    };

    const mode = config.mode || 'prod';
    const appUrl = config.appUrl || 'http://localhost:3000';
    const domain = config.domain || 'replybotz.localhost';
    const adminEmail = config.adminEmail || 'admin@replybotz.com';
    const adminPassword = config.adminPassword || 'Admin@123456';

    const envContent = `# ===========================================
# Reply Botz HD - Generated Configuration
# Generated on: ${new Date().toISOString()}
# ===========================================

# App
NODE_ENV=${mode === 'dev' ? 'development' : 'production'}
NEXT_PUBLIC_APP_URL=${appUrl}
NEXT_PUBLIC_APP_DOMAIN=${domain}

# Database (PostgreSQL)
DATABASE_URL=postgresql://replybotz:${secrets.POSTGRES_PASSWORD}@postgres:5432/replybotz
POSTGRES_PASSWORD=${secrets.POSTGRES_PASSWORD}

# Redis
REDIS_URL=redis://:${secrets.REDIS_PASSWORD}@redis:6379
REDIS_PASSWORD=${secrets.REDIS_PASSWORD}

# Auth (JWT) - Auto-generated secure secret
JWT_SECRET=${secrets.JWT_SECRET}
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Password Hashing (Argon2)
ARGON2_MEMORY_COST=65536
ARGON2_TIME_COST=3

# MFA (TOTP)
MFA_ISSUER=ReplyBotzHD

# Encryption (AES-256-GCM) - Auto-generated secure key
ENCRYPTION_KEY=${secrets.ENCRYPTION_KEY}

# Meilisearch
MEILI_URL=http://meilisearch:7700
MEILI_MASTER_KEY=${secrets.MEILI_MASTER_KEY}

# Monitoring
GRAFANA_PASSWORD=${secrets.GRAFANA_PASSWORD}

# Logging
LOG_LEVEL=info

# Tenant Resolution
TENANT_RESOLUTION_MODE=subdomain

# Seed Admin (set by GUI installer)
SEED_ADMIN_EMAIL=${adminEmail}
SEED_ADMIN_PASSWORD=${adminPassword}
`;

    fs.writeFileSync(path.join(ROOT, '.env.local'), envContent, 'utf8');
    emit('env', 'done', '.env.local generated with secure secrets');

    // Phase 2: Docker Compose pull
    emit('pull', 'running', 'Pulling Docker images...');
    const composeArgs = ['-f', 'docker-compose.yml'];
    if (mode === 'dev') composeArgs.push('-f', 'docker-compose.dev.yml');
    const profileArgs = config.monitoring ? ['--profile', 'monitoring'] : [];

    await streamCmd('docker', ['compose', ...composeArgs, 'pull'], msg => {
      emit('pull', 'running', msg);
    });
    emit('pull', 'done', 'Docker images pulled');

    // Phase 3: Build and start services
    emit('start', 'running', 'Building and starting services...');
    await streamCmd('docker', ['compose', ...composeArgs, ...profileArgs, 'up', '-d', '--build'], msg => {
      emit('start', 'running', msg);
    });
    emit('start', 'done', 'Services started');

    // Phase 4: Health checks
    emit('health', 'running', 'Waiting for services to be healthy...');

    const pgOk = await healthCheck(composeArgs, 'PostgreSQL',
      ['postgres', 'pg_isready', '-U', 'replybotz', '-d', 'replybotz'], 30,
      msg => emit('health', 'running', msg));
    if (!pgOk) throw new Error('PostgreSQL failed to start within 30s');
    emit('health', 'running', 'PostgreSQL is ready');

    const redisOk = await healthCheck(composeArgs, 'Redis',
      ['redis', 'redis-cli', 'ping'], 15,
      msg => emit('health', 'running', msg));
    if (!redisOk) throw new Error('Redis failed to start within 15s');
    emit('health', 'running', 'Redis is ready');

    let appOk = false;
    const appStart = Date.now();
    while (Date.now() - appStart < 120000) {
      try {
        await runCmd('curl', ['-sf', 'http://localhost:3000/api/health']);
        appOk = true;
        break;
      } catch { /* retry */ }
      emit('health', 'running', 'Waiting for application...');
      await new Promise(r => setTimeout(r, 3000));
    }
    if (!appOk) throw new Error('Application failed to start within 120s');
    emit('health', 'done', 'All services are healthy');

    // Phase 5: Database migrations + seed
    emit('database', 'running', 'Running database migrations...');
    if (mode === 'dev') {
      await streamCmd('docker', ['compose', ...composeArgs, 'exec', '-T', 'app',
        'sh', '-c', 'npx prisma migrate dev --name init 2>/dev/null || npx prisma db push'],
        msg => emit('database', 'running', msg));
    } else {
      await streamCmd('docker', ['compose', ...composeArgs, 'exec', '-T', 'app',
        'sh', '-c', 'npx prisma migrate deploy 2>/dev/null || npx prisma db push'],
        msg => emit('database', 'running', msg));
    }
    emit('database', 'running', 'Seeding database...');
    await streamCmd('docker', ['compose', ...composeArgs, 'exec', '-T', 'app',
      'npx', 'prisma', 'db', 'seed'],
      msg => emit('database', 'running', msg));
    emit('database', 'done', 'Database setup complete');

    // Done
    fs.writeFileSync(LOCK_FILE, new Date().toISOString(), 'utf8');

    const result = {
      appUrl,
      adminEmail,
      monitoring: !!config.monitoring,
      grafanaPassword: secrets.GRAFANA_PASSWORD,
    };
    emit('complete', 'done', JSON.stringify(result));

    setTimeout(() => {
      console.log('\nInstaller shutting down automatically...');
      process.exit(0);
    }, 60000);

  } catch (err) {
    emit('error', 'error', err.message);
  }

  res.end();
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname === '/' && req.method === 'GET') {
    if (!checkAuth(req, res)) return;
    const htmlPath = path.join(__dirname, 'index.html');
    try {
      const html = fs.readFileSync(htmlPath, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch {
      sendJSON(res, 500, { error: 'index.html not found' });
    }
    return;
  }

  if (pathname === '/api/preflight' && req.method === 'GET') {
    if (!checkAuth(req, res)) return;
    const result = await runPreflight();
    sendJSON(res, 200, result);
    return;
  }

  if (pathname === '/api/install' && req.method === 'POST') {
    if (!checkAuth(req, res)) return;
    if (installState.phase !== 'idle' && installState.phase !== 'error') {
      sendJSON(res, 409, { error: 'Installation already in progress' });
      return;
    }
    try {
      const config = await readBody(req);
      await runInstall(config, res);
    } catch (err) {
      sendJSON(res, 400, { error: err.message });
    }
    return;
  }

  if (pathname === '/api/status' && req.method === 'GET') {
    if (!checkAuth(req, res)) return;
    sendJSON(res, 200, installState);
    return;
  }

  if (pathname === '/api/shutdown' && req.method === 'POST') {
    if (!checkAuth(req, res)) return;
    sendJSON(res, 200, { message: 'Shutting down...' });
    setTimeout(() => process.exit(0), 500);
    return;
  }

  sendJSON(res, 404, { error: 'Not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ┌──────────────────────────────────────────────┐');
  console.log('  │     Reply Botz HD — GUI Installer            │');
  console.log('  └──────────────────────────────────────────────┘');
  console.log('');
  console.log(`  Open in your browser:`);
  console.log(`  http://localhost:${PORT}/?token=${TOKEN}`);
  console.log('');
  console.log(`  Or from your VPS public IP:`);
  console.log(`  http://<your-server-ip>:${PORT}/?token=${TOKEN}`);
  console.log('');
  console.log('  The access token above is required. Do not share it.');
  console.log('');
});
