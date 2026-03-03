# Manuscript Guide

Writer to writer: this guide is for turning clean Markdown into submission-ready manuscript pages with `draft2final`.

If you just want the shortest path:

```bash
draft2final build novel.md -o novel.pdf --format manuscript
```

---

## 1. Fast Start

Create `novel.md`:

```markdown
# The Orchard Beyond Midnight

- author: Avery Stone
- email: avery@example.com
- word-count: 82000

## Chapter One

The first paragraph after a chapter heading is not indented.

This paragraph is indented in manuscript output.
```

Build:

```bash
draft2final build novel.md -o novel.pdf --format manuscript
```

What you get by default:
- US Letter
- 1-inch margins
- double-spaced body
- running header
- cover block on page 1

---

## 2. Core Command-Line Patterns

Basic manuscript:

```bash
draft2final build book.md -o book.pdf --format manuscript
```

Classic (Courier-style) manuscript:

```bash
draft2final build book.md -o book.pdf --format manuscript --theme classic
```

Compliance overlay guides:

```bash
# explicit overlay module
draft2final build story.md -o story.pdf --format manuscript --overlay ./manuscript-debug.overlay.mjs

# sidecar auto-detect: story.overlay.mjs next to story.md
draft2final build story.md -o story.pdf --format manuscript
```

Cover page mode:

```bash
draft2final build story.md -o story.pdf --format manuscript --cover-page first
draft2final build story.md -o story.pdf --format manuscript --cover-page separate
draft2final build story.md -o story.pdf --format manuscript --cover-page none
```

---

## 3. Cover Page and Metadata

The manuscript title is your first `# H1`.

The first top-level list right under that title is treated as cover metadata.

```markdown
# Winter Ledger

- author: M. Rowan
- byline: Mira Rowan
- email: rowan@example.com
- phone: +1-555-0102
- address: 123 Writer Lane, Portland, OR 97201
- word-count: 53000
- rights: First North American Serial Rights
- agent: Northline Literary
```

Supported keys:
- `author`
- `byline`
- `email`
- `phone`
- `address`
- `word-count`
- `rights`
- `agent`

Cover modes:
- `first` -> cover block on the first manuscript page
- `separate` -> dedicated cover page; body starts on the next page
- `none` -> no cover block output

---

## 4. Chapter and Scene Structure

Chapter headings: use `##`.

```markdown
## Chapter One
```

Scene breaks: use thematic break (`---`).

```markdown
---
```

The output maps that to manuscript-style scene-break rendering.

---

## 5. Display Text: Poems, Lyrics, Quotes, Epigraphs

### Option A (recommended): fenced code blocks with language tags

Poem:

```markdown
```poem
The gate remembers rain,
and names we leave behind.
```
```

Lyrics:

```markdown
```lyrics
Hold the wire, hold the line,
name the dusk and call it mine.
```
```

Epigraph:

```markdown
```epigraph
Names are anchors for the living.
-- Field Notes
```
```

Extract / literary quote:

```markdown
```extract
Archive entry:
The river shifted east before dawn.
```
```

### Option B: blockquote marker line

Useful when you want these blocks to still read naturally in plain Markdown editors.

```markdown
> [poem]
> The gate remembers rain.
```

```markdown
> [lyrics]
> Hold the wire, hold the line.
```

```markdown
> [epigraph]
> Names are anchors for the living.
> -- Field Notes
```

Supported marker tags:
- `[poem]`
- `[lyrics]`
- `[epigraph]`

---

## 6. Footnotes (v1: endnotes output)

Write normal Markdown footnotes:

```markdown
A line with a note.[^gate]

[^gate]: In early drafts, the gate appeared in three variants.
```

Current v1 behavior:
- inline markers render in text
- notes collect at the end in a `Notes` section

Important:
- `end-of-page` footnotes are not supported in v1

---

## 7. Front Matter Configuration (basic to advanced)

You can configure manuscript behavior in YAML front matter.

```markdown
---
format: manuscript
theme: default
manuscript:
  coverPage:
    mode: first-page-cover
  runningHeader:
    enabled: true
    format: "{surname} / {shortTitle} / {n}"
  chapter:
    pageBreakBefore: true
  footnotes:
    mode: endnotes
    heading: Notes
---
```

### Config reference

`manuscript.coverPage.mode`
- `first-page-cover` (default)
- `separate-cover-page`
- `none`

`manuscript.runningHeader.enabled`
- `true`/`false`

`manuscript.runningHeader.format`
- token format string
- supported tokens: `{surname}`, `{shortTitle}`, `{n}`

`manuscript.chapter.pageBreakBefore`
- `true`/`false`

`manuscript.footnotes.mode`
- `endnotes` (v1 supported)
- `end-of-page` (future; not supported in v1)

`manuscript.footnotes.heading`
- heading text for endnotes section (`Notes` by default)

`typography.smartQuotes`
- `true` (default) — converts straight ASCII quotes to typographic curly quotes and typewriter dashes (`--`, `---`) to em dashes in all prose and display text
- `false` — leave quotes and dashes as-is (useful if your source already uses typographic characters or you prefer typewriter-style output)

---

## 8. Real Use Cases

### Novel draft with classic typewriter look

```bash
draft2final build novel.md -o novel.pdf --format manuscript --theme classic
```

### Manuscript without a cover block

```bash
draft2final build story.md -o story.pdf --format manuscript --cover-page none
```

---

## 9. Practical Notes

- Keep your Markdown source simple and readable first.
- Put submission metadata in the title list; avoid hiding it in ad hoc prose.
- For verse/lyrics/epigraphs, tagged fenced blocks are the clearest long-term source format.

---

## 10. See Also

- [QUICKSTART.md](QUICKSTART.md)
- [README.md](README.md)
- [../documents/manuscript-standards-matrix.md](../documents/manuscript-standards-matrix.md)
