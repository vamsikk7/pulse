import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

/**
 * A single document per user holding the LLM provider configuration.
 * Worker reads this at the start of each analysis job so changes
 * take effect without restart.
 */
const LlmSettingsSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    provider: {
      type: String,
      enum: ["ollama-local", "openai", "anthropic-compat", "custom"],
      default: "ollama-local",
    },
    baseUrl: { type: String, default: "http://host.docker.internal:11434/v1" },
    model: { type: String, default: "deepseek-r1:8b" },
    apiKey: { type: String, default: "" }, // never returned to the client raw — see route
    temperature: { type: Number, default: 0.2 },
    maxTokens: { type: Number, default: 4096 },
  },
  { timestamps: true },
);

export type LlmSettingsDoc = InferSchemaType<typeof LlmSettingsSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const LlmSettingsModel: Model<LlmSettingsDoc> =
  (mongoose.models.LlmSettings as Model<LlmSettingsDoc>) ??
  mongoose.model<LlmSettingsDoc>("LlmSettings", LlmSettingsSchema);
