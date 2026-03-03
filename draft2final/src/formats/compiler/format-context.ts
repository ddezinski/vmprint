import type { Element, ElementStyle } from '@vmprint/engine';
import type { SemanticNode } from '../../semantic';
import type { ThemeDefinition } from './theme-loader';
import type { ResolvedImage } from './image';
import { inlineToElements, applySmartQuotes } from './inline';
import { createImageResolver } from './image';
import { formatNumber as doFormatNumber } from './numbering';
export type TableEmitOptions = {
  zebra?: boolean;
  zebraColor?: string;
  headerColor?: string;
  marginLeft?: number;
  marginBottom?: number;
};

export interface FormatContext {
  /**
   * Emit a leaf element.
   *   content: SemanticNode[] → compiler runs inline pipeline to produce children
   *   content: string        → literal text, no inline processing
   */
  emit(role: string, content: string | SemanticNode[], properties?: Record<string, unknown>): void;
  /** Emit a standalone block image. Compiler resolves the image and embeds the payload. */
  emitImage(imageNode: SemanticNode, properties?: Record<string, unknown>): void;
  /** Emit a full table structure from a SemanticNode of kind 'table'. */
  emitTable(tableNode: SemanticNode, options?: TableEmitOptions): void;
  /** Emit a single reference list item with an inline-mode hyperlink. */
  emitReferenceItem(numberPrefix: string, url: string, title?: string): void;
  /** Emit a prebuilt VMPrint element (for bespoke emitters such as screenplay dialogue). */
  emitRaw(element: Element): void;
  /** Run the inline pipeline on a SemanticNode[] and return the resulting Element[]. */
  processInline(nodes: SemanticNode[]): Element[];
  /** Format a number using a standard numbering style. */
  formatNumber(value: number, style: 'decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman'): string;
  /** Register a link URL for citation output. Returns 0 for empty URLs. */
  registerLink(url: string, title?: string): number;
  /** Returns the number of links registered so far. */
  registeredLinkCount(): number;
  /** Returns all registered links in registration order. */
  registeredLinks(): readonly { index: number; url: string; title?: string }[];
  /** Register a footnote by id and content. Returns 0 for empty ids. */
  registerFootnote(identifier: string, content?: SemanticNode[]): number;
  /** Returns the number of registered footnotes so far. */
  registeredFootnoteCount(): number;
  /** Returns all registered footnotes in registration order. */
  registeredFootnotes(): readonly { index: number; identifier: string; content?: SemanticNode[] }[];
  /** Look up a style from the active theme by role name. */
  getThemeStyle(role: string): ElementStyle | undefined;
  /** The fully resolved format configuration. */
  readonly config: Record<string, unknown>;
}

// ─── Reference registry ───────────────────────────────────────────────────────

type ReferenceEntry = { index: number; url: string; title?: string };
type ReferenceRegistry = { byUrl: Map<string, number>; entries: ReferenceEntry[] };
type FootnoteEntry = { index: number; identifier: string; content?: SemanticNode[] };
type FootnoteRegistry = { byIdentifier: Map<string, number>; entries: FootnoteEntry[] };

export function createReferenceRegistry(): ReferenceRegistry {
  return { byUrl: new Map<string, number>(), entries: [] };
}

function createFootnoteRegistry(): FootnoteRegistry {
  return { byIdentifier: new Map<string, number>(), entries: [] };
}

export function registerReference(
  url: string,
  title: string | undefined,
  registry: ReferenceRegistry,
  dedupe: boolean
): number {
  const normalized = (url || '').trim();
  if (normalized.length === 0) return 0;

  if (dedupe) {
    const existing = registry.byUrl.get(normalized);
    if (existing !== undefined) return existing;
  }

  const index = registry.entries.length + 1;
  registry.byUrl.set(normalized, index);
  registry.entries.push({ index, url: normalized, title });
  return index;
}

export function getRegistryEntries(registry: ReferenceRegistry): ReferenceEntry[] {
  return registry.entries;
}

// ─── Implementation ──────────────────────────────────────────────────────────

export class FormatContextImpl implements FormatContext {
  private readonly elements: Element[] = [];
  private readonly registry: ReferenceRegistry = createReferenceRegistry();
  private readonly footnotes: FootnoteRegistry = createFootnoteRegistry();
  private readonly resolveImage: (node: SemanticNode) => ResolvedImage;
  private readonly themeStyles: Record<string, ElementStyle>;

  constructor(
    private readonly theme: ThemeDefinition,
    public readonly config: Record<string, unknown>,
    inputPath: string
  ) {
    this.themeStyles = theme.styles;
    this.resolveImage = createImageResolver(inputPath);
  }

