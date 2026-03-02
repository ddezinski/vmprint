import { RuleBasedFormatHandler, type FormatRule, type BlockProcessor, type HandlerState } from '../compiler/rule-based-handler';
import type { SemanticNode } from '../../semantic';
import type { FormatContext } from '../compiler/format-context';
import type { Element } from '@vmprint/engine';
import { inlinePlainText } from '../compiler/inline';

// ─── Constants & Roles ───────────────────────────────────────────────────────

const roles = {
  title: 'title',
  titleMeta: 'title-meta',
  titleContact: 'title-contact',
  character: 'character',
  parenthetical: 'parenthetical',
  dialogue: 'dialogue',
  characterDualLeft: 'character-dual-left',
  parentheticalDualLeft: 'parenthetical-dual-left',
  dialogueDualLeft: 'dialogue-dual-left',
  characterDualRight: 'character-dual-right',
  parentheticalDualRight: 'parenthetical-dual-right',
  dialogueDualRight: 'dialogue-dual-right',
  more: 'more'
} as const;

const SPEAKER_CUE_PATTERN = /^@([^\n()]{1,48})(?:\s+\(([^)]+)\))?$/i;
const SCENE_HEADING_PATTERN = /^(INT\.|EXT\.|INT\/EXT\.|EST\.)/i;
const CONTACT_FIELD_PATTERN = /^(email|address|phone|tel|fax|contact)\s*:/i;

// ─── Types ───────────────────────────────────────────────────────────────────

type SpeakerCue = {
  name: string;
  qualifier?: string;
  hasContd: boolean;
  dual: boolean;
};

type DialogueTurn = {
  cue: SpeakerCue;
  characterText: string;
  parentheticalText?: string;
  /** Inline children per dialogue paragraph (soft breaks already collapsed). */
  dialogueParas: SemanticNode[][];
  isDual: boolean;
  sourceNode: SemanticNode;
};

// ─── Dialogue Parsing Helpers ────────────────────────────────────────────────

