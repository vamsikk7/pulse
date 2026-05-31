import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const PredictionSchema = new Schema(
  {
    receiptId: { type: Schema.Types.ObjectId, ref: "Receipt", required: true, index: true },
    computedAt: { type: Date, default: () => new Date() },
    nextMilestone: { type: String, default: "" },
    predictedDate: { type: Date },
    lowerBoundDate: { type: Date },
    upperBoundDate: { type: Date },
    isStuck: { type: Boolean, default: false },
    currentDaysAtStep: { type: Number, default: 0 },
    p50Days: { type: Number, default: 0 },
    p80Days: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export type PredictionDoc = InferSchemaType<typeof PredictionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PredictionModel: Model<PredictionDoc> =
  (mongoose.models.Prediction as Model<PredictionDoc>) ??
  mongoose.model<PredictionDoc>("Prediction", PredictionSchema);
