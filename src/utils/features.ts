import fs from "node:fs";
import path from "node:path";
import { AgentConfig, projectPath } from "../config.js";

export interface Feature {
  id: string;
  category: string;
  description: string;
  steps: string[];
  passes: boolean;
  priority: number; // lower = higher priority
}

export interface FeatureList {
  projectName: string;
  totalFeatures: number;
  features: Feature[];
}

/**
 * Read the feature list from disk.
 */
export function readFeatureList(config: AgentConfig): FeatureList | null {
  const filePath = projectPath(config, config.featureListFile);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

/**
 * Write the feature list to disk.
 */
export function writeFeatureList(
  config: AgentConfig,
  featureList: FeatureList
): void {
  const filePath = projectPath(config, config.featureListFile);
  fs.writeFileSync(filePath, JSON.stringify(featureList, null, 2), "utf-8");
}

/**
 * Get completion stats.
 */
export function getFeatureStats(featureList: FeatureList): {
  total: number;
  passed: number;
  remaining: number;
  percent: number;
} {
  const total = featureList.features.length;
  const passed = featureList.features.filter((f) => f.passes).length;
  return {
    total,
    passed,
    remaining: total - passed,
    percent: total > 0 ? Math.round((passed / total) * 100) : 0,
  };
}

/**
 * Get the next feature to work on (highest priority, not yet passing).
 */
export function getNextFeature(featureList: FeatureList): Feature | null {
  const pending = featureList.features
    .filter((f) => !f.passes)
    .sort((a, b) => a.priority - b.priority);
  return pending.length > 0 ? pending[0] : null;
}
