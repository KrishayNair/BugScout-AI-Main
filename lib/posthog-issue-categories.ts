/**
 * PostHog issue categories for LLM context.
 * Import this in API routes (e.g. issues/analyze) and include in the system prompt
 * so the model can classify and describe issues using PostHog's monitored categories.
 */

import categoriesJson from "./posthog-issue-categories.json";

export type PostHogIssueCategory = typeof categoriesJson;
export const posthogIssueCategories = categoriesJson as PostHogIssueCategory;

/** Serialize for LLM prompt: full JSON (use when token budget allows). */
export function getPostHogIssueCategoriesForLLM(): string {
  return JSON.stringify(posthogIssueCategories, null, 2);
}

/** Shorter summary for LLM: categories + issue type names + examples only. */
export function getPostHogIssueCategoriesSummaryForLLM(): string {
  const parts = posthogIssueCategories.categories.map((cat) => {
    const types = cat.issueTypes
      .map(
        (t) =>
          `  - ${t.name}: ${(t.examples as string[]).slice(0, 2).join("; ")}`
      )
      .join("\n");
    return `${cat.name} (${cat.id}):\n${types}`;
  });
  return [
    "PostHog issue categories (use to classify and title issues):",
    ...parts,
    "\nTL;DR categories: " +
      posthogIssueCategories.tlbr.map((t) => `${t.category}: ${t.examples}`).join(" | "),
  ].join("\n");
}
