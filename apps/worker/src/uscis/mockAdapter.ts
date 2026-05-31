import type { UscisStatusResult } from "@pulse/shared";

interface Fixture {
  statusCode: string;
  statusTitle: string;
  statusDetail: string;
  history?: Array<{ daysAgo: number; statusCode: string; statusTitle: string; statusDetail: string }>;
}

const FIXTURES: Record<string, Fixture> = {
  EAC: {
    statusCode: "REQUEST_FOR_EVIDENCE_WAS_SENT",
    statusTitle: "Request for Initial Evidence Was Sent",
    statusDetail:
      "On March 12, 2026, we mailed a request for additional evidence for your Form I-129, Petition for a Nonimmigrant Worker. Please follow the instructions in the notice to submit the requested evidence.",
    history: [
      {
        daysAgo: 142,
        statusCode: "REQUEST_FOR_EVIDENCE_WAS_SENT",
        statusTitle: "Request for Initial Evidence Was Sent",
        statusDetail:
          "On March 12, 2026, we mailed a request for additional evidence for your Form I-129, Petition for a Nonimmigrant Worker.",
      },
      {
        daysAgo: 180,
        statusCode: "CASE_IS_BEING_ACTIVELY_REVIEWED",
        statusTitle: "Case Is Being Actively Reviewed by USCIS",
        statusDetail:
          "On February 2, 2026, an officer at our Vermont Service Center is reviewing your Form I-129 case.",
      },
      {
        daysAgo: 210,
        statusCode: "CASE_WAS_RECEIVED",
        statusTitle: "Case Was Received",
        statusDetail:
          "On January 3, 2026, we received your Form I-129, Petition for a Nonimmigrant Worker.",
      },
    ],
  },
  WAC: {
    statusCode: "CASE_WAS_APPROVED",
    statusTitle: "Case Was Approved",
    statusDetail:
      "On April 22, 2026, we approved your Form I-129, Petition for a Nonimmigrant Worker. We sent you an approval notice.",
    history: [
      {
        daysAgo: 28,
        statusCode: "CASE_WAS_APPROVED",
        statusTitle: "Case Was Approved",
        statusDetail:
          "On April 22, 2026, we approved your Form I-129, Petition for a Nonimmigrant Worker.",
      },
      {
        daysAgo: 75,
        statusCode: "CASE_IS_BEING_ACTIVELY_REVIEWED",
        statusTitle: "Case Is Being Actively Reviewed by USCIS",
        statusDetail:
          "On March 7, 2026, an officer at our California Service Center is reviewing your Form I-129.",
      },
      {
        daysAgo: 95,
        statusCode: "CASE_WAS_RECEIVED",
        statusTitle: "Case Was Received",
        statusDetail:
          "On February 15, 2026, we received your Form I-129, Petition for a Nonimmigrant Worker.",
      },
    ],
  },
  LIN: {
    statusCode: "CASE_IS_BEING_ACTIVELY_REVIEWED",
    statusTitle: "Case Is Being Actively Reviewed by USCIS",
    statusDetail:
      "On April 1, 2026, an officer at our Nebraska Service Center is reviewing your Form I-140 case.",
    history: [
      {
        daysAgo: 30,
        statusCode: "CASE_WAS_RECEIVED",
        statusTitle: "Case Was Received",
        statusDetail:
          "On May 1, 2026, we received your Form I-140 petition.",
      },
    ],
  },
  SRC: {
    statusCode: "RESPONSE_TO_USCIS_REQUEST_FOR_EVIDENCE_WAS_RECEIVED",
    statusTitle: "Response To USCIS' Request For Evidence Was Received",
    statusDetail:
      "On May 10, 2026, we received your response to our Request for Evidence for your Form I-140, Immigrant Petition for Alien Worker.",
    history: [
      {
        daysAgo: 21,
        statusCode: "RESPONSE_TO_USCIS_REQUEST_FOR_EVIDENCE_WAS_RECEIVED",
        statusTitle: "Response To USCIS' Request For Evidence Was Received",
        statusDetail: "On May 10, 2026, we received your RFE response.",
      },
      {
        daysAgo: 90,
        statusCode: "REQUEST_FOR_EVIDENCE_WAS_SENT",
        statusTitle: "Request for Initial Evidence Was Sent",
        statusDetail: "On March 2, 2026, we mailed a request for additional evidence.",
      },
      {
        daysAgo: 150,
        statusCode: "CASE_WAS_RECEIVED",
        statusTitle: "Case Was Received",
        statusDetail: "On January 1, 2026, we received your I-140.",
      },
    ],
  },
  MSC: {
    statusCode: "CASE_WAS_RECEIVED",
    statusTitle: "Case Was Received",
    statusDetail:
      "On May 20, 2026, we received your Form I-485, Application to Register Permanent Residence.",
    history: [
      {
        daysAgo: 11,
        statusCode: "CASE_WAS_RECEIVED",
        statusTitle: "Case Was Received",
        statusDetail: "On May 20, 2026, we received your Form I-485.",
      },
    ],
  },
  IOE: {
    statusCode: "BIOMETRICS_WAS_SCHEDULED",
    statusTitle: "Fingerprint Fee Was Received",
    statusDetail:
      "On April 18, 2026, we received the biometrics fee. We will mail you a notice with the date and place of your biometrics appointment.",
    history: [
      {
        daysAgo: 43,
        statusCode: "BIOMETRICS_WAS_SCHEDULED",
        statusTitle: "Fingerprint Fee Was Received",
        statusDetail: "On April 18, 2026, we received the biometrics fee.",
      },
      {
        daysAgo: 60,
        statusCode: "CASE_WAS_RECEIVED",
        statusTitle: "Case Was Received",
        statusDetail: "On April 1, 2026, we received your case.",
      },
    ],
  },
  YSC: {
    statusCode: "CASE_WAS_DENIED",
    statusTitle: "Case Was Denied",
    statusDetail:
      "On April 5, 2026, we denied your Form I-129. We mailed you a notice that explains why we denied your case.",
    history: [
      {
        daysAgo: 56,
        statusCode: "CASE_WAS_DENIED",
        statusTitle: "Case Was Denied",
        statusDetail: "On April 5, 2026, we denied your Form I-129.",
      },
      {
        daysAgo: 130,
        statusCode: "REQUEST_FOR_EVIDENCE_WAS_SENT",
        statusTitle: "Request for Initial Evidence Was Sent",
        statusDetail: "On January 21, 2026, we mailed a request for additional evidence.",
      },
    ],
  },
};

const DEFAULT: Fixture = {
  statusCode: "CASE_WAS_RECEIVED",
  statusTitle: "Case Was Received",
  statusDetail:
    "We received your immigration petition. (Fixture default — receipt prefix not in mock set.)",
  history: [],
};

export function getFixture(receiptNumber: string): {
  current: UscisStatusResult;
  history: Array<{ daysAgo: number; result: UscisStatusResult }>;
} {
  const prefix = receiptNumber.slice(0, 3).toUpperCase();
  const fx = FIXTURES[prefix] ?? DEFAULT;
  const now = new Date();
  const current: UscisStatusResult = {
    statusCode: fx.statusCode,
    statusTitle: fx.statusTitle,
    statusDetail: fx.statusDetail,
    source: "mock",
    scrapedAt: now.toISOString(),
  };
  const history = (fx.history ?? []).map((h) => ({
    daysAgo: h.daysAgo,
    result: {
      statusCode: h.statusCode,
      statusTitle: h.statusTitle,
      statusDetail: h.statusDetail,
      source: "mock" as const,
      scrapedAt: new Date(now.getTime() - h.daysAgo * 86400_000).toISOString(),
    },
  }));
  return { current, history };
}
