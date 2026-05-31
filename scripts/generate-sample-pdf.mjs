#!/usr/bin/env node
/**
 * Generates a synthetic EB-1A petition PDF for the demo.
 * Deliberately seeded with weaknesses so the RFE Sentinel finds meaningful issues:
 *   - Salary mentioned without comparator data
 *   - Low citation count (only ~14 citations across two papers)
 *   - Only 3 recommendation letters (insufficient for EB-1A)
 *   - One recommender is a former collaborator (independence concern)
 *
 * Every page is watermarked SYNTHETIC.
 */
import PDFDocument from "pdfkit";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(__dirname, "..", "samples", "synthetic-eb1a-petition.pdf");

const doc = new PDFDocument({ size: "LETTER", margins: { top: 72, bottom: 72, left: 72, right: 72 } });
doc.pipe(fs.createWriteStream(out));

const stampOnPage = () => {
  doc.save();
  doc.fontSize(60).fillColor("#fee2e2").opacity(0.35);
  doc.rotate(-30, { origin: [306, 396] });
  doc.text("SYNTHETIC", 60, 380, { align: "center", width: 492 });
  doc.restore();
};

doc.on("pageAdded", stampOnPage);
stampOnPage();

// ===== Cover =====
doc.fillColor("#0f172a").opacity(1).fontSize(20).text("In Re: Petition of MS. WEI LIN", { align: "center" });
doc.moveDown(0.3);
doc.fontSize(14).text("Form I-140 — EB-1A, Alien of Extraordinary Ability in Bioinformatics", { align: "center" });
doc.moveDown(0.3);
doc.fontSize(10).fillColor("#475569").text("(SYNTHETIC DEMO — Not a real petition. Generated for portfolio purposes.)", { align: "center" });
doc.moveDown(2);
doc.fillColor("#0f172a").fontSize(12);
doc.text(
  "This brief sets forth the basis upon which Petitioner WEI LIN qualifies for classification as an alien of extraordinary ability under INA § 203(b)(1)(A) and 8 C.F.R. § 204.5(h). Petitioner self-petitions on the basis of demonstrated extraordinary ability in the field of bioinformatics, specifically in single-cell RNA sequencing analysis pipelines.",
);
doc.moveDown();

// ===== Criteria =====
doc.fontSize(14).text("I. Regulatory Framework and Criteria Asserted").moveDown(0.5);
doc.fontSize(12).text(
  "Petitioner satisfies at least four of the ten regulatory criteria enumerated at 8 C.F.R. § 204.5(h)(3): membership in associations requiring outstanding achievement, authorship of scholarly articles, judging of others' work, and original contributions of major significance. Each is addressed below.",
);
doc.moveDown();

// ----- Memberships -----
doc.fontSize(13).fillColor("#1e3a8a").text("A. Membership in Associations Requiring Outstanding Achievement").fillColor("#0f172a").moveDown(0.3);
doc.fontSize(12).text(
  "Petitioner is an elected member of the International Society for Computational Biology (ISCB) Student Council, having been selected via competitive nomination in 2023. While ISCB membership generally does not require outstanding achievement, the Student Council selection is competitive and judged by recognized experts in the field.",
);
doc.moveDown();

// ----- Scholarly Articles -----
doc.fontSize(13).fillColor("#1e3a8a").text("B. Authorship of Scholarly Articles").fillColor("#0f172a").moveDown(0.3);
doc.fontSize(12).text(
  "Petitioner has authored two (2) peer-reviewed scholarly articles in major journals:",
);
doc.moveDown(0.3);
doc.text(
  "• \"Sparse Decomposition Approaches to scRNA-seq Cell-Type Annotation,\" published in Bioinformatics, Vol. 39, Issue 8 (2023). Cited by 9 subsequent works as of April 2026.",
);
doc.moveDown(0.2);
doc.text(
  "• \"Memory-Efficient Cell-Cell Distance Computation for Single-Cell Atlases,\" published in BMC Bioinformatics, Vol. 24, No. 14 (2023). Cited by 5 subsequent works as of April 2026.",
);
doc.moveDown();

// ----- Judging -----
doc.fontSize(13).fillColor("#1e3a8a").text("C. Participation as a Judge of the Work of Others").fillColor("#0f172a").moveDown(0.3);
doc.fontSize(12).text(
  "Petitioner has served as a reviewer for two journal manuscripts at Bioinformatics in 2022, prior to receiving her Ph.D. She also served on the program committee of the ISCB Regional Student Group meeting in 2021.",
);
doc.moveDown();

// ----- Original Contributions -----
doc.fontSize(13).fillColor("#1e3a8a").text("D. Original Scientific Contributions of Major Significance").fillColor("#0f172a").moveDown(0.3);
doc.fontSize(12).text(
  "Petitioner developed a novel sparse decomposition technique that reduces memory requirements for cell-cell distance computation by approximately 40% in a benchmark configuration. The contribution is documented in her 2023 BMC Bioinformatics publication.",
);
doc.moveDown(0.3);
doc.text(
  "Three independent experts have provided letters attesting to the importance of this work:",
);
doc.moveDown(0.2);
doc.text(
  "• Dr. Hassan Ali, Senior Researcher at the Broad Institute (recommender letter, Tab 3).",
);
doc.moveDown(0.2);
doc.text(
  "• Dr. María Reyes, Professor of Computational Biology, Stanford University (recommender letter, Tab 4). Dr. Reyes was Petitioner's Ph.D. co-advisor and they have collaborated on two prior papers.",
);
doc.moveDown(0.2);
doc.text(
  "• Dr. Tomás Bouchard, Director of Computational Biology, Genentech (recommender letter, Tab 5).",
);
doc.moveDown();

// ===== Compensation =====
doc.addPage();
doc.fontSize(14).fillColor("#0f172a").text("II. Compensation").moveDown(0.5);
doc.fontSize(12).text(
  "Petitioner is currently employed as a Senior Bioinformatics Scientist at a biotech firm in South San Francisco, California, with a total annual compensation of $215,000. This compensation reflects the petitioner's expertise and the value placed on her contributions by her employer.",
);
doc.moveDown();
doc.text(
  "(Note: the petition does not include a salary comparator analysis or BLS wage data. Petitioner's compensation is high relative to her field but no comparative dataset is referenced in this brief.)",
);
doc.moveDown();

// ===== Conclusion =====
doc.fontSize(14).text("III. Conclusion").moveDown(0.5);
doc.fontSize(12).text(
  "For the foregoing reasons, Petitioner respectfully submits that she satisfies at least four of the ten regulatory criteria at 8 C.F.R. § 204.5(h)(3) and qualifies for classification as an alien of extraordinary ability under INA § 203(b)(1)(A). Petitioner respectfully requests that her Form I-140 be approved.",
);
doc.moveDown(2);
doc.fillColor("#475569").fontSize(10).text(
  "Respectfully submitted,\n\nWEI LIN (Pro Se)\n\nDate: May 2026",
);

doc.end();

doc.on("close", () => {
  const size = fs.statSync(out).size;
  console.log(`generated: ${out} (${(size / 1024).toFixed(1)} KB)`);
});
