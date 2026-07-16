# Arvenilo Main Logo Exploration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate five consistent, polished Arvenilo main-logo concepts for founder selection before derived sub-brand development.

**Architecture:** Use five separate built-in ImageGen 2 calls, one per approved geometric route, to prevent one concept from contaminating another. Every prompt shares the same palette, typography, presentation layout, and exclusions; only the core symbol construction changes. Inspect each result for spelling, geometric distinctiveness, monochrome viability, and small-size clarity, then regenerate only concepts that fail those checks.

**Tech Stack:** Built-in ImageGen 2, Codex image inspection, project-local design specification.

## Global Constraints

- Use case is `logo-brand`.
- Generate exactly five distinct concepts: Spatial Aperture, Signal Horizon, Agent Vertex, Connected Aperture, and Reality Fold.
- The only logo text is `ARVENILO`, spelled exactly `A-R-V-E-N-I-L-O`.
- Use flat, minimal, vector-friendly geometry on a plain Reality Mist `#F4FBFA` background.
- Primary colours are Spatial Ink `#081D21` and Signal Mint `#5EEAD4`.
- Digital Violet `#7456F1` and Anchor Gold `#F4B942` are optional controlled accents only.
- Each square presentation contains a large symbol, a horizontal symbol-and-wordmark lockup, a monochrome preview, and an app-icon-scale preview.
- Do not use gradients, shadows, bevels, glass, 3D effects, mockup scenery, mascots, shields, globes, cubes, infinity symbols, blockchain chains, brains, circuit-board motifs, sparkles, watermarks, taglines, or extra text.
- Do not develop sub-brand logos during this phase.

---

### Task 1: Generate Spatial Aperture

**Files:**
- Reference: `docs/superpowers/specs/2026-07-16-arvenilo-main-logo-exploration-design.md`
- Produce: built-in ImageGen concept asset for `Spatial Aperture`

**Interfaces:**
- Consumes: the approved palette, presentation template, exclusions, and Spatial Aperture geometry.
- Produces: one square concept presentation suitable for comparison with the other four routes.

- [ ] **Step 1: Generate the concept**

Use this prompt:

```text
Use case: logo-brand
Asset type: Arvenilo main-logo concept presentation
Primary request: Create the Spatial Aperture logo concept for Arvenilo, an Intelligent Reality company spanning Agentic AI, XR, Web3, and AnchorAR. Build an original open geometric letter A from two converging spatial paths. Place one small central signal point inside a clean aperture or horizon crossing, expressing intelligence entering reality.
Scene/backdrop: perfectly plain Reality Mist #F4FBFA background
Style/medium: polished flat vector-logo aesthetic, minimal geometric construction, strong silhouette, balanced negative space
Composition/framing: square presentation with four clearly separated applications: one large primary symbol, one horizontal symbol-and-wordmark lockup, one small monochrome symbol preview, and one small app-icon preview; generous margins; no device or stationery mockups
Color palette: Spatial Ink #081D21 and Signal Mint #5EEAD4 dominate; one very restrained Anchor Gold #F4B942 signal point is permitted
Text (verbatim): "ARVENILO"
Typography: custom-looking uppercase geometric sans serif, highly legible, balanced spacing; spell A-R-V-E-N-I-L-O exactly once in the horizontal lockup
Constraints: the symbol must subtly read as letter A, portal, focus point, and spatial convergence; preserve clarity in one colour and at tiny size; original design; no tagline; no other words
Avoid: gradients, shadows, glow, bevels, glass, 3D, photorealism, mockup scenery, mountains, navigation icons, location pins, cursors, paper planes, shields, globes, cubes, infinity symbols, chains, brains, circuit boards, sparkles, watermarks
```

- [ ] **Step 2: Inspect the result**

Confirm:

- `ARVENILO` is spelled correctly;
- the symbol has an open A silhouette;
- the central signal point remains visible at app-icon scale;
- the monochrome preview works without relying on colour;
- no prohibited visual cliché or extra text appears.

### Task 2: Generate Signal Horizon

**Files:**
- Reference: `docs/superpowers/specs/2026-07-16-arvenilo-main-logo-exploration-design.md`
- Produce: built-in ImageGen concept asset for `Signal Horizon`

**Interfaces:**
- Consumes: the shared visual system and Signal Horizon geometry.
- Produces: one square concept presentation directly comparable with Task 1.

- [ ] **Step 1: Generate the concept**

Use this prompt:

