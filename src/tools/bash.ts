import { execSync, ExecSyncOptions } from "node:child_process";

/**
 * Execute a bash/shell command and return stdout.
 * Used as a tool for the Agent.
 */
export function executeBash(
  command: string,
  cwd: string,
  timeoutMs: number = 60000
): { stdout: string; stderr: string; exitCode: number } {
  const opts: ExecSyncOptions = {
    cwd,
    timeout: timeoutMs,
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024, // 10MB
    shell: process.platform === "win32" ? "cmd.exe" : "/bin/bash",
  };

  try {
    const stdout = execSync(command, {
      ...opts,
      stdio: ["pipe", "pipe", "pipe"],
    }) as unknown as string;
    return { stdout: stdout || "", stderr: "", exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: (err.stdout as string) || "",
      stderr: (err.stderr as string) || "",
      exitCode: err.status ?? 1,
    };
  }
}
