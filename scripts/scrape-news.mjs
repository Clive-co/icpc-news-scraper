import fs from "fs/promises";
import * as cheerio from "cheerio";

//scrape news from ICPC website and save to data/news.json

const SITE = "https://icpc.gov.ng";
const OUTPUT_PATH = "data/news.json";
const MAX_ITEMS = 6;
const UA = "ICPC-App-NewsBot/1.0 (+contact: youremail@example.com)";

async function fetchFromRestApi() {
  const url = `${SITE}/wp-json/wp/v2/posts?per_page=${MAX_ITEMS}&_embed`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`REST API responded ${res.status}`);
  const posts = await res.json();
  return posts.map((p) => ({
    title: decodeEntities(p.title.rendered),
    link: p.link,
    date: p.date,
    image: p._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
  }));
}

async function fetchFromHtml() {
  const res = await fetch(`${SITE}/news/`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`News page responded ${res.status}`);
  const $ = cheerio.load(await res.text());
  const items = [];
  $("h3 a").each((_, el) => {
    if (items.length >= MAX_ITEMS) return;
    const title = $(el).text().trim();
    const link = $(el).attr("href");
    if (!title || !link) return;
    const img = $(el).closest("article, div").find("img").first().attr("src") || null;
    items.push({ title, link, date: null, image: img });
  });
  return items;
}

function decodeEntities(str) {
  return str
    .replace(/&#8217;/g, "’").replace(/&#8216;/g, "‘")
    .replace(/&#8220;/g, "“").replace(/&#8221;/g, "”")
    .replace(/&#8211;/g, "–").replace(/&amp;/g, "&");
}

async function main() {
  let items;
  try {
    items = await fetchFromRestApi();
    console.log(`Fetched ${items.length} posts from REST API`);
  } catch (err) {
    console.warn(`REST API failed (${err.message}) — falling back to HTML scrape`);
    items = await fetchFromHtml();
  }
  if (!items.length) throw new Error("No news items found — site structure may have changed");

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify({ updatedAt: new Date().toISOString(), items }, null, 2)
  );
  console.log(`Wrote ${items.length} items to ${OUTPUT_PATH}`);
}

main().catch((err) => { console.error(err); process.exit(1); });