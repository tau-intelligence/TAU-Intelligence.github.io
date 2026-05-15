# Drop your paper PDFs here

Optional. Most papers live behind arXiv or a venue site, so the
[`content/papers.json`](../content/papers.json) manifest is the source of
truth for the Research page.

If you want to host the PDF on the site itself, drop it in this folder and
reference it from [`content/papers.json`](../content/papers.json) like so:

```json
{
  "links": {
    "pdf": "papers/my-paper.pdf"
  }
}
```

The auto-generator does **not** create paper entries automatically — paper
metadata (authors, venue, abstract, BibTeX, etc.) is too rich to infer
from a filename. Edit [`content/papers.json`](../content/papers.json) by
hand when you publish.
