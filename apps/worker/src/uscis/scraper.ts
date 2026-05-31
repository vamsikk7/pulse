import { request } from "undici";
import * as cheerio from "cheerio";
import type { UscisStatusResult } from "@pulse/shared";

const USCIS_URL = "https://egov.uscis.gov/casestatus/mycasestatus.do";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_1) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function scrapeUscisStatus(
  receiptNumber: string,
): Promise<UscisStatusResult> {
  const body = new URLSearchParams({
    appReceiptNum: receiptNumber,
    caseStatusSearchBtn: "CHECK STATUS",
  }).toString();

  const res = await request(USCIS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    body,
    bodyTimeout: 15000,
    headersTimeout: 15000,
  });

  if (res.statusCode >= 400) {
    throw new Error(`USCIS HTTP ${res.statusCode}`);
  }

  const html = await res.body.text();
  const $ = cheerio.load(html);

  // Primary selectors (current site as of late-2024/2025)
  let title =
    $("div.rows.text-center h1").first().text().trim() ||
    $("h1.text-center, .current-status-sec h1").first().text().trim();
  let detail =
    $("div.rows.text-center p").first().text().trim() ||
    $(".current-status-sec p").first().text().trim();

  // Fallback selectors
  if (!title) title = $("h1").first().text().trim();
  if (!detail) detail = $("main p, .case-status p").first().text().trim();

  if (!title) {
    throw new Error("USCIS page did not contain a recognizable status title");
  }

  return {
    statusCode: normalize(title),
    statusTitle: title,
    statusDetail: detail,
    source: "live",
    scrapedAt: new Date().toISOString(),
  };
}

function normalize(title: string): string {
  return title
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 80);
}
