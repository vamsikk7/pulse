import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const RECEIPT_PREFIX_TO_CENTER: Record<string, string> = {
  EAC: "VSC",
  WAC: "CSC",
  LIN: "NSC",
  SRC: "TSC",
  MSC: "NBC",
  IOE: "IOE",
  YSC: "YSC",
};

const ReceiptSchema = new Schema(
  {
    caseId: { type: Schema.Types.ObjectId, ref: "Case", required: true, index: true },
    userId: { type: String, required: true, index: true },
    receiptNumber: { type: String, required: true, uppercase: true, index: true },
    formType: {
      type: String,
      enum: ["I-129", "I-140", "I-485", "I-765", "I-131", ""],
      default: "",
    },
    serviceCenter: { type: String, default: "" },
    lastSyncedAt: { type: Date },
    lastStatusCode: { type: String, default: "" },
    lastStatusTitle: { type: String, default: "" },
    lastStatusDetail: { type: String, default: "" },
    lastSource: {
      type: String,
      enum: ["live", "mock", "fixture", "unknown"],
      default: "unknown",
    },
    deletedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

ReceiptSchema.pre("save", function (next) {
  if (!this.serviceCenter && typeof this.receiptNumber === "string") {
    const prefix = this.receiptNumber.slice(0, 3).toUpperCase();
    this.serviceCenter = RECEIPT_PREFIX_TO_CENTER[prefix] ?? prefix;
  }
  next();
});

export type ReceiptDoc = InferSchemaType<typeof ReceiptSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ReceiptModel: Model<ReceiptDoc> =
  (mongoose.models.Receipt as Model<ReceiptDoc>) ??
  mongoose.model<ReceiptDoc>("Receipt", ReceiptSchema);

export { RECEIPT_PREFIX_TO_CENTER };
