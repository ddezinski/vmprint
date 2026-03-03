import { screenplayFormat } from './screenplay';
import { markdownFormat } from './markdown';
import { literatureFormat } from './literature';
import { academicFormat } from './academic';
import { manuscriptFormat } from './manuscript';
import type { FormatModule } from './types';
import { Draft2FinalError } from '../errors';

const FORMATS: ReadonlyMap<string, FormatModule> = new Map([
  [screenplayFormat.name, screenplayFormat],
  [markdownFormat.name, markdownFormat],
  [literatureFormat.name, literatureFormat],
  [academicFormat.name, academicFormat],
  [manuscriptFormat.name, manuscriptFormat],
]);

export function listFormats(): string[] {
  return Array.from(FORMATS.keys()).sort();
}

export function getFormatModule(name: string): FormatModule {
  const format = FORMATS.get(name);
  if (format) return format;
  throw new Draft2FinalError('format', name, `Unknown format "${name}". Available formats: ${listFormats().join(', ')}`, 2);
}

export function listFormatThemes(formatName: string): string[] {
  return getFormatModule(formatName).listThemes();
}

export type { FormatModule } from './types';
