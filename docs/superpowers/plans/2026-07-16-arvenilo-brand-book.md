# Arvenilo Brand Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate one polished, visually verified Arvenilo brand-book PDF containing the complete strategy and identity system, with a recommended decision and credible alternatives wherever optimization is useful.

**Architecture:** Store editorial content in a dedicated Python content module, render reusable identity and layout primitives from a separate visual module, and compose the final document through a ReportLab generator. Validate the content model and generated PDF with focused Python tests, then render every page through Poppler for visual inspection.

**Tech Stack:** Python 3, ReportLab, pypdf, pdfplumber, Poppler (`pdfinfo`, `pdftoppm`), unittest.

## Global Constraints

- Final artifact: `output/pdf/arvenilo-complete-brand-book.pdf`.
- Temporary renders: `tmp/pdfs/`.
- Use ASCII hyphens only; avoid non-breaking or typographic dash glyphs.
- Arvenilo is the parent company; AnchorAR is the first active product.
- Future descriptors such as Arvenilo Agents, Arvenilo Spatial, and Arvenilo Network must be labelled reserved concepts.
- Agentic AI, XR, and Web3 are enabling layers, not disconnected headline buzzwords.
- Every major decision must show one clearly marked recommended option plus credible alternatives wherever useful.
- Every alternative must include a selection condition or trade-off.
- Do not claim trademark clearance or legal availability.
- Use original vector and abstract spatial visuals; do not depend on licensed stock imagery.
- Render and inspect every page before delivery.

## File Structure

- `tools/brand_book/content.py` - complete brand strategy, option sets, pitches, examples, roadmaps, and legal caveats.
- `tools/brand_book/visuals.py` - colour constants, logo routes, diagrams, cards, grids, and drawing helpers.
- `tools/brand_book/generate.py` - document setup, page templates, flowables, section composition, and PDF generation entrypoint.
- `tests/brand_book/test_content.py` - option-system, required-section, active-product, and legal-language tests.
- `tests/brand_book/test_pdf.py` - output existence, metadata, page count, required text, and malformed-text tests.
- `output/pdf/arvenilo-complete-brand-book.pdf` - final generated artifact.
- `tmp/pdfs/` - page renders and contact sheets used during verification.

---

### Task 1: Encode the complete brand content and option system

**Files:**
- Create: `tools/brand_book/__init__.py`
- Create: `tools/brand_book/content.py`
- Create: `tests/brand_book/__init__.py`
- Create: `tests/brand_book/test_content.py`

**Interfaces:**
- Produces: `BRAND_BOOK: dict`, `option_set(recommended, alternatives, guidance) -> dict`, and `validate_content() -> list[str]`.
- Consumes: approved design in `docs/superpowers/specs/2026-07-16-arvenilo-brand-book-design.md`.

- [ ] **Step 1: Write the failing content tests**

```python
import unittest

from tools.brand_book.content import BRAND_BOOK, validate_content


class BrandContentTests(unittest.TestCase):
    def test_required_sections_exist(self):
        required = {
            "foundation", "positioning", "audiences", "architecture",
            "anchorar", "messaging", "voice", "identity", "digital",
            "launch", "governance",
        }
        self.assertTrue(required.issubset(BRAND_BOOK))

    def test_option_sets_have_one_recommendation_and_two_alternatives(self):
        for option in BRAND_BOOK["option_sets"]:
            self.assertTrue(option["recommended"]["value"])
            self.assertGreaterEqual(len(option["alternatives"]), 2)
            self.assertTrue(option["selection_guidance"])

    def test_future_products_are_reserved(self):
        products = BRAND_BOOK["architecture"]["products"]
        self.assertEqual(products["AnchorAR"]["status"], "active")
        for name in ("Arvenilo Agents", "Arvenilo Spatial", "Arvenilo Network"):
            self.assertEqual(products[name]["status"], "reserved")

    def test_content_validation_has_no_errors(self):
        self.assertEqual(validate_content(), [])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests and verify failure**

Run:

```powershell
& 'C:\Users\shibi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tests.brand_book.test_content -v
```

Expected: FAIL because `tools.brand_book.content` does not exist.

- [ ] **Step 3: Implement the content model**

Create `content.py` with this public shape:

```python
def option_set(topic, recommended, alternatives, selection_guidance):
    return {
        "topic": topic,
        "recommended": recommended,
        "alternatives": alternatives,
        "selection_guidance": selection_guidance,
    }


