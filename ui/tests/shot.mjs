import { chromium } from "playwright";
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: process.env.HOME + "/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell" });
for (const [w, h] of [[1440, 900], [390, 844]]) { const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto(url, { waitUntil: "networkidle" }).catch(() => {}); await p.waitForSelector(".blotter .tbl tbody tr td .chip", { timeout: 45000 }).catch(() => {}); await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}-${w}.png` }); await p.screenshot({ path: `${out}-${w}-full.png`, fullPage: true }); }
await b.close();
