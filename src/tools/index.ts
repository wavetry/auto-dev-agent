import path from "node:path";
import { AgentConfig } from "../config.js";
import { executeBash } from "./bash.js";
import { readFile, writeFile, listFiles, appendToFile } from "./file-ops.js";
import {
  gitInit, gitAdd, gitCommit, gitLog, gitDiff, gitStatus, gitRevert,
} from "./git.js";
import { httpTest } from "./http-test.js";
import Anthropic from "@anthropic-ai/sdk";

type Tool = Anthropic.Messages.Tool;

/**
 * All tools exposed to the Agent as Anthropic tool definitions.
 */
export function getToolDefinitions(): Tool[] {
  return [
    {
      name: "bash",
      description:
        "Execute a shell command. Use for running dev servers, installing dependencies, running tests, etc. Returns stdout, stderr, and exit code.",
      input_schema: {
        type: "object" as const,
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute",
          },
          timeout_ms: {
            type: "number",
            description: "Timeout in milliseconds (default 60000)",
          },
        },
        required: ["command"],
      },
    },
    {
      name: "read_file",
      description: "Read the contents of a file at the given path (relative to project root).",
      input_schema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description: "File path relative to project root",
          },
        },
        required: ["path"],
      },
    },
    {
      name: "write_file",
      description:
        "Write content to a file. Creates parent directories if needed. Use for creating or overwriting files.",
      input_schema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description: "File path relative to project root",
          },
          content: {
            type: "string",
            description: "Content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "append_file",
      description: "Append content to the end of a file.",
      input_schema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description: "File path relative to project root",
          },
          content: {
            type: "string",
            description: "Content to append",
          },
        },
        required: ["path", "content"],
      },
    },
    {
      name: "list_files",
      description:
        "List files and directories at the given path (relative to project root).",
      input_schema: {
        type: "object" as const,
        properties: {
          path: {
            type: "string",
            description: "Directory path relative to project root (default: '.')",
          },
        },
        required: [],
      },
    },
    {
      name: "git_init",
      description: "Initialize a new git repository in the project directory.",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "git_add",
      description: "Stage files for git commit.",
      input_schema: {
        type: "object" as const,
        properties: {
          files: {
            type: "string",
            description: "Files to stage (default: '.' for all)",
          },
        },
        required: [],
      },
    },
    {
      name: "git_commit",
      description: "Create a git commit with a descriptive message.",
      input_schema: {
        type: "object" as const,
        properties: {
          message: {
            type: "string",
            description: "Commit message describing what was done",
          },
        },
        required: ["message"],
      },
    },
    {
      name: "git_log",
      description: "View recent git commit history.",
      input_schema: {
        type: "object" as const,
        properties: {
          count: {
            type: "number",
            description: "Number of commits to show (default: 20)",
          },
        },
        required: [],
      },
    },
    {
      name: "git_diff",
      description: "Show current unstaged changes.",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "git_status",
      description: "Show git status (modified, staged, untracked files).",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "git_revert",
      description:
        "Revert all uncommitted changes. Use when code is in a broken state and you need to go back to the last commit.",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "http_test",
      description:
        "Make an HTTP request to test API endpoints. Returns status code, headers, body, and duration. Use this for end-to-end API testing.",
      input_schema: {
        type: "object" as const,
        properties: {
          url: {
            type: "string",
            description: "Full URL to request (e.g. http://localhost:3000/api/users)",
          },
          method: {
            type: "string",
            description: "HTTP method: GET, POST, PUT, DELETE, PATCH (default: GET)",
          },
          headers: {
            type: "object",
            description: "HTTP headers as key-value pairs",
          },
          body: {
            type: "string",
            description: "Request body (for POST/PUT/PATCH)",
          },
        },
        required: ["url"],
      },
    },
    {
      name: "update_feature_status",
      description:
        "Mark a feature as passing or failing in the feature list. ONLY mark as passing after you have thoroughly tested the feature end-to-end. It is UNACCEPTABLE to mark a feature as passing without proper testing.",
      input_schema: {
        type: "object" as const,
        properties: {
          feature_id: {
            type: "string",
            description: "The ID of the feature to update",
          },
          passes: {
            type: "boolean",
            description: "Whether the feature passes (true) or fails (false)",
          },
        },
        required: ["feature_id", "passes"],
      },
    },
    {
      name: "update_progress",
      description:
        "Write a progress update to the progress log file. Do this at the end of every session to document what you accomplished.",
      input_schema: {
        type: "object" as const,
        properties: {
          feature_worked_on: {
            type: "string",
            description: "Which feature you worked on",
          },
          summary: {
            type: "string",
            description: "Summary of what was accomplished",
          },
          files_changed: {
            type: "array",
            items: { type: "string" },
            description: "List of files that were created or modified",
          },
          status: {
            type: "string",
            enum: ["completed", "in_progress", "blocked"],
            description: "Status of the work on this feature",
          },
        },
        required: ["feature_worked_on", "summary", "files_changed", "status"],
      },
    },
  ];
}

/**
 * Execute a tool call from the Agent and return the result.
 */
export async function executeTool(
  toolName: string,
  input: Record<string, any>,
  config: AgentConfig,
  sessionNumber: number
): Promise<string> {
  const cwd = config.projectDir;

  switch (toolName) {
    case "bash": {
      const result = executeBash(
        input.command,
        cwd,
        input.timeout_ms || 60000
      );
      let output = "";
      if (result.stdout) output += result.stdout;
      if (result.stderr) output += `\n[stderr]: ${result.stderr}`;
      output += `\n[exit code]: ${result.exitCode}`;
      return output || "(no output)";
    }

    case "read_file":
      return readFile(path.join(cwd, input.path));

    case "write_file":
      return writeFile(path.join(cwd, input.path), input.content);

    case "append_file":
      return appendToFile(path.join(cwd, input.path), input.content);

    case "list_files":
      return listFiles(path.join(cwd, input.path || "."));

    case "git_init":
      return gitInit(cwd);

    case "git_add":
      return gitAdd(cwd, input.files || ".");

    case "git_commit":
      return gitCommit(cwd, input.message);

    case "git_log":
      return gitLog(cwd, input.count || 20);

    case "git_diff":
      return gitDiff(cwd);

    case "git_status":
      return gitStatus(cwd);

    case "git_revert":
      return gitRevert(cwd);

    case "http_test": {
      const result = await httpTest(input.url, {
        method: input.method,
        headers: input.headers,
        body: input.body,
      });
      return JSON.stringify(result, null, 2);
    }

    case "update_feature_status": {
      // Read, update, write the feature list
      const { readFeatureList, writeFeatureList } = await import(
        "../utils/features.js"
      );
      const featureList = readFeatureList(config);
      if (!featureList)
        return "Error: feature_list.json not found";
      const feature = featureList.features.find(
        (f) => f.id === input.feature_id
      );
      if (!feature)
        return `Error: Feature "${input.feature_id}" not found`;
      feature.passes = input.passes;
      writeFeatureList(config, featureList);
      return `Feature "${input.feature_id}" marked as ${input.passes ? "PASSING" : "FAILING"}`;
    }

    case "update_progress": {
      const { appendProgress } = await import("../utils/progress.js");
      appendProgress(config, {
        session: sessionNumber,
        timestamp: new Date().toISOString(),
        featureWorkedOn: input.feature_worked_on,
        summary: input.summary,
        filesChanged: input.files_changed || [],
        status: input.status,
      });
      return "Progress updated successfully";
    }

    default:
      return `Error: Unknown tool "${toolName}"`;
  }
}