BRAND_BOOK = {
    "meta": {
        "name": "Arvenilo",
        "pronunciation": "ar-veh-nee-lo",
        "tagline": "Where Intelligence Meets Reality.",
        "category": "Intelligent Reality company",
    },
    "foundation": {},
    "positioning": {},
    "audiences": {},
    "architecture": {},
    "anchorar": {},
    "messaging": {},
    "voice": {},
    "identity": {},
    "digital": {},
    "launch": {},
    "governance": {},
    "option_sets": [],
}


def validate_content():
    errors = []
    required = {
        "foundation", "positioning", "audiences", "architecture",
        "anchorar", "messaging", "voice", "identity", "digital",
        "launch", "governance",
    }
    missing = required.difference(BRAND_BOOK)
    if missing:
        errors.append(f"Missing sections: {sorted(missing)}")
    for item in BRAND_BOOK.get("option_sets", []):
        if len(item.get("alternatives", [])) < 2:
            errors.append(f"Option set needs two alternatives: {item.get('topic')}")
        if not item.get("selection_guidance"):
            errors.append(f"Option set needs guidance: {item.get('topic')}")
    return errors
```

Populate every approved section with final copy. Include at least 18 option sets spanning strategy, taglines, pitches, architecture, identity, website, campaign, and launch decisions.

- [ ] **Step 4: Run the content tests**

Run the Step 2 command.

Expected: all tests PASS.

- [ ] **Step 5: Commit the content model**

```powershell
git add tools/brand_book tests/brand_book
git commit -m "feat: define Arvenilo brand content"
```

### Task 2: Build the vector identity and layout primitives

**Files:**
- Create: `tools/brand_book/visuals.py`
- Modify: `tests/brand_book/test_content.py`

**Interfaces:**
- Consumes: option labels and identity values from `BRAND_BOOK`.
- Produces: `PALETTE`, `draw_logo_symbol(canvas, x, y, size, route)`, `draw_spatial_grid(...)`, `draw_option_card(...)`, `draw_architecture_map(...)`, and `draw_palette_swatch(...)`.

- [ ] **Step 1: Add failing visual-contract tests**

```python
from tools.brand_book.visuals import PALETTE, LOGO_ROUTES


class BrandVisualContractTests(unittest.TestCase):
    def test_palette_contains_accessible_core_roles(self):
        self.assertEqual(PALETTE["spatial_ink"], "#081D21")
        self.assertIn("signal_mint", PALETTE)
        self.assertIn("reality_mist", PALETTE)

    def test_logo_routes_include_recommended_and_alternatives(self):
        self.assertEqual(LOGO_ROUTES[0]["status"], "Recommended")
        self.assertGreaterEqual(len(LOGO_ROUTES), 3)
```

- [ ] **Step 2: Verify the visual-contract tests fail**

Run:

```powershell
& 'C:\Users\shibi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tests.brand_book.test_content -v
```

Expected: FAIL because `tools.brand_book.visuals` does not exist.

- [ ] **Step 3: Implement reusable visual primitives**

Define:

```python
PALETTE = {
    "spatial_ink": "#081D21",
    "signal_mint": "#5EEAD4",
    "reality_mist": "#F4FBFA",
    "digital_violet": "#7456F1",
    "anchor_gold": "#F4B942",
    "slate": "#4D6265",
    "white": "#FFFFFF",
}

