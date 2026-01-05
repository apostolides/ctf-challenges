import puppeteer from "puppeteer";

export async function launchBrowser() {
  return await puppeteer.launch({
    headless: true,
    product: "firefox",
    browser: "firefox",
    executablePath: "/usr/bin/firefox",
    ignoreHTTPSErrors: true,
    args: [
      "--no-sandbox",
      "--ignore-certificate-errors",
    ],
  });
}

export async function visitPage(page, url) {
  try {
    console.log(`[visitPage] Visiting: ${url}`);

    page.setDefaultNavigationTimeout(150000);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 150000 });
  } catch (err) {
    console.warn(`[visitPage] Failed to navigate to ${url}:`, err.message);
  }
}
