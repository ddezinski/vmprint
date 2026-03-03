import { listThemes } from '../compiler';
import { ManuscriptFormat } from './format';
import type { FormatModule } from '../types';

export const manuscriptFormat: FormatModule = {
  name: 'manuscript',
  pluginDir: __dirname,
  listThemes() { return listThemes(__dirname); },
  createHandler(config) { return new ManuscriptFormat(config); }
};

