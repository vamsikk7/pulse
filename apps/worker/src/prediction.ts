import { ReceiptModel, StatusEventModel } from "./db.js";
import { bandFor } from "./uscis/processingTimes.js";
import type { PredictionResult } from "@pulse/shared";

const NEXT_MILESTONE: Record<string, string> = {
  CASE_WAS_RECEIVED: "Biometrics or initial review",
  FINGERPRINT_FEE_WAS_RECEIVED: "Biometrics appointment",
  BIOMETRICS_WAS_SCHEDULED: "Officer review",
  CASE_IS_BEING_ACTIVELY_REVIEWED_BY_USCIS:
    "A decision or a request for more evidence",
  REQUEST_FOR_EVIDENCE_WAS_SENT: "Your response to USCIS",
  RESPONSE_TO_USCIS_REQUEST_FOR_EVIDENCE_WAS_RECEIVED: "A final decision",
  CASE_WAS_APPROVED: "Approval notice in the mail",
  CASE_WAS_DENIED: "Appeal window opens",
};

const VISA_CATEGORY: Record<string, string> = {
  "O-1A": "O-1A",
  "O-1B": "O-1A",
  "EB-1A": "EB-1A",
  "EB-1C": "EB-1A",
  "EB-2-NIW": "EB-2-NIW",
  "L-1A": "L-1",
  "L-1B": "L-1",
};

export async function computePrediction(
  receiptId: string,
): Promise<Omit<PredictionResult, "predictedDate" | "lowerBoundDate" | "upperBoundDate"> & {
  predictedDate: Date | null;
  lowerBoundDate: Date | null;
  upperBoundDate: Date | null;
} | null> {
  const r = await ReceiptModel.findById(receiptId).lean();
  if (!r) return null;
  const lastEvent = await StatusEventModel.findOne({ receiptId })
    .sort({ scrapedAt: -1 })
    .lean();
  if (!lastEvent) return null;

  // Get visa category by walking back to case
  const Case = (await import("./db.js")).CaseModel;
  const kase = await Case.findById(r.caseId).lean();
  const formCategory = kase ? VISA_CATEGORY[kase.visaType as string] ?? "" : "";

  const band = await bandFor(r.formType, r.serviceCenter, formCategory);

  const now = new Date();
  const enteredStepAt = new Date(lastEvent.scrapedAt as string | Date);
  const currentDaysAtStep = Math.max(
    0,
    Math.floor((now.getTime() - enteredStepAt.getTime()) / 86400_000),
  );

  if (!band) {
    return {
      nextMilestone:
        NEXT_MILESTONE[lastEvent.statusCode as string] ?? "Awaiting next update",
      predictedDate: null,
      lowerBoundDate: null,
      upperBoundDate: null,
      isStuck: false,
      currentDaysAtStep,
      p50Days: 0,
      p80Days: 0,
    };
  }

  const predicted = new Date(enteredStepAt.getTime() + band.p50Days * 86400_000);
  const lower = new Date(enteredStepAt.getTime() + band.p50Days * 0.7 * 86400_000);
  const upper = new Date(enteredStepAt.getTime() + band.p80Days * 86400_000);
  const isStuck = currentDaysAtStep > band.p80Days;

  return {
    nextMilestone:
      NEXT_MILESTONE[lastEvent.statusCode as string] ?? "Awaiting next update",
    predictedDate: predicted,
    lowerBoundDate: lower,
    upperBoundDate: upper,
    isStuck,
    currentDaysAtStep,
    p50Days: band.p50Days,
    p80Days: band.p80Days,
  };
}
