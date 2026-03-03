import type { Element } from '@vmprint/engine';
import type { SemanticNode } from '../../semantic';
import type { ResolvedImage } from './image';

export type InlineLinkMode = 'citation' | 'inline' | 'strip';

/**
 * Converts straight ASCII quotes and typewriter dashes to typographic
 * equivalents.
 *
 * Dashes (processed first so em-dash context is available for quotes):
 *   ---  →  — (em dash, U+2014)
 *   --   →  — (em dash, U+2014)
 *
 * Double quotes: left (") after whitespace / open brackets / em-dash /
 * en-dash, right (") otherwise.
 *
 * Single quotes: left (') after whitespace / open brackets, right (') /
 * apostrophe otherwise.
 */
export function applySmartQuotes(text: string): string {
  // Dashes first so em-dash chars are in place before the quote pass.
  // Triple before double to avoid partial substitution.
  let s = text.replace(/---/g, '\u2014').replace(/--/g, '\u2014');

  const chars = Array.from(s);
  const out: string[] = [];
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === '"') {
      const prev = i > 0 ? chars[i - 1] : ' ';
      out.push(/[\s([{\u2014\u2013]/.test(prev) ? '\u201C' : '\u201D');
    } else if (ch === "'") {
      const prev = i > 0 ? chars[i - 1] : ' ';
      out.push(/[\s([{]/.test(prev) ? '\u2018' : '\u2019');
    } else {
      out.push(ch);
    }
  }
  return out.join('');
}

export type InlineLinkOptions = {
  mode: InlineLinkMode;
  citationStyle: 'bracket' | 'paren';
  dedupe: boolean;
};

export type InlineContext = {
  linkMode: InlineLinkMode;
  citationStyle: 'bracket' | 'paren';
  linkMarkerFormat?: 'bracket' | 'paren' | 'superscript';
  footnoteStyle?: 'bracket' | 'superscript' | 'plain';
  dedupe: boolean;
  smartQuotes?: boolean;
  inlineCodeStyle?: Record<string, unknown>;
  linkStyle?: Record<string, unknown>;
  citationMarkerStyle?: Record<string, unknown>;
  footnoteMarkerStyle?: Record<string, unknown>;
  inlineImageStyle?: Record<string, unknown>;
  registerLink(url: string, title?: string): number;
  registerFootnote(identifier: string, content?: SemanticNode[]): number;
  resolveImage(node: SemanticNode): ResolvedImage;
};

const INLINE_CONTAINER_TYPE = 'inline';

function formatCitationMarker(index: number, style: 'bracket' | 'paren'): string {
  return style === 'paren' ? `(${index})` : `[${index}]`;
}

export function inlineToElements(nodes: SemanticNode[], ctx: InlineContext): Element[] {
  const result: Element[] = [];

  for (const node of nodes) {
    switch (node.kind) {
      case 'text': {
        const raw = node.value || '';
        result.push({ type: 'text', content: ctx.smartQuotes ? applySmartQuotes(raw) : raw });
        break;
      }

      case 'inlineCode':
        result.push({
          type: 'text',
          content: node.value || '',
          properties: ctx.inlineCodeStyle ? { style: { ...ctx.inlineCodeStyle } } : undefined
        });
        break;

      case 'em':
        result.push({
          type: INLINE_CONTAINER_TYPE,
          content: '',
          properties: { style: { fontStyle: 'italic' } },
          children: inlineToElements(node.children || [], ctx)
        });
        break;

      case 'strong':
        result.push({
          type: INLINE_CONTAINER_TYPE,
          content: '',
          properties: { style: { fontWeight: 700 } },
          children: inlineToElements(node.children || [], ctx)
        });
        break;

      case 'del':
        result.push({
          type: INLINE_CONTAINER_TYPE,
          content: '',
          properties: { style: { textDecoration: 'line-through' } },
          children: inlineToElements(node.children || [], ctx)
        });
        break;

      case 'link':
        if (ctx.linkMode === 'strip') {
          // Render link text as plain text — no citation marker, no hyperlink annotation
          result.push(...inlineToElements(node.children || [], ctx));
          break;
        }
        if (ctx.linkMode === 'inline') {
          result.push({
            type: INLINE_CONTAINER_TYPE,
            content: '',
            properties: {
              style: ctx.linkStyle ? { ...ctx.linkStyle } : undefined,
              linkTarget: (node.url || '').trim()
            },
            children: inlineToElements(node.children || [], ctx)
          });
          break;
        }
        // citation mode
        result.push(...inlineToElements(node.children || [], ctx));
        {
          const citationIndex = ctx.registerLink(node.url || '', node.title);
          if (citationIndex > 0) {
            const fmt = ctx.linkMarkerFormat ?? 'bracket';
            const markerText = fmt === 'superscript'
              ? String(citationIndex)
              : formatCitationMarker(citationIndex, fmt === 'paren' ? 'paren' : 'bracket');
            const baseStyle = fmt === 'superscript'
              ? { fontSize: 8.5, baselineShift: 3 }
              : {};
            result.push({
              type: 'text',
              content: markerText,
              properties: ctx.citationMarkerStyle
                ? { style: { ...baseStyle, ...ctx.citationMarkerStyle } }
                : Object.keys(baseStyle).length > 0 ? { style: baseStyle } : undefined
            });
          }
        }
        break;

      case 'image': {
        const resolvedImage = ctx.resolveImage(node);
        result.push({
          type: 'image',
          content: '',
          properties: {
            style: ctx.inlineImageStyle ? { ...ctx.inlineImageStyle } : undefined,
            image: {
              data: resolvedImage.data,
              mimeType: resolvedImage.mimeType,
              fit: 'contain'
            },
            sourceRange: node.sourceRange,
            sourceSyntax: node.sourceSyntax
          }
        });
        break;
      }

      case 'footnoteRef': {
        const footnoteIndex = ctx.registerFootnote(node.identifier || node.value || '', undefined);
        if (footnoteIndex > 0) {
          const markerStyle = ctx.footnoteStyle || 'bracket';
          const markerText = markerStyle === 'superscript'
            ? String(footnoteIndex)
            : markerStyle === 'plain'
            ? String(footnoteIndex)
            : formatCitationMarker(footnoteIndex, ctx.citationStyle);
          result.push({
            type: 'text',
            content: markerText,
            properties: {
              style: {
                fontSize: 8.5,
                baselineShift: 3,
                ...(ctx.footnoteMarkerStyle ? { ...ctx.footnoteMarkerStyle } : {})
              }
            }
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return result;
}

export function inlinePlainText(nodes: SemanticNode[]): string {
  let out = '';
  for (const node of nodes) {
    switch (node.kind) {
      case 'text':
      case 'inlineCode':
        out += node.value || '';
        break;
      case 'em':
      case 'strong':
      case 'del':
      case 'link':
        out += inlinePlainText(node.children || []);
        break;
      case 'footnoteRef':
        break;
      case 'image':
        out += node.alt || '';
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * Collapses source-level soft breaks (single newlines that come from Markdown line wrapping)
 * into a single space, while preserving hard breaks (standalone '\n' text nodes produced by
 * a trailing backslash `\` or double-space at end of line).
 *
 * Intended to be applied to paragraph children before emission so that re-flowed source lines
 * are treated as continuous prose rather than broken lines.
 */
export function collapseTextSoftBreaks(children: SemanticNode[]): SemanticNode[] {
  return children.map((child) => {
    if (child.kind === 'text' && child.value && child.value !== '\n' && child.value.includes('\n')) {
      return { ...child, value: child.value.replace(/[ \t]*\r?\n[ \t]*/g, ' ') };
    }
    if (child.children) {
      return { ...child, children: collapseTextSoftBreaks(child.children) };
    }
    return child;
  });
}
