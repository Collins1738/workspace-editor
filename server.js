const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.EDITOR_TOKEN || 'dravon123';

const ROOTS = {};
if (process.env.WORKSPACE_ROOT) ROOTS.workspace = process.env.WORKSPACE_ROOT;
if (process.env.EXTRA_ROOT)     ROOTS.extra     = process.env.EXTRA_ROOT;

// Fallback to defaults if no env vars set
if (Object.keys(ROOTS).length === 0) {
  ROOTS.workspace   = '/Users/collinsc/.openclaw/workspace';
  ROOTS.development = '/Users/collinsc/Development';
}

// Middleware
app.use(express.text({ type: '*/*', limit: '10mb' }));
app.use(express.json());

// Auth middleware
function auth(req, res, next) {
  const token = req.query.token || req.headers['x-token'];
  if (token !== TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Path safety check — relPath must start with a known root key (e.g. "workspace/foo" or "development/bar")
function safePath(relPath) {
  if (!relPath) return null;
  if (relPath.includes('..')) return null;
  const parts = relPath.split('/');
  const rootKey = parts[0];
  const base = ROOTS[rootKey];
  if (!base) return null;
  const subPath = parts.slice(1).join('/');
  const abs = subPath ? path.join(base, subPath) : base;
  if (!abs.startsWith(base)) return null;
  return abs;
}

// Recursive file tree builder
function buildTree(dirPath, relBase) {
  const SKIP = new Set(['node_modules', '.git', '.DS_Store']);
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  const result = [];

  for (const entry of entries) {
    if (SKIP.has(entry.name)) continue;
    const relPath = relBase ? `${relBase}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      let children = [];
      try {
        children = buildTree(path.join(dirPath, entry.name), relPath);
      } catch (e) {}
      result.push({ name: entry.name, path: relPath, type: 'dir', children });
    } else {
      result.push({ name: entry.name, path: relPath, type: 'file' });
    }
  }

  result.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return result;
}

// Routes
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/tree', auth, (req, res) => {
  try {
    const roots = Object.entries(ROOTS).map(([key, absPath]) => {
      let children = [];
      try { children = buildTree(absPath, key); } catch (e) {}
      return { name: key, path: key, type: 'dir', children };
    });
    res.json(roots);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/file', auth, (req, res) => {
  const abs = safePath(req.query.path);
  if (!abs) return res.status(400).json({ error: 'Invalid path' });
  try {
    const content = fs.readFileSync(abs, 'utf8');
    res.type('text/plain').send(content);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/file', auth, (req, res) => {
  const abs = safePath(req.query.path);
  if (!abs) return res.status(400).json({ error: 'Invalid path' });
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, req.body, 'utf8');
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/mkdir', auth, (req, res) => {
  const abs = safePath(req.body.path);
  if (!abs) return res.status(400).json({ error: 'Invalid path' });
  try {
    fs.mkdirSync(abs, { recursive: true });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/raw', auth, (req, res) => {
  const abs = safePath(req.query.path);
  if (!abs) return res.status(400).json({ error: 'Invalid path' });
  try {
    const ext = path.extname(abs).toLowerCase().slice(1);
    const mimeMap = {
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
      bmp: 'image/bmp', ico: 'image/x-icon',
    };
    const mime = mimeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    fs.createReadStream(abs).pipe(res);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.delete('/api/file', auth, (req, res) => {
  const abs = safePath(req.query.path);
  if (!abs) return res.status(400).json({ error: 'Invalid path' });
  try {
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      fs.rmSync(abs, { recursive: true });
    } else {
      fs.unlinkSync(abs);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/rename', auth, (req, res) => {
  const fromAbs = safePath(req.body.from);
  const toAbs = safePath(req.body.to);
  if (!fromAbs || !toAbs) return res.status(400).json({ error: 'Invalid path' });
  try {
    fs.mkdirSync(path.dirname(toAbs), { recursive: true });
    fs.renameSync(fromAbs, toAbs);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

app.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n🐉 Workspace Editor running!`);
  console.log(`   Local:   http://localhost:${PORT}?token=${TOKEN}`);
  console.log(`   Network: http://${ip}:${PORT}?token=${TOKEN}`);
  console.log(`   Token:   ${TOKEN}`);
  console.log(`   Roots:   ${JSON.stringify(ROOTS)}\n`);
});
