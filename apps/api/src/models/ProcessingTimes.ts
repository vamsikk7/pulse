import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const BandSchema = new Schema(
  {
    form: { type: String, required: true }, // I-129, I-140, ...
    serviceCenter: { type: String, required: true },
    formCategory: { type: String, default: "" }, // e.g. "O-1A", "EB-1A"
    p50Days: { type: Number, required: true },
    p80Days: { type: Number, required: true },
    p93Days: { type: Number, required: true },
  },
  { _id: false },
);

const ProcessingTimesSchema = new Schema(
  {
    asOf: { type: Date, default: () => new Date() },
    source: { type: String, enum: ["live", "snapshot"], default: "snapshot" },
    bands: { type: [BandSchema], default: [] },
  },
  { timestamps: true },
);

export type ProcessingTimesDoc = InferSchemaType<typeof ProcessingTimesSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ProcessingTimesModel: Model<ProcessingTimesDoc> =
  (mongoose.models.ProcessingTimes as Model<ProcessingTimesDoc>) ??
  mongoose.model<ProcessingTimesDoc>("ProcessingTimes", ProcessingTimesSchema);
