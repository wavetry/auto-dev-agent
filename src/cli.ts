#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import { loadConfig } from "./config.js";
import { runOrchestrator } from "./orchestrator.js";
import { readFeatureList, getFeatureStats } from "./utils/features.js";
import { readProgressRaw } from "./utils/progress.js";

const program = new Command();

program
  .name("auto-dev-agent")
  .description(
    "Autonomous long-running development agent. Inspired by Anthropic's approach to effective harnesses for long-running agents."
  )
  .version("1.0.0");

// Main "run" command
program
  .command("run")
  .description("Start the autonomous development agent")
  .requiredOption("--spec <spec>", "Project specification / requirements (string or file path)")
  .option("--project-dir <dir>", "Target project directory", process.cwd())
  .option("--api-key <key>", "Anthropic API key (or set ANTHROPIC_API_KEY env var)")
  .option("--base-url <url>", "API base URL (for third-party providers like Aliyun Bailian)")
  .option("--model <model>", "Model to use", "claude-sonnet-4-20250514")
  .option("--max-sessions <n>", "Maximum number of sessions", "50")
  .option("--max-tokens <n>", "Max tokens per session", "100000")
  .option("--test-url <url>", "Base URL for API testing", "http://localhost:3000")
  .option("--session-delay <ms>", "Delay between sessions in ms", "2000")
  .option("--no-auto-commit", "Disable automatic git commits")
  .action(async (opts) => {
    try {
      // If spec is a file path, read it
      let spec = opts.spec;
      const fs = await import("node:fs");
      if (fs.existsSync(spec)) {
        spec = fs.readFileSync(spec, "utf-8");
      }

      const projectDir = path.resolve(opts.projectDir);

      const config = loadConfig({
        apiKey: opts.apiKey,
        baseUrl: opts.baseUrl,
        model: opts.model,
        maxSessions: parseInt(opts.maxSessions, 10),
        maxTokensPerSession: parseInt(opts.maxTokens, 10),
        projectDir,
        projectSpec: spec,
        testBaseUrl: opts.testUrl,
        sessionDelay: parseInt(opts.sessionDelay, 10),
        autoCommit: opts.autoCommit !== false,
      });

      await runOrchestrator(config);
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

// "status" command - view current progress
program
  .command("status")
  .description("View current project progress")
  .option("--project-dir <dir>", "Target project directory", process.cwd())
  .action(async (opts) => {
    const projectDir = path.resolve(opts.projectDir);
    const config = loadConfig({
      apiKey: "dummy", // Not needed for status
      projectDir,
      projectSpec: "",
    });

    const featureList = readFeatureList(config);
    if (!featureList) {
      console.log(chalk.yellow("No feature_list.json found. Project not initialized."));
      return;
    }

    const stats = getFeatureStats(featureList);
    console.log(chalk.bold(`\nProject: ${featureList.projectName}`));
    console.log(chalk.green(`Passing: ${stats.passed}`));
    console.log(chalk.red(`Failing: ${stats.remaining}`));
    console.log(chalk.cyan(`Total: ${stats.total} (${stats.percent}%)`));

    console.log(chalk.bold("\nFeatures:"));
    featureList.features.forEach((f) => {
      const icon = f.passes ? chalk.green("PASS") : chalk.red("FAIL");
      console.log(`  [${icon}] ${f.id}: ${f.description}`);
    });
  });

// "progress" command - view progress log
program
  .command("progress")
  .description("View the agent progress log")
  .option("--project-dir <dir>", "Target project directory", process.cwd())
  .action(async (opts) => {
    const projectDir = path.resolve(opts.projectDir);
    const config = loadConfig({
      apiKey: "dummy",
      projectDir,
      projectSpec: "",
    });

    const progress = readProgressRaw(config);
    if (!progress) {
      console.log(chalk.yellow("No progress file found."));
      return;
    }

    console.log(progress);
  });

// "resume" command - resume from existing state
program
  .command("resume")
  .description("Resume development from the current project state")
  .option("--project-dir <dir>", "Target project directory", process.cwd())
  .option("--api-key <key>", "Anthropic API key")
  .option("--base-url <url>", "API base URL (for third-party providers)")
  .option("--model <model>", "Model to use", "claude-sonnet-4-20250514")
  .option("--max-sessions <n>", "Maximum number of sessions", "50")
  .option("--max-tokens <n>", "Max tokens per session", "100000")
  .option("--test-url <url>", "Base URL for API testing", "http://localhost:3000")
  .option("--session-delay <ms>", "Delay between sessions in ms", "2000")
  .action(async (opts) => {
    try {
      const projectDir = path.resolve(opts.projectDir);

      const config = loadConfig({
        apiKey: opts.apiKey,
        baseUrl: opts.baseUrl,
        model: opts.model,
        maxSessions: parseInt(opts.maxSessions, 10),
        maxTokensPerSession: parseInt(opts.maxTokens, 10),
        projectDir,
        projectSpec: "", // Not needed for resume
        testBaseUrl: opts.testUrl,
        sessionDelay: parseInt(opts.sessionDelay, 10),
      });

      await runOrchestrator(config);
    } catch (err: any) {
      console.error(chalk.red(`Error: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