  emit(role: string, content: string | SemanticNode[], properties?: Record<string, unknown>): void {
    let element: Element;

    if (typeof content === 'string') {
      const typographyCfg = this.section('typography');
      const sqEnabled = typographyCfg.smartQuotes !== false;
      element = {
        type: role,
        content: sqEnabled ? applySmartQuotes(content) : content,
        ...(properties ? { properties } : {})
      };
    } else {
      const inlineCtx = this.makeInlineContext();
      const children = inlineToElements(content, inlineCtx);
      element = {
        type: role,
        content: '',
        children,
        ...(properties ? { properties } : {})
      };
    }

    this.elements.push(element);
  }

  emitImage(imageNode: SemanticNode, properties?: Record<string, unknown>): void {
    const resolvedImage = this.resolveImage(imageNode);
    const element: Element = {
      type: 'image',
      content: '',
      properties: {
        image: {
          data: resolvedImage.data,
          mimeType: resolvedImage.mimeType,
          fit: 'contain'
        },
        sourceRange: imageNode.sourceRange,
        sourceSyntax: imageNode.sourceSyntax,
        ...(properties || {})
      }
    };
    this.elements.push(element);
  }

  emitTable(tableNode: SemanticNode, options: TableEmitOptions = {}): void {
    const rows = (tableNode.children || []).filter((n) => n.kind === 'tableRow');
    const alignments = Array.isArray(tableNode.align) ? tableNode.align : undefined;
    const inlineCtx = this.makeInlineContext();

    const rowElements = rows.map((row, rowIndex) => {
      const cells = (row.children || []).filter((n) => n.kind === 'tableCell');
      const cellElements = cells.map((cell, cellIndex) => {
        const alignment = alignments && cellIndex < alignments.length ? alignments[cellIndex] : null;
        const isBodyRow = rowIndex > 0;
        const shouldStripe = options.zebra && isBodyRow && ((rowIndex - 1) % 2 === 1);
        const styleOverride: Record<string, unknown> = {};

        if (alignment === 'left' || alignment === 'right' || alignment === 'center') {
          styleOverride.textAlign = alignment;
        }
        if (shouldStripe && options.zebraColor) {
          styleOverride.backgroundColor = options.zebraColor;
        }

        const children = inlineToElements(cell.children || [], inlineCtx);
        const cellProps: Record<string, unknown> = {
          sourceRange: cell.sourceRange,
          sourceSyntax: cell.sourceSyntax
        };
        if (Object.keys(styleOverride).length > 0) cellProps.style = styleOverride;

        return { type: 'table-cell', content: '', children, properties: cellProps };
      });

      const rowProps: Record<string, unknown> = {
        sourceRange: row.sourceRange,
        sourceSyntax: row.sourceSyntax
      };
      if (rowIndex === 0) rowProps.semanticRole = 'header';

      return { type: 'table-row', content: '', children: cellElements, properties: rowProps };
    });

    const tableStyle: Record<string, unknown> = {};
    if (options.marginLeft !== undefined) tableStyle.marginLeft = options.marginLeft;
    if (options.marginBottom !== undefined) tableStyle.marginBottom = options.marginBottom;

    const headerCellStyle: Record<string, unknown> = { fontWeight: 700 };
    if (options.headerColor) headerCellStyle.backgroundColor = options.headerColor;

    const tableProps: Record<string, unknown> = {
      table: { headerRows: 1, repeatHeader: true, headerCellStyle },
      sourceRange: tableNode.sourceRange,
      sourceSyntax: tableNode.sourceSyntax
    };
    if (Object.keys(tableStyle).length > 0) tableProps.style = tableStyle;

    this.elements.push({
      type: 'table',
      content: '',
      children: rowElements as Element[],
      properties: tableProps
    });
  }

  emitReferenceItem(numberPrefix: string, url: string, title?: string): void {
    const linkStyle = this.themeStyles['link'] as Record<string, unknown> | undefined;
    const titlePart = title && title.trim().length > 0 ? `${title.trim()}. ` : '';

    const element: Element = {
      type: 'references-item',
      content: '',
      children: [
        { type: 'text', content: `${numberPrefix}${titlePart}` },
        {
          type: 'inline',
          content: '',
          properties: {
            ...(linkStyle ? { style: linkStyle } : {}),
            linkTarget: url
          },
          children: [{ type: 'text', content: url }]
        }
      ]
    };
    this.elements.push(element);
  }

  emitRaw(element: Element): void {
    this.elements.push(element);
  }

