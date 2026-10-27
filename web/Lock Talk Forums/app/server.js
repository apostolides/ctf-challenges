'use strict';

const crypto  = require('crypto');
const dns     = require('dns');
const net     = require('net');
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const AdminBot = require('./bot');

const app = express();
const PORT = process.env.APP_PORT || 3000;

const config    = JSON.parse(fs.readFileSync('/app/config.json', 'utf8'));
const BOT_TOKEN = crypto.randomBytes(32).toString('hex');
const bot       = new AdminBot(config, BOT_TOKEN);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false, httpOnly: true, maxAge: 3600000 },
}));

const KC   = config.keycloakUrl;
const REALM = config.realm;

async function kcAdminToken() {
  const res = await axios.post(
    `${KC}/realms/master/protocol/openid-connect/token`,
    new URLSearchParams({
      grant_type: 'password',
      client_id:  'admin-cli',
      username:   'kc-admin',
      password:   config.kcAdminPassword,
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return res.data.access_token;
}

async function kcCreateUser(adminToken, username, email, password) {
  return axios.post(
    `${KC}/admin/realms/${REALM}/users`,
    { username, email, enabled: true, emailVerified: true,
      credentials: [{ type: 'password', value: password, temporary: false }] },
    { headers: { Authorization: `Bearer ${adminToken}` }, validateStatus: () => true },
  );
}

async function kcPasswordGrant(username, password) {
  const res = await axios.post(
    `${KC}/realms/${REALM}/protocol/openid-connect/token`,
    new URLSearchParams({
      grant_type:    'password',
      client_id:     config.clientId,
      client_secret: config.clientSecret,
      username,
      password,
      scope: 'openid email profile',
    }).toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return res.data;
}

async function kcUserInfo(accessToken) {
  const res = await axios.get(
    `${KC}/realms/${REALM}/protocol/openid-connect/userinfo`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return res.data;
}

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.username !== config.adminUsername) {
    return res.status(403).json({ error: 'Forbidden.' });
  }
  next();
}

function timeAgo(unixSeconds) {
  const diff = Math.floor(Date.now() / 1000) - unixSeconds;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

app.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('login', { error: null });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password)
    return res.render('login', { error: 'Username and password are required.' });
  try {
    const tokenData = await kcPasswordGrant(String(username), String(password));
    const info = await kcUserInfo(tokenData.access_token);
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.user = {
      sub:      info.sub,
      username: info.preferred_username,
      email:    info.email,
      name:     info.name,
    };
    req.session.accessToken = tokenData.access_token;
    db.upsertUser.run({
      sub:          info.sub,
      username:     info.preferred_username,
      email:        info.email || '',
      display_name: info.name || info.preferred_username,
    });
    res.redirect('/');
  } catch {
    res.render('login', { error: 'Invalid username or password.' });
  }
});

app.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('register', { error: null });
});

