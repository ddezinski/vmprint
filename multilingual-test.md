---
title: Multilingual Global Typesetting Test
author: VMPrint User
format: markdown
---

# 1. English (Latin Pack)
This section uses the default **Caladea** and **Arimo** fonts that are bundled directly in the `draft2final` 10MB core distribution. It should render immediately without any downloads.

> "To read makes our speaking English good."

# 2. Simplified Chinese (CJK Pack)
This section should trigger an auto-download of **Noto Sans SC**.

**中文测试**
 Draft2Final 是一个强大的排版引擎。它可以将 Markdown 转换为完美的 PDF。
（Draft2Final is a powerful typesetting engine. It can convert Markdown to perfect PDFs.）

# 3. Japanese (CJK Pack)
This section should trigger an auto-download of **Noto Sans JP**.

**日本語のテスト**
これは日本語の組版のテストです。
(This is a test of Japanese typesetting.)

# 4. Thai (Southeast Asian Scripts)
This section should trigger an auto-download of **Noto Sans Thai**.

**ทดสอบภาษาไทย**
สวัสดีชาวโลก! นี่คือการทดสอบการพิมพ์หลายภาษา
(Hello World! This is a multilingual typesetting test.)

# 5. Arabic (Middle East Scripts)
This section should trigger an auto-download of **Noto Sans Arabic**. Note that true Right-To-Left (RTL) shaping might require explicit directional markers in the current engine version, but the glyphs themselves should load and render.

**اختبار اللغة العربية**
مرحبا بالعالم! هذا اختبار التنضيد متعدد اللغات.
(Hello World! This is a multilingual typesetting test.)

# 6. Hebrew (Middle East Scripts)
This section should trigger an auto-download of **Noto Sans Hebrew**.

**מבחן בעברית**
שלום עולם! זהו מבחן סדר רב לשוני.
(Hello World! This is a multilingual typesetting test.)

# 7. Hindi / Devanagari (Indic Scripts)
This section should trigger an auto-download of **Noto Sans Devanagari**.

**हिंदी परीक्षण**
नमस्ते दुनिया! यह एक बहुभाषी टाइपसेटिंग परीक्षण है।
(Hello World! This is a multilingual typesetting test.)

# 8. Extreme Mixed Inline Text
English, 中文, 日本語, ภาษาไทย, العربية, עברית, and हिंदी all living together on a single line to test concurrent downloading and inline fallback font resolution.
