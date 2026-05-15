# Drop your blog files here

This directory is the **drop zone** for new writings. Add a file, push, and
the homepage will pick it up automatically (the GitHub Action regenerates
[`content/blogs.json`](../content/blogs.json) on every push).

> 👀 The shipped post [`welcome.md`](welcome.md) is a **kitchen-sink
> demo** — every supported block is shown there with the source above
> the rendered version. Use it as your reference / template.

## Supported formats

### 1. Markdown (`.md`) — recommended

Add YAML frontmatter:

```markdown
---
title: My Post Title
date: 2025-04-12
author: Your Name
tags: [world-models, RL]
summary: One-sentence teaser shown on the listing page.
---

# Body starts here…
```

The `slug` is derived from the filename (`my-post.md` → `my-post`).

#### Things you can drop into a post

| You write…                              | You get                                                          |
| --------------------------------------- | ---------------------------------------------------------------- |
| ` ```python … ``` `                     | A syntax-highlighted code block with a language label            |
| `` `policy.forward(obs)` ``             | Inline code                                                      |
| `$x^2$` and `$$ \int_0^1 x^2 dx $$`     | KaTeX inline / display math                                      |
| `![alt](images/foo.png "Caption text")` | A figure with caption (caption from title attribute)             |
| `![alt](images/foo.png)` + `*Caption.*` | Same — caption taken from the italic line that follows the image |
| `:::figures … :::`                      | A responsive grid of side-by-side figures                        |
| `> [!note]`, `[!tip]`, `[!warning]` …   | A coloured callout / admonition                                  |
| Pipe tables                             | Styled tables (left/right/centre alignable)                      |
| `- [x] task`                            | Task-list checkboxes                                             |
| `<details><summary>…</summary>…`        | Collapsible section                                              |
| Raw `<iframe>`                          | Embedded video (16:9)                                            |
| (automatic)                             | "Cite this post" block at the end with copy-able plain-text + BibTeX |

All of these are demonstrated in [`welcome.md`](welcome.md).

#### Citation block

The viewer auto-appends a copy-able **plain-text + BibTeX** citation to
every markdown post. Add any of these to the frontmatter to override
the defaults:

```yaml
bibtex_key: yourname_short_2025      # citation key
doi:        10.5281/zenodo.0000000   # added to BibTeX
url:        https://your.site/path   # canonical URL
bibtex: |                            # supply a full entry yourself
  @misc{key, title = {…}, author = {…}, year = {2025} }
cite: false                          # hide the block entirely
```

#### Image paths

Paths in markdown are resolved **relative to the post file**, so the
intuitive thing just works:

```
blogs/
  my-post.md
  images/
    diagram.svg
```

```markdown
![A diagram](images/diagram.svg "Figure 1. The diagram.")
```

Use absolute URLs (`https://…`) for external assets.

### 2. PDF (`.pdf`)

Great for talks, technical notes, draft papers. Drop the PDF here, then
optionally add a sidecar JSON next to it with the same basename:

```
blogs/
  my-talk.pdf
  my-talk.json   ← optional metadata
```

`my-talk.json`:

```json
{
  "title":   "My talk title",
  "date":    "2025-04-12",
  "author":  "Your Name",
  "tags":    ["talks"],
  "summary": "What the talk is about."
}
```

If you don't add a sidecar, the script fills in sensible defaults (title
from filename, today's date).

### 3. External link

Edit [`../content/blogs.json`](../content/blogs.json) directly and add an
entry with `"type": "external"` and a full URL.

## Manual regeneration

Local preview before pushing:

```bash
python3 scripts/generate_manifest.py
```
