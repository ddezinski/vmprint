import type { FormatHandler } from './compiler/format-handler';

export type FormatModule = {
  name: string;
  /** Absolute path to this format's asset directory (themes/, config.defaults.yaml, etc.). */
  pluginDir: string;
  listThemes(): string[];
  createHandler(config: Record<string, unknown>): FormatHandler;
};
