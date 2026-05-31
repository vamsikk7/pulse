#!/usr/bin/env node
/**
 * Generates a valid PDF that is NOT a petition — used to verify Pulse's
 * preflight refuses to analyze irrelevant documents.
 */
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(
  __dirname,
  "..",
  "samples",
  "non-petition-recipe.pdf",
);

const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 72, bottom: 72, left: 72, right: 72 },
  compress: false,
  pdfVersion: "1.4",
});
doc.pipe(fs.createWriteStream(out));

doc.fontSize(22).text("Brown Butter Chocolate Chip Cookies", { align: "center" });
doc.moveDown(0.5);
doc.fontSize(11).fillColor("#666").text("Yields 24 cookies · 45 minutes", { align: "center" });
doc.moveDown(2);

doc.fillColor("black").fontSize(14).text("Ingredients").moveDown(0.4);
doc.fontSize(11).text(
  "- 1 cup unsalted butter\n" +
  "- 1 cup brown sugar, packed\n" +
  "- 1/2 cup granulated sugar\n" +
  "- 2 large eggs\n" +
  "- 2 teaspoons vanilla extract\n" +
  "- 2 1/4 cups all-purpose flour\n" +
  "- 1 teaspoon baking soda\n" +
  "- 3/4 teaspoon kosher salt\n" +
  "- 2 cups semi-sweet chocolate chips",
);
doc.moveDown();

doc.fontSize(14).text("Directions").moveDown(0.4);
doc.fontSize(11).text(
  "1. Brown the butter in a saucepan until it smells nutty and turns deep amber. Let it cool until just warm.\n" +
  "2. Whisk the sugars into the butter until smooth.\n" +
  "3. Add the eggs and vanilla; whisk again.\n" +
  "4. Stir in the flour, baking soda, and salt until just combined. Fold in the chocolate chips.\n" +
  "5. Chill the dough for at least 30 minutes (overnight is better).\n" +
  "6. Scoop into balls and bake at 375F for 10-12 minutes, until the edges are set but the centers look slightly underdone.\n" +
  "7. Let cool on the pan for 5 minutes before transferring to a rack.",
);
doc.moveDown();

doc.fontSize(14).text("Notes").moveDown(0.4);
doc.fontSize(11).text(
  "Chilling matters. The browned butter spreads more, and resting hydrates the flour. " +
  "If you skip it, expect flatter, paler cookies.",
);

doc.end();
doc.on("close", () => {
  const size = fs.statSync(out).size;
  console.log(`generated: ${out} (${(size / 1024).toFixed(1)} KB)`);
});
