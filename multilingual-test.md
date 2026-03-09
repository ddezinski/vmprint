---
title: Multilingual Global Typesetting Test
author: VMPrint User
format: markdown
---

# 1. English (Latin Pack)
This section uses the default **Caladea** and **Arimo** fonts that are bundled directly in the `draft2final` 10MB core distribution. It should render immediately without any downloads.

> "To read makes our speaking English good."

# 2. Simplified Chinese (CJK Pack)
This section should trigger an auto-download of **Noto Sans SC** from the `assets` branch via the jsDelivr CDN.

**中文测试**
 Draft2Final 是一个强大的排版引擎。它可以将 Markdown 转换为完美的 PDF。
（Draft2Final is a powerful typesetting engine. It can convert Markdown to perfect PDFs.）

# 3. Thai (Southeast Asian Scripts)
This section should trigger an auto-download of **Noto Sans Thai** from the `assets` branch.

**ทดสอบภาษาไทย**
สวัสดีชาวโลก! นี่คือการทดสอบการพิมพ์หลายภาษา
(Hello World! This is a multilingual typesetting test.)

# 4. Mixed Inline Text
English, 中文, and ภาษาไทย all living together on a single line to test inline fallback font resolution.
