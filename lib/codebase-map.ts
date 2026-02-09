/**
 * Load CODEBASE_MAP.json and produce an LLM-ready summary for the Issue Monitoring Agent
 * (file paths + roles so the model can suggest code locations and snippets).
 */

import { readFileSync } from "fs";
import { join } from "path";

export type CodebaseMapFile = { path: string; role: string };
export type CodebaseMap = {
  meta?: { projectName?: string; description?: string };
  routing?: { pages?: Record<string, string>; apiRoutes?: Record<string, string> };
  files?: CodebaseMapFile[];
  fileToPurposeMap?: Record<string, string>;
};

let cached: CodebaseMap | null = null;

export function loadCodebaseMap(): CodebaseMap {
  if (cached) return cached;
  try {
    const path = join(process.cwd(), "CODEBASE_MAP.json");
    const raw = readFileSync(path, "utf-8");
    cached = JSON.parse(raw) as CodebaseMap;
    return cached;
  } catch {
    return { files: [], fileToPurposeMap: {} };
  }
}

/** Condensed map for LLM: file path + role/purpose (one line per file). */
export function getCodebaseMapForLLM(): string {
  const map = loadCodebaseMap();
  const lines: string[] = [
    "Codebase map (use to suggest codeLocation and codeSnippetHint):",
    `Project: ${map.meta?.projectName ?? "Unknown"}`,
    "",
  ];
  if (map.files?.length) {
    lines.push("Files (path -> role):");
    map.files.forEach((f) => lines.push(`  ${f.path} -> ${f.role}`));
  }
  if (map.fileToPurposeMap && Object.keys(map.fileToPurposeMap).length > 0) {
    lines.push("");
    lines.push("File purpose (path -> purpose):");
    Object.entries(map.fileToPurposeMap).forEach(([path, purpose]) =>
      lines.push(`  ${path} -> ${purpose}`)
    );
  }
  if (map.routing?.pages && Object.keys(map.routing.pages).length > 0) {
    lines.push("");
    lines.push("Routes (URL -> page/description):");
    Object.entries(map.routing.pages).slice(0, 30).forEach(([url, desc]) =>
      lines.push(`  ${url} -> ${desc}`)
    );
  }
  return lines.join("\n");
}
