import type { SemanticNode } from '../../semantic';
import { inlinePlainText } from './inline';
import type { FormatHandler } from './format-handler';
import type { FormatContext } from './format-context';

// ─── Rule Schema ─────────────────────────────────────────────────────────────

export type MatchCondition = {
  /** Match by SemanticNode kind (e.g. 'p', 'h1', 'blockquote') */
  kind?: string | string[];
  /** Match by regex against the plain-text content of the node */
  content?: RegExp;
  /** Match based on the kind of the immediately preceding node */
  previousKind?: string | string[];
  /** Match based on nesting depth (0 = top level) */
  depth?: number | { min?: number; max?: number };
  /** Match if node contains an image child */
  hasImage?: boolean;
};

export type RuleAction = {
  /** The target role name to emit (e.g. 'paragraph', 'scene-heading') */
  role?: string;
  /** Static properties to merge into the emitted element */
  properties?: Record<string, unknown>;
  /** Name of a registered BlockProcessor for complex logic (e.g. 'dialogue', 'list') */
  processor?: string;
};

export type FormatRule = {
  name?: string;
  match: MatchCondition;
  action: RuleAction;
};

// ─── Block Processor Interface ───────────────────────────────────────────────

/**
 * A BlockProcessor handles complex semantic transformations that cannot be 
 * expressed as a simple 1:1 role mapping (e.g. Screenplay dialogue turns).
 */
export interface BlockProcessor {
  handle(node: SemanticNode, ctx: FormatContext, rule: FormatRule, state: HandlerState): boolean;
}

export type HandlerState = {
  previousNode: SemanticNode | null;
  depth: number;
  handler: RuleBasedFormatHandler;
  // Future state: list stacks, numbering counters, etc.
};

// ─── Rule-Based Format Handler ───────────────────────────────────────────────

export class RuleBasedFormatHandler implements FormatHandler {
  private readonly rules: FormatRule[];
  private readonly processors: Map<string, BlockProcessor>;
  private state: HandlerState;
  private readonly buffer: SemanticNode[] = [];
  private readonly shouldBuffer: boolean;

  constructor(options: {
    rules: FormatRule[];
    processors?: Record<string, BlockProcessor>;
    buffer?: boolean;
  }) {
    this.rules = options.rules;
    this.processors = new Map(Object.entries(options.processors || {}));
    this.shouldBuffer = options.buffer === true;
    this.state = {
      previousNode: null,
      depth: 0,
      handler: this
    };
  }

  // ── FormatHandler API ──────────────────────────────────────────────────────

  handleBlock(node: SemanticNode, ctx: FormatContext): void {
    if (this.shouldBuffer) {
      this.buffer.push(node);
      return;
    }
    this.processSingle(node, ctx);
  }

  flush(ctx: FormatContext): void {
    if (this.shouldBuffer) {
      for (let i = 0; i < this.buffer.length; i++) {
        const node = this.buffer[i];
        // For buffered mode, we pass the full buffer as an "ambient" state
        // so processors can look ahead.
        (this.state as any).buffer = this.buffer;
        (this.state as any).bufferIndex = i;
        this.processSingle(node, ctx);
        // Note: processors might advance the index by modifying bufferIndex
        i = (this.state as any).bufferIndex;
      }
    }
  }

  private processSingle(node: SemanticNode, ctx: FormatContext): void {
    this.dispatch(node, ctx);
    this.state.previousNode = node;
  }


  roles(): string[] {
    const roleSet = new Set<string>();
    for (const rule of this.rules) {
      if (rule.action.role) roleSet.add(rule.action.role);
    }
    return Array.from(roleSet).sort();
  }

  // ── Private Dispatch ───────────────────────────────────────────────────────

  public dispatch(node: SemanticNode, ctx: FormatContext): boolean {
    const previousDepth = this.state.depth;
    for (const rule of this.rules) {
      if (this.matches(node, rule.match)) {
        if (rule.action.processor) {
          const proc = this.processors.get(rule.action.processor);
          if (proc) {
            this.state.depth++;
            const handled = proc.handle(node, ctx, rule, this.state);
            this.state.depth = previousDepth;
            if (handled) return true;
          }
          continue; 
        }

        if (rule.action.role) {
          ctx.emit(rule.action.role, node.children || [], {
            sourceRange: node.sourceRange,
            sourceSyntax: node.sourceSyntax,
            ...(rule.action.properties || {})
          });
          return true;
        }
      }
    }
    return false;
  }

  private matches(node: SemanticNode, match: MatchCondition): boolean {
    // 1. Kind match
    if (match.kind) {
      const kinds = Array.isArray(match.kind) ? match.kind : [match.kind];
      if (!kinds.includes(node.kind)) return false;
    }

    // 2. Previous kind match
    if (match.previousKind) {
      if (!this.state.previousNode) return false;
      const prevKinds = Array.isArray(match.previousKind) ? match.previousKind : [match.previousKind];
      if (!prevKinds.includes(this.state.previousNode.kind)) return false;
    }

    // 3. Content match (Regex)
    if (match.content) {
      const text = inlinePlainText(node.children || []);
      if (!match.content.test(text)) return false;
    }

    // 4. Depth match
    if (match.depth !== undefined) {
      if (typeof match.depth === 'number') {
        if (this.state.depth !== match.depth) return false;
      } else {
        if (match.depth.min !== undefined && this.state.depth < match.depth.min) return false;
        if (match.depth.max !== undefined && this.state.depth > match.depth.max) return false;
      }
    }

    // 5. hasImage match
    if (match.hasImage !== undefined) {
      const containsImage = (node.children || []).some(c => c.kind === 'image');
      if (containsImage !== match.hasImage) return false;
    }

    return true;
  }
}