  processInline(nodes: SemanticNode[]): Element[] {
    const inlineCtx = this.makeInlineContext();
    return inlineToElements(nodes, inlineCtx);
  }

  formatNumber(value: number, style: 'decimal' | 'lower-alpha' | 'upper-alpha' | 'lower-roman' | 'upper-roman'): string {
    return doFormatNumber(value, style);
  }

  registerLink(url: string, title?: string): number {
    const dedupe = this.section('links').dedupe !== false;
    return registerReference(url, title, this.registry, dedupe);
  }

  registeredLinkCount(): number {
    return this.registry.entries.length;
  }

  registeredLinks(): readonly { index: number; url: string; title?: string }[] {
    return this.registry.entries;
  }

  registerFootnote(identifier: string, content?: SemanticNode[]): number {
    const normalized = String(identifier || '').trim().toLowerCase();
    if (normalized.length === 0) return 0;
    const existing = this.footnotes.byIdentifier.get(normalized);
    if (existing !== undefined) {
      const entry = this.footnotes.entries.find((item) => item.index === existing);
      if (entry && !entry.content && content && content.length > 0) {
        entry.content = content;
      }
      return existing;
    }

    const index = this.footnotes.entries.length + 1;
    this.footnotes.byIdentifier.set(normalized, index);
    this.footnotes.entries.push({ index, identifier: normalized, content });
    return index;
  }

  registeredFootnoteCount(): number {
    return this.footnotes.entries.length;
  }

  registeredFootnotes(): readonly { index: number; identifier: string; content?: SemanticNode[] }[] {
    return this.footnotes.entries;
  }

  getThemeStyle(role: string): ElementStyle | undefined {
    return this.themeStyles[role];
  }

  // Called by compile.ts after flush() to retrieve the final element list
  getElements(): Element[] {
    return this.elements;
  }

  private section(key: string): Record<string, unknown> {
    const v = this.config[key];
    return (v !== null && typeof v === 'object' && !Array.isArray(v))
      ? v as Record<string, unknown>
      : {};
  }

  private makeInlineContext() {
    const linksCfg = this.section('links');
    const footnotesTop = this.section('footnotes');
    const manuscript = this.section('manuscript');
    const manuscriptFootnotes = manuscript.footnotes && typeof manuscript.footnotes === 'object' && !Array.isArray(manuscript.footnotes)
      ? manuscript.footnotes as Record<string, unknown>
      : {};
    const footnotesCfg = Object.keys(footnotesTop).length > 0 ? footnotesTop : manuscriptFootnotes;
    const linkMode: 'citation' | 'inline' | 'strip' =
      linksCfg.mode === 'inline' ? 'inline' : linksCfg.mode === 'strip' ? 'strip' : 'citation';
    const linkMarkerFormat: 'bracket' | 'paren' | 'superscript' =
      linksCfg.markerStyle === 'superscript' ? 'superscript'
      : linksCfg.markerStyle === 'paren' ? 'paren'
      : 'bracket';
    const footnoteStyle: 'bracket' | 'superscript' | 'plain' =
      footnotesCfg.markerStyle === 'plain'
        ? 'plain'
        : footnotesCfg.markerStyle === 'bracket'
        ? 'bracket'
        : 'superscript';

    const typographyCfg = this.section('typography');
    const smartQuotes = typographyCfg.smartQuotes !== false;

    return {
      linkMode,
      citationStyle: (linksCfg.citationStyle || 'bracket') as 'bracket' | 'paren',
      linkMarkerFormat,
      footnoteStyle,
      dedupe: linksCfg.dedupe !== false,
      smartQuotes,
      inlineCodeStyle: this.themeStyles['inline-code'] as Record<string, unknown> | undefined,
      linkStyle: this.themeStyles['link'] as Record<string, unknown> | undefined,
      citationMarkerStyle: this.themeStyles['citation-marker'] as Record<string, unknown> | undefined,
      footnoteMarkerStyle: this.themeStyles['footnote-marker'] as Record<string, unknown> | undefined,
      inlineImageStyle: this.getInlineImageStyle(),
      registerLink: (url: string, title?: string) => this.registerLink(url, title),
      registerFootnote: (identifier: string, content?: SemanticNode[]) => this.registerFootnote(identifier, content),
      resolveImage: this.resolveImage
    };
  }

  private getInlineImageStyle(): Record<string, unknown> {
    const imgCfg = this.section('images');
    return {
      width: 11,
      height: 11,
      verticalAlign: 'middle',
      baselineShift: -0.8,
      inlineMarginLeft: 1.2,
      inlineMarginRight: 1.2,
      ...(imgCfg.inlineStyle || {})
    };
  }
}
