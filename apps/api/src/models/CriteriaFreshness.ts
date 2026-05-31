import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Singleton-style document tracking the freshness of the USCIS criteria
 * taxonomy compared to eCFR. Written by the worker's daily `criteria-refresh`
 * cron; read by the API for the dashboard's "last verified" indicator.
 */
const CriteriaFreshnessSchema = new Schema(
  {
    key: { type: String, default: "criteria", unique: true, index: true },
    lastSyncedAt: { type: Date, default: null, index: true },
    lastSuccessfulSyncAt: { type: Date, default: null },
    lastChangedAt: { type: Date, default: null },
    lastError: { type: String, default: "" },
    consecutiveFailures: { type: Number, default: 0 },
    sectionsHash: { type: Map, of: String, default: {} },
  },
  { timestamps: true, collection: "criteria_freshness" },
);

export type CriteriaFreshnessDoc = InferSchemaType<typeof CriteriaFreshnessSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const CriteriaFreshnessModel: Model<CriteriaFreshnessDoc> =
  (mongoose.models.CriteriaFreshness as Model<CriteriaFreshnessDoc>) ??
  mongoose.model<CriteriaFreshnessDoc>(
    "CriteriaFreshness",
    CriteriaFreshnessSchema,
  );