LOGO_ROUTES = [
    {"name": "Spatial Aperture", "status": "Recommended"},
    {"name": "Agent Path", "status": "Alternative A"},
    {"name": "Reality Anchor", "status": "Alternative B"},
]
```

Implement all drawing functions with ReportLab canvas operations only. The recommended mark must combine an implied A, an aperture, and an illuminated anchor point.

- [ ] **Step 4: Run the visual-contract tests**

Expected: all tests PASS.

- [ ] **Step 5: Commit the visual system**

```powershell
git add tools/brand_book/visuals.py tests/brand_book/test_content.py
git commit -m "feat: add Arvenilo vector identity system"
```

### Task 3: Build the PDF composition engine

**Files:**
- Create: `tools/brand_book/generate.py`
- Create: `tests/brand_book/test_pdf.py`

**Interfaces:**
- Consumes: `BRAND_BOOK`, `PALETTE`, logo and diagram drawing functions.
- Produces: `build_brand_book(output_path: str) -> str`.

- [ ] **Step 1: Write the failing PDF smoke test**

```python
import tempfile
import unittest
from pathlib import Path

from pypdf import PdfReader
from tools.brand_book.generate import build_brand_book


class BrandPdfTests(unittest.TestCase):
    def test_generator_creates_a_multipage_pdf(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "brand-book.pdf"
            result = Path(build_brand_book(str(path)))
            self.assertTrue(result.exists())
            self.assertGreater(len(PdfReader(str(result)).pages), 30)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run and verify failure**

Run:

```powershell
& 'C:\Users\shibi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest tests.brand_book.test_pdf -v
```

Expected: FAIL because `tools.brand_book.generate` does not exist.

- [ ] **Step 3: Implement the composition engine**

Use a landscape A4 `BaseDocTemplate`, two page templates (dark opener and light editorial), and reusable flowables:

```python
PAGE_SIZE = landscape(A4)


def build_brand_book(output_path):
    target = Path(output_path)
    target.parent.mkdir(parents=True, exist_ok=True)
    doc = BrandBookDocTemplate(
        str(target),
        pagesize=PAGE_SIZE,
        title="Arvenilo Complete Brand Book",
        author="Arvenilo",
    )
    story = build_story()
    doc.build(story)
    return str(target)
```

Implement page numbers, section labels, dark and light backgrounds, paragraph styles, option cards, callouts, tables, architecture diagrams, palette pages, and logo demonstrations.

- [ ] **Step 4: Run the PDF smoke test**

Expected: PASS with more than 30 pages.

- [ ] **Step 5: Commit the PDF engine**

```powershell
git add tools/brand_book/generate.py tests/brand_book/test_pdf.py
git commit -m "feat: build Arvenilo brand book PDF engine"
```

### Task 4: Compose all approved sections and option comparisons

**Files:**
- Modify: `tools/brand_book/content.py`
- Modify: `tools/brand_book/generate.py`
- Modify: `tests/brand_book/test_pdf.py`

**Interfaces:**
- Consumes: all content and visual primitives from Tasks 1-3.
- Produces: a 36-50 page complete brand book with every approved section represented.

- [ ] **Step 1: Add failing required-text tests**

```python
def test_pdf_contains_required_brand_language(self):
    path = Path("output/pdf/arvenilo-complete-brand-book.pdf")
    build_brand_book(str(path))
    text = "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)
    required = [
        "Where Intelligence Meets Reality.",
        "AnchorAR by Arvenilo",
        "Recommended",
        "Alternative A",
        "Alternative B",
        "Intelligent Reality company",
        "Reality, Activated.",
        "Trademark clearance",
    ]
    for phrase in required:
        self.assertIn(phrase, text)
```

- [ ] **Step 2: Run and verify failure**

Run the Task 3 test command.

Expected: FAIL for one or more missing required phrases.

- [ ] **Step 3: Complete the editorial composition**

Add every section listed in the design specification. For each major option page, render:

```python
option_comparison(
    topic="Master tagline",
    recommended=("Where Intelligence Meets Reality.", "Best all-round parent-brand line."),
    alternatives=[
        ("Intelligence Beyond the Screen.", "Choose for a more AI-led market entry."),
        ("Reality, Activated.", "Choose for a more product and campaign-led entry."),
    ],
)
```

Include ready-to-copy company descriptions, B2B/B2C pitches, investor copy, AnchorAR messages, website copy, social copy, campaign options, roadmap, asset checklist, and governance rules.

- [ ] **Step 4: Run all brand-book tests**

Run:

```powershell
& 'C:\Users\shibi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s tests/brand_book -v
```

Expected: all tests PASS.

- [ ] **Step 5: Commit the complete composition**

```powershell
git add tools/brand_book tests/brand_book
git commit -m "feat: complete Arvenilo brand book content"
```

### Task 5: Generate and programmatically verify the final PDF

**Files:**
- Create: `output/pdf/arvenilo-complete-brand-book.pdf`
- Modify: `tests/brand_book/test_pdf.py`

**Interfaces:**
- Consumes: `build_brand_book`.
- Produces: stable final PDF plus verification evidence.

- [ ] **Step 1: Generate the stable output**

Run:

```powershell
& 'C:\Users\shibi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m tools.brand_book.generate
```

Expected: prints the absolute path and page count for `output/pdf/arvenilo-complete-brand-book.pdf`.

- [ ] **Step 2: Inspect PDF metadata**

Run:

```powershell
pdfinfo 'output/pdf/arvenilo-complete-brand-book.pdf'
```

Expected: valid PDF, landscape A4 page size, more than 30 pages, non-zero file size.

- [ ] **Step 3: Extract and scan text**

Run:

```powershell
pdftotext 'output/pdf/arvenilo-complete-brand-book.pdf' 'tmp/pdfs/arvenilo-brand-book.txt'
```

Then search for unfinished markers and malformed source tokens:

```powershell
rg -n 'T[B]D|T[O]DO|PLACEH[O]LDER|turn[0-9]+search|�' 'tmp/pdfs/arvenilo-brand-book.txt'
```

Expected: no matches.

- [ ] **Step 4: Run all tests against the stable output**

Run the Task 4 test command.

Expected: all tests PASS.

- [ ] **Step 5: Commit the verified generator and artifact**

```powershell
git add tools/brand_book tests/brand_book output/pdf/arvenilo-complete-brand-book.pdf
git commit -m "docs: generate Arvenilo complete brand book"
```

### Task 6: Render, inspect, and correct every page

**Files:**
- Create: `tmp/pdfs/arvenilo-page-*.png`
- Create: `tmp/pdfs/arvenilo-contact-sheet.png`
- Modify as needed: `tools/brand_book/generate.py`
- Regenerate: `output/pdf/arvenilo-complete-brand-book.pdf`

**Interfaces:**
- Consumes: final PDF from Task 5.
- Produces: visually verified final PDF with no clipping, overlap, broken glyphs, or inconsistent page furniture.

- [ ] **Step 1: Render every page**

Run:

```powershell
pdftoppm -png -r 120 'output/pdf/arvenilo-complete-brand-book.pdf' 'tmp/pdfs/arvenilo-page'
```

Expected: one PNG per PDF page.

- [ ] **Step 2: Build a contact sheet**

Use Pillow to assemble all rendered pages at thumbnail scale into `tmp/pdfs/arvenilo-contact-sheet.png`, labelled with page numbers.

- [ ] **Step 3: Inspect visual rhythm and dense pages**

Inspect the contact sheet, cover, contents, audience comparison, architecture, messaging options, logo options, palette, typography, website, campaign, roadmap, and final checklist pages.

Expected:

- no clipped or overlapping text;
- readable option cards;
- consistent page numbers and section labels;
- balanced dark/light page rhythm;
- no black squares or missing glyphs;
- recommendations visually dominant but alternatives still legible.

- [ ] **Step 4: Correct defects and regenerate**

For each defect, adjust styles or content density in `generate.py`, regenerate, rerender, and reinspect the affected pages. Repeat until the latest inspection has zero defects.

- [ ] **Step 5: Run final verification**

Run:

```powershell
& 'C:\Users\shibi\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' -m unittest discover -s tests/brand_book -v
pdfinfo 'output/pdf/arvenilo-complete-brand-book.pdf'
```

Expected: all tests PASS and PDF metadata is valid.
