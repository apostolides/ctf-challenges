import { Router } from "express";
import checkAuth from "../security/checkAuth.js";
import {visitPage, launchBrowser} from "../bot/bot.js";
import { execSync } from "child_process";
import os from "os";

export async function systemStatus(req, res) {
  try {
    const envVars = process.env;

    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    let disk = {};
    try {
      const df = execSync("df -h /").toString();
      disk = { df };
    } catch {
      disk = { error: "Disk check failed, df not available" };
    }

    const osInfo = {
      platform: os.platform(),
      release: os.release(),
      cpu: os.cpus()[0]?.model,
      cores: os.cpus().length,
      uptimeSeconds: os.uptime(),
      loadavg: os.loadavg(),
      hostname: os.hostname(),
    };

    return res.json({
      user: res.locals.userInfo,
      env: envVars,
      ram: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
      },
      disk,
      os: osInfo,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

const router = Router();

router.get("/app-info", (req, res) => {
  const clientIP = req.ip || req.connection.remoteAddress;

  if (clientIP !== '127.0.0.1' && clientIP !== '::1' && clientIP !== '::ffff:127.0.0.1') {
    console.log(`[!] Forbidden access from ${clientIP}`)
    return res.status(403).json({message: 'Forbidden: Invalid IP'});
  }

  return systemStatus(req, res);
});

router.use(checkAuth);

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

router.post("/report", async (req, res) => {
    let { url } = req.body;

    if (!url || typeof url !== "string") {
        return res.status(400).json({ message: "URL is required." });
    }

    url = url.toLowerCase();

    if (
        !url.startsWith("http://") &&
        !url.startsWith("https://")
    ) {
        return res.status(400).json({
            message: "URL must start with http:// or https://."
        });
    }
    
    try {
        let browser = await launchBrowser();
        const page = await browser.newPage();
        await visitPage(page, url);
        console.log(`[+] Bot is visiting ${url}...`);
        await wait(150000);
        console.log(`[+] Bot finished visiting ${url}`);
        await page.close();
        await browser.close();

    } catch (err) {
        console.error(err);
        if (browser) await browser.close();
        return res.status(500).json({ message: "Bot visit failed."});
    }

    return res.json({
        message: "Note reported."
    });
});

export default router;
