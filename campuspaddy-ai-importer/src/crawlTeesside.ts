import "dotenv/config";
import * as cheerio from "cheerio";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { db } from "./db";

const UNIVERSITY_NAME = "Teesside University";
const UNIVERSITY_DOMAIN = "tees.ac.uk";

const START_URLS = [
  "https://www.tees.ac.uk/",
  "https://www.tees.ac.uk/sections/stud/index.cfm",
  "https://www.tees.ac.uk/sections/stud/support.cfm",
  "https://www.tees.ac.uk/sections/accommodation/index.cfm",
  "https://www.tees.ac.uk/docs/index.cfm?folder_id=57",
  "https://www.tees.ac.uk/sections/fulltime/index.cfm",
  "https://www.tees.ac.uk/sections/international/index.cfm",
  "https://www.tees.ac.uk/sections/studying/index.cfm",
  "https://www.tees.ac.uk/sections/teessidelife/index.cfm",
];

const SITEMAP_URLS = [
  "https://www.tees.ac.uk/sitemap.xml",
  "https://tees.ac.uk/sitemap.xml",
  "https://www.tees.ac.uk/sitemap_index.xml",
];

const ENABLE_SITEMAP_DISCOVERY = true;
const MAX_DEPTH = Number(process.env.MAX_DEPTH || 8);
const MAX_PAGES = Number(process.env.MAX_PAGES || 5000);
const REQUEST_DELAY_MS = Number(process.env.REQUEST_DELAY_MS || 1500);
const MAX_DOWNLOAD_BYTES = Number(process.env.MAX_DOWNLOAD_BYTES || 50 * 1024 * 1024);
const USER_AGENT = "CampusPaddyBot/0.1 educational student-support crawler; public tees.ac.uk pages only";

const DOCUMENT_EXTENSIONS = [".pdf", ".doc", ".docx"];
const IGNORED_FILE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico", ".css", ".js", ".mp4", ".mp3", ".avi", ".mov", ".wmv", ".zip", ".rar", ".7z", ".tar", ".gz", ".xml", ".rss"];
const BLOCKED_URL_PARTS = ["mailto:", "tel:", "javascript:", "/search", "/site-search", "/cgi-bin", "/login", "/logout", "/account", "/signin", "/sign-in", "/register", "/apply/login", "/portal", "/blackboard", "/mymail", "/e-vision", "/sits", "facebook.com", "twitter.com", "x.com", "instagram.com", "linkedin.com", "youtube.com", "tiktok.com", "cookies.cfm", "cookie", "privacy.cfm", "copyright.cfm", "modern_slavery", "accessibility_statement"];
const HIGH_PRIORITY_PARTS = ["/sections/stud/", "/sections/accommodation/", "/sections/fulltime/", "/sections/international/", "/sections/studying/", "/sections/teessidelife/", "/docs/", "/Docs/"];
const STUDENT_KEYWORDS = ["student", "students", "support", "advice", "accommodation", "library", "timetable", "timetabling", "calendar", "semester", "course", "courses", "fees", "funding", "finance", "money", "wellbeing", "mental", "health", "counselling", "disability", "international", "visa", "careers", "employability", "it", "password", "wifi", "regulations", "handbook", "assessment", "exams", "graduation", "campus", "life", "events", "contact"];

function sleep(ms: number) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function sha256(input: Buffer | string) { return crypto.createHash("sha256").update(input).digest("hex"); }
function getPathnameLower(url: string) { try { return new URL(url).pathname.toLowerCase(); } catch { return ""; } }
function isDocumentUrl(url: string) { const pathname = getPathnameLower(url); return DOCUMENT_EXTENSIONS.some((ext) => pathname.endsWith(ext)); }
function hasIgnoredFileExtension(url: string) { const pathname = getPathnameLower(url); return IGNORED_FILE_EXTENSIONS.some((ext) => pathname.endsWith(ext)); }
function isPriorityUrl(url: string) { const lower = url.toLowerCase(); return isDocumentUrl(url) || HIGH_PRIORITY_PARTS.some((part) => lower.includes(part.toLowerCase())) || STUDENT_KEYWORDS.some((keyword) => lower.includes(keyword)); }

