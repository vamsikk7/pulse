/**
 * DeepSeek-R1 (and distill variants) wraps its chain-of-thought in <think>...</think>
 * tags before the actual answer. Strip those so JSON.parse succeeds.
 *
 * Also trims to the outermost { ... } block for safety.
 */
export function stripThink(s: string): { content: string; reasoning: string } {
  const reasoningMatches = [...s.matchAll(/<think>([\s\S]*?)<\/think>/gi)];
  const reasoning = reasoningMatches.map((m) => m[1]).join("\n---\n");
  let content = s.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

  // If the model never closed the think tag, drop everything up to the last </think>
  const lastClose = content.lastIndexOf("</think>");
  if (lastClose !== -1) {
    content = content.slice(lastClose + "</think>".length).trim();
  }
  // Or if it never opened/closed but started reasoning with no JSON yet
  const lastOpen = content.lastIndexOf("<think>");
  if (lastOpen !== -1 && content.indexOf("</think>") === -1) {
    content = content.slice(0, lastOpen).trim();
  }

  return { content, reasoning };
}

/**
 * Extract the first balanced JSON object from a string.
 * Useful when the model emits prose before/after the JSON.
 */
export function extractJsonObject(s: string): string | null {
  const start = s.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}
