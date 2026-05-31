import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const StatusEventSchema = new Schema(
  {
    receiptId: { type: Schema.Types.ObjectId, ref: "Receipt", required: true, index: true },
    caseId: { type: Schema.Types.ObjectId, ref: "Case", index: true },
    statusCode: { type: String, default: "UNKNOWN" }, // normalized
    statusTitle: { type: String, default: "" },
    statusDetail: { type: String, default: "" },
    source: { type: String, enum: ["live", "mock", "fixture"], default: "fixture" },
    scrapedAt: { type: Date, default: () => new Date() },
    rawHtml: { type: String, default: "" },
    eventDate: { type: Date }, // parsed from status detail when possible
  },
  { timestamps: true },
);

StatusEventSchema.index({ receiptId: 1, scrapedAt: -1 });

export type StatusEventDoc = InferSchemaType<typeof StatusEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const StatusEventModel: Model<StatusEventDoc> =
  (mongoose.models.StatusEvent as Model<StatusEventDoc>) ??
  mongoose.model<StatusEventDoc>("StatusEvent", StatusEventSchema);
