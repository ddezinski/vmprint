import { listThemes } from '../compiler';
import { ScreenplayFormat } from './format';
import type { FormatModule } from '../types';

export const screenplayFormat: FormatModule = {
  name: 'screenplay',
  pluginDir: __dirname,
  listThemes() { return listThemes(__dirname); },
  createHandler(config) { return new ScreenplayFormat(config); }
};
