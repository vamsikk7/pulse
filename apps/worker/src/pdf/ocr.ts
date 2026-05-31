import { spawn } from "node:child_process";
import { mkdtemp, rm, readdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const OCR_DPI = 200;
const MAX_PAGES = 30; // cap so a scanned 500-page exhibit doesn't OOM the worker

export interface OcrResult {
  text: string;
  pageCount: number;
  ocrPages: number;
  durationMs: number;
  truncated: boolean;
}

/**
 * Run a binary, return stdout. Rejects if the process exits non-zero.
 */
function run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (c) => (out += c.toString()));
    child.stderr.on("data", (c) => (err += c.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout: out, stderr: err });
      else reject(new Error(`${cmd} exited ${code}: ${err.slice(0, 200)}`));
    });
  });
}

/**
 * Rasterize every page of the PDF with `pdftoppm` and OCR each image with
 * `tesseract`. Returns the concatenated text. This is a fallback for petitions
 * that are scanned images (where pdf-parse extracts nothing useful).
 */
export async function ocrPdf(buf: Buffer): Promise<OcrResult> {
  const start = Date.now();
  const work = await mkdtemp(join(tmpdir(), "pulse-ocr-"));
  const inputPath = join(work, "input.pdf");
  const imagePrefix = join(work, "page");

  try {
    await writeFile(inputPath, buf);

    // 1. Get the page count from pdfinfo so we can cap before rasterizing
    const info = await run("pdfinfo", [inputPath]).catch(() => null);
    let pageCount = 0;
    const pageMatch = info?.stdout.match(/^Pages:\s*(\d+)/m);
    if (pageMatch) pageCount = parseInt(pageMatch[1] ?? "0", 10);

    const pagesToOcr = pageCount > 0 ? Math.min(pageCount, MAX_PAGES) : MAX_PAGES;

    // 2. Rasterize to PNG: `pdftoppm -png -r 200 -l N input.pdf prefix`
    await run("pdftoppm", [
      "-png",
      "-r",
      String(OCR_DPI),
      "-l",
      String(pagesToOcr),
      inputPath,
      imagePrefix,
    ]);

    // 3. List the produced PNGs and OCR each
    const files = (await readdir(work))
      .filter((f) => f.startsWith("page") && f.endsWith(".png"))
      .sort();

    const pages: string[] = [];
    for (const file of files) {
      const imgPath = join(work, file);
      // tesseract <input.png> stdout
      const { stdout } = await run("tesseract", [
        imgPath,
        "stdout",
        "-l",
        "eng",
        "--psm",
        "1",
      ]);
      pages.push(stdout.trim());
    }

    return {
      text: pages.join("\n\n"),
      pageCount: pageCount || pages.length,
      ocrPages: pages.length,
      durationMs: Date.now() - start,
      truncated: pageCount > MAX_PAGES,
    };
  } finally {
    await rm(work, { recursive: true, force: true }).catch(() => {});
  }
}

export async function ocrAvailable(): Promise<boolean> {
  try {
    await run("tesseract", ["--version"]);
    await run("pdftoppm", ["-v"]).catch(() => null); // pdftoppm prints version to stderr
    return true;
  } catch {
    return false;
  }
}

// Silence unused-import warnings for utility functions kept for future use.
void readFile;
