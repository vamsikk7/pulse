/**
 * Deterministic, cheap signal extractors layered ON TOP of the LLM analysis.
 * These flag concerns that USCIS adjudicators commonly cite but the LLM
 * sometimes misses, AND they're negation-aware so a petition that says
 * "does NOT include a salary comparator" doesn't get a false negative.
 */

export type HeuristicSeverity = "info" | "minor" | "major" | "critical";

export interface HeuristicSignal {
  code: string;
  title: string;
  detail: string;
  severity: HeuristicSeverity;
}

/**
 * One check Pulse always runs. Even if it doesn't fire, we surface "Pulse
 * looked for this and didn't find a problem" — so a passing petition has
 * positive evidence, not just absence of complaints.
 */
export interface CheckOutcome {
  code: string;
  label: string;
  passed: boolean;
  /** Human description shown to user when passed = true */
  passDetail?: string;
  /** Signal produced when passed = false */
  signal?: HeuristicSignal;
}

export interface HeuristicReport {
  signals: HeuristicSignal[];
  checks: CheckOutcome[];
}

const NEGATION_WINDOW = 60; // chars before keyword that we scan for negators
const NEGATORS = [
  /\bno\b/i,
  /\bnot\b/i,
  /\bwithout\b/i,
  /\bdoes\s+not\b/i,
  /\bdid\s+not\b/i,
  /\bcannot\b/i,
  /\blacks?\b/i,
  /\bmissing\b/i,
  /\babsent\b/i,
  /\binsufficient\b/i,
];

/**
 * Returns true if a negator appears within NEGATION_WINDOW chars BEFORE
 * the match. Lets us distinguish "includes a salary comparator" from
 * "does not include a salary comparator".
 */
function isNegated(text: string, matchIndex: number): boolean {
  const start = Math.max(0, matchIndex - NEGATION_WINDOW);
  const window = text.slice(start, matchIndex);
  return NEGATORS.some((re) => re.test(window));
}

function affirmativeMatch(text: string, re: RegExp): boolean {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const gre = new RegExp(re.source, flags);
  let m: RegExpExecArray | null;
  while ((m = gre.exec(text))) {
    if (!isNegated(text, m.index)) return true;
  }
  return false;
}

function countAffirmative(text: string, re: RegExp): number {
  const flags = re.flags.includes("g") ? re.flags : re.flags + "g";
  const gre = new RegExp(re.source, flags);
  let count = 0;
  let m: RegExpExecArray | null;
  while ((m = gre.exec(text))) {
    if (!isNegated(text, m.index)) count += 1;
  }
  return count;
}

