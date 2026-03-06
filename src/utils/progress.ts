import fs from "node:fs";
import { AgentConfig, projectPath } from "../config.js";

export interface ProgressEntry {
  session: number;
  timestamp: string;
  featureWorkedOn: string;
  summary: string;
  filesChanged: string[];
  status: "completed" | "in_progress" | "blocked";
}

/**
 * Read the progress file content as raw text.
 */
export function readProgressRaw(config: AgentConfig): string {
  const filePath = projectPath(config, config.progressFile);
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Append a progress entry to the progress file.
 */
export function appendProgress(
  config: AgentConfig,
  entry: ProgressEntry
): void {
  const filePath = projectPath(config, config.progressFile);

  const block = `
=== Session ${entry.session} | ${entry.timestamp} ===
Feature: ${entry.featureWorkedOn}
Status: ${entry.status}
Summary: ${entry.summary}
Files changed: ${entry.filesChanged.join(", ") || "none"}
${"=".repeat(50)}
`;

  fs.appendFileSync(filePath, block, "utf-8");
}

/**
 * Initialize an empty progress file.
 */
export function initProgressFile(config: AgentConfig, projectName: string): void {
  const filePath = projectPath(config, config.progressFile);
  const header = `# Agent Progress Log - ${projectName}
# This file tracks what each agent session accomplished.
# Do NOT delete or modify existing entries.
# Created: ${new Date().toISOString()}

`;
  fs.writeFileSync(filePath, header, "utf-8");
}
