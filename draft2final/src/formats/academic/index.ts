import { listThemes } from '../compiler';
import { AcademicFormat } from './format';
import type { FormatModule } from '../types';

export const academicFormat: FormatModule = {
  name: 'academic',
  pluginDir: __dirname,
  listThemes() { return listThemes(__dirname); },
  createHandler(config) { return new AcademicFormat(config); }
};
