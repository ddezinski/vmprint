# draft2final User Guide

**Focus on your writing. Get a book that's ready to publish.**

`draft2final` is a professional typesetting engine built for writers who want to stay focused on their content, yet demand output that is polished and perfect. It turns plain Markdown files into publication-grade PDFs for novels, memoirs, film scripts, and academic papers—all with industrial-strength precision.

---

## The Philosophy

Traditional word processors force you to fight with margins, font sizes, and "hidden" formatting while you're trying to write. `draft2final` reverses this. You write in a clean, distraction-free environment (Markdown), and the engine handles the high-fidelity layout.

- **Form**: The structural nature of your work (`manuscript`, `screenplay`, `academic`).
- **Aesthetic**: The visual skin or "Style" (`classic`, `modern`, `minimal`).

---

## Installation

To make `draft2final` available as a global command:

```bash
npm install -g draft2final
```

Or run it instantly without installation:

```bash
npx draft2final --help
```

---

## Getting Started

### 1. Scaffold a New Project
Don't start with a blank page. Let the tool set up a professional template for you.

```bash
# For a novel or memoir
draft2final --new story.md --as manuscript

# For a film script
draft2final --new script.md --as screenplay
```

### 2. Render your PDF
Once you've written your masterpiece, rendering is instantaneous.

```bash
# Render with default settings
draft2final story.md

# Render as a specific type
draft2final story.md --as manuscript
```

---

## Choosing your "Form"

Use the `--as` flag (or `as:` in your frontmatter) to choose the structural "Form" of your work.

### `manuscript`
The gold standard for prose submissions. It handles chapter headers, paragraph indentation, and scene breaks according to industry expectations.

- **Chapter heading**: `## Chapter One`
- **Scene break**: `---` (centered symbol) or `### Label` (centered text)
- **Special blocks**: Use `> [epigraph]`, `> [poem]`, or `> [lyrics]` for specialized formatting.

### `screenplay`
Industry-standard script formatting with zero effort. It naturally understands scene headings, action, character cues, and dialogue.

- **Scene heading**: `## INT. CAFE - DAY` or a line starting with `INT./EXT.`
- **Character**: `> @NAME`
- **Parenthetical**: `> (beat)` inside the dialogue block.
- **Dual Dialogue**: End character cues with `^` (e.g., `> @RIN ^`).

### `academic`
Precise layout for research drafts and formal papers, focusing on readability and clear citation structures.

### `literature`
Clean, elegant book designs for poetry and literary prose, often used for "reading copies."

### `markdown`
A clean, modern technical style for handbooks, reports, and developer documentation.

---

## Aesthetics & Styles

The `--style` flag lets you choose the visual "skin" of your document without touching your text.

```bash
draft2final story.md --as manuscript --style classic
```

You can also set this in your file's **Frontmatter**:

```yaml
---
title: The Last Orchard
as: manuscript
style: modern
---
```

---

## Multilingual Native

`draft2final` is built for a global world. It features a sophisticated font-matching engine that fetches and caches high-fidelity OpenType fonts on demand.

Whether you are mixing English with **Arabic**, **Chinese**, **Hindi**, or **Thai**, the engine handles contextual shaping and bidirectional layout with industrial-strength precision. No "font emergencies," no broken glyphs.

---

## Syntax Cheat Sheet

| Feature | Manuscript | Screenplay |
| :--- | :--- | :--- |
| **Title Page** | `# Title` | `# Title` followed by `- Author` list |
| **Major Header** | `## Chapter Name` | `## INT. SCENE` |
| **Sub Header** | `### Scene Label` | `### TRANSITION:` |
| **Break** | `---` (Symbol) | `---` (Action Beat) |
| **Dialogue** | N/A | `> @CHAR` |

---

## Full Reference & Samples

For more concrete examples, explore the [starter samples](./samples/README.md).

---

## License

Apache-2.0
