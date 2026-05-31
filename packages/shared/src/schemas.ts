import { z } from "zod";

export const VisaTypeSchema = z.enum([
  "O-1A",
  "O-1B",
  "EB-1A",
  "EB-1C",
  "EB-2-NIW",
  "H-1B",
  "L-1A",
  "L-1B",
  "TN",
]);

export const FormTypeSchema = z.enum(["I-129", "I-140", "I-485", "I-765", "I-131"]);

export const ServiceCenterSchema = z.enum([
  "NSC",
  "TSC",
  "CSC",
  "VSC",
  "MSC",
  "NBC",
  "YSC",
  "EAC",
  "WAC",
  "LIN",
  "SRC",
  "IOE",
]);

export const StrengthSchema = z.enum(["weak", "moderate", "strong"]);
export const AnalysisStatusSchema = z.enum(["queued", "running", "done", "failed"]);

export const CriterionFindingSchema = z.object({
  criterionCode: z.string(),
  claimed: z.boolean(),
  strength: StrengthSchema,
  evidenceSummary: z.string(),
  critique: z.string(),
  pageReferences: z.array(z.number()).optional(),
});

export const WeaknessSchema = z.object({
  severity: z.enum(["info", "minor", "major", "critical"]),
  title: z.string(),
  detail: z.string(),
  criterionCode: z.string().optional(),
  suggestedFix: z.string(),
  pageReference: z.number().optional(),
});

export const RfeAnalysisResultSchema = z.object({
  riskScore: z.number().min(0).max(100),
  overallSummary: z.string(),
  criteriaFindings: z.array(CriterionFindingSchema),
  weaknesses: z.array(WeaknessSchema),
});

/**
 * Permissive variant — used when raw LLM output may have malformed entries.
 * Bad criteria/weakness rows are filtered out, never crash.
 */
export const LenientCriterionFindingSchema = z
  .union([
    CriterionFindingSchema,
    z.string(),
    z.unknown(),
  ])
  .transform((v) => {
    if (typeof v === "object" && v !== null && "criterionCode" in v) {
      const obj = v as Record<string, unknown>;
      return {
        criterionCode: String(obj.criterionCode ?? "UNKNOWN"),
        claimed: Boolean(obj.claimed ?? false),
        strength: (["weak", "moderate", "strong"] as const).includes(
          obj.strength as "weak" | "moderate" | "strong",
        )
          ? (obj.strength as "weak" | "moderate" | "strong")
          : "weak",
        evidenceSummary: String(obj.evidenceSummary ?? ""),
        critique: String(obj.critique ?? ""),
      };
    }
    return null;
  });

export const LenientWeaknessSchema = z
  .union([WeaknessSchema, z.string(), z.unknown()])
  .transform((v) => {
    if (typeof v === "object" && v !== null && "title" in v) {
      const obj = v as Record<string, unknown>;
      const sev = obj.severity as string;
      return {
        severity: (["info", "minor", "major", "critical"] as const).includes(
          sev as "info" | "minor" | "major" | "critical",
        )
          ? (sev as "info" | "minor" | "major" | "critical")
          : "minor",
        title: String(obj.title ?? "Untitled"),
        detail: String(obj.detail ?? ""),
        criterionCode: obj.criterionCode ? String(obj.criterionCode) : undefined,
        suggestedFix: String(obj.suggestedFix ?? ""),
        pageReference: typeof obj.pageReference === "number" ? obj.pageReference : undefined,
      };
    }
    return null;
  });

export const LenientRfeAnalysisResultSchema = z
  .object({
    riskScore: z.coerce.number().catch(50),
    overallSummary: z.string().catch(""),
    criteriaFindings: z.array(LenientCriterionFindingSchema).catch([]),
    weaknesses: z.array(LenientWeaknessSchema).catch([]),
  })
  .transform((v) => ({
    riskScore: Math.max(0, Math.min(100, v.riskScore ?? 50)),
    overallSummary: v.overallSummary,
    criteriaFindings: v.criteriaFindings.filter((x): x is NonNullable<typeof x> => x !== null),
    weaknesses: v.weaknesses.filter((x): x is NonNullable<typeof x> => x !== null),
  }));

export const CreateCaseSchema = z.object({
  name: z.string().min(1).max(120),
  visaType: VisaTypeSchema,
});

const PetitionFileInputSchema = z.object({
  fileKey: z.string(),
  filename: z.string(),
  role: z.enum(["brief", "exhibit"]).optional(),
});

/**
 * Accepts either:
 *   1. Legacy single-file shape: { caseId, fileKey, filename }
 *   2. Multi-file shape:        { caseId, files: [{ fileKey, filename, role? }] }
 *
 * The first file is treated as the brief unless explicitly marked otherwise.
 */
export const CreatePetitionSchema = z
  .object({
    caseId: z.string(),
    fileKey: z.string().optional(),
    filename: z.string().optional(),
    files: z.array(PetitionFileInputSchema).min(1).max(20).optional(),
  })
  .refine(
    (v) => Boolean(v.files?.length) || (Boolean(v.fileKey) && Boolean(v.filename)),
    {
      message: "Either `files` (array) or `fileKey` + `filename` must be provided",
    },
  );

export const PresignUploadSchema = z.object({
  caseId: z.string(),
  filename: z.string().max(255),
  contentType: z.string(),
});

export const CreateReceiptSchema = z.object({
  caseId: z.string(),
  receiptNumber: z
    .string()
    .regex(/^[A-Z]{3}\d{10}$/, "USCIS receipt numbers are 3 letters + 10 digits"),
  // Optional — USCIS API returns the actual form number, and the worker will
  // backfill it on the first successful fetch. If neither is available, the
  // prediction engine falls back to "form unknown" and skips the milestone date.
  formType: FormTypeSchema.optional(),
});

export const PredictionResultSchema = z.object({
  nextMilestone: z.string(),
  predictedDate: z.string(),
  lowerBoundDate: z.string(),
  upperBoundDate: z.string(),
  isStuck: z.boolean(),
  currentDaysAtStep: z.number(),
  p50Days: z.number(),
  p80Days: z.number(),
});

export const ProcessingTimeBandSchema = z.object({
  form: FormTypeSchema,
  serviceCenter: ServiceCenterSchema,
  formCategory: z.string().optional(),
  p50Days: z.number(),
  p80Days: z.number(),
  p93Days: z.number(),
});

export type CreateCaseInput = z.infer<typeof CreateCaseSchema>;
export type CreatePetitionInput = z.infer<typeof CreatePetitionSchema>;
export type PresignUploadInput = z.infer<typeof PresignUploadSchema>;
export type CreateReceiptInput = z.infer<typeof CreateReceiptSchema>;
