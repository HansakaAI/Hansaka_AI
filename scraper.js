// techlogiclk.com scraper -> PDF -> Telegram upload
const axios = require("axios");
const cheerio = require("cheerio");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");
const fs = require("fs");

const BASE = "https://techlogiclk.com";
const BOT_TOKEN = process.env.BOT_TOKEN || "YOUR_BOT_TOKEN";
const CHAT_ID = process.env.CHAT_ID || "YOUR_CHAT_ID";
const PDF_FILE = "techlogiclk.pdf";

const HEADERS = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" };

const startUrls = [
  BASE + "/",
  BASE + "/sft-science-for-technology/",
  BASE + "/e-tech-a-l-engineering-technology/",
  BASE + "/bst-bio-system-technology/",
  BASE + "/al-ict/",
  BASE + "/technology-past-papers/",
  BASE + "/download-center/",
  BASE + "/blog/",
];

function sameSite(u) {
  try { return new URL(u).hostname.endsWith("techlogiclk.com"); } catch { return false; }
}

async function scrape() {
  const visited = new Set();
  const queue = [...startUrls];
  const pages = [];

  while (queue.length && visited.size < 80) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    try {
      const { data: html } = await axios.get(url, { headers: HEADERS, timeout: 30000 });
      const $ = cheerio.load(html);
      const content = $("main").length ? $("main") : ($("article").length ? $("article") : $("body"));
      pages.push({ url, text: content.text().replace(/\n{2,}/g, "\n").trim() });
      console.log(`[${visited.size}] ${url}`);
      $("a[href]").each((_, a) => {
        const link = new URL($(a).attr("href"), url).toString().split("#")[0];
        if (sameSite(link) && !visited.has(link)) queue.push(link);
      });
    } catch (e) { console.log("ERR", url, e.message); }
  }
  return pages;
}

async function makePdf(pages) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595, 842]);
  let y = 790;
  const draw = (t, f = font, size = 9) => {
    if (y < 50) { page = pdf.addPage([595, 842]); y = 790; }
    page.drawText(t, { x: 50, y, size, font: f, color: rgb(0, 0, 0), maxWidth: 495 });
    y -= size + 3;
  };
  draw("techlogiclk.com - Full Site Scrap", bold, 18); y -= 20;
  for (const p of pages) {
    draw("URL: " + p.url, bold, 9);
    for (const line of p.text.split("\n")) {
      // rough wrap ~95 chars
      for (let i = 0; i < line.length; i += 95) draw(line.slice(i, i + 95));
      if (line === "") y -= 4;
    }
    y -= 12;
  }
  fs.writeFileSync(PDF_FILE, await pdf.save());
  console.log("PDF ready:", PDF_FILE);
}

async function uploadTelegram() {
  const FormData = require("form-data");
  const form = new FormData();
  form.append("chat_id", CHAT_ID);
  form.append("document", fs.createReadStream(PDF_FILE));
  const res = await axios.post(
    `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, form,
    { headers: form.getHeaders(), maxBodyLength: Infinity }
  );
  console.log("Telegram:", res.data.ok ? "OK - uploaded" : JSON.stringify(res.data));
}

(async () => {
  const pages = await scrape();
  await makePdf(pages);
  await uploadTelegram();
})();
