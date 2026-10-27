'use strict';

const express  = require('express');
const session  = require('express-session');
const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');
const crypto   = require('crypto');

const PORT       = parseInt(process.env.PORT || '3000', 10);
const START_TIME = Date.now();

const db = new Database(':memory:');

db.exec(`
  CREATE TABLE users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT    UNIQUE NOT NULL,
    password TEXT    NOT NULL
  )
`);

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

class MemStore extends session.Store {
  constructor() { super(); this._s = new Map(); }
  get(sid, cb)       { cb(null, this._s.get(sid) ?? null); }
  set(sid, sess, cb) { this._s.set(sid, sess); cb(null); }
  destroy(sid, cb)   { this._s.delete(sid); cb(null); }
}

app.use(session({
  store:             new MemStore(),
  secret:            crypto.randomBytes(32).toString('hex'),
  resave:            false,
  saveUninitialized: false,
  cookie:            { httpOnly: true, sameSite: 'lax' },
}));

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

function safeRender(res, view, locals, status = 200) {
  try {
    res.status(status).render(view, locals);
  } catch {
    res.status(status === 200 ? 500 : status).send('An error occurred.');
  }
}

app.get('/', (req, res) => res.redirect('/gallery'));

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/gallery');
  safeRender(res, 'login', { error: null });
});

app.post('/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return safeRender(res, 'login', { error: 'Username and password are required.' });
    }
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?').get(username, password);
    if (!user) {
      return safeRender(res, 'login', { error: 'Invalid username or password.' });
    }
    req.session.userId   = user.id;
    req.session.username = user.username;
    res.redirect('/gallery');
  } catch {
    safeRender(res, 'error', { msg: 'Internal server error.' }, 500);
  }
});

app.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/gallery');
  safeRender(res, 'register', { error: null });
});

app.post('/register', (req, res) => {
  try {
    const { username, password, password2 } = req.body;
    if (!username || !password || !password2) {
      return safeRender(res, 'register', { error: 'All fields are required.' });
    }
    if (username.length < 3 || username.length > 32) {
      return safeRender(res, 'register', { error: 'Username must be 3–32 characters.' });
    }
    if (password !== password2) {
      return safeRender(res, 'register', { error: 'Passwords do not match.' });
    }
    if (password.length < 6) {
      return safeRender(res, 'register', { error: 'Password must be at least 6 characters.' });
    }
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return safeRender(res, 'register', { error: 'Username already taken.' });
    }
    db.prepare('INSERT INTO users (username, password) VALUES (?, ?)').run(username, password);
    res.redirect('/login');
  } catch {
    safeRender(res, 'error', { msg: 'Internal server error.' }, 500);
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/gallery', requireAuth, (req, res) => {
  safeRender(res, 'gallery', {
    username: req.session.username,
    images:   ['1.jpg','2.jpg','3.jpg','4.jpg','5.jpg','6.jpg','7.jpg','8.jpg'],
  });
});

app.get('/image', requireAuth, (req, res) => {
  const { file } = req.query;
  if (!file) return res.status(400).json({ error: 'Missing file parameter.' });

  if (file.length > 12) {
    return res.status(403).json({ error: 'Filename too long.' });
  }

  const target = path.resolve(__dirname, 'images', file);

  res.sendFile(target, err => {
    if (err && !res.headersSent) {
      res.status(404).json({ error: 'Image not found.' });
    }
  });
});

app.post('/health', requireAuth, async (req, res) => {
  const fds = [];
  try {
    const files = fs.readdirSync(__dirname);
    let totalBytes = 0;

    for (const file of files) {
      try {
        const fd  = fs.openSync(path.join(__dirname, file), 'r');
        const buf = Buffer.alloc(65536);
        let bytes = 0, chunk;
        while ((chunk = fs.readSync(fd, buf, 0, buf.length, bytes)) > 0) bytes += chunk;
        totalBytes += bytes;
        fds.push(fd);
      } catch {}
    }

    await new Promise(r => setTimeout(r, 800));

    let size, unit;
    if      (totalBytes >= 1_073_741_824) { size = (totalBytes / 1_073_741_824).toFixed(2); unit = 'GB'; }
    else if (totalBytes >= 1_048_576)     { size = (totalBytes / 1_048_576).toFixed(2);     unit = 'MB'; }
    else if (totalBytes >= 1024)          { size = (totalBytes / 1024).toFixed(2);           unit = 'KB'; }
    else                                  { size = String(totalBytes);                        unit = 'B';  }

    const uptimeSec = Math.floor((Date.now() - START_TIME) / 1000);
    const h = Math.floor(uptimeSec / 3600);
    const m = Math.floor((uptimeSec % 3600) / 60);
    const s = uptimeSec % 60;
    const uptime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    if (!res.headersSent) {
      res.json({ status: 'healthy', uptime, storage: `${size} ${unit}`, checked: new Date().toISOString() });
    }
  } catch {
    if (!res.headersSent) res.status(500).json({ status: 'error' });
  } finally {
    for (const fd of fds) { try { fs.closeSync(fd); } catch {} }
  }
});

app.use((req, res) => {
  safeRender(res, 'error', { msg: 'Page not found.' }, 404);
});

app.use((err, req, res, _next) => {
  if (!res.headersSent) {
    safeRender(res, 'error', { msg: 'Internal server error.' }, 500);
  }
});

app.listen(PORT, () => {
  console.log(`Kartoules listening on port ${PORT}`);
});
