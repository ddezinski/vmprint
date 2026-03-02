import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';
import { LayoutEngine, Renderer, resolveDocumentPaths, toLayoutConfig, createEngineRuntime, LayoutUtils } from '@vmprint/engine';
import type { DocumentInput } from '@vmprint/engine';
import { parseMarkdownAst } from './markdown';
import { normalizeToSemantic, SemanticDocument } from './semantic';
import { getFormatModule } from './formats';
import { compile, resolveConfig, loadTheme } from './formats/compiler';
import { Draft2FinalError } from './errors';
// ─── Implementation loading ─────────────────────────────────────────────────────

function resolveBuiltin(bundledRelPath: string, packageName: string): string {
  const bundledPath = path.join(__dirname, 'bundled', bundledRelPath);
  if (fs.existsSync(bundledPath)) return bundledPath;
  // Dev mode (tsx src/): bundled dir not present, resolve from workspace package
  return require.resolve(packageName);
}

async function loadImplementation<T>(modulePath: string): Promise<T> {
  const unwrap = (mod: any): T => mod?.default?.default ?? mod?.default ?? mod;

  try {
    const mod = await import(modulePath);
    return unwrap(mod);
  } catch (error) {
    if (path.isAbsolute(modulePath)) {
      const mod = await import(pathToFileURL(modulePath).href);
      return unwrap(mod);
    }
    throw error;
  }
}
// ─── Frontmatter extraction ───────────────────────────────────────────────────

function extractFrontmatter(markdown: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
  if (!match) return { frontmatter: {}, body: markdown };
  try {
    const parsed = parseYaml(match[1]) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return { frontmatter: {}, body: markdown };
    return { frontmatter: parsed, body: markdown.slice(match[0].length) };
  } catch {
    return { frontmatter: {}, body: markdown };
  }
}

// ─── Layout defaults ──────────────────────────────────────────────────────────

function buildLayout(themeLayout: Partial<DocumentInput['layout']> | undefined): DocumentInput['layout'] {
  const defaults: Partial<DocumentInput['layout']> = {
    fontFamily: 'Caladea',
    fontSize: 11,
    lineHeight: 1.5,
    pageSize: 'LETTER',
    margins: { top: 72, right: 72, bottom: 72, left: 72 }
  };
  return { ...defaults, ...(themeLayout || {}) } as DocumentInput['layout'];
}

// ─── Public compile API ───────────────────────────────────────────────────────

export type BuildResult = {
  format: string;
  theme: string;
  syntax: SemanticDocument;
  ir: DocumentInput;
};

export function compileToVmprint(
  markdown: string,
  inputPath: string,
  cliFlags: Record<string, unknown> = {}
): BuildResult {
  const { frontmatter, body } = extractFrontmatter(markdown);
  const ast = parseMarkdownAst(body, inputPath);
  const syntax = normalizeToSemantic(ast, inputPath);

  const formatName = String(frontmatter.format ?? cliFlags.format ?? 'markdown');
  const themeName = String(frontmatter.theme ?? cliFlags.theme ?? 'default');
  const format = getFormatModule(formatName);

  const config = resolveConfig(format.pluginDir, frontmatter, cliFlags, themeName);
  const theme = loadTheme(format.pluginDir, themeName);
  const layout = buildLayout(theme.layout);
  const ir = compile(syntax, format.createHandler(config), theme, config, layout, inputPath);

  return { format: formatName, theme: themeName, syntax, ir };
}

// ─── PDF rendering ────────────────────────────────────────────────────────────

async function renderVmprintPdf(ir: DocumentInput, inputPath: string, outputPdfPath: string, debug: boolean = false): Promise<void> {
  const resolvedOutput = path.resolve(outputPdfPath);
  const outputDir = path.dirname(resolvedOutput);

  try {
    fs.mkdirSync(outputDir, { recursive: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Draft2FinalError('write', resolvedOutput, `Failed to prepare output directory: ${message}`, 5, { cause: error });
  }

  try {
    const builtinFontManager = resolveBuiltin('font-managers/local/index.js', '@vmprint/local-fonts');
    const builtinContext = resolveBuiltin('contexts/pdf/index.js', '@vmprint/context-pdf');
    const FontManagerClass = await loadImplementation<new (...args: any[]) => any>(builtinFontManager);
    const ContextClass = await loadImplementation<new (...args: any[]) => any>(builtinContext);

    const documentIR = resolveDocumentPaths(ir, inputPath);
    const runtime = createEngineRuntime({ fontManager: new FontManagerClass() });
    const config = toLayoutConfig(documentIR, debug);
    const engine = new LayoutEngine(config, runtime);
    await engine.waitForFonts();
    const pages = engine.paginate(documentIR.elements);

    const { width, height } = LayoutUtils.getPageDimensions(config);
    const outputStream = fs.createWriteStream(resolvedOutput);
    const context = new ContextClass(outputStream, {
      size: [width, height],
      margins: { top: 0, left: 0, right: 0, bottom: 0 },
      autoFirstPage: false,
      bufferPages: false
    });

    const renderer = new Renderer(config, debug, runtime);
    await renderer.render(pages, context);
    if (typeof (context as any).waitForFinish === 'function') {
      await (context as any).waitForFinish();
    }
  } catch (error: unknown) {
    if (error instanceof Draft2FinalError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new Draft2FinalError('render', resolvedOutput, `Failed to render PDF: ${message}`, 4, { cause: error });
  }

  try {
    const stat = fs.statSync(resolvedOutput);
    if (!stat.isFile() || stat.size <= 0) {
      throw new Error('Rendered PDF file was empty.');
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Draft2FinalError('write', resolvedOutput, `Failed to verify output file: ${message}`, 5, { cause: error });
  }
}

export async function buildMarkdownToPdf(
  markdown: string,
  inputPath: string,
  outputPdfPath: string,
  cliFlags: Record<string, unknown> = {},
  debug: boolean = false
): Promise<BuildResult> {
  const result = compileToVmprint(markdown, inputPath, cliFlags);
  await renderVmprintPdf(result.ir, inputPath, outputPdfPath, debug);
  return result;
}
