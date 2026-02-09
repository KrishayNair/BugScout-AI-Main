/**
 * Shared types for Issue Monitoring Agent and Solution Agent.
 */

export type IssueSeverity = "Critical" | "High" | "Medium" | "Low";

/** Output from Issue Monitoring Agent — input to Solution Agent. */
export type MonitoredIssue = {
  recordingId: string;
  posthogCategoryId: string;
  posthogIssueTypeId: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  codeLocation: string;
  codeSnippetHint?: string;
  startUrl?: string;
};

/** Output from Solution Agent. */
export type SuggestedFix = {
  recordingId: string;
  title: string;
  suggestedFix: string;
  codeLocation: string;
  codeEdits?: Array<{
    file: string;
    description: string;
    snippet: string;
  }>;
  /** 0–1 when agent used past logs to inform the suggestion. */
  agentConfidenceScore?: number;
};
