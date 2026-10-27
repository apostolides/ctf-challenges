'use strict';

const puppeteer = require('puppeteer-core');

const CHROMIUM = '/usr/bin/google-chrome-stable';
const APP_BASE = 'http://127.0.0.1:3000';

const XSS_TIMEOUT_MS = 15000;

class AdminBot {
  constructor(config, botToken) {
    this.config   = config;
    this.botToken = botToken;
    this.queue = [];
    this.processing = false;

    this.rateLimits = new Map();
  }

  checkRateLimit(sub) {
    const now = Date.now();
    const WINDOW_MS = 5 * 60 * 1000;
    const MAX_REPORTS = 3;

    const entry = this.rateLimits.get(sub) || { count: 0, windowStart: now };
    if (now - entry.windowStart > WINDOW_MS) {
      entry.count = 0;
      entry.windowStart = now;
    }
    if (entry.count >= MAX_REPORTS) {
      const remaining = Math.ceil((WINDOW_MS - (now - entry.windowStart)) / 1000);
      return `Too many reports. Try again in ${remaining}s.`;
    }
    entry.count++;
    this.rateLimits.set(sub, entry);
    return null;
  }

  enqueue(threadId) {
    this.queue.push(threadId);
    if (!this.processing) this._drain();
  }

  async _drain() {
    this.processing = true;
    while (this.queue.length > 0) {
      const threadId = this.queue.shift();
      try {
        await this._visit(threadId);
      } catch (err) {
        console.error(`[bot] visit failed for thread ${threadId}:`, err.message);
      }
      await new Promise(r => setTimeout(r, 2000));
    }
    this.processing = false;
  }

  async _visit(threadId) {
    console.log(`[bot] Starting visit for thread ${threadId}`);

    const browser = await puppeteer.launch({
      executablePath: CHROMIUM,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-first-run',
        '--disable-extensions',
        '--host-resolver-rules=MAP * 0.0.0.0, EXCLUDE localhost, EXCLUDE 127.0.0.1',
        '--proxy-server=socks5://127.0.0.1:1',
        '--proxy-bypass-list=localhost,127.0.0.1',
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setDefaultNavigationTimeout(30000);

      page.on('console', msg => console.log(`[bot-js] ${msg.type()}: ${msg.text()}`));
      page.on('response', resp => {
        const url = resp.url();
        if (url.includes('/api/') || url.includes('/submit') || url.includes('/bot-auth'))
          console.log(`[bot-net] ${resp.status()} ${resp.url()}`);
      });

      await page.goto(`${APP_BASE}/api/bot-auth/${this.botToken}`, { waitUntil: 'load' });

      console.log(`[bot] Bot-auth response: ${page.url()}`);
      const authBody = await page.evaluate(() => document.body.innerText).catch(() => '');
      console.log(`[bot] Bot-auth body: ${authBody.slice(0, 80)}`);

      const cookies = await page.cookies();
      console.log(`[bot] Cookies: ${cookies.map(c => c.name).join(', ') || '(none)'}`);

      await page.goto(`${APP_BASE}/t/${threadId}`, { waitUntil: 'networkidle2' });
      console.log(`[bot] Thread page: ${page.url()}`);

      const profileHref = await page.$eval(
        '.post-author',
        el => el.getAttribute('href'),
      ).catch(() => null);

      if (!profileHref) {
        console.error('[bot] Could not find .post-author link on thread page.');
        const snippet = await page.evaluate(() => document.body.innerHTML.slice(0, 300));
        console.error('[bot] Page HTML snippet:', snippet);
        return;
      }

      await page.goto(`${APP_BASE}${profileHref}`, { waitUntil: 'load' });

      console.log(`[bot] Visiting profile: ${profileHref}`);

      await new Promise(r => setTimeout(r, XSS_TIMEOUT_MS));

      console.log(`[bot] Visit complete for thread ${threadId}`);
    } finally {
      await browser.close();
    }
  }
}

module.exports = AdminBot;