app.post('/register', async (req, res) => {
  const { username, email, password, confirm } = req.body || {};
  if (!username || !email || !password || !confirm)
    return res.render('register', { error: 'All fields are required.' });
  if (password !== confirm)
    return res.render('register', { error: 'Passwords do not match.' });
  if (String(password).length < 8)
    return res.render('register', { error: 'Password must be at least 8 characters.' });

  try {
    const adminToken = await kcAdminToken();
    const createRes = await kcCreateUser(adminToken, String(username), String(email), String(password));

    if (createRes.status === 409)
      return res.render('register', { error: 'Username or email is already taken.' });
    if (createRes.status !== 201)
      return res.render('register', { error: 'Registration failed. Try again.' });

    const tokenData = await kcPasswordGrant(String(username), String(password));
    const info = await kcUserInfo(tokenData.access_token);
    await new Promise((resolve, reject) => req.session.regenerate(err => err ? reject(err) : resolve()));
    req.session.user = {
      sub:      info.sub,
      username: info.preferred_username,
      email:    info.email,
      name:     info.name,
    };
    req.session.accessToken = tokenData.access_token;
    db.upsertUser.run({
      sub:          info.sub,
      username:     info.preferred_username,
      email:        info.email || '',
      display_name: info.name || info.preferred_username,
    });
    res.redirect('/');
  } catch (err) {
    console.error('Registration error:', err.message);
    res.render('register', { error: 'Registration failed. Try again.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/', (req, res) => {
  const threads = db.listThreads.all().map(t => ({ ...t, age: timeAgo(t.created_at) }));
  res.render('home', { user: req.session.user || null, threads });
});

app.get('/submit', requireAuth, (req, res) => {
  res.render('thread-new', { user: req.session.user, error: null });
});

app.post('/submit', requireAuth, (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !title.trim())
    return res.render('thread-new', { user: req.session.user, error: 'Title is required.' });
  if (!body || !body.trim())
    return res.render('thread-new', { user: req.session.user, error: 'Post body is required.' });

  const result = db.insertThread.run({
    title:           title.trim().slice(0, 300),
    body:            body.trim().slice(0, 40000),
    author_sub:      req.session.user.sub,
    author_username: req.session.user.username,
  });

  res.redirect(`/t/${result.lastInsertRowid}`);
});

app.get('/t/:id', (req, res) => {
  const thread = db.getThread.get(req.params.id);
  if (!thread) return res.status(404).render('error', { user: req.session.user || null, message: 'Thread not found.' });

  const comments = db.getComments.all(thread.id).map(c => ({ ...c, age: timeAgo(c.created_at) }));
  thread.age = timeAgo(thread.created_at);
  res.render('thread', { user: req.session.user || null, thread, comments, error: null });
});

app.post('/t/:id/comment', requireAuth, (req, res) => {
  const thread = db.getThread.get(req.params.id);
  if (!thread) return res.status(404).render('error', { user: req.session.user, message: 'Thread not found.' });

  const { body } = req.body || {};
  if (!body || !body.trim()) {
    const comments = db.getComments.all(thread.id).map(c => ({ ...c, age: timeAgo(c.created_at) }));
    thread.age = timeAgo(thread.created_at);
    return res.render('thread', { user: req.session.user, thread, comments, error: 'Comment cannot be empty.' });
  }

  db.insertComment.run({
    thread_id:       thread.id,
    body:            body.trim().slice(0, 10000),
    author_sub:      req.session.user.sub,
    author_username: req.session.user.username,
  });

  res.redirect(`/t/${thread.id}`);
});

app.post('/t/:id/delete', requireAuth, (req, res) => {
  db.deleteThread.run(req.params.id, req.session.user.sub);
  res.redirect('/');
});

app.post('/c/:id/delete', requireAuth, (req, res) => {
  db.deleteComment.run(req.params.id, req.session.user.sub);
  let target = '/';
  try { target = new URL(req.get('Referer') || '/').pathname; } catch {}
  res.redirect(target || '/');
});

app.post('/report/thread/:id', requireAuth, (req, res) => {
  const thread = db.getThread.get(req.params.id);
  if (!thread) return res.status(404).json({ error: 'Thread not found.' });

  const rateLimitError = bot.checkRateLimit(req.session.user.sub);
  if (rateLimitError) return res.status(429).json({ error: rateLimitError });

  bot.enqueue(thread.id);
  res.json({ ok: true, message: 'Report submitted. An admin will review this thread shortly.' });
});

app.get('/u/:username', async (req, res) => {
  const profile = db.getUserByUsername.get(req.params.username);
  if (!profile) return res.status(404).render('error', { user: req.session.user || null, message: 'User not found.' });

  const threads = db.getThreadsByUser.all(profile.sub).map(t => ({ ...t, age: timeAgo(t.created_at) }));
  const isSelf = req.session.user && req.session.user.sub === profile.sub;

  if (isSelf && req.session.accessToken) {
    try {
      const accountRes = await axios.get(
        `${KC}/realms/${REALM}/account`,
        { headers: { Authorization: `Bearer ${req.session.accessToken}` }, timeout: 4000, validateStatus: () => true },
      );
      if (accountRes.status === 200) {
        const fresh = accountRes.data.attributes?.about?.[0] ?? '';
        db.updateAbout.run({ about: fresh, sub: profile.sub });
        profile.about = fresh;
      }
    } catch {}
  }

  res.render('profile', { user: req.session.user || null, profile, threads, isSelf });
});

function isPrivateIp(ip) {
  if (!net.isIPv4(ip)) return true;
  const p = ip.split('.').map(Number);
  return (
    p[0] === 127 ||
    p[0] === 10 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254) ||
    p[0] === 0
  );
}

async function validateAvatarUrl(urlStr) {
  let u;
  try { u = new URL(urlStr); } catch { return 'Invalid URL.'; }
  if (!['http:', 'https:'].includes(u.protocol)) return 'Only http and https URLs are supported.';
  try {
    const ip = net.isIP(u.hostname) ? u.hostname : (await dns.promises.lookup(u.hostname, { family: 4 })).address;
    if (isPrivateIp(ip)) return 'URL host could not be reached.';
  } catch {
    return 'URL host could not be reached.';
  }
  return null;
}

app.post('/api/settings/avatar/fetch', requireAuth, async (req, res) => {
  const { url, method, headers, body } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url is required.' });

  const urlError = await validateAvatarUrl(url);
  if (urlError) return res.status(400).json({ error: urlError });

  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];
  const httpMethod = allowedMethods.includes((method || 'GET').toUpperCase())
    ? (method || 'GET').toUpperCase() : 'GET';

  let parsedHeaders = {};
  if (headers) {
    try { parsedHeaders = JSON.parse(headers); }
    catch { return res.status(400).json({ error: 'headers must be valid JSON.' }); }
  }

  const SAFE_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);
  const AVATAR_MAX_BYTES = 200 * 1024;

  try {
    const response = await axios({
      method: httpMethod, url, headers: parsedHeaders,
      data: body || undefined, timeout: 8000,
      validateStatus: () => true, maxRedirects: 0,
      responseType: 'arraybuffer',
      maxContentLength: AVATAR_MAX_BYTES,
    });

    const ct = (response.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const raw = Buffer.from(response.data);

    let avatarSaved = false;
    if (SAFE_IMAGE_TYPES.has(ct) && response.status >= 200 && response.status < 300) {
      const dataUrl = `data:${ct};base64,${raw.toString('base64')}`;
      db.updateAvatar.run({ avatar: dataUrl, sub: req.session.user.sub });
      avatarSaved = true;
    }

    let bodyStr;
    try { bodyStr = JSON.stringify(JSON.parse(raw.toString('utf8')), null, 2); }
    catch { bodyStr = raw.toString('utf8').slice(0, 8192); }

    res.json({
      status:     response.status,
      statusText: response.statusText,
      avatarSaved,
      body:       bodyStr,
    });
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get('/api/bot-auth/:token', (req, res) => {
  if (req.params.token !== BOT_TOKEN) return res.status(403).end();
  req.session.user = {
    sub:      'bot-admin',
    username: config.adminUsername,
    email:    'admin@locktalk.internal',
    name:     'Lock Talk Forums Admin',
  };
  res.json({ ok: true });
});

app.get('/api/admin/flag', requireAdmin, (req, res) => {
  res.json({ flag: config.flag });
});

app.get('/api/me', requireAuth, (req, res) => {
  res.json({
    sub:              req.session.user.sub,
    username:         req.session.user.username,
    email:            req.session.user.email,
    access_token:     req.session.accessToken,
    realm:            config.realm,
    keycloak_issuer:  `${KC}/realms/${REALM}`,
  });
});

app.get('/settings', requireAuth, (req, res) => {
  res.render('settings', { user: req.session.user, error: null });
});

app.post('/settings/profile', requireAuth, (req, res) => {
  res.render('settings', {
    user: req.session.user,
    error: 'Profile fields are managed by your identity provider. Direct edits from this interface are not permitted.',
  });
});

app.get('/admin/panel', requireAdmin, (req, res) => {
  res.render('admin-panel', { user: req.session.user });
});

app.use((req, res) => res.status(404).render('error', { user: req.session.user || null, message: 'Page not found.' }));
app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).render('error', { user: req.session.user || null, message: 'Internal server error.' });
});

async function waitForKeycloak(retries = 30, delayMs = 5000) {
  for (let i = 0; i < retries; i++) {
    try {
      await axios.get(`${KC}/realms/${REALM}`, { timeout: 3000 });
      console.log('Keycloak is ready.');
      return;
    } catch {
      console.log(`Waiting for Keycloak (${i + 1}/${retries})…`);
      if (i < retries - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw new Error('Keycloak did not become ready in time.');
}

waitForKeycloak()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Lock Talk Forums listening on :${PORT}`)))
  .catch(err => { console.error('Startup failed:', err.message); process.exit(1); });
