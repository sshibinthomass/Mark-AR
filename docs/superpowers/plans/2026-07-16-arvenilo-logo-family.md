# Arvenilo Logo Family Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a visually consistent ten-mark Arvenilo and AnchorAR logo family, persist the generated assets in the project, and assemble an editable Canva review presentation when Canva connector access is available.

**Architecture:** Use the founder-selected Spatial Aperture image as the immutable visual reference. Generate Level 2 category and platform marks as separate ImageGen 2 edits that preserve the outer A and change only the internal signal system. Generate Level 3 AnchorAR solution apps from the approved AnchorAR platform result, then verify the complete family and assemble a review presentation with exact lockup names.

**Tech Stack:** Built-in ImageGen 2, Canva branded-presentation workflow, Pillow image validation, project-local PNG assets.

## Global Constraints

- Reference: `docs/superpowers/specs/2026-07-16-arvenilo-logo-family-design.md`.
- Preserve the selected outer A silhouette, apex opening, proportions, and central-aperture placement.
- Use Spatial Ink `#081D21`, Signal Mint `#5EEAD4`, Reality Mist `#F4FBFA`, Digital Violet `#7456F1`, and Anchor Gold `#F4B942`.
- Do not use gradients, glow, bevels, glass, photorealism, detailed illustrations, rainbow app colours, or generic blockchain, brain, cube, infinity, sparkle, shield, globe, and circuit-board symbols.
- Create exactly these ten marks: Arvenilo, Arvenilo Agents, Arvenilo Spatial, Arvenilo Network, AnchorAR by Arvenilo, AnchorAR Books, AnchorAR Menu, AnchorAR Cards, AnchorAR Ads, and AnchorAR Stories.
- Every generated presentation must include a primary symbol, horizontal lockup, monochrome preview, and app-icon or small-size preview.
- If generated lockup text is inaccurate, retain the valid symbol and compose exact text during review-board assembly.
- Keep the original founder reference unchanged.

---

### Task 1: Prepare the Selected Master Reference

**Files:**
- Read: `C:/Users/shibi/AppData/Local/Temp/codex-clipboard-d4827e71-a8a1-4983-b904-cdd68519bfb3.png`
- Create: `output/imagegen/arvenilo-logo-family/00-arvenilo-master-reference.png`

**Interfaces:**
- Consumes: the founder-selected Spatial Aperture image.
- Produces: the immutable reference path used by every Level 2 ImageGen call.

- [ ] **Step 1: Copy the selected image non-destructively**

Run:

```powershell
New-Item -ItemType Directory -Force -Path 'output/imagegen/arvenilo-logo-family'
Copy-Item -LiteralPath 'C:\Users\shibi\AppData\Local\Temp\codex-clipboard-d4827e71-a8a1-4983-b904-cdd68519bfb3.png' -Destination 'output/imagegen/arvenilo-logo-family/00-arvenilo-master-reference.png'
```

Expected: one project-local PNG exists without modifying the source image.

- [ ] **Step 2: Validate the reference**

Run a Pillow inspection and confirm PNG format, square dimensions, and non-zero file size.

### Task 2: Generate Level 2 Category and Platform Marks

**Files:**
- Reference: `output/imagegen/arvenilo-logo-family/00-arvenilo-master-reference.png`
- Create:
  - `output/imagegen/arvenilo-logo-family/01-arvenilo-agents.png`
  - `output/imagegen/arvenilo-logo-family/02-arvenilo-spatial.png`
  - `output/imagegen/arvenilo-logo-family/03-arvenilo-network.png`
  - `output/imagegen/arvenilo-logo-family/04-anchorar-platform.png`

**Interfaces:**
- Consumes: the immutable Arvenilo master reference.
- Produces: four visually related Level 2 marks; the AnchorAR result becomes the reference for Task 3.

- [ ] **Step 1: Generate Arvenilo Agents**

Use ImageGen 2 edit mode. Preserve the outer A exactly. Replace only the inner signal system with one small Digital Violet intelligent node and one short directional handoff path. Require exact text `ARVENILO AGENTS`, with `AGENTS` subordinate. Avoid arrows, cursors, paper planes, brains, and circuit motifs.

- [ ] **Step 2: Generate Arvenilo Spatial**

Use ImageGen 2 edit mode. Preserve the outer A exactly. Replace only the inner signal system with two restrained Signal Mint depth planes and one Anchor Gold focus point. Require exact text `ARVENILO SPATIAL`, with `SPATIAL` subordinate. Avoid globes, cubes, headsets, and 3D effects.

- [ ] **Step 3: Generate Arvenilo Network**

Use ImageGen 2 edit mode. Preserve the outer A exactly. Replace only the inner signal system with exactly three small connected nodes using controlled mint, violet, and gold accents. Require exact text `ARVENILO NETWORK`, with `NETWORK` subordinate. Avoid blockchain chains, molecular diagrams, generic meshes, and constellations.

- [ ] **Step 4: Generate AnchorAR by Arvenilo**

Use ImageGen 2 edit mode. Preserve the outer A exactly and retain the mint reality plane. Convert the gold point into a precise anchor or registration crosshair. Require exact text `AnchorAR by Arvenilo`, with `by Arvenilo` subordinate. Avoid literal nautical anchors and location pins.

- [ ] **Step 5: Inspect all four results**

For each output confirm:

- the outer A remains recognizably unchanged;
- the internal motif matches its assigned meaning;
- the wordmark is correctly spelled or the symbol is usable independently;
- monochrome and small-size previews are credible;
- no prohibited visual cliché appears.

Regenerate only a failing result with one targeted correction.

