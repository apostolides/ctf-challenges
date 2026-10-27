'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DATA_DIR = '/app/data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'forum.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    sub         TEXT PRIMARY KEY,
    username    TEXT NOT NULL UNIQUE,
    email       TEXT,
    display_name TEXT,
    about       TEXT NOT NULL DEFAULT '',
    avatar      TEXT NOT NULL DEFAULT '',
    created_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS threads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    body            TEXT NOT NULL,
    author_sub      TEXT NOT NULL,
    author_username TEXT NOT NULL,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS comments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id       INTEGER NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    body            TEXT NOT NULL,
    author_sub      TEXT NOT NULL,
    author_username TEXT NOT NULL,
    created_at      INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE INDEX IF NOT EXISTS idx_threads_created ON threads(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);
`);

const _seedCount = db.prepare('SELECT COUNT(*) as c FROM threads').get();
if (_seedCount.c === 0) {
  db.prepare(
    'INSERT OR IGNORE INTO users (sub, username, email, display_name, about) VALUES (?, ?, ?, ?, ?)'
  ).run('locktalk-seed', 'locktalk', 'locktalk@locktalk.internal', 'LockTalk', '');

  const _st = db.prepare(
    'INSERT INTO threads (title, body, author_sub, author_username, created_at) VALUES (?, ?, ?, ?, ?)'
  );

  const _now = Math.floor(Date.now() / 1000);

  const _seed = [
    [
      'Master Lock No.3 vs No.5 - Which Should You Train On?',
      `If you're just getting into lock sport, one of the first questions you'll face is which practice lock to start with. The No.3 and No.5 are both classics, but they serve different purposes.

The No.3 is a 4-pin padlock with very loose tolerances - you'll feel pins set easily and get feedback fast. Perfect for absolute beginners learning to use a tension wrench and hook pick.

The No.5 steps it up with 5 pins and tighter tolerances. The keyway is also more restrictive. You'll need a smaller hook or a city pick to navigate it comfortably.

My recommendation: start with the No.3, spend a week opening it consistently, then move to the No.5. Once you can open a No.5 in under a minute, you're ready for deadbolts.

What did you start with?`,
      _now - 86400 * 7,
    ],
    [
      "Single Pin Picking (SPP) - A Step-by-Step Guide for Beginners",
      `Single pin picking is the gold standard technique for lock sport. Unlike raking, SPP requires you to set each pin individually, giving you full control and a real understanding of the lock mechanism.

What you need:
- A tension wrench (bottom-of-keyway or top-of-keyway, your preference)
- A hook pick (Hook 4 or Hook 1 for most standard pin tumblers)

The process:
1. Insert the tension wrench and apply very light rotational pressure.
2. Insert your hook and probe each pin stack. Tension will cause one pin to bind against the shear line - this is your binding pin.
3. Gently lift the binding pin until you feel a slight click as the driver pin sets at the shear line.
4. Find the next binding pin and repeat.
5. When all pins are set, the plug rotates.

