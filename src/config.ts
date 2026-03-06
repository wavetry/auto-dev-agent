import path from "node:path";
import fs from "node:fs";

export interface AgentConfig {
  /** Anthropic API key */
  apiKey: string;
  /** Model to use, e.g. "claude-sonnet-4-20250514" */
  model: string;
  /** Maximum number of sessions (context windows) to run */
  maxSessions: number;
  /** Maximum tokens per session before forcing a new session */
  maxTokensPerSession: number;
  /** The target project's working directory (where code is generated) */
  projectDir: string;
  /** User's high-level project spec / requirements */
  projectSpec: string;
  /** Path to the feature list JSON file (inside projectDir) */
  featureListFile: string;
  /** Path to the progress log file (inside projectDir) */
  progressFile: string;
  /** Whether to auto-commit after each session */
  autoCommit: boolean;
  /** HTTP base URL for API testing (e.g. http://localhost:3000) */
  testBaseUrl: string;
  /** Delay in ms between sessions */
  sessionDelay: number;
}

const DEFAULTS: Partial<AgentConfig> = {
  model: "claude-sonnet-4-20250514",
  maxSessions: 50,
  maxTokensPerSession: 100000,
  featureListFile: "feature_list.json",
  progressFile: "agent-progress.txt",
  autoCommit: true,
  testBaseUrl: "http://localhost:3000",
  sessionDelay: 2000,
};

/**
 * Load config from a JSON file, env vars, and CLI overrides.
 * Priority: CLI overrides > env vars > config file > defaults.
 */
export function loadConfig(overrides: Partial<AgentConfig> = {}): AgentConfig {
  const apiKey =
    overrides.apiKey ||
    process.env.ANTHROPIC_API_KEY ||
    "";

  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is required. Set it via env var or --api-key flag."
    );
  }

  const projectDir = overrides.projectDir || process.cwd();

  // Try loading a config file from the project dir
  let fileConfig: Partial<AgentConfig> = {};
  const configPath = path.join(projectDir, "auto-dev-agent.json");
  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    } catch {
      // Ignore malformed config
    }
  }

  return {
    ...DEFAULTS,
    ...fileConfig,
    ...overrides,
    apiKey,
    projectDir,
    projectSpec: overrides.projectSpec || fileConfig.projectSpec || "",
  } as AgentConfig;
}

/**
 * Resolve a path relative to the project directory.
 */
export function projectPath(config: AgentConfig, ...segments: string[]): string {
  return path.join(config.projectDir, ...segments);
}
