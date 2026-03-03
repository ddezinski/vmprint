import type { DocumentInput, Element } from '@vmprint/engine';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function collectCoverFields(elements: Element[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const element of elements) {
    const props = asRecord(element.properties);
    // cover-line elements carry individual _coverKey/_coverValue pairs
    if (element.type === 'cover-line') {
      const key = asString(props._coverKey, '');
      const value = asString(props._coverValue, '');
      if (key) out[key] = value;
    }
    // The cover header table carries a _coverFields map for author + word-count
    const coverFields = props._coverFields;
    if (coverFields && typeof coverFields === 'object' && !Array.isArray(coverFields)) {
      for (const [key, value] of Object.entries(coverFields as Record<string, unknown>)) {
        if (typeof value === 'string' && key && value) out[key] = value;
      }
    }
  }
  return out;
}

function deriveSurname(author: string): string {
  const parts = author.trim().split(/\s+/).filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : 'Writer';
}

function deriveShortTitle(elements: Element[]): string {
  const title = elements.find((element) => element.type === 'cover-title' || element.type === 'chapter-heading');
  const raw = typeof title?.content === 'string' && title.content.trim().length > 0
    ? title.content.trim()
    : (title?.children || []).map((child) => child.content || '').join('').trim();
  if (!raw) return 'Untitled';
  return raw.length <= 30 ? raw : `${raw.slice(0, 27)}...`;
}

export function validateManuscriptCompliance(
  ir: DocumentInput,
  config: Record<string, unknown>
): void {
  const manuscript = asRecord(config.manuscript);
  const coverFields = collectCoverFields(ir.elements || []);

  const runningHeader = asRecord(manuscript.runningHeader);
  if (asBool(runningHeader.enabled, true)) {
    const format = asString(runningHeader.format, '{surname} / {shortTitle} / {n}');
    const author = coverFields.author || coverFields['byline-derived'] || 'A. Writer';
    const surname = deriveSurname(author);
    const shortTitle = deriveShortTitle(ir.elements || []);

    ir.layout.pageNumberFormat = format
      .replaceAll('{surname}', surname.toUpperCase())
      .replaceAll('{shortTitle}', shortTitle.toUpperCase());
    ir.layout.pageNumberPosition = 'top';
    ir.layout.pageNumberAlignment = 'right';
    ir.layout.pageNumberOffset = 36;
  }
}

