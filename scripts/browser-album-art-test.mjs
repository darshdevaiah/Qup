import { chromium } from "playwright";

const roomId = process.argv[2] ?? "friday-night";
const url = `http://localhost:3000/room/${roomId}`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const logs = [];

page.on("console", (msg) => {
  if (msg.text().includes("[Qup AlbumArt DIAG]")) {
    logs.push(msg.text());
  }
});

const failedRequests = [];
page.on("requestfailed", (req) => {
  if (req.url().includes("i.scdn.co")) {
    failedRequests.push({ url: req.url(), error: req.failure()?.errorText });
  }
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
await page.waitForTimeout(5000);

// Open Add Song modal to inspect Discover section artwork.
const addBtn = page.getByRole("button", { name: /add song/i }).first();
if (await addBtn.count()) {
  await addBtn.click();
  await page.waitForTimeout(2000);
}

const imgs = await page.evaluate(() =>
  Array.from(document.querySelectorAll('img[alt="album"]')).map((img) => ({
    src: img.getAttribute("src"),
    complete: img.complete,
    naturalWidth: img.naturalWidth,
    naturalHeight: img.naturalHeight,
  })),
);

console.log(`\n=== Room ${roomId} (${url}) ===`);
console.log("\nimg[alt=album] elements:", JSON.stringify(imgs, null, 2));
console.log("\nFailed i.scdn.co requests:", JSON.stringify(failedRequests, null, 2));
console.log("\nDIAG console logs (first 5):");
logs.slice(0, 5).forEach((l) => console.log(l));

await browser.close();
