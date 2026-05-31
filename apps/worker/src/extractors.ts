/**
 * Lightweight name extractors used to drive OpenAlex verification.
 * Best-effort regex; the LLM does the heavy lifting elsewhere.
 */

/**
 * Pull the petitioner's name out of the brief.
 * Looks for "In Re: Petition of NAME", "Petitioner: NAME", "Beneficiary: NAME",
 * etc. Returns the first plausible match.
 */
export function extractPetitionerName(text: string): string | null {
  const patterns: RegExp[] = [
    /In\s+Re:?\s*Petition\s+of\s+(?:Dr\.\s+|Mr\.\s+|Ms\.\s+|Mrs\.\s+)?([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){0,3})/,
    /Petitioner(?:\s+is)?:?\s+(?:Dr\.\s+|Mr\.\s+|Ms\.\s+|Mrs\.\s+)?([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){0,3})/,
    /Beneficiary(?:\s+is)?:?\s+(?:Dr\.\s+|Mr\.\s+|Ms\.\s+|Mrs\.\s+)?([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){0,3})/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m && m[1]) {
      const name = m[1].trim();
      // Reject obviously-bogus matches like "U S Department"
      if (/\b(department|service|center|states|america)\b/i.test(name))
        continue;
      if (name.split(/\s+/).length >= 2) return name;
    }
  }
  return null;
}

/**
 * Pull plausible recommender names. Looks for patterns like
 * "letter from Dr. NAME", "recommender letter from NAME", etc.
 */
export function extractRecommenderNames(text: string): string[] {
  const found = new Set<string>();
  const patterns: RegExp[] = [
    /(?:letter|recommendation)\s+(?:from|by)\s+(?:Dr\.\s+|Prof\.\s+|Professor\s+|Mr\.\s+|Ms\.\s+|Mrs\.\s+)?([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){1,3})/g,
    /Dr\.\s+([A-Z][a-zA-Z'\-]+(?:\s+[A-Z][a-zA-Z'\-]+){1,2})\s*,\s*(?:Senior|Professor|Director|Head|Chief|Researcher)/g,
  ];
  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m[1]) {
        const name = m[1].trim();
        if (/\b(department|service|center|university|institute)\b/i.test(name))
          continue;
        if (name.split(/\s+/).length >= 2) found.add(name);
      }
    }
  }
  return [...found].slice(0, 12);
}

/**
 * Look for the petitioner's own citation-count claim in the petition.
 * Returns the largest "cited by N" or "N citations" mention.
 */
export function extractClaimedCitations(text: string): number | null {
  const matches = [
    ...text.matchAll(/\bcited\s+by\s+(\d{1,5})/gi),
    ...text.matchAll(/\b(\d{1,5})\s+citations?\b/gi),
    ...text.matchAll(/\bh[-\s]?index(?:\s+of)?\s+(\d{1,3})\b/gi), // also picks up h-index
  ];
  const nums = matches
    .map((m) => parseInt(m[1] ?? "0", 10))
    .filter((n) => n > 0 && n < 100000);
  if (nums.length === 0) return null;
  return Math.max(...nums);
}
