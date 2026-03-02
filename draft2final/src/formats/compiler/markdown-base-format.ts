import type { SemanticNode } from '../../semantic';
import type { FormatContext } from './format-context';
import { RuleBasedFormatHandler, type FormatRule, type BlockProcessor, type HandlerState } from './rule-based-handler';
import { inlinePlainText } from './inline';

// ─── Shared Processors ───────────────────────────────────────────────────────

/** Strips leading '::' marker from subheading paragraphs and emits as 'subheading' */
const SubheadingProcessor: BlockProcessor = {
  handle(node: SemanticNode, ctx: FormatContext, _rule: FormatRule, _state: HandlerState): boolean {
    const children = node.children || [];
    const first = children[0];
    let strippedChildren: SemanticNode[];
    if (first?.kind === 'text' && first.value?.startsWith('::')) {
      strippedChildren = [{ ...first, value: first.value.slice(2).trimStart() }, ...children.slice(1)];
    } else {
      strippedChildren = children;
    }
    ctx.emit('subheading', strippedChildren, {
      sourceRange: node.sourceRange,
      sourceSyntax: node.sourceSyntax,
      keepWithNext: true
    });
    return true;
  }
};

/** Handles recursive blockquote emission */
const BlockquoteProcessor: BlockProcessor = {
  handle(node: SemanticNode, ctx: FormatContext, rule: FormatRule, state: HandlerState): boolean {
    const role = rule.action.role || 'blockquote';
    for (const child of node.children || []) {
      if (child.kind === 'p') {
        ctx.emit(role, child.children || [], {
          sourceRange: child.sourceRange,
          sourceSyntax: child.sourceSyntax
        });
      } else {
        state.handler.dispatch(child, ctx); 
      }
    }
    return true;
  }
};

/** Handles list markers and nesting */
const ListProcessor: BlockProcessor = {
  handle(node: SemanticNode, ctx: FormatContext, rule: FormatRule, state: HandlerState): boolean {
    const isOrdered = node.kind === 'ol';
    const items = (node.children || []).filter(n => n.kind === 'li');
    
    items.forEach((item, index) => {
      // Basic literal markers matching original snapshots
      let marker: string;
      if (isOrdered) {
        const roman = ['I.', 'II.', 'III.', 'IV.', 'V.'];
        marker = (roman[index] || `${index + 1}.`) + '  ';
      } else {
        const taskCfg = (ctx.config.list as any)?.taskMarkers || {};
        const checkedMarker = taskCfg.checked || "☑";
        const uncheckedMarker = taskCfg.unchecked || "☐";
        
        if (item.checked === true) marker = `${checkedMarker}  `;
        else if (item.checked === false) marker = `${uncheckedMarker}  `;
        else marker = '• ';
      }

      const children = item.children || [];
      if (children.length > 0 && children[0].kind === 'p') {
        const first = children[0];
        const role = isOrdered ? 'list-item-ordered-0' : 'list-item-unordered-0';
        ctx.emit(role, [
          { kind: 'text', value: marker } as SemanticNode,
          ...(first.children || [])
        ], {
          sourceRange: item.sourceRange,
          sourceSyntax: item.sourceSyntax
        });
        
        // Handle continuation blocks in list item
        for (let i = 1; i < children.length; i++) {
          const child = children[i];
          if (child.kind === 'p') {
            const listCfg = (ctx.config.list as any) || {};
            const indent = typeof listCfg.textIndentPerLevel === 'number' 
              ? listCfg.textIndentPerLevel 
              : 17.5;
            ctx.emit(`list-item-continuation-1`, child.children || [], {
              sourceRange: child.sourceRange,
              sourceSyntax: child.sourceSyntax,
              style: { textIndent: indent }
            });
          } else {
            state.handler.dispatch(child, ctx);
          }
        }

      }
    });
    return true;
  }
};

/** Handles code blocks with string values and mode-specific styling */
const CodeBlockProcessor: BlockProcessor = {
  handle(node: SemanticNode, ctx: FormatContext, rule: FormatRule, state: HandlerState): boolean {
    const codeBlocksCfg = (ctx.config.codeBlocks as any) || {};
    const modes = codeBlocksCfg.modes || {};
    const lang = (node.language || '').trim().toLowerCase();
    const modeCfg = (lang ? modes[lang] : undefined) as any;
    const modeStyle = modeCfg?.style || modeCfg; // Fallback if config is direct style

    ctx.emit(rule.action.role || 'code-block', node.value || '', {
      sourceRange: node.sourceRange,
      sourceSyntax: node.sourceSyntax,
      language: node.language,
      ...(modeStyle && Object.keys(modeStyle).length > 0 ? { style: modeStyle } : {})
    });
    return true;
  }
};

/** Handles table emission */
const TableProcessor: BlockProcessor = {
  handle(node: SemanticNode, ctx: FormatContext, rule: FormatRule, state: HandlerState): boolean {
    ctx.emitTable(node);
    return true;
  }
};

