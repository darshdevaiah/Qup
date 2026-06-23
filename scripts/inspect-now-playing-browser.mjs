/**
 * Browser Now Playing inspection — run: node scripts/inspect-now-playing-browser.mjs [roomId]
 */
import { chromium } from "playwright";

const roomId = process.argv[2] ?? "friday-night";
const url = `http://localhost:3000/room/${roomId}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];

page.on("console", (msg) => {
  const text = msg.text();
  if (text.includes("[Qup AlbumArt DIAG]") || text.includes("[Qup NowPlaying DIAG]")) {
    logs.push(`[${msg.type()}] ${text}`);
  }
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(6000);

const nowPlayingImg = await page.evaluate(() => {
  const card = document.querySelector('[aria-label*="Now playing"]');
  const img = card?.querySelector('img[alt="album"]');
  if (!img) return { found: false };
  const style = window.getComputedStyle(img);
  return {
    found: true,
    src: img.getAttribute("src"),
    currentSrc: img.currentSrc,
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
    css: {
      width: style.width,
      height: style.height,
      opacity: style.opacity,
      display: style.display,
      visibility: style.visibility,
      objectFit: style.objectFit,
      filter: style.filter,
    },
    referrerPolicy: img.referrerPolicy,
    onerrorAttr: img.getAttribute("onerror"),
    className: img.className,
    inlineStyle: img.getAttribute("style"),
  };
});

console.log(`\n=== Now Playing browser inspection: /room/${roomId} ===\n`);
console.log("img element:", JSON.stringify(nowPlayingImg, null, 2));
console.log("\nConsole logs:");
logs.forEach((l) => console.log(l));

await browser.close();
