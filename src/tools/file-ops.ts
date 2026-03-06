import fs from "node:fs";
import path from "node:path";

/**
 * Read a file's contents.
 */
export function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) {
    return `Error: File not found: ${filePath}`;
  }
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Write content to a file, creating directories as needed.
 */
export function writeFile(filePath: string, content: string): string {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, "utf-8");
  return `File written: ${filePath}`;
}

/**
 * List files/directories at a path.
 */
export function listFiles(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    return `Error: Directory not found: ${dirPath}`;
  }
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return entries
    .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
    .join("\n");
}

/**
 * Append content to a file.
 */
export function appendToFile(filePath: string, content: string): string {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.appendFileSync(filePath, content, "utf-8");
  return `Content appended to: ${filePath}`;
}
