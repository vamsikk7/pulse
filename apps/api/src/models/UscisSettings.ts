import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Per-user USCIS Developer Hub API credentials. Used by the worker's
 * `scrapeReceipt` job to fetch case status as structured JSON before
 * falling back to HTML scraping.
 */
const UscisSettingsSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    baseUrl: { type: String, default: "https://api-int.uscis.gov" },
    clientId: { type: String, default: "" },
    clientSecret: { type: String, default: "" }, // never returned to client
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export type UscisSettingsDoc = InferSchemaType<typeof UscisSettingsSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const UscisSettingsModel: Model<UscisSettingsDoc> =
  (mongoose.models.UscisSettings as Model<UscisSettingsDoc>) ??
  mongoose.model<UscisSettingsDoc>("UscisSettings", UscisSettingsSchema);
