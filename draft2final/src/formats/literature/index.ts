import { listThemes } from '../compiler';
import { LiteratureFormat } from './format';
import type { FormatModule } from '../types';

export const literatureFormat: FormatModule = {
  name: 'literature',
  pluginDir: __dirname,
  listThemes() { return listThemes(__dirname); },
  createHandler(config) { return new LiteratureFormat(config); }
};
