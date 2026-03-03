import { remark } from 'remark';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { Draft2FinalError } from './errors';

export type MdPosition = {
  start?: { line: number; column: number };
  end?: { line: number; column: number };
};

export type MdNode = {
  type: string;
  children?: MdNode[];
  value?: string;
  lang?: string;
  depth?: number;
  ordered?: boolean;
  start?: number;
  spread?: boolean;
  url?: string;
  alt?: string;
  title?: string;
  checked?: boolean | null;
  identifier?: string;
  referenceType?: string;
  align?: Array<'left' | 'right' | 'center' | null>;
  label?: string;
  position?: MdPosition;
};

export const KEEP_WITH_NEXT_PATTERN = /^\s*<!--\s*keep-with-next\s*-->\s*$/i;

export function parseMarkdownAst(markdown: string, inputPath: string, options?: { allowFootnotes?: boolean }): MdNode {
  void options;
  try {
    const processor = remark().use(remarkParse).use(remarkGfm);
    const ast = processor.parse(markdown) as unknown as MdNode;
    return ast;
  } catch (error: unknown) {
    if (error instanceof Draft2FinalError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : String(error);
    throw new Draft2FinalError('parse', inputPath, `Failed to parse Markdown: ${message}`, 3, { cause: error });
  }
}