export function runHeuristics(text: string): HeuristicReport {
  const checks: CheckOutcome[] = [];
  const lower = text.toLowerCase();

  // ─── Check 1: Citation count ──────────────────────────────────
  const citationMatches = [...text.matchAll(/\bcited\s+(?:by\s+)?(\d{1,4})/gi)];
  const totalCitations = citationMatches.reduce(
    (sum, m) => sum + parseInt(m[1] ?? "0", 10),
    0,
  );
  if (citationMatches.length > 0 && totalCitations < 50) {
    checks.push({
      code: "citation-count",
      label: "Citation count is meaningful",
      passed: false,
      signal: {
        code: "low-citation-count",
        title: "Citation count below approval threshold",
        detail: `Petition references only ~${totalCitations} citations across ${citationMatches.length} mention(s). USCIS frequently flags low citation counts as undermining "original contributions of major significance" for EB-1A and "sustained acclaim" for O-1A.`,
        severity: "major",
      },
    });
  } else if (citationMatches.length > 0) {
    checks.push({
      code: "citation-count",
      label: "Citation count is meaningful",
      passed: true,
      passDetail: `~${totalCitations} total citations referenced.`,
    });
  } else {
    checks.push({
      code: "citation-count",
      label: "Citation count is meaningful",
      passed: false,
      signal: {
        code: "no-citations",
        title: "No citation evidence detected",
        detail:
          "Pulse couldn't find any \"cited by N\" references. Strong O-1A / EB-1A petitions typically quantify citation impact (e.g., from Google Scholar or OpenAlex).",
        severity: "minor",
      },
    });
  }

  // ─── Check 2: Salary comparator (negation-aware) ──────────────
  const salaryRe = /(salary|remuneration|compensation|\$[\d,]{4,})/i;
  const comparatorRe =
    /(bls\s+(?:oews|wage|occupational)|bureau of labor|prevailing\s+wage|peer\s+salary|percentile|wage\s+data|comparator|comparable\s+salaries?)/i;
  const hasSalary = affirmativeMatch(text, salaryRe);
  const hasComparator = affirmativeMatch(text, comparatorRe);
  if (hasSalary && !hasComparator) {
    checks.push({
      code: "salary-comparator",
      label: "Salary backed by peer comparator data",
      passed: false,
      signal: {
        code: "salary-no-comparator",
        title: "Salary cited without comparator data",
        detail:
          "Salary figures are mentioned but no peer comparison (BLS OEWS, prevailing wage, or percentile ranking) is cited. The high-salary criterion under Kazarian requires demonstrating the salary is high *relative to others in the field*.",
        severity: "major",
      },
    });
  } else if (hasSalary && hasComparator) {
    checks.push({
      code: "salary-comparator",
      label: "Salary backed by peer comparator data",
      passed: true,
      passDetail: "Comparator references (BLS / wage data / percentile) detected.",
    });
  } else {
    checks.push({
      code: "salary-comparator",
      label: "Salary backed by peer comparator data",
      passed: true,
      passDetail: "High salary criterion not claimed.",
    });
  }

  // ─── Check 3: Recommender count ───────────────────────────────
  const recommenderCount = countAffirmative(
    text,
    /(?:letter\s+from|recommendation\s+letter|recommender\s+letter|expert\s+letter|testimonial\s+from)/i,
  );
  if (recommenderCount === 0) {
    checks.push({
      code: "recommenders",
      label: "Adequate expert recommendation letters",
      passed: false,
      signal: {
        code: "no-recommenders",
        title: "No recommendation letters detected",
        detail:
          "Pulse couldn't find references to expert letters. O-1A / EB-1A petitions typically rely on 5–8 letters from recognized experts.",
        severity: "major",
      },
    });
  } else if (recommenderCount < 4) {
    checks.push({
      code: "recommenders",
      label: "Adequate expert recommendation letters",
      passed: false,
      signal: {
        code: "few-recommenders",
        title: "Likely insufficient recommendation letters",
        detail: `Only ~${recommenderCount} recommender reference(s) detected. Strong O-1A / EB-1A petitions typically include 5–8 expert letters from independent sources.`,
        severity: "minor",
      },
    });
  } else {
    checks.push({
      code: "recommenders",
      label: "Adequate expert recommendation letters",
      passed: true,
      passDetail: `~${recommenderCount} recommender letter references detected.`,
    });
  }

  // ─── Check 4: Recommender independence ────────────────────────
  const coauthorHints =
    /(co[-\s]?author|collaborator|same\s+lab|same\s+research\s+group|former\s+(?:advisor|mentor|professor)|ph\.?d\.?\s+(?:advisor|co[-\s]?advisor))/i;
  const recommenderProximity =
    /(?:recommender|recommendation|expert\s+letter|letter\s+from)[\s\S]{0,200}/gi;
  const recommenderContexts = text.match(recommenderProximity) ?? [];
  const coauthorRecommender = recommenderContexts.some((ctx) =>
    coauthorHints.test(ctx),
  );
  if (coauthorRecommender) {
    checks.push({
      code: "recommender-independence",
      label: "Recommenders are independent",
      passed: false,
      signal: {
        code: "potential-recommender-coauthor",
        title: "At least one recommender may not be independent",
        detail:
          "Language around a recommender mentions co-authorship, prior advising, or a shared lab. USCIS gives less weight to letters from collaborators vs. independent experts.",
        severity: "minor",
      },
    });
  } else {
    checks.push({
      code: "recommender-independence",
      label: "Recommenders are independent",
      passed: true,
      passDetail: "No co-authorship or shared-lab language near recommenders.",
    });
  }

  // ─── Check 5: Judging recency ─────────────────────────────────
  if (/(judge|reviewer|program\s+committee)/i.test(lower)) {
    const years = (text.match(/\b20\d{2}\b/g) ?? []).map((y) =>
      parseInt(y, 10),
    );
    const max = years.length ? Math.max(...years) : 0;
    const currentYear = new Date().getFullYear();
    if (max > 0 && max < currentYear - 5) {
      checks.push({
        code: "judging-recency",
        label: "Judging evidence is recent",
        passed: false,
        signal: {
          code: "stale-judging",
          title: "Judging evidence may be stale",
          detail: `Most recent dated activity is ${max}, more than 5 years ago. Judging evidence is strongest when contemporaneous.`,
          severity: "minor",
        },
      });
    } else {
      checks.push({
        code: "judging-recency",
        label: "Judging evidence is recent",
        passed: true,
        passDetail:
          max > 0 ? `Most recent dated activity: ${max}.` : "Dates appear current.",
      });
    }
  } else {
    checks.push({
      code: "judging-recency",
      label: "Judging evidence is recent",
      passed: true,
      passDetail: "Judging criterion not claimed.",
    });
  }

  // ─── Check 6: Publications quantified ─────────────────────────
  const pubsRe =
    /(\d+)\s+(?:peer[-\s]reviewed\s+(?:articles?|papers?|publications?)|publications?\s+in\s+(?:major|peer[-\s]reviewed))/i;
  const pubsMatch = text.match(pubsRe);
  if (pubsMatch) {
    const pubs = parseInt(pubsMatch[1] ?? "0", 10);
    if (pubs < 3) {
      checks.push({
        code: "publications",
        label: "Meaningful publication record",
        passed: false,
        signal: {
          code: "low-publications",
          title: "Low publication count for scholarly-articles criterion",
          detail: `Petition claims ${pubs} peer-reviewed article${pubs === 1 ? "" : "s"}. USCIS often expects more substantial publication history for this criterion to carry weight.`,
          severity: "minor",
        },
      });
    } else {
      checks.push({
        code: "publications",
        label: "Meaningful publication record",
        passed: true,
        passDetail: `${pubs} peer-reviewed publication${pubs === 1 ? "" : "s"} claimed.`,
      });
    }
  } else {
    checks.push({
      code: "publications",
      label: "Meaningful publication record",
      passed: true,
      passDetail: "Publications criterion not quantitatively claimed.",
    });
  }

  const signals = checks
    .filter((c): c is CheckOutcome & { signal: HeuristicSignal } =>
      Boolean(!c.passed && c.signal),
    )
    .map((c) => c.signal);

  return { signals, checks };
}
