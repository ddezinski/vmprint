import fs from 'node:fs';
import path from 'node:path';

/**
 * Read a file synchronously, returning its content or null if it cannot be read.
 */
export function tryReadFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Resolve a format asset path relative to the plugin's own directory.
 * Returns the resolved path if it exists, or null otherwise.
 * Works for both files and directories.
 */
export function resolveFormatAsset(pluginDir: string, ...segments: string[]): string | null {
  const candidate = path.join(pluginDir, ...segments);
  return fs.existsSync(candidate) ? candidate : null;
}
