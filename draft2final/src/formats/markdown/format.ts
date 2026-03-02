import { MarkdownBaseFormat } from '../compiler/markdown-base-format';

/**
 * MarkdownFormat — standard markdown implementation.
 * Behavioral logic is consolidated into MarkdownBaseFormat's declarative rules,
 * with style-specific logic moved to config and themes.
 */
export class MarkdownFormat extends MarkdownBaseFormat {
  constructor(config: Record<string, unknown>) {
    super(config, { buffer: true });
  }
}
