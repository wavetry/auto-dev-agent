import Anthropic from "@anthropic-ai/sdk";
import chalk from "chalk";
import { AgentConfig } from "../config.js";
import { getToolDefinitions, executeTool } from "../tools/index.js";
import {
  INITIALIZER_SYSTEM_PROMPT,
  getInitializerUserPrompt,
} from "../prompts/initializer.js";

/**
 * Run the Initializer Agent - first session only.
 * Sets up project skeleton, feature list, init.sh, and initial git commit.
 */
export async function runInitializerAgent(
  config: AgentConfig
): Promise<{ success: boolean; error?: string }> {
  const client = new Anthropic({ apiKey: config.apiKey });
  const tools = getToolDefinitions();

  console.log(chalk.blue("\n=== Initializer Agent Starting ==="));
  console.log(chalk.gray(`Model: ${config.model}`));
  console.log(chalk.gray(`Project dir: ${config.projectDir}`));
  console.log(chalk.gray(`Spec: ${config.projectSpec.slice(0, 100)}...`));

  const messages: Anthropic.Messages.MessageParam[] = [
    {
      role: "user",
      content: getInitializerUserPrompt(config.projectSpec, config.testBaseUrl),
    },
  ];

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let iteration = 0;
  const maxIterations = 100;

  try {
    while (iteration < maxIterations) {
      iteration++;
      console.log(
        chalk.gray(`\n--- Initializer iteration ${iteration} ---`)
      );

      const response = await client.messages.create({
        model: config.model,
        max_tokens: 8192,
        system: INITIALIZER_SYSTEM_PROMPT,
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
            chalk.yellow(`[Tool] ${block.name}(${JSON.stringify(block.input).slice(0, 100)})`)
          );

          const result = await executeTool(
            block.name,
            block.input as Record<string, any>,
            config,
            1 // session 1
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

      // If stop reason is "end_turn" (no more tool calls), we're done
      if (response.stop_reason === "end_turn") {
        console.log(chalk.green("\n=== Initializer Agent Complete ==="));
        console.log(
          chalk.gray(
            `Tokens used: ${totalInputTokens} in / ${totalOutputTokens} out`
          )
        );
        return { success: true };
      }

      // Token budget check
      if (totalInputTokens + totalOutputTokens > config.maxTokensPerSession) {
        console.log(
          chalk.yellow("\nToken budget exceeded, ending session early.")
        );
        return { success: true };
      }
    }

    console.log(chalk.yellow("\nMax iterations reached."));
    return { success: true };
  } catch (err: any) {
    console.error(chalk.red(`\nInitializer Agent error: ${err.message}`));
    return { success: false, error: err.message };
  }
}
