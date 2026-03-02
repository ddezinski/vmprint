import { listThemes } from '../compiler';
import { MarkdownFormat } from './format';
import type { FormatModule } from '../types';

export const markdownFormat: FormatModule = {
  name: 'markdown',
  pluginDir: __dirname,
  listThemes() { return listThemes(__dirname); },
  createHandler(config) { return new MarkdownFormat(config); }
};
