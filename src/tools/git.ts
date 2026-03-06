import { executeBash } from "./bash.js";

/**
 * Git operations for the agent.
 */
export function gitInit(cwd: string): string {
  const result = executeBash("git init", cwd);
  return result.stdout || result.stderr;
}

export function gitAdd(cwd: string, files: string = "."): string {
  const result = executeBash(`git add ${files}`, cwd);
  return result.exitCode === 0
    ? "Files staged successfully"
    : `Error: ${result.stderr}`;
}

export function gitCommit(cwd: string, message: string): string {
  const result = executeBash(
    `git commit -m "${message.replace(/"/g, '\\"')}"`,
    cwd
  );
  return result.stdout || result.stderr;
}

export function gitLog(cwd: string, count: number = 20): string {
  const result = executeBash(
    `git log --oneline -${count} --no-color`,
    cwd
  );
  return result.stdout || "(no commits yet)";
}

export function gitDiff(cwd: string): string {
  const result = executeBash("git diff --stat --no-color", cwd);
  return result.stdout || "(no changes)";
}

export function gitStatus(cwd: string): string {
  const result = executeBash("git status --short", cwd);
  return result.stdout || "(clean working directory)";
}

export function gitRevert(cwd: string): string {
  const result = executeBash("git checkout -- .", cwd);
  return result.exitCode === 0
    ? "Reverted all changes"
    : `Error: ${result.stderr}`;
}
