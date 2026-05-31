import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const CriterionFindingSchema = new Schema(
  {
    criterionCode: { type: String, required: true },
    claimed: { type: Boolean, default: false },
    strength: { type: String, enum: ["weak", "moderate", "strong"], default: "weak" },
    evidenceSummary: { type: String, default: "" },
    critique: { type: String, default: "" },
    pageReferences: { type: [Number], default: [] },
  },
  { _id: false },
);

const WeaknessSchema = new Schema(
  {
    severity: {
      type: String,
      enum: ["info", "minor", "major", "critical"],
      default: "minor",
    },
    title: { type: String, required: true },
    detail: { type: String, default: "" },
    criterionCode: { type: String },
    suggestedFix: { type: String, default: "" },
    pageReference: { type: Number },
  },
  { _id: false },
);

const PreflightSignalSchema = new Schema(
  {
    code: String,
    severity: { type: String, enum: ["info", "warn", "fatal"] },
    title: String,
    detail: String,
  },
  { _id: false },
);

const CheckSchema = new Schema(
  {
    code: String,
    label: String,
    passed: Boolean,
    detail: String,
  },
  { _id: false },
);

const RfeAnalysisSchema = new Schema(
  {
    petitionId: { type: Schema.Types.ObjectId, ref: "Petition", required: true, index: true },
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
    userId: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["queued", "running", "done", "failed", "cancelled"],
      default: "queued",
      index: true,
    },
    progressLabel: { type: String, default: "" },
    progressPct: { type: Number, default: 0 },
    riskScore: { type: Number, default: 0 },
    overallSummary: { type: String, default: "" },
    criteriaFindings: { type: [CriterionFindingSchema], default: [] },
    weaknesses: { type: [WeaknessSchema], default: [] },
    preflightSignals: { type: [PreflightSignalSchema], default: [] },
    checks: { type: [CheckSchema], default: [] },
    rawModelOutput: { type: String, default: "" }, // includes <think> in dev
    rawReasoning: { type: String, default: "" }, // extracted <think> block
    model: { type: String, default: "" },
    durationMs: { type: Number, default: 0 },
    errorMessage: { type: String, default: "" },
  },
  { timestamps: true },
);

export type RfeAnalysisDoc = InferSchemaType<typeof RfeAnalysisSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const RfeAnalysisModel: Model<RfeAnalysisDoc> =
  (mongoose.models.RfeAnalysis as Model<RfeAnalysisDoc>) ??
  mongoose.model<RfeAnalysisDoc>("RfeAnalysis", RfeAnalysisSchema);