### Task 3: Generate the Five AnchorAR Solution Apps

**Files:**
- Reference: `output/imagegen/arvenilo-logo-family/04-anchorar-platform.png`
- Create:
  - `output/imagegen/arvenilo-logo-family/05-anchorar-books.png`
  - `output/imagegen/arvenilo-logo-family/06-anchorar-menu.png`
  - `output/imagegen/arvenilo-logo-family/07-anchorar-cards.png`
  - `output/imagegen/arvenilo-logo-family/08-anchorar-ads.png`
  - `output/imagegen/arvenilo-logo-family/09-anchorar-stories.png`

**Interfaces:**
- Consumes: the approved AnchorAR platform mark from Task 2.
- Produces: five separately marketable app identities that share one fixed AnchorAR core.

- [ ] **Step 1: Generate AnchorAR Books**

Preserve the AnchorAR outer A, aperture, and gold registration point. Transform only the lower mint solution-glyph zone into a simplified open-book glyph. Require exact text `AnchorAR Books`. Avoid graduation caps, page text, pencils, and school crests.

- [ ] **Step 2: Generate AnchorAR Menu**

Preserve the AnchorAR core. Transform only the lower mint solution-glyph zone into a compact menu panel with three short horizontal rows. Require exact text `AnchorAR Menu`. Avoid cutlery, chef hats, plates, and restaurant-sign clichés.

- [ ] **Step 3: Generate AnchorAR Cards**

Preserve the AnchorAR core. Transform only the lower mint solution-glyph zone into two offset rectangular cards. Require exact text `AnchorAR Cards`. Avoid playing-card suits and payment-card branding.

- [ ] **Step 4: Generate AnchorAR Ads**

Preserve the AnchorAR core. Transform only the lower mint solution-glyph zone into one compact broadcast wedge with two restrained signal lines. Require exact text `AnchorAR Ads`. Avoid loud literal megaphones, notification bells, and social-media symbols.

- [ ] **Step 5: Generate AnchorAR Stories**

Preserve the AnchorAR core. Transform only the lower mint solution-glyph zone into an open-page spread with one restrained speech-frame corner. Require exact text `AnchorAR Stories`. Avoid comic explosion shapes, quotation marks, and detailed illustrations.

- [ ] **Step 6: Inspect all five results**

Confirm:

- every result retains the same AnchorAR core;
- each app is recognizable by glyph without its label;
- all five use the same palette and visual weight;
- exact names are correct or the symbols are suitable for exact-text composition;
- no app introduces an unrelated colour or symbol style.

Regenerate only a failing result with one targeted correction.

### Task 4: Validate and Package the Asset Family

**Files:**
- Inspect: `output/imagegen/arvenilo-logo-family/*.png`
- Create: `output/imagegen/arvenilo-logo-family/manifest.txt`

**Interfaces:**
- Consumes: the master reference and nine derived generated assets.
- Produces: a verified project-local asset set and a simple manifest.

- [ ] **Step 1: Validate image files**

Use Pillow to assert:

- exactly ten numbered PNG files exist;
- every file opens successfully;
- every image has non-zero dimensions;
- every file is larger than 100 KB.

- [ ] **Step 2: Create the manifest**

Record each filename, mark name, hierarchy level, generation mode, and approved reference source.

- [ ] **Step 3: Visually inspect the complete set**

Open all ten project-local assets and verify consistency, spelling, symbol clarity, and small-size viability.

### Task 5: Assemble the Canva Review Presentation

**Files:**
- Source: `docs/superpowers/specs/2026-07-16-arvenilo-logo-family-design.md`
- Source: `output/imagegen/arvenilo-logo-family/*.png`
- Produce: editable Canva presentation when connector access is available.

**Interfaces:**
- Consumes: the verified logo-family assets and approved hierarchy.
- Produces: an editable founder-review deck or an explicit Canva-access blocker plus the complete slide brief.

- [ ] **Step 1: Discover Canva brand kits**

Use the Canva connector to list available brand kits. If exactly one exists, use it. If no Arvenilo kit exists, use the documented palette and typography direction. If multiple plausible kits exist, stop and request the user's selection.

- [ ] **Step 2: Generate presentation candidates**

Create an eight-slide candidate deck:

1. Arvenilo Logo Family;
2. three-level brand architecture;
3. selected Arvenilo master;
4. Arvenilo Agents, Spatial, and Network;
5. AnchorAR by Arvenilo;
6. AnchorAR Books, Menu, and Cards;
7. AnchorAR Ads and Stories;
8. monochrome, small-size, expansion rule, and next steps.

- [ ] **Step 3: Create the editable presentation**

Create the final editable deck from the strongest candidate and retain exact product names.

- [ ] **Step 4: Fallback if Canva access is unavailable**

Report that the Canva connector is unavailable or not connected. Preserve the complete slide brief and all project-local assets so the deck can be created immediately after Canva is connected.

### Task 6: Final Verification and Handoff

**Files:**
- Verify: `output/imagegen/arvenilo-logo-family/`
- Verify: Canva design link if produced.

**Interfaces:**
- Consumes: all implementation outputs.
- Produces: the final founder-facing logo-family handoff.

- [ ] **Step 1: Run repository and asset checks**

Run:

```powershell
git diff --check
git status --short
```

Run the Pillow asset validator from Task 4 again.

- [ ] **Step 2: Report deliverables**

Provide:

- the project-local asset folder;
- individual clickable image links;
- the Canva presentation link when available;
- the final ImageGen prompt strategy;
- any remaining production-vector or trademark-clearance caveats.