```text
Use case: logo-brand
Asset type: Arvenilo main-logo concept presentation
Primary request: Create the Signal Horizon logo concept for Arvenilo, an Intelligent Reality company spanning Agentic AI, XR, Web3, and AnchorAR. Construct a minimal geometric letter A intersected by one precise horizontal plane, with a single signal point emerging through or just above that horizon. Express the meeting of physical and digital layers, clarity, presence, and emergence.
Scene/backdrop: perfectly plain Reality Mist #F4FBFA background
Style/medium: polished flat vector-logo aesthetic, minimal geometric construction, strong silhouette, balanced negative space
Composition/framing: square presentation with four clearly separated applications: one large primary symbol, one horizontal symbol-and-wordmark lockup, one small monochrome symbol preview, and one small app-icon preview; generous margins; no device or stationery mockups
Color palette: Spatial Ink #081D21 and Signal Mint #5EEAD4 dominate; one very restrained Anchor Gold #F4B942 signal point is permitted
Text (verbatim): "ARVENILO"
Typography: custom-looking uppercase geometric sans serif, highly legible, balanced spacing; spell A-R-V-E-N-I-L-O exactly once in the horizontal lockup
Constraints: make the horizontal plane a structural part of the A; preserve clarity in one colour and at tiny size; original design; no tagline; no other words
Avoid: sunrise, sunset, mountain, navigation, compass, location-pin or landscape-logo resemblance; gradients, shadows, glow, bevels, glass, 3D, photorealism, mockup scenery, shields, globes, cubes, infinity symbols, chains, brains, circuit boards, sparkles, watermarks
```

- [ ] **Step 2: Inspect the result**

Confirm:

- `ARVENILO` is spelled correctly;
- the horizon is structurally integrated rather than scenic;
- the symbol does not resemble a mountain or sunrise;
- monochrome and small-size previews remain clear;
- no prohibited effects or extra text appear.

### Task 3: Generate Agent Vertex

**Files:**
- Reference: `docs/superpowers/specs/2026-07-16-arvenilo-main-logo-exploration-design.md`
- Produce: built-in ImageGen concept asset for `Agent Vertex`

**Interfaces:**
- Consumes: the shared visual system and Agent Vertex geometry.
- Produces: one square concept presentation directly comparable with Tasks 1 and 2.

- [ ] **Step 1: Generate the concept**

Use this prompt:

```text
Use case: logo-brand
Asset type: Arvenilo main-logo concept presentation
Primary request: Create the Agent Vertex logo concept for Arvenilo, an Intelligent Reality company spanning Agentic AI, XR, Web3, and AnchorAR. Form a crisp abstract letter A from two purposeful directional paths that converge at a decisive vertex and change direction around one intelligent node. Express autonomous action, orchestration, intention, movement, and decision-making.
Scene/backdrop: perfectly plain Reality Mist #F4FBFA background
Style/medium: polished flat vector-logo aesthetic, minimal geometric construction, strong silhouette, balanced negative space
Composition/framing: square presentation with four clearly separated applications: one large primary symbol, one horizontal symbol-and-wordmark lockup, one small monochrome symbol preview, and one small app-icon preview; generous margins; no device or stationery mockups
Color palette: Spatial Ink #081D21 and Signal Mint #5EEAD4 dominate; one restrained Digital Violet #7456F1 node accent is permitted
Text (verbatim): "ARVENILO"
Typography: custom-looking uppercase geometric sans serif, highly legible, balanced spacing; spell A-R-V-E-N-I-L-O exactly once in the horizontal lockup
Constraints: the symbol must read as a unique A-shaped agent path, not a literal arrow; preserve clarity in one colour and at tiny size; original design; no tagline; no other words
Avoid: paper planes, cursors, mouse pointers, location pins, play buttons, cryptocurrency marks, literal arrows, gradients, shadows, glow, bevels, glass, 3D, photorealism, mockup scenery, shields, globes, cubes, infinity symbols, chains, brains, circuit boards, sparkles, watermarks
```

- [ ] **Step 2: Inspect the result**

Confirm:

- `ARVENILO` is spelled correctly;
- the directional motion is evident without becoming a cursor or paper plane;
- the intelligent node remains secondary to the main silhouette;
- monochrome and small-size previews remain clear;
- no prohibited effects or extra text appear.

### Task 4: Generate Connected Aperture

**Files:**
- Reference: `docs/superpowers/specs/2026-07-16-arvenilo-main-logo-exploration-design.md`
- Produce: built-in ImageGen concept asset for `Connected Aperture`

**Interfaces:**
- Consumes: the shared visual system and Connected Aperture geometry.
- Produces: one square concept presentation directly comparable with Tasks 1–3.

- [ ] **Step 1: Generate the concept**

Use this prompt:

