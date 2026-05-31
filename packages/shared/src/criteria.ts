import type { CriterionCode } from "./types.js";

export interface CriterionDef {
  code: CriterionCode;
  visa: "O-1A" | "EB-1A" | "BOTH";
  title: string;
  uscisDescription: string;
  keywords: string[];
}

/**
 * Plain-English USCIS criteria for O-1A and EB-1A petitions.
 * Loaded verbatim into the LLM system prompt to avoid relying on training data.
 */
export const O1A_CRITERIA: CriterionDef[] = [
  {
    code: "O1A-AWARDS",
    visa: "O-1A",
    title: "Nationally or internationally recognized prizes or awards",
    uscisDescription:
      "Documentation of the alien's receipt of nationally or internationally recognized prizes or awards for excellence in the field of endeavor.",
    keywords: ["award", "prize", "medal", "honor", "fellowship", "recognition"],
  },
  {
    code: "O1A-MEMBERSHIPS",
    visa: "O-1A",
    title: "Membership in associations requiring outstanding achievement",
    uscisDescription:
      "Documentation of membership in associations in the field that require outstanding achievements of their members, as judged by recognized national or international experts.",
    keywords: ["member", "fellow", "elected", "association", "society"],
  },
  {
    code: "O1A-PUBLISHED-MATERIAL",
    visa: "O-1A",
    title: "Published material about the alien in professional or major media",
    uscisDescription:
      "Published material in professional or major trade publications or major media about the alien's work in the field. Must include the title, date, and author.",
    keywords: ["featured", "profile", "interview", "press", "media", "magazine", "newspaper"],
  },
  {
    code: "O1A-JUDGING",
    visa: "O-1A",
    title: "Participation as a judge of others' work",
    uscisDescription:
      "Evidence of the alien's participation, either individually or on a panel, as a judge of the work of others in the same or an allied field of specialization.",
    keywords: ["judge", "reviewer", "panel", "evaluator", "referee", "program committee"],
  },
  {
    code: "O1A-ORIGINAL-CONTRIBUTIONS",
    visa: "O-1A",
    title: "Original scientific, scholarly, or business-related contributions of major significance",
    uscisDescription:
      "Evidence of the alien's original scientific, scholarly, or business-related contributions of major significance in the field. Independent letters and citations help establish 'major significance'.",
    keywords: ["invented", "developed", "discovered", "patent", "novel", "first", "breakthrough"],
  },
  {
    code: "O1A-SCHOLARLY-ARTICLES",
    visa: "O-1A",
    title: "Authorship of scholarly articles",
    uscisDescription:
      "Evidence of the alien's authorship of scholarly articles in the field in professional journals or other major media.",
    keywords: ["published", "article", "paper", "co-author", "journal", "conference"],
  },
  {
    code: "O1A-CRITICAL-EMPLOYMENT",
    visa: "O-1A",
    title: "Critical employment in distinguished organizations",
    uscisDescription:
      "Evidence that the alien has been employed in a critical or essential capacity for organizations and establishments that have a distinguished reputation.",
    keywords: ["lead", "principal", "senior", "founding", "head", "director", "chief"],
  },
  {
    code: "O1A-HIGH-SALARY",
    visa: "O-1A",
    title: "High salary or remuneration",
    uscisDescription:
      "Evidence that the alien has either commanded a high salary or will command a high salary or other remuneration for services, evidenced by contracts or other reliable evidence. Salary should be compared to peers via BLS or similar data.",
    keywords: ["salary", "compensation", "remuneration", "package", "stock", "bonus", "BLS"],
  },
];

export const EB1A_CRITERIA: CriterionDef[] = [
  {
    code: "EB1A-AWARDS",
    visa: "EB-1A",
    title: "Lesser nationally or internationally recognized prizes or awards",
    uscisDescription:
      "Receipt of lesser nationally or internationally recognized prizes or awards for excellence.",
    keywords: ["award", "prize", "medal", "honor"],
  },
  {
    code: "EB1A-MEMBERSHIPS",
    visa: "EB-1A",
    title: "Membership in associations requiring outstanding achievement",
    uscisDescription:
      "Membership in associations in the field which demand outstanding achievement of their members.",
    keywords: ["member", "fellow", "elected", "association"],
  },
  {
    code: "EB1A-PUBLISHED-MATERIAL",
    visa: "EB-1A",
    title: "Published material about the alien",
    uscisDescription:
      "Published material about the alien in professional or major trade publications or other major media.",
    keywords: ["featured", "profile", "interview", "press"],
  },
  {
    code: "EB1A-JUDGING",
    visa: "EB-1A",
    title: "Participation as a judge",
    uscisDescription:
      "Participation, either individually or on a panel, as a judge of the work of others in the same or an allied field of specialization.",
    keywords: ["judge", "reviewer", "panel"],
  },
  {
    code: "EB1A-ORIGINAL-CONTRIBUTIONS",
    visa: "EB-1A",
    title: "Original contributions of major significance",
    uscisDescription:
      "Original scientific, scholarly, artistic, athletic, or business-related contributions of major significance.",
    keywords: ["invented", "developed", "discovered", "patent"],
  },
  {
    code: "EB1A-SCHOLARLY-ARTICLES",
    visa: "EB-1A",
    title: "Authorship of scholarly articles",
    uscisDescription:
      "Authorship of scholarly articles in professional or major trade publications or other major media.",
    keywords: ["published", "article", "paper", "journal"],
  },
  {
    code: "EB1A-EXHIBITIONS",
    visa: "EB-1A",
    title: "Artistic exhibitions or showcases",
    uscisDescription:
      "Display of the alien's work at artistic exhibitions or showcases.",
    keywords: ["exhibition", "showcase", "gallery", "performance"],
  },
  {
    code: "EB1A-LEADING-ROLE",
    visa: "EB-1A",
    title: "Leading or critical role in distinguished organizations",
    uscisDescription:
      "Performance in a leading or critical role for organizations or establishments that have a distinguished reputation.",
    keywords: ["lead", "principal", "senior", "founding", "director"],
  },
  {
    code: "EB1A-HIGH-SALARY",
    visa: "EB-1A",
    title: "High salary or remuneration",
    uscisDescription:
      "Command of a high salary or other significantly high remuneration in relation to others in the field.",
    keywords: ["salary", "compensation", "remuneration", "stock", "bonus"],
  },
  {
    code: "EB1A-COMMERCIAL-SUCCESS",
    visa: "EB-1A",
    title: "Commercial success in the performing arts",
    uscisDescription:
      "Commercial successes in the performing arts, as shown by box office receipts or record, cassette, compact disk, or video sales.",
    keywords: ["box office", "sales", "downloads", "streams", "tickets"],
  },
];

export const ALL_CRITERIA = [...O1A_CRITERIA, ...EB1A_CRITERIA];

export function criteriaForVisa(visa: "O-1A" | "EB-1A"): CriterionDef[] {
  return visa === "O-1A" ? O1A_CRITERIA : EB1A_CRITERIA;
}
