import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const CaseSchema = new Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    visaType: {
      type: String,
      required: true,
      enum: ["O-1A", "O-1B", "EB-1A", "EB-1C", "EB-2-NIW", "H-1B", "L-1A", "L-1B", "TN"],
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true },
);

export type CaseDoc = InferSchemaType<typeof CaseSchema> & { _id: mongoose.Types.ObjectId };

export const CaseModel: Model<CaseDoc> =
  (mongoose.models.Case as Model<CaseDoc>) ??
  mongoose.model<CaseDoc>("Case", CaseSchema);