function parseSpeakerCue(line: string): SpeakerCue | null {
  const normalized = line.trim().replace(/\s+/g, ' ');
  const dual = normalized.endsWith('^');
  const withoutDual = dual ? normalized.slice(0, -1).trimEnd() : normalized;
  const match = withoutDual.match(SPEAKER_CUE_PATTERN);
  if (!match) return null;
  const name = (match[1] || '').trim().toUpperCase();
  const qualifier = (match[2] || '').trim().toUpperCase();
  return { name, qualifier: qualifier || undefined, hasContd: /CONT'?D/i.test(qualifier), dual };
}

function formatSpeakerCue(cue: SpeakerCue, forceContd: boolean): string {
  const chunks: string[] = [];
  if (cue.qualifier) chunks.push(cue.qualifier);
  if (forceContd && !cue.hasContd) chunks.push("CONT'D");
  return chunks.length > 0 ? `${cue.name} (${chunks.join(') (')})` : cue.name;
}

/**
 * Strip the first `skipLines` newline-delimited lines from inline children.
 * Handles '\n' embedded in text node values (soft line breaks from blockquote source).
 */
function stripFirstLines(children: SemanticNode[], skipLines: number): SemanticNode[] {
  if (skipLines === 0) return children;

  let linesRemaining = skipLines;
  const result: SemanticNode[] = [];

  for (const child of children) {
    if (linesRemaining === 0) {
      result.push(child);
      continue;
    }

    if (child.kind === 'text' && child.value) {
      const value = child.value;
      let pos = 0;
      let linesFound = 0;
      let exhausted = false;

      while (linesFound < linesRemaining) {
        const nextNL = value.indexOf('\n', pos);
        if (nextNL === -1) {
          linesRemaining -= linesFound;
          exhausted = true;
          break;
        }
        pos = nextNL + 1;
        linesFound++;
      }

      if (!exhausted) {
        linesRemaining = 0;
        const remaining = value.slice(pos);
        if (remaining) result.push({ ...child, value: remaining });
      }
      // else: this text node was fully consumed; continue to next child
    } else {
      // Non-text inline nodes (em, strong, etc.): pass through while still skipping.
      // Cue lines are always plain text, so this case is rare.
      result.push(child);
    }
  }

  return result;
}

/**
 * Replace '\n' embedded in text node values with spaces (collapse soft line breaks).
 * Standalone text nodes with exactly '\n' (hard breaks from \\) are preserved.
 */
function collapseTextSoftBreaks(children: SemanticNode[]): SemanticNode[] {
  return children.map(child => {
    if (child.kind === 'text' && child.value && child.value !== '\n' && child.value.includes('\n')) {
      return { ...child, value: child.value.replace(/\n/g, ' ') };
    }
    if (child.children) {
      return { ...child, children: collapseTextSoftBreaks(child.children) };
    }
    return child;
  });
}

function buildDialogueTurn(node: SemanticNode): DialogueTurn | null {
  const paragraphs = (node.children || []).filter(c => c.kind === 'p');
  if (paragraphs.length === 0) return null;

  const firstPara = paragraphs[0];
  const firstText = inlinePlainText(firstPara.children || []);
  const firstLines = firstText.split('\n');

  const cue = parseSpeakerCue(firstLines[0]);
  if (!cue) return null;

  let parentheticalText: string | undefined;
  let skipLines: number;

  if (firstLines.length > 1 && firstLines[1].trim().startsWith('(')) {
    parentheticalText = firstLines[1].trim();
    skipLines = 2;
  } else {
    skipLines = 1;
  }

  const dialogueParas: SemanticNode[][] = [];

  // First paragraph: strip cue line (and optional parenthetical line)
  const firstRemainder = collapseTextSoftBreaks(
    stripFirstLines(firstPara.children || [], skipLines)
  );
  if (firstRemainder.length > 0 && inlinePlainText(firstRemainder).trim()) {
    dialogueParas.push(firstRemainder);
  }

  // Each subsequent blockquote paragraph is a new dialogue paragraph
  for (let i = 1; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const paraChildren = collapseTextSoftBreaks(para.children || []);
    if (paraChildren.length > 0) {
      dialogueParas.push(paraChildren);
    }
  }

  return {
    cue,
    characterText: formatSpeakerCue(cue, false),
    parentheticalText,
    dialogueParas,
    isDual: cue.dual,
    sourceNode: node
  };
}

// ─── Emission Helpers ────────────────────────────────────────────────────────

function emitTurn(turn: DialogueTurn, side: 'mono' | 'left' | 'right', ctx: FormatContext): void {
  const r = side === 'left'
    ? { c: roles.characterDualLeft, p: roles.parentheticalDualLeft, d: roles.dialogueDualLeft }
    : side === 'right'
    ? { c: roles.characterDualRight, p: roles.parentheticalDualRight, d: roles.dialogueDualRight }
    : { c: roles.character, p: roles.parenthetical, d: roles.dialogue };

  ctx.emit(r.c, turn.characterText, { keepWithNext: true });
  if (turn.parentheticalText) {
    ctx.emit(r.p, turn.parentheticalText, { keepWithNext: true });
  }

  // Build dialogue children with inline styling, joining paragraphs with '\n\n'
  const allChildren: Element[] = [];
  for (let i = 0; i < turn.dialogueParas.length; i++) {
    if (i > 0) allChildren.push({ type: 'text', content: '\n\n' });
    allChildren.push(...ctx.processInline(turn.dialogueParas[i]));
  }

  const charContdCue = formatSpeakerCue(turn.cue, true);
  const charMarker = { type: r.c, content: charContdCue, properties: { keepWithNext: true } };
  const markersBeforeContinuation: Array<{ type: string; content: string; properties?: Record<string, unknown> }> = [
    charMarker
  ];
  if (turn.parentheticalText) {
    markersBeforeContinuation.push({ type: r.p, content: turn.parentheticalText });
  }

  const dialogueElement: Element = {
    type: r.d,
    content: '',
    children: allChildren,
    properties: {
      paginationContinuation: {
        enabled: true,
        markerAfterSplit: { type: roles.more, content: '(MORE)' },
        markerBeforeContinuation: charMarker,
        markersBeforeContinuation
      }
    }
  };

  ctx.emitRaw(dialogueElement);
}

// ─── Title Processor ─────────────────────────────────────────────────────────

const TitleProcessor: BlockProcessor = {
  handle(node: SemanticNode, ctx: FormatContext, _rule: FormatRule, state: HandlerState): boolean {
    ctx.emit('title', node.children || [], {
      sourceRange: node.sourceRange,
      sourceSyntax: node.sourceSyntax,
      layoutDirectives: { suppressPageNumber: true }
    });

    // Consume an immediately following ul as title metadata
    const buffer = (state as any).buffer as SemanticNode[] | undefined;
    const index = (state as any).bufferIndex as number | undefined;

    if (buffer && typeof index === 'number' && index < buffer.length - 1) {
      const next = buffer[index + 1];
      if (next.kind === 'ul') {
        (state as any).bufferIndex++;
        for (const item of (next.children || []).filter((n: SemanticNode) => n.kind === 'li')) {
          const firstPara = (item.children || []).find((c: SemanticNode) => c.kind === 'p');
          if (!firstPara) continue;
          const text = inlinePlainText(firstPara.children || []);
          const role = CONTACT_FIELD_PATTERN.test(text) ? roles.titleContact : roles.titleMeta;
          ctx.emit(role, firstPara.children || [], {
            sourceRange: item.sourceRange,
            sourceSyntax: item.sourceSyntax
          });
        }
      }
    }

    (state as any).hasTitlePage = true;
    return true;
  }
};

// ─── Scene Heading Processor ─────────────────────────────────────────────────

const SceneHeadingProcessor: BlockProcessor = {
  handle(node: SemanticNode, ctx: FormatContext, _rule: FormatRule, state: HandlerState): boolean {
    const props: Record<string, unknown> = {
      sourceRange: node.sourceRange,
      sourceSyntax: node.sourceSyntax
    };

    if ((state as any).hasTitlePage) {
      props.style = { pageBreakBefore: true };
      (state as any).hasTitlePage = false;
    }

    ctx.emit('scene-heading', node.children || [], props);
    return true;
  }
};

// ─── Dialogue Processor ──────────────────────────────────────────────────────

const DialogueProcessor: BlockProcessor = {
  handle(node: SemanticNode, ctx: FormatContext, _rule: FormatRule, state: HandlerState): boolean {
    const turn = buildDialogueTurn(node);
    if (!turn) return false;

    const buffer = (state as any).buffer as SemanticNode[] | undefined;
    const index = (state as any).bufferIndex as number | undefined;

    // Dual dialogue lookahead: if this turn has ^ flag, consume next blockquote too
    if (turn.isDual && buffer && typeof index === 'number' && index < buffer.length - 1) {
      const nextNode = buffer[index + 1];
      const nextTurn = nextNode.kind === 'blockquote' ? buildDialogueTurn(nextNode) : null;
      if (nextTurn?.isDual) {
        emitTurn(turn, 'left', ctx);
        emitTurn(nextTurn, 'right', ctx);
        (state as any).bufferIndex++;
        return true;
      }
    }

    emitTurn(turn, 'mono', ctx);
    return true;
  }
};

// ─── Screenplay Format Definition ────────────────────────────────────────────

const ScreenplayRules: FormatRule[] = [
  { match: { kind: 'h1' }, action: { processor: 'title' } },
  { match: { kind: 'h2' }, action: { processor: 'scene-heading' } },
  { match: { kind: 'p', content: SCENE_HEADING_PATTERN }, action: { processor: 'scene-heading' } },
  { match: { kind: 'h3', content: /:$/ }, action: { role: 'transition' } },
  { match: { kind: 'p', content: /^[A-Z0-9 .'"()/-]+:$/ }, action: { role: 'transition' } },
  { match: { kind: 'blockquote' }, action: { processor: 'dialogue' } },
  { match: { kind: 'p' }, action: { role: 'action' } },
  { match: { kind: 'hr' }, action: { role: 'beat' } }
];

export class ScreenplayFormat extends RuleBasedFormatHandler {
  constructor(_config: Record<string, unknown>) {
    super({
      rules: ScreenplayRules,
      processors: {
        title: TitleProcessor,
        'scene-heading': SceneHeadingProcessor,
        dialogue: DialogueProcessor
      },
      buffer: true
    });
  }
}
