import chalk from "chalk";
import fs from "node:fs";
import { AgentConfig, projectPath } from "./config.js";
import { runInitializerAgent } from "./agents/initializer.js";
import { runCoderAgent } from "./agents/coder.js";
import { readFeatureList, getFeatureStats } from "./utils/features.js";

/**
 * Orchestrator: Manages the lifecycle of multiple agent sessions.
 *
 * Flow:
 * 1. Check if project is already initialized (feature_list.json exists)
 * 2. If not, run the Initializer Agent (session 1)
 * 3. Run Coding Agent sessions in a loop until:
 *    - All features pass
 *    - Max sessions reached
 *    - Fatal error occurs
 */
export async function runOrchestrator(config: AgentConfig): Promise<void> {
  console.log(chalk.bold.blue("\n╔══════════════════════════════════════╗"));
  console.log(chalk.bold.blue("║   Auto Dev Agent - Orchestrator      ║"));
  console.log(chalk.bold.blue("╚══════════════════════════════════════╝\n"));

  console.log(chalk.white(`Project: ${config.projectDir}`));
  console.log(chalk.white(`Model: ${config.model}`));
  console.log(chalk.white(`Max sessions: ${config.maxSessions}`));
  console.log(chalk.white(`Test URL: ${config.testBaseUrl}\n`));

  // Ensure project directory exists
  if (!fs.existsSync(config.projectDir)) {
    fs.mkdirSync(config.projectDir, { recursive: true });
    console.log(chalk.gray(`Created project directory: ${config.projectDir}`));
  }

  let sessionNumber = 1;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 3;

  // Phase 1: Check if initialization is needed
  const featureListPath = projectPath(config, config.featureListFile);
  const isInitialized = fs.existsSync(featureListPath);

  if (!isInitialized) {
    console.log(chalk.blue("\n--- Phase 1: Initialization ---"));
    console.log(chalk.gray("No feature_list.json found. Running Initializer Agent..."));

    const initResult = await runInitializerAgent(config);

    if (!initResult.success) {
      console.error(
        chalk.red(`Initialization failed: ${initResult.error}`)
      );
      console.error(chalk.red("Cannot proceed without initialization."));
      return;
    }

    // Verify initialization produced a feature list
    if (!fs.existsSync(featureListPath)) {
      console.error(
        chalk.red("Initializer Agent did not create feature_list.json. Aborting.")
      );
      return;
    }

    sessionNumber = 2;
    console.log(chalk.green("\nInitialization complete. Starting coding sessions...\n"));
  } else {
    console.log(chalk.gray("Project already initialized. Resuming coding sessions..."));

    // Determine session number from progress file
    const progressPath = projectPath(config, config.progressFile);
    if (fs.existsSync(progressPath)) {
      const progressContent = fs.readFileSync(progressPath, "utf-8");
      const sessionMatches = progressContent.match(/=== Session (\d+)/g);
      if (sessionMatches && sessionMatches.length > 0) {
        const lastSession = Math.max(
          ...sessionMatches.map((m) => parseInt(m.replace(/\D/g, ""), 10))
        );
        sessionNumber = lastSession + 1;
        console.log(chalk.gray(`Resuming from session ${sessionNumber}`));
      }
    }
  }

  // Phase 2: Coding loop
  console.log(chalk.blue("\n--- Phase 2: Incremental Coding ---"));

  while (sessionNumber <= config.maxSessions) {
    // Check if all done
    const featureList = readFeatureList(config);
    if (featureList) {
      const stats = getFeatureStats(featureList);
      printProgressBar(stats.passed, stats.total);

      if (stats.remaining === 0) {
        console.log(
          chalk.bold.green("\n🎉 All features are PASSING! Project complete.")
        );
        printFinalReport(config);
        return;
      }
    }

    // Run coding session
    const result = await runCoderAgent(config, sessionNumber);

    if (!result.success) {
      consecutiveFailures++;
      console.error(
        chalk.red(
          `Session ${sessionNumber} failed (${consecutiveFailures}/${maxConsecutiveFailures})`
        )
      );

      if (consecutiveFailures >= maxConsecutiveFailures) {
        console.error(
          chalk.red(
            "\nToo many consecutive failures. Stopping orchestrator."
          )
        );
        break;
      }
    } else {
      consecutiveFailures = 0;
    }

    if (result.allFeaturesDone) {
      console.log(
        chalk.bold.green("\nAll features complete! Project is done.")
      );
      printFinalReport(config);
      return;
    }

    sessionNumber++;

    // Delay between sessions
    if (sessionNumber <= config.maxSessions && config.sessionDelay > 0) {
      console.log(
        chalk.gray(
          `\nWaiting ${config.sessionDelay / 1000}s before next session...`
        )
      );
      await sleep(config.sessionDelay);
    }
  }

  console.log(
    chalk.yellow(`\nMax sessions (${config.maxSessions}) reached.`)
  );
  printFinalReport(config);
}

function printProgressBar(completed: number, total: number): void {
  const width = 40;
  const filled = Math.round((completed / total) * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const percent = Math.round((completed / total) * 100);
  console.log(
    chalk.cyan(`\n  Progress: [${bar}] ${percent}% (${completed}/${total})`)
  );
}

function printFinalReport(config: AgentConfig): void {
  const featureList = readFeatureList(config);
  if (!featureList) return;

  const stats = getFeatureStats(featureList);

  console.log(chalk.bold("\n═══ Final Report ═══"));
  console.log(chalk.white(`Project: ${featureList.projectName}`));
  console.log(chalk.green(`Features passing: ${stats.passed}`));
  console.log(chalk.red(`Features failing: ${stats.remaining}`));
  console.log(chalk.cyan(`Completion: ${stats.percent}%`));

  if (stats.remaining > 0) {
    console.log(chalk.yellow("\nRemaining features:"));
    featureList.features
      .filter((f) => !f.passes)
      .forEach((f) => {
        console.log(chalk.yellow(`  - [${f.id}] ${f.description}`));
      });
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