function normalizeUrl(href: string, baseUrl: string): string | null {
  try {
    if (!href) return null;
    const raw = href.trim();
    const rawLower = raw.toLowerCase();
    if (BLOCKED_URL_PARTS.some((part) => rawLower.includes(part))) return null;
    const url = new URL(raw, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const hostname = url.hostname.toLowerCase();
    if (!(hostname === "tees.ac.uk" || hostname === "www.tees.ac.uk")) return null;
    url.protocol = "https:";
    url.hostname = "www.tees.ac.uk";
    url.hash = "";
    if (hasIgnoredFileExtension(url.toString())) return null;
    const fullUrlLower = url.toString().toLowerCase();
    if (BLOCKED_URL_PARTS.some((part) => fullUrlLower.includes(part))) return null;
    for (const param of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid", "mc_cid", "mc_eid"]) url.searchParams.delete(param);
    return url.toString();
  } catch { return null; }
}

function shouldDownloadUrl(url: string) { const lower = url.toLowerCase(); return !BLOCKED_URL_PARTS.some((part) => lower.includes(part)) && !hasIgnoredFileExtension(url); }
function getSourceType(url: string, contentType: string | null) {
  const pathname = new URL(url).pathname.toLowerCase();
  const type = contentType?.toLowerCase() || "";
  if (pathname.endsWith(".pdf") || type.includes("application/pdf")) return "pdf";
  if (pathname.endsWith(".docx")) return "docx";
  if (pathname.endsWith(".doc")) return "doc";
  if (type.includes("text/html") || pathname.endsWith(".cfm") || pathname.endsWith(".html") || pathname.endsWith(".htm") || pathname === "/" || pathname === "") return "html";
  return "other";
}
function getFileExtension(url: string, contentType: string | null) {
  const pathname = new URL(url).pathname.toLowerCase();
  const type = contentType?.toLowerCase() || "";
  if (pathname.endsWith(".pdf") || type.includes("application/pdf")) return ".pdf";
  if (pathname.endsWith(".docx")) return ".docx";
  if (pathname.endsWith(".doc")) return ".doc";
  if (type.includes("text/html") || pathname.endsWith(".cfm") || pathname.endsWith(".html") || pathname.endsWith(".htm") || pathname === "/" || pathname === "") return ".html";
  return ".bin";
}
function getStorageFolder(sourceType: string) { if (sourceType === "html") return "storage/raw-html"; if (sourceType === "pdf") return "storage/pdfs"; return "storage/other"; }
function extractTitle(html: string) { const $ = cheerio.load(html); return ($("title").first().text().trim() || $("h1").first().text().trim() || "Untitled page").replace(/\s+/g, " "); }
function extractLinks(html: string, baseUrl: string) { const $ = cheerio.load(html); const links = new Set<string>(); $("a[href]").each((_, element) => { const normalized = normalizeUrl($(element).attr("href") || "", baseUrl); if (normalized && shouldDownloadUrl(normalized)) links.add(normalized); }); return [...links]; }

async function getOrCreateUniversity() {
  const existing = await db.query(`SELECT id FROM universities WHERE domain = $1 LIMIT 1`, [UNIVERSITY_DOMAIN]);
  if (existing.rows[0]) return existing.rows[0].id as string;
  const created = await db.query(`INSERT INTO universities (name, domain) VALUES ($1, $2) RETURNING id`, [UNIVERSITY_NAME, UNIVERSITY_DOMAIN]);
  return created.rows[0].id as string;
}
async function insertCrawlUrl(params: { universityId: string; url: string; discoveredFrom?: string | null; depth: number; }) {
  if (!shouldDownloadUrl(params.url)) return;
  await db.query(`INSERT INTO crawl_urls (university_id, url, discovered_from, depth, status) VALUES ($1, $2, $3, $4, 'pending') ON CONFLICT (url) DO NOTHING`, [params.universityId, params.url, params.discoveredFrom ?? null, params.depth]);
}
async function markCrawlUrlStatus(params: { url: string; status: "done" | "failed" | "skipped"; contentType?: string | null; error?: string | null; }) {
  await db.query(`UPDATE crawl_urls SET status = $1, content_type = COALESCE($2, content_type), last_error = $3, scraped_at = now() WHERE url = $4`, [params.status, params.contentType ?? null, params.error ?? null, params.url]);
}
async function getNextPendingUrl() {
  const result = await db.query(`SELECT * FROM crawl_urls WHERE status = 'pending' AND depth <= $1 ORDER BY CASE WHEN url ILIKE '%.pdf%' THEN 0 WHEN url ILIKE '%/docs/%' THEN 1 WHEN url ILIKE '%/sections/stud/%' THEN 2 WHEN url ILIKE '%/sections/accommodation/%' THEN 3 WHEN url ILIKE '%/sections/fulltime/%' THEN 4 WHEN url ILIKE '%/sections/international/%' THEN 5 WHEN url ILIKE '%/sections/studying/%' THEN 6 WHEN url ILIKE '%student%' THEN 7 WHEN url ILIKE '%support%' THEN 8 WHEN url ILIKE '%course%' THEN 9 ELSE 20 END ASC, depth ASC, created_at ASC LIMIT 1`, [MAX_DEPTH]);
  return result.rows[0] ?? null;
}
async function countDoneUrls() { const result = await db.query(`SELECT COUNT(*)::int AS count FROM crawl_urls WHERE status = 'done'`); return result.rows[0].count as number; }
async function saveKnowledgeSource(params: { universityId: string; url: string; title: string | null; sourceType: string; rawFilePath: string; contentHash: string; }) {
  await db.query(`INSERT INTO knowledge_sources (university_id, url, title, source_type, raw_file_path, content_hash, status, updated_at) VALUES ($1, $2, $3, $4, $5, $6, 'pending', now()) ON CONFLICT (url) DO UPDATE SET title = EXCLUDED.title, source_type = EXCLUDED.source_type, raw_file_path = EXCLUDED.raw_file_path, content_hash = EXCLUDED.content_hash, updated_at = now()`, [params.universityId, params.url, params.title, params.sourceType, params.rawFilePath, params.contentHash]);
}
async function printStats() {
  const crawlStats = await db.query(`SELECT status, COUNT(*)::int AS count FROM crawl_urls GROUP BY status ORDER BY status`);
  const sourceStats = await db.query(`SELECT source_type, COUNT(*)::int AS count FROM knowledge_sources GROUP BY source_type ORDER BY source_type`);
  console.log("\nCrawl URL stats:"); for (const row of crawlStats.rows) console.log(`- ${row.status}: ${row.count}`);
  console.log("Knowledge source stats:"); for (const row of sourceStats.rows) console.log(`- ${row.source_type}: ${row.count}`); console.log("");
}
async function downloadAndStore(params: { universityId: string; url: string; depth: number; }) {
  if (!shouldDownloadUrl(params.url)) { await markCrawlUrlStatus({ url: params.url, status: "skipped", error: "Blocked by crawler filter" }); return; }
  console.log(`Scraping depth=${params.depth}: ${params.url}`);
  const response = await fetch(params.url, { headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,*/*" } });
  if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
  const contentType = response.headers.get("content-type");
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_DOWNLOAD_BYTES) { await markCrawlUrlStatus({ url: params.url, status: "skipped", contentType, error: `File too large: ${contentLength} bytes` }); return; }
  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_DOWNLOAD_BYTES) { await markCrawlUrlStatus({ url: params.url, status: "skipped", contentType, error: `Downloaded file too large: ${arrayBuffer.byteLength} bytes` }); return; }
  const buffer = Buffer.from(arrayBuffer);
  const sourceType = getSourceType(params.url, contentType);
  const extension = getFileExtension(params.url, contentType);
  if (!["html", "pdf", "doc", "docx"].includes(sourceType)) { await markCrawlUrlStatus({ url: params.url, status: "skipped", contentType, error: `Unsupported source type: ${sourceType}` }); return; }
  const contentHash = sha256(buffer);
  const folder = getStorageFolder(sourceType);
  await fs.mkdir(folder, { recursive: true });
  const rawFilePath = path.join(folder, `${contentHash}${extension}`);
  await fs.writeFile(rawFilePath, buffer);
  let title: string | null = null;
  if (sourceType === "html") {
    const html = buffer.toString("utf8");
    title = extractTitle(html);
    const links = extractLinks(html, params.url);
    for (const link of links) await insertCrawlUrl({ universityId: params.universityId, url: link, discoveredFrom: params.url, depth: params.depth + 1 });
    console.log(`Found ${links.length} links`);
  } else title = path.basename(new URL(params.url).pathname);
  await saveKnowledgeSource({ universityId: params.universityId, url: params.url, title, sourceType, rawFilePath, contentHash });
  await markCrawlUrlStatus({ url: params.url, status: "done", contentType });
  console.log(`Saved ${sourceType} (${isPriorityUrl(params.url) ? "priority" : "general"}): ${rawFilePath}`);
}
async function seedStartUrls(universityId: string) { for (const url of START_URLS) { const normalized = normalizeUrl(url, "https://www.tees.ac.uk/"); if (normalized) await insertCrawlUrl({ universityId, url: normalized, depth: 0, discoveredFrom: null }); } }
function extractSitemapLocations(xml: string) { const locations = new Set<string>(); const locRegex = /<loc>\s*([^<]+)\s*<\/loc>/gi; let match: RegExpExecArray | null; while ((match = locRegex.exec(xml)) !== null) { const loc = match[1]?.trim(); if (loc) locations.add(loc); } return [...locations]; }
async function seedSitemapUrl(params: { universityId: string; sitemapUrl: string; visitedSitemaps: Set<string>; depth: number; }) {
  if (params.visitedSitemaps.has(params.sitemapUrl) || params.depth > 3) return;
  params.visitedSitemaps.add(params.sitemapUrl);
  try {
    console.log(`Reading sitemap: ${params.sitemapUrl}`);
    const response = await fetch(params.sitemapUrl, { headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml,*/*" } });
    if (!response.ok) { console.log(`Sitemap failed: ${response.status} ${params.sitemapUrl}`); return; }
    const locations = extractSitemapLocations(await response.text());
    console.log(`Sitemap locations found: ${locations.length}`);
    for (const loc of locations) {
      const normalized = normalizeUrl(loc, "https://www.tees.ac.uk/");
      if (!normalized) continue;
      if (normalized.toLowerCase().endsWith(".xml")) await seedSitemapUrl({ universityId: params.universityId, sitemapUrl: normalized, visitedSitemaps: params.visitedSitemaps, depth: params.depth + 1 });
      else await insertCrawlUrl({ universityId: params.universityId, url: normalized, depth: 0, discoveredFrom: params.sitemapUrl });
    }
  } catch (error: any) { console.log(`Could not read sitemap ${params.sitemapUrl}: ${error.message}`); }
}
async function seedSitemaps(universityId: string) { if (!ENABLE_SITEMAP_DISCOVERY) return; const visitedSitemaps = new Set<string>(); for (const sitemapUrl of SITEMAP_URLS) await seedSitemapUrl({ universityId, sitemapUrl, visitedSitemaps, depth: 0 }); }

async function main() {
  const universityId = await getOrCreateUniversity();
  console.log(`University ID: ${universityId}`); console.log(`Max depth: ${MAX_DEPTH}`); console.log(`Max pages: ${MAX_PAGES}`); console.log(`Delay: ${REQUEST_DELAY_MS}ms`);
  await seedStartUrls(universityId);
  await seedSitemaps(universityId);
  let processedThisRun = 0;
  while (true) {
    const completed = await countDoneUrls();
    if (completed >= MAX_PAGES) { console.log(`Reached MAX_PAGES limit: ${MAX_PAGES}`); break; }
    const next = await getNextPendingUrl();
    if (!next) { console.log("No more pending URLs."); break; }
    try { await downloadAndStore({ universityId, url: next.url, depth: next.depth }); }
    catch (error: any) { console.error(`Failed: ${next.url}`); console.error(error.message); await markCrawlUrlStatus({ url: next.url, status: "failed", error: error.message }); }
    processedThisRun += 1;
    if (processedThisRun % 25 === 0) await printStats();
    await sleep(REQUEST_DELAY_MS);
  }
  await printStats(); console.log("Crawler finished."); await db.end();
}
main().catch(async (error) => { console.error(error); await db.end(); process.exit(1); });
