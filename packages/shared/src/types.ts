export type VisaType =
  | "O-1A"
  | "O-1B"
  | "EB-1A"
  | "EB-1C"
  | "EB-2-NIW"
  | "H-1B"
  | "L-1A"
  | "L-1B"
  | "TN";

export type FormType = "I-129" | "I-140" | "I-485" | "I-765" | "I-131";

export type ServiceCenter =
  | "NSC" // Nebraska
  | "TSC" // Texas
  | "CSC" // California
  | "VSC" // Vermont
  | "MSC" // National Benefits Center
  | "NBC" // Same NBC
  | "YSC" // Potomac
  | "EAC" // Vermont legacy I-129
  | "WAC" // California legacy
  | "LIN" // Nebraska legacy
  | "SRC" // Texas legacy
  | "IOE"; // ELIS electronic

export type CriterionCode =
  // O-1A criteria
  | "O1A-AWARDS"
  | "O1A-MEMBERSHIPS"
  | "O1A-PUBLISHED-MATERIAL"
  | "O1A-JUDGING"
  | "O1A-ORIGINAL-CONTRIBUTIONS"
  | "O1A-SCHOLARLY-ARTICLES"
  | "O1A-CRITICAL-EMPLOYMENT"
  | "O1A-HIGH-SALARY"
  // EB-1A additional / overlapping
  | "EB1A-AWARDS"
  | "EB1A-MEMBERSHIPS"
  | "EB1A-PUBLISHED-MATERIAL"
  | "EB1A-JUDGING"
  | "EB1A-ORIGINAL-CONTRIBUTIONS"
  | "EB1A-SCHOLARLY-ARTICLES"
  | "EB1A-EXHIBITIONS"
  | "EB1A-LEADING-ROLE"
  | "EB1A-HIGH-SALARY"
  | "EB1A-COMMERCIAL-SUCCESS";

export type StrengthLevel = "weak" | "moderate" | "strong";

export type AnalysisStatus = "queued" | "running" | "done" | "failed";

export interface CriterionFinding {
  criterionCode: CriterionCode;
  claimed: boolean;
  strength: StrengthLevel;
  evidenceSummary: string;
  critique: string;
  pageReferences?: number[];
}

export type WeaknessSeverity = "info" | "minor" | "major" | "critical";

export interface Weakness {
  severity: WeaknessSeverity;
  title: string;
  detail: string;
  criterionCode?: CriterionCode;
  suggestedFix: string;
  pageReference?: number;
}

export interface RfeAnalysisResult {
  riskScore: number; // 0-100, higher = more RFE risk
  overallSummary: string;
  criteriaFindings: CriterionFinding[];
  weaknesses: Weakness[];
}

export type StatusSource = "live" | "mock" | "fixture";

export interface UscisStatusResult {
  statusCode: string; // normalized e.g. "CASE_RECEIVED"
  statusTitle: string; // raw USCIS title e.g. "Case Was Received"
  statusDetail: string; // full paragraph
  source: StatusSource;
  scrapedAt: string; // ISO
  formNumber?: string; // e.g. "I-129" — when USCIS reports it
}

export interface ProcessingTimeBand {
  form: FormType;
  serviceCenter: ServiceCenter;
  formCategory?: string; // e.g. "O-1A" classification within I-129
  p50Days: number;
  p80Days: number;
  p93Days: number;
}

export interface PredictionResult {
  nextMilestone: string;
  predictedDate: string; // ISO
  lowerBoundDate: string;
  upperBoundDate: string;
  isStuck: boolean;
  currentDaysAtStep: number;
  p50Days: number;
  p80Days: number;
}