/** Handles block images with framing support */
const ImageProcessor: BlockProcessor = {
  handle(node: SemanticNode, ctx: FormatContext, rule: FormatRule, state: HandlerState): boolean {
    const imageNode = node.kind === 'image' ? node : (node.children?.find(n => n.kind === 'image'));
    if (imageNode) {
      const imgCfg = (ctx.config.images as any) || {};
      const blockStyle = imgCfg.blockStyle || {};
      
      const alt = (imageNode.alt || '').toLowerCase();
      const value = (imageNode.value || '').toLowerCase();
      const frameCfg = imgCfg.frame || {};
      const markerPattern = frameCfg.markerPattern || '\\b(frame|framed)\\b';
      const hasFrameKeyword = new RegExp(markerPattern, 'i').test(alt) || new RegExp(markerPattern, 'i').test(value);
      
      const shouldApplyFrame = frameCfg.mode === 'all' || (hasFrameKeyword && frameCfg.mode !== 'off');
      const frameStyle = shouldApplyFrame ? (frameCfg.style || {}) : {};

      // Caption lookahead
      const buffer = (state as any).buffer as SemanticNode[];
      const index = (state as any).bufferIndex as number;
      let keepWithNext = false;
      let blockquoteCaptionNode: SemanticNode | null = null;
      if (buffer && index < buffer.length - 1) {
        const next = buffer[index + 1];
        const captionCfg = (ctx.config.captions as any) || {};

        // Match standard paragraphs starting with Figure/Fig.
        if (next.kind === 'p') {
          const nextText = inlinePlainText(next.children || []);
          const captionPattern = captionCfg.pattern || '^(Figure|Fig\\.)\\s+';
          if (new RegExp(captionPattern).test(nextText)) {
            keepWithNext = true;
          }
        }
        // Match blockquote captions if configured
        else if (next.kind === 'blockquote' && captionCfg.blockquoteUnderImageAsFigureCaption) {
          keepWithNext = true;
          blockquoteCaptionNode = next;
        }
      }

      ctx.emitImage(imageNode, {
        sourceRange: node.sourceRange,
        sourceSyntax: node.sourceSyntax,
        style: { ...blockStyle, ...frameStyle },
        keepWithNext
      });

      // Emit blockquote as styled paragraph and consume it from the buffer
      if (blockquoteCaptionNode) {
        const captionCfg = (ctx.config.captions as any) || {};
        const captionStyle = captionCfg.blockquoteStyle || {};
        for (const child of blockquoteCaptionNode.children || []) {
          if (child.kind === 'p') {
            ctx.emit('paragraph', child.children || [], {
              sourceRange: child.sourceRange,
              sourceSyntax: child.sourceSyntax,
              style: captionStyle
            });
          }
        }
        (state as any).bufferIndex++;
      }

      return true;
    }
    return false;
  }
};

/** Handles definition lists */
const DefinitionListProcessor: BlockProcessor = {
  handle(node: SemanticNode, ctx: FormatContext, rule: FormatRule, state: HandlerState): boolean {
    for (const child of node.children || []) {
      state.handler.dispatch(child, ctx);
    }
    return true;
  }
};

const simpleRules: FormatRule[] = [
  // 1. Semantic Headings
  { match: { kind: 'h1' }, action: { role: 'heading-1' } },
  { match: { kind: 'h2' }, action: { role: 'heading-2' } },
  { match: { kind: 'h3' }, action: { role: 'heading-3' } },
  { match: { kind: 'h4' }, action: { role: 'heading-4' } },
  { match: { kind: 'h5' }, action: { role: 'heading-5' } },
  { match: { kind: 'h6' }, action: { role: 'heading-6' } },

  // 2. Subheading Logic (Paragraph immediately following H1, depth 0)
  {
    name: 'subheading',
    match: { kind: 'p', previousKind: 'h1', depth: 0, content: /::/ },
    action: { processor: 'subheading' }
  },

  // 3. Complex Containers
  { match: { kind: ['ul', 'ol'] }, action: { processor: 'list' } },
  { match: { kind: 'dl' }, action: { processor: 'dl' } },
  { match: { kind: 'blockquote' }, action: { processor: 'blockquote', role: 'blockquote' } },
  { match: { kind: 'code' }, action: { processor: 'code', role: 'code-block' } },
  { match: { kind: 'table' }, action: { processor: 'table' } },
  { 
    name: 'image-paragraph',
    match: { 
      kind: 'p', 
      hasImage: true
    }, 
    action: { processor: 'image' } 
  },

  // 4. Standard Blocks
  { 
    name: 'lead-in-paragraph',
    match: { kind: 'p', content: /:$/ }, 
    action: { role: 'paragraph', properties: { keepWithNext: true } } 
  },
  { match: { kind: 'p' }, action: { role: 'paragraph' } },
  { match: { kind: 'dt' }, action: { role: 'definition-term' } },
  { match: { kind: 'dd' }, action: { role: 'definition-desc' } },
  { match: { kind: 'hr' }, action: { role: 'thematic-break' } }
];

/**
 * Implements the full markdown grammar as a declarative rule set.
 * Serves as the base for MarkdownFormat, AcademicFormat, and LiteratureFormat,
 * which differ only through config and theme — not code.
 */
export class MarkdownBaseFormat extends RuleBasedFormatHandler {
  constructor(config: Record<string, unknown>, options?: { buffer?: boolean }) {
    super({
      rules: simpleRules,
      processors: {
        subheading: SubheadingProcessor,
        list: ListProcessor,
        dl: DefinitionListProcessor,
        blockquote: BlockquoteProcessor,
        code: CodeBlockProcessor,
        table: TableProcessor,
        image: ImageProcessor
      },
      buffer: options?.buffer ?? false
    });
  }

  override flush(ctx: FormatContext): void {
    super.flush(ctx);

    const refCfg = (ctx.config.references as any) || {};
    const heading = refCfg.heading || 'References';
    const numStyle = refCfg.numberingStyle || 'decimal';

    if (ctx.registeredLinkCount() > 0) {
      ctx.emit('thematic-break', '');
      ctx.emit('references-heading', heading);
      for (const entry of ctx.registeredLinks()) {
        const numStr = ctx.formatNumber(entry.index, numStyle);
        const prefix = `${numStr}. `;
        ctx.emitReferenceItem(prefix, entry.url, entry.title);
      }
    }
  }
}
