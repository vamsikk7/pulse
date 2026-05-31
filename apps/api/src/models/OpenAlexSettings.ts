import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * Per-user OpenAlex API configuration. The worker reads this at the start
 * of each analysis job so the correct API key / mailto is used without a
 * restart. OpenAlex works without a key, but providing one grants access
 * to the "polite pool" (higher rate limits).
 */
const OpenAlexSettingsSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    mailto: { type: String, default: "pulse-demo@example.com" },
    apiKey: { type: String, default: "" }, // never returned to client
  },
  { timestamps: true },
);

export type OpenAlexSettingsDoc = InferSchemaType<typeof OpenAlexSettingsSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const OpenAlexSettingsModel: Model<OpenAlexSettingsDoc> =
  (mongoose.models.OpenAlexSettings as Model<OpenAlexSettingsDoc>) ??
  mongoose.model<OpenAlexSettingsDoc>("OpenAlexSettings", OpenAlexSettingsSchema);
