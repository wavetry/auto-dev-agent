import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { AgentConfig } from "../config.js";
import { getToolDefinitions, executeTool } from "../tools/index.js";
import { CODER_SYSTEM_PROMPT, getCoderUserPrompt } from "../prompts/coder.js";
import { readFeatureList, getFeatureStats } from "../utils/features.js";

export interface CoderResult {
  success: boolean;
  allFeaturesDone: boolean;
  featuresCompleted: number;
  featuresRemaining: number;
  error?: string;
}

/**
 * Run the Coding Agent for one session.
 * Makes incremental progress on one feature, tests it, commits, and updates progress.
 */
export async function runCoderAgent(
  config: AgentConfig,
  sessionNumber: number
): Promise<CoderResult> {
  const clientOpts: Record<string, any> = { apiKey: config.apiKey };
  if (config.baseUrl) {
    clientOpts.baseURL = config.baseUrl;
  }
  const client = new Anthropic(clientOpts);
  const tools = getToolDefinitions();

  console.log(chalk.blue(`\n=== Coding Agent Session ${sessionNumber} ===`));

  // Show current progress
  const featureList = readFeatureList(config);
  if (featureList) {
    const stats = getFeatureStats(featureList);
    console.log(
      chalk.cyan(
        `Progress: ${stats.passed}/${stats.total} features done (${stats.percent}%)`
      )
    );

    if (stats.remaining === 0) {
      console.log(chalk.green("All features are already passing!"));
      return {
        success: true,
        allFeaturesDone: true,
        featuresCompleted: stats.passed,
        featuresRemaining: 0,
      };
    }
  }

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: getCoderUserPrompt(sessionNumber, config.testBaseUrl),
    },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let iteration = 0;
  const maxIterations = 150;

  try {
    while (iteration < maxIterations) {
      iteration++;
      console.log(
        chalk.gray(`\n--- Session ${sessionNumber}, iteration ${iteration} ---`)
      );

      const response = await client.messages.create({
        model: config.model,
        max_tokens: 8192,
        system: CODER_SYSTEM_PROMPT,
        tools,
        messages,
      });

      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Process response content blocks
      const assistantContent: Anthropic.Messages.ContentBlock[] = [];
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        assistantContent.push(block);

        if (block.type === "text") {
          console.log(chalk.white(`[Agent] ${block.text.slice(0, 200)}`));
        } else if (block.type === "tool_use") {
          console.log(
            chalk.yellow(
              `[Tool] ${block.name}(${JSON.stringify(block.input).slice(0, 100)})`
            )
          );

          const result = await executeTool(
            block.name,
            block.input as Record<string, any>,
            config,
            sessionNumber
          );

          console.log(chalk.gray(`[Result] ${result.slice(0, 150)}`));

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      // Add assistant message
      messages.push({ role: "assistant", content: assistantContent });

      // If there are tool results, add them and continue
      if (toolResults.length > 0) {
        messages.push({ role: "user", content: toolResults });
      }

      // If stop reason is "end_turn", session is done
      if (response.stop_reason === "end_turn") {
        break;
      }

      // Token budget check
      if (totalInputTokens + totalOutputTokens > config.maxTokensPerSession) {
        console.log(
          chalk.yellow("\nToken budget exceeded, ending session.")
        );
        break;
      }
    }

    // Check final feature status
    const finalFeatureList = readFeatureList(config);
    const stats = finalFeatureList
      ? getFeatureStats(finalFeatureList)
      : { passed: 0, total: 0, remaining: 0, percent: 0 };

    console.log(chalk.green(`\n=== Session ${sessionNumber} Complete ===`));
    console.log(
      chalk.cyan(
        `Progress: ${stats.passed}/${stats.total} features (${stats.percent}%)`
      )
    );
    console.log(
      chalk.gray(
        `Tokens used: ${totalInputTokens} in / ${totalOutputTokens} out`
      )
    );

    return {
      success: true,
      allFeaturesDone: stats.remaining === 0,
      featuresCompleted: stats.passed,
      featuresRemaining: stats.remaining,
    };
  } catch (err: any) {
    console.error(
      chalk.red(`\nCoding Agent error (session ${sessionNumber}): ${err.message}`)
    );
    return {
      success: false,
      allFeaturesDone: false,
      featuresCompleted: 0,
      featuresRemaining: -1,
      error: err.message,
    };
  }
}