Common mistakes:
- Too much tension (pins can't move freely)
- Too little tension (set pins fall back)
- Moving to the next pin too quickly

Patience is everything. Start slow and let the lock tell you what it needs.`,
      _now - 86400 * 6,
    ],
    [
      'Picked My First High-Security Lock - Medeco Biaxial',
      `After about 6 months in the hobby, I finally got into a Medeco Biaxial deadbolt I picked up at a surplus store.

For those unfamiliar: Medeco locks use rotating pins in addition to the standard up/down pin stack. Each key cut has a specific rotation angle (left, right, or middle), and both the height AND rotation must be correct for the plug to turn. SPP requires setting both the vertical position AND the rotation of each driver pin.

My setup: Peterson Gem with light tension, bottom-of-keyway.

Total attempts before first open: around 140 over 3 sessions. The third session something clicked mentally and I started feeling the pin rotation. Once you feel it, you can't unfeel it.

Medeco is genuinely a different skill tier. Make sure you're comfortable with Schlage C-keyway and Kwikset before attempting one.

Happy to answer questions about technique.`,
      _now - 86400 * 5,
    ],
    [
      'Tool Talk: Peterson Hook 4 vs Hook 8 - Daily Driver Comparison',
      `Been using both picks for the past year. Here's a fair comparison:

Peterson Hook 4 (0.025" gauge):
The classic. Works on 95% of standard residential locks. Thin enough to navigate tight keyways like Kwikset, sturdy enough to transmit pin feedback clearly. This is the pick I reach for first.

Peterson Hook 8 (0.025" gauge):
Also called the "City Pick" by some. The longer tip with more aggressive curve is great for locks with deep pin stacks or awkward keyways. I use this for mortise cylinders and older European locks.

For most people starting out, just get the Hook 4 (or Hook 1 if you prefer shorter reach). You don't need the full set to be effective.

The 0.025" gauge handles virtually all European and North American cylinders. Only go thinner (0.018") for wafer locks or very tight keyways.

Drop your pick preferences below.`,
      _now - 86400 * 4,
    ],
    [
      'Understanding ANSI/BHMA Lock Grades - What Do They Actually Mean?',
      `The ANSI/BHMA grading system (Grades 1, 2, 3) is one of the most misunderstood rating systems in residential security.

Grade 3 - Light duty residential. Typically builder-grade deadbolts in the $20–40 range. Tested to 250,000 cycles. Minimal security; most can be bumped, picked, or bypassed with basic tools.

Grade 2 - Medium duty residential/light commercial. 500,000 cycle rating. Better pick resistance, often includes hardened steel inserts against drilling. Schlage B-series and similar fall here.

Grade 1 - Heavy duty commercial. Significantly higher attack resistance requirements. Devices must withstand 10 strikes of 75 ft-lbs. This is what you want on an exterior door.

What ANSI does NOT test:
Pick resistance, bump resistance, and drill resistance are not part of the ANSI standard. A Grade 1 lock can still be picked easily. For those properties, look at UL 437 (pick and drill resistant) ratings.

Bottom line: ANSI grade tells you about durability under normal use, not security under attack.`,
      _now - 86400 * 3,
    ],
    [
      'Schlage B60N vs Kwikset 980 - Which Is the Better Upgrade?',
      `Both are common upgrade recommendations for homeowners stepping away from builder-grade hardware.

Kwikset 980:
- SmartKey re-keying (re-key in seconds, no locksmith)
- ANSI Grade 1 certified
- BumpGuard protection
- Weakness: SmartKey mechanism can be bypassed with a blank key and tension if not properly maintained
- Price: ~$45–60

Schlage B60N:
- Traditional cylinder (re-key requires disassembly or a locksmith)
- ANSI Grade 1 certified
- Hardened steel insert protects against bolt sawing
- Higher overall build quality
- Price: ~$55–75

My take: For pure security, the Schlage B60N wins. The traditional cylinder is harder to bypass than SmartKey, and the build quality is consistently better.

For convenience - especially rentals where you need to re-key frequently - the Kwikset 980 makes sense, just be aware of its limitations.

Either way, both are massive upgrades over a typical builder-grade lock.`,
      _now - 86400 * 2,
    ],
    [
      'Disc Detainer Picking - Is It Harder Than Pin Tumbler?',
      `Short answer: yes, for most people coming from pin tumbler.

Disc detainer locks (common in Abloy, certain Abus, and some Assa Abloy products) work completely differently. Instead of spring-loaded pin stacks, they use rotating discs that must all align to a specific rotational position for the lock to open.

Key differences:

1. No spring feedback - You can't feel the binding disc set the same way you feel a pin set. The feedback is rotational, not linear.

2. Specialized tooling required - You need a purpose-built disc detainer pick (Multipick Elite or similar). Standard hook picks won't work.

3. Manual rotation - You individually rotate each disc to its true gate position while maintaining tension.

The learning curve is steep. Many experienced pickers find their first disc detainer pick takes weeks of attempts.

Abloy Protec2 is considered the gold standard and is notoriously difficult even for experts - the hardened discs and anti-rotation mechanism make it one of the best-secured cylinders available.

Anyone here tackled disc detainers?`,
      _now - 86400,
    ],
  ];

  for (const [title, body, ts] of _seed) {
    _st.run(title, body, 'locktalk-seed', 'locktalk', ts);
  }
}

const upsertUser = db.prepare(`
  INSERT INTO users (sub, username, email, display_name)
  VALUES (@sub, @username, @email, @display_name)
  ON CONFLICT(sub) DO UPDATE SET
    username     = excluded.username,
    email        = excluded.email,
    display_name = excluded.display_name
`);

try { db.exec('ALTER TABLE users ADD COLUMN avatar TEXT NOT NULL DEFAULT ""'); } catch {}

const updateAbout = db.prepare(`
  UPDATE users SET about = @about WHERE sub = @sub
`);

const updateAvatar = db.prepare(`
  UPDATE users SET avatar = @avatar WHERE sub = @sub
`);

const getUserBySub      = db.prepare(`SELECT * FROM users WHERE sub = ?`);
const getUserByUsername = db.prepare(`SELECT * FROM users WHERE username = ?`);

const listThreads = db.prepare(`
  SELECT t.*, (SELECT COUNT(*) FROM comments c WHERE c.thread_id = t.id) AS comment_count
  FROM threads t
  ORDER BY t.created_at DESC
  LIMIT 50
`);

const getThread = db.prepare(`
  SELECT t.*, (SELECT COUNT(*) FROM comments c WHERE c.thread_id = t.id) AS comment_count
  FROM threads t
  WHERE t.id = ?
`);

const getThreadsByUser = db.prepare(`
  SELECT id, title, created_at,
    (SELECT COUNT(*) FROM comments c WHERE c.thread_id = threads.id) AS comment_count
  FROM threads
  WHERE author_sub = ?
  ORDER BY created_at DESC
  LIMIT 20
`);

const insertThread = db.prepare(`
  INSERT INTO threads (title, body, author_sub, author_username)
  VALUES (@title, @body, @author_sub, @author_username)
`);

const deleteThread = db.prepare(`
  DELETE FROM threads WHERE id = ? AND author_sub = ?
`);

const getComments = db.prepare(`
  SELECT * FROM comments WHERE thread_id = ? ORDER BY created_at ASC
`);

const insertComment = db.prepare(`
  INSERT INTO comments (thread_id, body, author_sub, author_username)
  VALUES (@thread_id, @body, @author_sub, @author_username)
`);

const deleteComment = db.prepare(`
  DELETE FROM comments WHERE id = ? AND author_sub = ?
`);

module.exports = {
  upsertUser,
  updateAbout,
  updateAvatar,
  getUserBySub,
  getUserByUsername,
  listThreads,
  getThread,
  getThreadsByUser,
  insertThread,
  deleteThread,
  getComments,
  insertComment,
  deleteComment,
};
