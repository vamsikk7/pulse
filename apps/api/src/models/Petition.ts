import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const PetitionFileSchema = new Schema(
  {
    role: {
      type: String,
      enum: ["brief", "exhibit"],
      default: "exhibit",
    },
    filename: { type: String, required: true },
    fileKey: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    contentType: { type: String, default: "application/pdf" },
    pageCount: { type: Number, default: 0 },
    textChars: { type: Number, default: 0 },
    ocrUsed: { type: Boolean, default: false },
  },
  { _id: false },
);

const PetitionSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
    userId: { type: String, required: true, index: true },
    // Primary file (back-compat). For multi-file petitions this is the brief.
    filename: { type: String, required: true },
    fileKey: { type: String, required: true },
    fileSize: { type: Number, default: 0 },
    pageCount: { type: Number, default: 0 },
    textExtracted: { type: String, default: "" },
    textChars: { type: Number, default: 0 },
    contentType: { type: String, default: "application/pdf" },
    // Full file list (always includes the brief + any exhibits)
    files: { type: [PetitionFileSchema], default: [] },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

export type PetitionDoc = InferSchemaType<typeof PetitionSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const PetitionModel: Model<PetitionDoc> =
  (mongoose.models.Petition as Model<PetitionDoc>) ??
  mongoose.model<PetitionDoc>("Petition", PetitionSchema);