```text
Use case: logo-brand
Asset type: Arvenilo main-logo concept presentation
Primary request: Create the Connected Aperture logo concept for Arvenilo, an Intelligent Reality company spanning Agentic AI, XR, Web3, and AnchorAR. Use exactly three restrained circular nodes and a minimal set of connecting paths to construct an open geometric A-shaped aperture around a clear central negative space. Express trusted connection, interoperability, and an intelligent ecosystem without depicting a literal blockchain.
Scene/backdrop: perfectly plain Reality Mist #F4FBFA background
Style/medium: polished flat vector-logo aesthetic, minimal geometric construction, strong silhouette, balanced negative space
Composition/framing: square presentation with four clearly separated applications: one large primary symbol, one horizontal symbol-and-wordmark lockup, one small monochrome symbol preview, and one small app-icon preview; generous margins; no device or stationery mockups
Color palette: Spatial Ink #081D21 and Signal Mint #5EEAD4 dominate; restrained Digital Violet #7456F1 may distinguish one node
Text (verbatim): "ARVENILO"
Typography: custom-looking uppercase geometric sans serif, highly legible, balanced spacing; spell A-R-V-E-N-I-L-O exactly once in the horizontal lockup
Constraints: exactly three nodes; keep the A silhouette simpler and stronger than the network detail; preserve clarity in one colour and at tiny size; original design; no tagline; no other words
Avoid: blockchain-chain diagrams, molecular diagrams, share icons, generic network meshes, constellations, gradients, shadows, glow, bevels, glass, 3D, photorealism, mockup scenery, shields, globes, cubes, infinity symbols, brains, circuit boards, sparkles, watermarks
```

- [ ] **Step 2: Inspect the result**

Confirm:

- `ARVENILO` is spelled correctly;
- exactly three nodes are used;
- the A silhouette remains stronger than the network metaphor;
- monochrome and small-size previews remain clear;
- no prohibited effects or extra text appear.

### Task 5: Generate Reality Fold

**Files:**
- Reference: `docs/superpowers/specs/2026-07-16-arvenilo-main-logo-exploration-design.md`
- Produce: built-in ImageGen concept asset for `Reality Fold`

**Interfaces:**
- Consumes: the shared visual system and Reality Fold geometry.
- Produces: the fifth square concept presentation and completes the comparison set.

- [ ] **Step 1: Generate the concept**

Use this prompt:

```text
Use case: logo-brand
Asset type: Arvenilo main-logo concept presentation
Primary request: Create the Reality Fold logo concept for Arvenilo, an Intelligent Reality company spanning Agentic AI, XR, Web3, and AnchorAR. Build an original abstract letter A from exactly two precise folded planar shapes whose overlap and negative space create the letterform. Express physical and digital realities becoming one elegant system, with premium architectural simplicity.
Scene/backdrop: perfectly plain Reality Mist #F4FBFA background
Style/medium: polished flat vector-logo aesthetic, minimal geometric construction, strong silhouette, balanced negative space
Composition/framing: square presentation with four clearly separated applications: one large primary symbol, one horizontal symbol-and-wordmark lockup, one small monochrome symbol preview, and one small app-icon preview; generous margins; no device or stationery mockups
Color palette: Spatial Ink #081D21 and Signal Mint #5EEAD4 dominate; no additional accent is needed
Text (verbatim): "ARVENILO"
Typography: custom-looking uppercase geometric sans serif, highly legible, balanced spacing; spell A-R-V-E-N-I-L-O exactly once in the horizontal lockup
Constraints: exactly two planar forms; create the A primarily through negative space; preserve clarity in one colour and at tiny size; original design; no tagline; no other words
Avoid: generic ribbons, origami birds, excessive facets, impossible 3D geometry, gradients, shadows, glow, bevels, glass, 3D rendering, photorealism, mockup scenery, shields, globes, cubes, infinity symbols, chains, brains, circuit boards, sparkles, watermarks
```

- [ ] **Step 2: Inspect the result**

Confirm:

- `ARVENILO` is spelled correctly;
- exactly two planar forms create a recognizable A through negative space;
- the mark does not resemble a generic ribbon or origami symbol;
- monochrome and small-size previews remain clear;
- no prohibited effects or extra text appear.

### Task 6: Compare and Deliver

**Files:**
- Inspect: all five built-in ImageGen outputs
- Reference: `docs/superpowers/specs/2026-07-16-arvenilo-main-logo-exploration-design.md`

**Interfaces:**
- Consumes: the five generated concept presentations.
- Produces: a complete founder-facing selection set.

- [ ] **Step 1: Verify the full set**

Confirm that:

- all five approved routes exist;
- each route has distinct geometry;
- all presentations use a consistent palette and layout;
- the wordmark is correctly spelled wherever it appears;
- each presentation includes symbol, lockup, monochrome, and app-icon views.

- [ ] **Step 2: Regenerate only failed concepts**

If a concept fails one criterion, issue one targeted follow-up that changes only the failing property while repeating the shared palette, exact spelling, presentation layout, and exclusions.

- [ ] **Step 3: Present the five concepts**

Render all five outputs inline, identified in this order:

1. Spatial Aperture — Recommended
2. Signal Horizon
3. Agent Vertex
4. Connected Aperture
5. Reality Fold

Do not create sub-brand marks until the user chooses one main-logo route.
