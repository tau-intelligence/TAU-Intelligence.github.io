# Tau Intelligence — website

> **τ — Trustworthy Autonomy under Uncertainty.**
> Static, dependency-free site for a research group working on
> reinforcement learning, world models, and robotics. Hosted on
> GitHub Pages.

This repository **is** the website. There is no build step. Open
[`index.html`](index.html) in a browser and it works.

---

## Pages

| Page                              | What it is                                                              |
| --------------------------------- | ----------------------------------------------------------------------- |
| [`index.html`](index.html)        | Home. Hero with an interactive 3D armillary scene (Three.js, no build). |
| [`research.html`](research.html)  | Publications, filtered by venue, searchable.                            |
| [`blogs.html`](blogs.html)        | Technical writings (Markdown + PDF + external links).                   |
| [`about.html`](about.html)        | About + contact.                                                        |
| [`blog.html`](blog.html)          | Single-post viewer (`?slug=…`). Renders Markdown or embeds PDF.         |

The whole site shares one stylesheet ([`assets/css/style.css`](assets/css/style.css))
whose colour tokens come straight from the company logo (warm copper,
cream, near-black). Re-theme by editing the `:root` block.

---

## Adding content

### A new blog post — Markdown (recommended)

1. Create `blogs/my-post.md` with YAML frontmatter:

   ```markdown
   ---
   title: My post title
   date: 2025-04-12
   author: Your Name
   tags: [world-models, RL]
   summary: One-sentence teaser.
   ---

   # Body…
   ```

2. Push. The GitHub Action regenerates [`content/blogs.json`](content/blogs.json)
   and the post appears on [`blogs.html`](blogs.html). To preview locally
   first, run:

   ```bash
   python3 scripts/generate_manifest.py
   ```

### A new blog post — PDF

1. Drop the file: `blogs/my-talk.pdf`
2. *(Optional)* add a sidecar `blogs/my-talk.json` with metadata:

   ```json
   {
     "title":  "My talk title",
     "date":   "2025-04-12",
     "author": "Your Name",
     "tags":   ["talks"],
     "summary": "What the talk is about."
   }
   ```

3. Push. Done.

### A new publication

Edit [`content/papers.json`](content/papers.json) and add an entry. Paper
metadata is too rich to infer from a filename, so this is intentionally
manual:

```json
{
  "title": "…",
  "authors": ["A", "B"],
  "venue": "NeurIPS",
  "year": 2025,
  "tags": ["RL", "world models"],
  "abstract": "…",
  "links": {
    "pdf": "papers/my-paper.pdf",
    "arxiv": "https://arxiv.org/abs/…",
    "code": "https://github.com/…",
    "project": "https://…"
  }
}
```

If you want to host the PDF too, drop it in [`papers/`](papers/).

---

## Local preview

No toolchain required:

```bash
# Any static server. Python's built-in works fine.
python3 -m http.server 8080
# then open http://localhost:8080
```

(Opening `index.html` directly with `file://` mostly works, but the
JSON `fetch()` calls used by the research/blog loaders need an HTTP
origin — use the server.)

---

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. **Settings → Pages → Build and deployment → Source → "GitHub Actions"**.
3. Push to `main`. The workflow at
   [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) will:
   - Run [`scripts/generate_manifest.py`](scripts/generate_manifest.py)
     to refresh [`content/blogs.json`](content/blogs.json).
   - Auto-commit the regenerated manifest (with `[skip ci]` so it doesn't loop).
   - Publish the entire repo as the GitHub Pages artifact.

Custom domain? Rename [`CNAME.example`](CNAME.example) to `CNAME` and put
your domain inside it.

---

## Repository layout

```
.
├── index.html              ← Home (3D hero)
├── research.html           ← Publications listing
├── blogs.html              ← Writings listing
├── about.html              ← About + contact
├── blog.html               ← Single-post viewer
│
├── assets/
│   ├── css/style.css       ← Single stylesheet, all theme tokens at top
│   ├── js/
│   │   ├── main.js             ← Nav toggle + reveal-on-scroll
│   │   ├── three-hero.js       ← Interactive 3D hero (Three.js, ESM CDN)
│   │   ├── research-loader.js  ← Renders papers from content/papers.json
│   │   ├── blogs-loader.js     ← Renders writings from content/blogs.json
│   │   └── blog-viewer.js      ← Renders Markdown / embeds PDF
│   └── img/
│       ├── logo.svg            ← Fallback τ mark
│       └── (drop logo.png here)
│
├── content/
│   ├── papers.json         ← Publications manifest (edit by hand)
│   └── blogs.json          ← Writings manifest (auto-generated)
│
├── blogs/                  ← Drop .md / .pdf files here
│   └── welcome.md          ← Example post
├── papers/                 ← Optional: host paper PDFs here
│
├── scripts/
│   └── generate_manifest.py    ← Scans /blogs → writes content/blogs.json
│
├── .github/workflows/deploy.yml ← Build manifest + publish to Pages
├── .nojekyll                    ← Tells Pages to skip Jekyll
└── CNAME.example                ← Rename to CNAME for a custom domain
```

---

## Theme

All colours are tokens at the top of [`assets/css/style.css`](assets/css/style.css)
under `:root`. The defaults are sampled from the logo:

| Token         | Hex       | Role                          |
| ------------- | --------- | ----------------------------- |
| `--primary`   | `#E8722C` | Logo orange                   |
| `--primary-2` | `#B8541C` | Deep copper                   |
| `--accent`    | `#E9A766` | Warm gold highlight           |
| `--bg`        | `#0E0D0B` | Page background (near-black)  |
| `--text`      | `#F2E9D8` | Body text (cream)             |

Change them in one place; the whole site re-themes.

---

## The 3D hero

[`assets/js/three-hero.js`](assets/js/three-hero.js) loads
[Three.js](https://threejs.org/) from a CDN as a native ES module — no
bundler. The scene is a wireframe icosphere wrapped by three orbiting
copper rings (a nod to the logo's armillary sphere) inside a warm
particle field. Drag to rotate, scroll to zoom, move the cursor to
parallax-nudge the camera. Pauses automatically when off-screen, and
silently no-ops if WebGL is unavailable.

To swap the visual for something else (e.g. a Gaussian-splat viewer
later), edit just that one file.