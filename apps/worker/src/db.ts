import mongoose, { Schema, type Model } from "mongoose";

const CaseSchema = new Schema(
  {
    userId: { type: String, required: true },
    name: { type: String, required: true },
    visaType: { type: String, required: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true, collection: "cases" },
);

const PetitionFileSubSchema = new Schema(
  {
    role: String,
    filename: String,
    fileKey: String,
    fileSize: Number,
    contentType: String,
    pageCount: { type: Number, default: 0 },
    textChars: { type: Number, default: 0 },
    ocrUsed: { type: Boolean, default: false },
  },
  { _id: false },
);

const PetitionSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true },
    userId: { type: String, required: true },
    filename: String,
    fileKey: String,
    fileSize: Number,
    pageCount: { type: Number, default: 0 },
    textExtracted: { type: String, default: "" },
    textChars: { type: Number, default: 0 },
    contentType: String,
    files: { type: [PetitionFileSubSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "petitions" },
);

const CriterionFindingSubSchema = new Schema(
  {
    criterionCode: String,
    claimed: Boolean,
    strength: String,
    evidenceSummary: String,
    critique: String,
    pageReferences: { type: [Number], default: [] },
  },
  { _id: false },
);

const WeaknessSubSchema = new Schema(
  {
    severity: String,
    title: String,
    detail: String,
    criterionCode: String,
    suggestedFix: String,
    pageReference: Number,
  },
  { _id: false },
);

const PreflightSignalSchema = new Schema(
  {
    code: String,
    severity: String,
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
    petitionId: { type: Schema.Types.ObjectId, ref: "Petition", required: true },
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true },
    userId: String,
    status: { type: String, default: "queued" },
    progressLabel: { type: String, default: "" },
    progressPct: { type: Number, default: 0 },
    riskScore: { type: Number, default: 0 },
    overallSummary: { type: String, default: "" },
    criteriaFindings: { type: [CriterionFindingSubSchema], default: [] },
    weaknesses: { type: [WeaknessSubSchema], default: [] },
    preflightSignals: { type: [PreflightSignalSchema], default: [] },
    checks: { type: [CheckSchema], default: [] },
    rawModelOutput: { type: String, default: "" },
    rawReasoning: { type: String, default: "" },
    model: { type: String, default: "" },
    durationMs: { type: Number, default: 0 },
    errorMessage: { type: String, default: "" },
  },
  { timestamps: true, collection: "rfeanalyses" },
);

const ReceiptSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true },
    userId: String,
    receiptNumber: { type: String, uppercase: true },
    formType: { type: String, default: "" },
    serviceCenter: { type: String, default: "" },
    lastSyncedAt: Date,
    lastStatusCode: { type: String, default: "" },
    lastStatusTitle: { type: String, default: "" },
    lastStatusDetail: { type: String, default: "" },
    lastSource: { type: String, default: "unknown" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "receipts" },
);

const StatusEventSchema = new Schema(
  {
    receiptId: { type: Schema.Types.ObjectId, ref: "Receipt", required: true },
    caseId: { type: Schema.Types.ObjectId, ref: "Case" },
    statusCode: { type: String, default: "UNKNOWN" },
    statusTitle: { type: String, default: "" },
    statusDetail: { type: String, default: "" },
    source: { type: String, default: "fixture" },
    scrapedAt: { type: Date, default: () => new Date() },
    rawHtml: { type: String, default: "" },
    eventDate: Date,
  },
  { timestamps: true, collection: "statusevents" },
);

const BandSubSchema = new Schema(
  {
    form: String,
    serviceCenter: String,
    formCategory: { type: String, default: "" },
    p50Days: Number,
    p80Days: Number,
    p93Days: Number,
  },
  { _id: false },
);

const ProcessingTimesSchema = new Schema(
  {
    asOf: Date,
    source: { type: String, default: "snapshot" },
    bands: { type: [BandSubSchema], default: [] },
  },
  { timestamps: true, collection: "processingtimes" },
);

const PredictionSchema = new Schema(
  {
    receiptId: { type: Schema.Types.ObjectId, ref: "Receipt", required: true },
    computedAt: { type: Date, default: () => new Date() },
    nextMilestone: { type: String, default: "" },
    predictedDate: Date,
    lowerBoundDate: Date,
    upperBoundDate: Date,
    isStuck: { type: Boolean, default: false },
    currentDaysAtStep: { type: Number, default: 0 },
    p50Days: { type: Number, default: 0 },
    p80Days: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "predictions" },
);

export const CaseModel: Model<any> =
  mongoose.models.Case ?? mongoose.model("Case", CaseSchema);
export const PetitionModel: Model<any> =
  mongoose.models.Petition ?? mongoose.model("Petition", PetitionSchema);
export const RfeAnalysisModel: Model<any> =
  mongoose.models.RfeAnalysis ?? mongoose.model("RfeAnalysis", RfeAnalysisSchema);
export const ReceiptModel: Model<any> =
  mongoose.models.Receipt ?? mongoose.model("Receipt", ReceiptSchema);
export const StatusEventModel: Model<any> =
  mongoose.models.StatusEvent ?? mongoose.model("StatusEvent", StatusEventSchema);
export const ProcessingTimesModel: Model<any> =
  mongoose.models.ProcessingTimes ??
  mongoose.model("ProcessingTimes", ProcessingTimesSchema);
export const PredictionModel: Model<any> =
  mongoose.models.Prediction ?? mongoose.model("Prediction", PredictionSchema);

const LlmSettingsSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    provider: { type: String, default: "ollama-local" },
    baseUrl: { type: String, default: "http://host.docker.internal:11434/v1" },
    model: { type: String, default: "deepseek-r1:8b" },
    apiKey: { type: String, default: "" },
    temperature: { type: Number, default: 0.2 },
    maxTokens: { type: Number, default: 4096 },
  },
  { timestamps: true, collection: "llmsettings" },
);

export const LlmSettingsModel: Model<any> =
  mongoose.models.LlmSettings ??
  mongoose.model("LlmSettings", LlmSettingsSchema);

const UscisSettingsSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    baseUrl: { type: String, default: "https://api-int.uscis.gov" },
    clientId: { type: String, default: "" },
    clientSecret: { type: String, default: "" },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "uscissettings" },
);

export const UscisSettingsModel: Model<any> =
  mongoose.models.UscisSettings ??
  mongoose.model("UscisSettings", UscisSettingsSchema);

const OpenAlexSettingsSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    mailto: { type: String, default: "pulse-demo@example.com" },
    apiKey: { type: String, default: "" },
  },
  { timestamps: true, collection: "openalexsettings" },
);

export const OpenAlexSettingsModel: Model<any> =
  mongoose.models.OpenAlexSettings ??
  mongoose.model("OpenAlexSettings", OpenAlexSettingsSchema);

export async function connect(): Promise<void> {
  const url = process.env.MONGO_URL ?? "mongodb://mongo:27017/pulse";
  await mongoose.connect(url);
  console.log(`[worker] mongo connected`);
}
