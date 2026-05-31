import pdfParse from "pdf-parse";

export interface ExtractedPdf {
  text: string;
  pageCount: number;
  charCount: number;
}

export async function extractPdf(buffer: Buffer): Promise<ExtractedPdf> {
  const parsed = await pdfParse(buffer);
  const text = normalizeText(parsed.text);
  return {
    text,
    pageCount: parsed.numpages,
    charCount: text.length,
  };
}

function normalizeText(t: string): string {
  return t
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

/**
 * Cut to approximately N characters at a paragraph boundary.
 * deepseek-r1:8b's effective context is large but reasoning eats tokens,
 * so trimming long petitions to ~24k chars keeps each call cheap.
 */
export function clipForLlm(text: string, maxChars = 24_000): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastBreak = cut.lastIndexOf("\n\n");
  return (lastBreak > maxChars * 0.7 ? cut.slice(0, lastBreak) : cut) + "\n\n[…truncated]";
}
