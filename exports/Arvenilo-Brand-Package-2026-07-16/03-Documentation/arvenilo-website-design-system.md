# Arvenilo Website Theme and Design System

- Version: 1.0
- Date: 2026-07-16
- Status: Approved design direction
- Experience concept: Spatial Aperture Portal
- Visual theme: Precision Spatial

## 1. Purpose

This document defines the visual, interaction, content, responsive, and 3D direction for the Arvenilo public website.

The website will be:

- multi-page;
- B2C-first;
- equally useful to people who want to create an AR experience and people who want to explore one;
- serious, precise, futuristic, and recognizably Arvenilo;
- fully usable on mobile and desktop;
- grounded in the existing Arvenilo brand book and logo family;
- clear about what is available now, what is an AnchorAR possibility, and what is coming later.

The website must make advanced technology feel understandable. It should create a strong spatial impression without becoming a cyberpunk showcase, game interface, or generic AI startup website.

## 2. Reference Sources

The design is derived from:

- `arvenilo-complete-brand-book.pdf`;
- the approved Arvenilo Spatial Aperture logo;
- the Arvenilo logo family and transparent PNG exports;
- the approved brand architecture and product-status system.

When colours in generated raster logo concepts differ slightly from the brand book, the brand-book values in this document are the source of truth for website UI. Existing logo image files must remain unchanged.

## 3. Non-Negotiable Brand Truth

The website must always preserve the following product hierarchy.

### Available now

- **AnchorAR by Arvenilo** is the only currently available product.

### AnchorAR possibilities

These are use-case ideas that can be created with AnchorAR. They are not separate released applications:

- Books
- Menu
- Cards
- Ads
- Stories

Recommended public label:

> What you can create with AnchorAR

Acceptable supporting labels:

- AnchorAR possibility
- Built with AnchorAR
- Experience idea

Do not label these concepts as separate available products, standalone apps, or launched product lines.

### Coming next

These are future Arvenilo capability families and must be visibly marked `COMING SOON`:

- Arvenilo Agents
- Arvenilo Spatial
- Arvenilo Network

Do not publish release dates, detailed feature promises, pricing, or availability claims until they are approved and supportable.

## 4. Audience and Conversion Strategy

### Primary audience

The homepage is B2C-first and gives equal emphasis to:

1. creators who want to build an experience;
2. people who want to open, discover, or explore an experience.

### Secondary audience

The wider site also supports:

- creative studios and agencies;
- potential partners;
- businesses interested in focused pilots;
- developers evaluating spatial capabilities;
- people following future Arvenilo products.

### Primary homepage actions

Both actions receive equal visual weight:

- **Create an experience**
- **Explore experiences**

The persistent site-level action is:

- **Open AnchorAR**

The enterprise action appears on Contact and relevant secondary sections:

- **Discuss a pilot**

## 5. Recommended Design Direction

### 5.1 Experience concept: Spatial Aperture Portal

The Arvenilo aperture is the website's central spatial device. It represents the point where a familiar physical object becomes an interactive digital experience.

The site should feel like entering a precise intelligent environment:

- deep spatial surfaces;
- clear editorial information;
- controlled 3D depth;
- calibrated grids;
- converging paths;
- one active signal point;
- intentional transitions between physical, immersive, and intelligent states.

### 5.2 Visual theme: Precision Spatial

The theme is dark-first at key moments, but not permanently dark.

- Dark sections create authority, depth, and 3D focus.
- Light sections make information readable and human.
- Mint identifies action and active intelligence.
- Gold identifies one selected spatial point.
- Violet identifies future agentic and network concepts.

The overall experience must feel:

- advanced, not alien;
- cinematic, not theatrical;
- technical, not academic;
- premium, not decorative;
- calm, not passive;
- futuristic, not cyberpunk.

### 5.3 Controlled alternatives

The approved recommendation remains Precision Spatial. These alternatives may be used only in specific contexts:

- **Editorial light mode:** Reality Mist-dominant layouts for About, legal, accessibility, and long-form pages.
- **Product demonstration mode:** Spatial Ink-dominant layouts for AnchorAR demos and 3D interactions.
- **Future capability mode:** restrained violet wireframes for Coming Next sections.

These are modes within one system, not separate website themes.

## 6. Core Colour System

### 6.1 Brand colours

| Token | Hex | Role |
|---|---:|---|
| Spatial Ink | `#081D21` | Parent-brand authority, primary dark surface, dark text |
| Signal Mint | `#5EEAD4` | Primary action, active intelligence, successful active state |
| Reality Mist | `#F4FBFA` | Primary light canvas, editorial space, calm product surface |
| Digital Violet | `#7456F1` | Agentic systems, networks, future capabilities |
| Anchor Gold | `#F4B942` | Spatial focus, selected location, one premium detail |
| Context Slate | `#4D6265` | Secondary copy, utility text, diagrams, dividers |

### 6.2 Website extension colours

These colours extend the brand palette without replacing it.

| Token | Hex | Role |
|---|---:|---|
| Spatial Void | `#020A0C` | Deepest 3D and cinematic background |
| Spatial Surface | `#0D2A2E` | Dark cards, navigation, elevated dark surfaces |
| Spatial Surface Raised | `#12363A` | Selected or raised dark components |
| Dark Border | `#1D454A` | Borders and grids on dark backgrounds |
| Light Border | `#C9DADA` | Borders and dividers on light backgrounds |
| Interface White | `#FFFFFF` | High-contrast inverse text |
| Mist Slate | `#A8B9BB` | Secondary text on dark surfaces |
| Mint Wash | `#D8F8F2` | Active light surface and quiet mint emphasis |
| Violet Wash | `#E9E5FF` | Coming-soon light surface |
| Gold Wash | `#FFF1CF` | Selected-location explanation and restrained warning surface |
| Error Dark | `#B83E4B` | Error text and destructive action on light surfaces |
| Error Light | `#FF9099` | Error text and indicators on dark surfaces |

### 6.3 CSS colour tokens

```css
:root {
  --color-spatial-void: #020A0C;
  --color-spatial-ink: #081D21;
  --color-spatial-surface: #0D2A2E;
  --color-spatial-surface-raised: #12363A;

  --color-reality-mist: #F4FBFA;
  --color-interface-white: #FFFFFF;

  --color-signal-mint: #5EEAD4;
  --color-digital-violet: #7456F1;
  --color-anchor-gold: #F4B942;

  --color-context-slate: #4D6265;
  --color-mist-slate: #A8B9BB;

  --color-border-dark: #1D454A;
  --color-border-light: #C9DADA;

  --color-mint-wash: #D8F8F2;
  --color-violet-wash: #E9E5FF;
  --color-gold-wash: #FFF1CF;

  --color-error-dark: #B83E4B;
  --color-error-light: #FF9099;
}
```

### 6.4 Colour ratio

Across the complete website, remain close to the brand-book ratio:

- 50% Reality Mist or white;
- 30% Spatial Ink and related dark surfaces;
- 12% Signal Mint;
- 5% Digital Violet;
- 3% Anchor Gold.

The homepage may open with a large dark hero, but subsequent light sections should restore the overall balance.

### 6.5 Colour rules

- Use Spatial Ink on Reality Mist for long-form text.
- Use white on Spatial Ink for inverse text.
- Use mint for primary actions, active systems, and short labels.
- Use gold only for a spatial focus, selected target, or one premium detail.
- Use violet for future capabilities, intelligent systems, and networks.
- Do not use gold as a normal CTA colour.
- Do not use violet as a routine success colour.
- Do not colour-code status without a text label or icon.
- Do not create rainbow product colours for Books, Menu, Cards, Ads, and Stories.
- Do not recolour the approved logo assets.

### 6.6 Gradients and glow

UI surfaces should remain predominantly solid.

Permitted:

- subtle atmospheric radial lighting behind 3D scenes;
- controlled mint or violet light falloff below 10% visual opacity;
- physically based lighting and reflections inside the 3D canvas;
- one restrained gold emission around the signal point.

Avoid:

- rainbow gradients;
- blue-purple startup gradients;
- neon outer glows around text;
- glowing borders on every card;
- glassmorphism as the dominant visual language;
- gradients inside logo artwork.

## 7. Typography

### 7.1 Recommended family

| Role | Typeface | Weights | Use |
|---|---|---|---|
| Display | Sora | 600, 700 | Hero, page titles, major statements |
| Text | Inter | 400, 500, 600 | Body copy, UI, forms, navigation |
| Utility | IBM Plex Mono | 400, 500 | Status, coordinates, IDs, compact technical data |

### 7.2 Fallback stacks

```css
:root {
  --font-display: "Sora", "Avenir Next", "Segoe UI", sans-serif;
  --font-text: "Inter", "Segoe UI Variable Text", "Segoe UI", sans-serif;
  --font-utility: "IBM Plex Mono", "Cascadia Mono", "SFMono-Regular", monospace;
}
```

### 7.3 Type scale

```css
:root {
  --text-display-xl: clamp(3.5rem, 7vw, 7.5rem);
  --text-display-lg: clamp(2.75rem, 5vw, 5.25rem);
  --text-heading-1: clamp(2.25rem, 4vw, 4rem);
  --text-heading-2: clamp(1.75rem, 3vw, 3rem);
  --text-heading-3: clamp(1.25rem, 2vw, 1.75rem);
  --text-body-lg: clamp(1.0625rem, 1.3vw, 1.25rem);
  --text-body: 1rem;
  --text-small: 0.875rem;
  --text-label: 0.75rem;
}
```

### 7.4 Typography rules

- Hero headlines use Sora semibold or bold.
- Body copy uses Inter regular with a maximum line length of 66 characters.
- Technical labels use IBM Plex Mono and remain short.
- Use sentence case for navigation, buttons, headings, and form labels.
- Uppercase is reserved for compact status and category labels.
- Avoid large blocks of all-caps text.
- Avoid thin font weights on dark backgrounds.
- Do not place long paragraphs in mint, gold, or violet.

## 8. Spatial Graphic Language

The website uses five approved graphic elements.

### Spatial frame

A boundary that can become interactive. Use as:

- corner brackets around media;
- focus frames inside 3D scenes;
- section dividers;
- hover and selection boundaries.

### Signal point

The moment a context or object becomes active.

- Use one gold point as the main focal element.
- Supporting points may use mint.
- Do not scatter decorative dots across every section.

### Converging path

Information moving toward a useful outcome.

- Use in diagrams and page transitions.
- Keep paths precise and sparse.
- Do not turn them into generic circuit-board decoration.

### Calibration grid

Orientation and connection to a real environment.

- Use inside 3D stages, technical diagrams, and selected dark sections.
- Keep opacity low.
- Do not place a grid behind long body copy.

### Layer transition

Movement between physical, immersive, and intelligent states.

- Use overlapping planes, controlled depth, and object transformations.
- Maintain stable spatial orientation while layers move.

## 9. Signature 3D System

### 9.1 The Aperture Engine

The signature 3D element is a dimensional interpretation of the Arvenilo aperture.

It consists of:

- a matte Spatial Ink outer structure;
- an open central aperture;
- a Signal Mint reality plane;
- one Anchor Gold signal point;
- restrained calibration lines;
- one physical object or spatial layer moving through the aperture.

It must remain recognizable as the brand mark without copying the flat logo into a glossy 3D badge.

### 9.2 Material direction

Recommended material qualities:

- outer aperture: matte, low-metalness, controlled roughness;
- mint plane: soft satin or lightly translucent spatial layer;
- gold point: small emissive focal element;
- future wireframes: thin violet lines with restrained opacity;
- background: deep teal-black spatial field;
- reflections: soft and limited;
- shadows: directional and believable, never heavy or smoky.

Avoid:

- chrome;
- liquid metal;
- excessive glass;
- holographic rainbows;
- floating AI spheres;
- generic blockchain cubes;
- dense particles;
- sci-fi tunnel effects;
- permanent lens flares.

### 9.3 Lighting

Use:

- one neutral key light;
- one soft mint fill;
- a restrained edge light;
- the gold signal point as a local accent.

Do not use continuously changing coloured lights.

### 9.4 Hero sequence

The homepage hero sequence should:

1. render the headline and actions immediately;
2. reveal the aperture structure;
3. converge its layers into alignment;
4. activate one gold signal point;
5. introduce one familiar object;
6. reveal its digital layer.

The sequence must not delay access to navigation or CTAs.

### 9.5 Object sequence

The homepage may cycle through:

- an open book;
- a restaurant menu;
- a card;
- an advertisement frame;
- a comic or magazine spread.

Only one object is active at a time. The visitor may choose an object through accessible HTML controls outside the canvas.

### 9.6 Coming-next scenes

- **Agents:** one violet intelligent node and a directional path.
- **Spatial:** layered mint planes and controlled depth.
- **Network:** exactly three connected mint, violet, and gold nodes.

These scenes should look incomplete or formative to reinforce `COMING SOON`.

### 9.7 Page transition

Recommended desktop transition:

- the current page moves slightly toward the aperture;
- a spatial frame closes to the selected route;
- the next page resolves through the opening;
- total duration: 400-650 ms.

The transition must never block navigation longer than 650 ms.

Mobile and reduced-motion alternative:

- short geometric aperture wipe or crossfade;
- duration: 120-220 ms;
- no camera travel.

### 9.8 Interaction limits

- Pointer parallax: maximum 2-3 degrees.
- Object drag: only on product demonstrations where rotation teaches something.
- Scroll: no scroll-jacking.
- Gyroscope: off by default.
- Auto-rotation: stop after interaction and stop when the scene is off-screen.
- Ambient motion: one focal animation at a time.

## 10. Information Architecture

### 10.1 Primary navigation

Desktop:

```text
ARVENILO | AnchorAR | Possibilities | Coming Next | About | Open AnchorAR
```

The Arvenilo logo links to Home.

Mobile:

- compact logo header;
- visible menu control;
- full-screen structured navigation;
- persistent `Open AnchorAR` action inside the menu;
- no important navigation inside a 3D canvas.

### 10.2 Route map

| Route | Purpose | Status |
|---|---|---|
| `/` | B2C homepage for creating and exploring | Active |
| `/anchorar` | Current AnchorAR product page | Available now |
| `/possibilities` | AnchorAR use-case overview | Ideas within AnchorAR |
| `/possibilities/books` | Interactive books and learning | AnchorAR possibility |
| `/possibilities/menu` | Interactive restaurant menus | AnchorAR possibility |
| `/possibilities/cards` | Interactive cards and invitations | AnchorAR possibility |
| `/possibilities/ads` | Interactive advertisements | AnchorAR possibility |
| `/possibilities/stories` | Comics, magazines, and stories | AnchorAR possibility |
| `/coming-next` | Future Arvenilo capability families | Coming soon |
| `/about` | Arvenilo purpose, positioning, and story | Active |
| `/contact` | Support, collaboration, and pilot enquiries | Active |
| `/privacy` | Privacy information | Active |
| `/accessibility` | Accessibility commitment | Active |
| `/terms` | Terms of use | Active |

## 11. Homepage Design

### 11.1 Page objective

Help a visitor understand Arvenilo, see AnchorAR as real proof, and choose either creation or exploration within the first viewport.

### 11.2 Hero content

Recommended:

```text
INTELLIGENT REALITY

Build intelligence into the world around you.

Arvenilo creates accessible experiences that connect physical and
digital reality. AnchorAR is available now for creating and opening
interactive web-based AR experiences.

[Create an experience] [Explore experiences]

Discover AnchorAR
```

Controlled headline alternatives:

- `Where intelligence meets reality.`
- `Make the world around you interactive.`

The approved primary headline remains:

> Build intelligence into the world around you.

### 11.3 Homepage sequence

1. Hero with live AnchorAR proof
2. Equal creator and explorer paths
3. AnchorAR introduction marked `AVAILABLE NOW`
4. Five AnchorAR possibilities
5. Intelligent Reality explanation
6. Coming-next preview
7. Trust, permissions, accessibility, and compatibility
8. Final dual CTA
9. Company footer

### 11.4 Desktop wireframe

```text
+------------------------------------------------------------------+
| ARVENILO   AnchorAR  Possibilities  Coming Next  About   [Open]  |
+------------------------------------------------------------------+
|                                                                  |
| INTELLIGENT REALITY          |  Interactive Aperture Engine      |
| Build intelligence into      |  Familiar object -> AR layer      |
| the world around you.        |                                   |
|                              |                                   |
| [Create] [Explore]           |                                   |
| Discover AnchorAR            |                                   |
+------------------------------------------------------------------+
|             CREATE AN EXPERIENCE | EXPLORE EXPERIENCES            |
+------------------------------------------------------------------+
|                 ANCHORAR - AVAILABLE NOW                          |
|            Product proof, workflow, and demonstration             |
+------------------------------------------------------------------+
| Books | Menu | Cards | Ads | Stories                              |
+------------------------------------------------------------------+
| Intelligent Reality explanation and layer diagram                 |
+------------------------------------------------------------------+
| Agents | Spatial | Network                         COMING SOON     |
+------------------------------------------------------------------+
| Trust and accessibility | Final create/explore actions            |
+------------------------------------------------------------------+
```

### 11.5 Mobile wireframe

```text
+----------------------------------+
| ARVENILO                    Menu |
+----------------------------------+
| INTELLIGENT REALITY              |
| Build intelligence into the      |
| world around you.                |
|                                  |
| [Create an experience]           |
| [Explore experiences]            |
| Discover AnchorAR                |
|                                  |
| Simplified 3D aperture           |
+----------------------------------+
| AnchorAR - AVAILABLE NOW         |
+----------------------------------+
| Creator path                     |
| Explorer path                    |
+----------------------------------+
| What you can create              |
| Books / Menu / Cards / Ads /     |
| Stories                          |
+----------------------------------+
| Coming next                      |
+----------------------------------+
| Trust and final actions          |
+----------------------------------+
```

## 12. AnchorAR Page

### 12.1 Positioning

Label:

> AVAILABLE NOW

Headline:

> Turn physical touchpoints into interactive experiences.

Description:

> AnchorAR by Arvenilo helps creators and audiences build, publish,
> share, and open web-based AR experiences without a conventional
> app-store installation.

### 12.2 Page sequence

1. Product hero and availability
2. Interactive transformation demonstration
3. Create -> Publish -> Open -> Experience workflow
4. Capabilities translated into user value
5. Creator and explorer benefits
6. AnchorAR possibilities
7. Compatibility, permissions, and limitations
8. Product-status statement
9. Final action

### 12.3 Primary actions

Recommended:

- `Open AnchorAR`
- `Explore a demo`

Controlled alternative:

- `Start building` may replace `Open AnchorAR` only when self-service onboarding is reliable and immediately available.

### 12.4 Feature-to-value language

| Capability | User value |
|---|---|
| Web-based viewing | Open experiences with less install friction |
| Image targets | Activate print, packaging, posters, cards, and visual markers |
| Floor placement | Extend saved content into the visitor's environment |
| Visual scene editing | Arrange content through an understandable workflow |
| Shareable links | Give each experience a direct distribution path |
| Reusable creation flow | Move from one demonstration to repeatable creation |

### 12.5 Product-status transparency

The page must explain:

- which browsers and devices are supported;
- when camera access is required;
- why a permission is requested;
- what happens if a device is unsupported;
- known limitations;
- how to exit an immersive experience;
- how personal data and camera access are treated.

## 13. Possibilities System

### 13.1 Landing-page positioning

Headline:

> One platform. Many ways to make reality interactive.

Required clarification:

> Books, Menu, Cards, Ads, and Stories are examples of experiences
> that can be created with AnchorAR. They are not separate released
> applications.

### 13.2 Shared possibility-page pattern

Every possibility page contains:

1. use-case label;
2. familiar physical object;
3. possible AR transformation;
4. useful interactions;
5. intended creators;
6. intended audience experience;
7. example user journey;
8. limitations or dependencies;
9. `Create with AnchorAR` action.

### 13.3 Books

Possible experiences:

- interactive diagrams;
- 3D learning objects;
- narration and pronunciation;
- character animation;
- contextual explanation;
- chapter-linked media.

Primary users:

- educators;
- publishers;
- students;
- authors;
- museums and learning teams.

### 13.4 Menu

Possible experiences:

- dish previews;
- ingredient information;
- allergen context;
- multilingual content;
- preparation stories;
- direct order or reservation actions where integrations exist.

Primary users:

- restaurants;
- cafes;
- hospitality groups;
- diners;
- food creators.

### 13.5 Cards

Possible experiences:

- portfolio introductions;
- event invitations;
- greetings;
- product information;
- collectible content;
- personal or business profiles.

Primary users:

- individuals;
- designers;
- event organisers;
- small businesses;
- creators.

### 13.6 Ads

Possible experiences:

- product demonstrations;
- campaign storytelling;
- interactive calls to action;
- poster and print activation;
- event promotion;
- measurable engagement entry points.

Primary users:

- brands;
- agencies;
- campaign teams;
- publishers;
- event organisers.

### 13.7 Stories

Possible experiences:

- animated panels;
- audio and narration;
- character layers;
- editorial extras;
- 3D scenes;
- alternate or extended story moments.

Primary users:

- comic creators;
- magazines;
- authors;
- publishers;
- artists;
- audiences.

### 13.8 Logo use

The derived AnchorAR possibility logos may appear on their pages, but:

- the AnchorAR parent relationship must remain clear;
- the pages must use the same core colour system;
- the concepts must not receive unrelated standalone brand palettes;
- the status must be written in text;
- the possibility logo must not imply independent app-store availability.

## 14. Coming Next Page

### 14.1 Page objective

Communicate Arvenilo's direction without presenting future concepts as current products.

### 14.2 Required status language

Every capability card must show:

> COMING SOON

Recommended page introduction:

> Arvenilo is exploring future capabilities across agentic intelligence,
> spatial computing, and trusted digital infrastructure. AnchorAR is the
> currently available product.

### 14.3 Capability framing

#### Arvenilo Agents

Direction:

- intelligent assistance;
- goal-based orchestration;
- contextual actions;
- visible user control.

#### Arvenilo Spatial

Direction:

- richer spatial environments;
- extended reality interaction;
- place-aware digital layers;
- continuity between physical and digital context.

#### Arvenilo Network

Direction:

- portable trust;
- connected identity and access;
- interoperability;
- infrastructure that supports experiences across environments.

### 14.4 CTA

Recommended:

- `Follow Arvenilo's progress`

Do not use:

- `Buy now`
- `Start now`
- unapproved waitlist promises;
- countdowns;
- fabricated launch dates.

## 15. About Page

### 15.1 Content

- Arvenilo pronunciation and name story;
- Intelligent Reality company positioning;
- purpose, vision, and mission;
- Explorer-led, Sage-supported personality;
- human agency and trust principles;
- relationship between Arvenilo and AnchorAR;
- current product-status statement;
- the company story from the approved brand book.

### 15.2 Recommended page statement

> Arvenilo builds the intelligent layer between physical and digital
> reality. We combine autonomous intelligence, immersive interaction,
> and trusted digital systems to make advanced experiences useful in
> the world around us.

### 15.3 3D treatment

Use a restrained structural study of the aperture:

- exploded layers;
- one signal point;
- labels showing intelligence, immersion, and trust;
- no continuous hero animation after the explanation completes.

## 16. Contact Page

### 16.1 Entry paths

The visitor first selects one route:

- Creator support or feedback
- Partnership and collaboration
- Business pilot enquiry

### 16.2 Form behaviour

Reveal only the fields needed for the selected route.

Common fields:

- name;
- email;
- selected enquiry type;
- message;
- consent acknowledgment.

Business pilot fields may additionally request:

- organisation;
- use case;
- desired outcome;
- target timeline.

Do not force normal consumers through an enterprise qualification form.

### 16.3 Form status

Every form state must be explicit:

- ready;
- sending;
- sent;
- validation required;
- failed with a recovery action.

## 17. Layout System

### 17.1 Breakpoints

```css
/* Mobile */
@media (max-width: 767px) {}

/* Tablet */
@media (min-width: 768px) and (max-width: 1023px) {}

/* Desktop */
@media (min-width: 1024px) {}

/* Wide desktop */
@media (min-width: 1440px) {}
```

### 17.2 Content widths

- standard reading width: `720px`;
- standard content container: `1200px`;
- wide spatial container: `1440px`;
- maximum page width: `1600px`;
- mobile gutter: `20px`;
- tablet gutter: `32px`;
- desktop gutter: `48px`;
- wide desktop gutter: `64px`.

### 17.3 Grid

- desktop: 12 columns;
- tablet: 8 columns;
- mobile: 4 columns;
- minimum gap: 16px mobile, 24px tablet, 32px desktop.

### 17.4 Spacing scale

```css
:root {
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.5rem;
  --space-6: 2rem;
  --space-7: 3rem;
  --space-8: 4rem;
  --space-9: 6rem;
  --space-10: 8rem;
}
```

### 17.5 Shape system

```css
:root {
  --radius-control: 10px;
  --radius-card: 16px;
  --radius-stage: 24px;
  --radius-status: 999px;
}
```

Use pills only for:

- status;
- filters;
- compact metadata.

Do not make every card, section, and button pill-shaped.

### 17.6 Elevation

- Prefer borders and surface contrast over large shadows.
- Dark 3D stages use a 1px dark border.
- Light cards use a subtle cool shadow only when necessary.
- Do not place floating cards over every section.

## 18. Responsive Behaviour

### 18.1 Desktop

- Full interactive aperture scene.
- Split hero with copy and actions beside the 3D stage.
- Pointer movement may affect the camera by a maximum of 2-3 degrees.
- Possibility cards may form a five-column row on wide screens.
- Product demonstrations may support controlled drag rotation.
- Page transitions may use the aperture effect.

### 18.2 Tablet

- Preserve split layouts when content remains readable.
- Reduce scene complexity and camera movement.
- Possibility cards use two or three columns.
- Navigation may collapse before content becomes crowded.
- Avoid hover-dependent information.

### 18.3 Mobile

- Content and actions appear before decorative 3D.
- Hero actions stack as two equal full-width controls.
- Use a simplified, lower-polygon aperture.
- Show one possibility object at a time.
- Use touch drag only when it teaches the experience.
- Do not enable automatic gyroscope movement.
- Do not hide text or status inside the canvas.
- Use a static poster fallback for unsupported or constrained devices.
- Maintain at least 44x44px touch targets.
- Respect top, bottom, and device safe areas.

### 18.4 Mobile navigation

- Header remains compact.
- Menu opens as an accessible full-screen panel.
- Navigation groups current product, possibilities, future capabilities, and company information.
- `Open AnchorAR` remains visible and clearly separated.
- Escape, close button, and browser Back all close the menu correctly.

### 18.5 Orientation and resize

- Preserve the visitor's reading position when resizing.
- Reframe the 3D camera rather than stretching the canvas.
- Do not force landscape orientation.
- Do not reload a scene only because the viewport changes.

## 19. Component System

### 19.1 Buttons

#### Primary

- Signal Mint background;
- Spatial Ink text;
- one primary action per local decision group;
- strong visible focus state.

#### Secondary

- transparent or light surface;
- visible border;
- high-contrast text;
- used for the equal secondary path or supporting action.

#### Inverse

- Spatial Ink or translucent dark surface;
- white text;
- mint focus ring;
- used over dark media or AR stages.

#### Quiet

- no heavy container;
- underline or directional indicator on hover/focus;
- used for low-priority navigation.

#### Danger

- Error colour only;
- never visually confused with the primary action.

### 19.2 Status chips

Approved labels:

- `AVAILABLE NOW`
- `ANCHORAR POSSIBILITY`
- `COMING SOON`
- `SUPPORTED`
- `LIMITED SUPPORT`
- `UNAVAILABLE`

Status chips require text and may include an icon. Colour alone is insufficient.

### 19.3 Product and possibility cards

Each card includes:

- logo or glyph;
- exact name;
- explicit status;
- one-sentence outcome;
- one action;
- optional static or lightweight 3D preview.

Cards should not contain:

- vague futuristic claims;
- invented metrics;
- unrelated colour themes;
- multiple competing CTAs.

### 19.4 3D stage

Every 3D stage includes:

- accessible title and description outside the canvas;
- loading state;
- static poster;
- optional interaction instructions;
- reset view action when direct manipulation is available;
- fallback content;
- visible exit for immersive experiences.

### 19.5 Content section

Use a consistent structure:

- compact eyebrow;
- clear headline;
- short introduction;
- primary content or visual;
- one local action where appropriate.

### 19.6 Technical data panel

Use IBM Plex Mono for short data such as:

```text
ANCHOR_ID   01A7
STATE       ACTIVE
POSITION    48.137 / 11.575
CONFIDENCE  0.94
```

Technical panels should explain something real. Do not add fake data for atmosphere.

## 20. Motion System

### 20.1 Timing

- hover and press: 120-180 ms;
- UI reveal: 180-300 ms;
- section transition: 300-500 ms;
- brand or 3D moment: 600-1200 ms;
- page transition maximum: 650 ms.

### 20.2 Easing

Recommended:

```css
:root {
  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-exit: cubic-bezier(0.4, 0, 1, 1);
}
```

### 20.3 Motion rules

- Use convergence, focus, and layer transition as the main motion vocabulary.
- Keep the camera stable while objects or layers move.
- Stop ambient movement when content leaves the viewport.
- Do not animate every card independently.
- Do not use perpetual floating motion on text or CTAs.
- Never use motion as the only explanation of a state change.

### 20.4 Reduced motion

When `prefers-reduced-motion: reduce` is active:

- remove camera travel;
- remove scroll-linked transforms;
- replace 3D assembly with a static composed state;
- replace page transitions with a short crossfade;
- retain all information and actions.

## 21. Imagery Direction

### 21.1 Photography

Default direction: human in context.

Use:

- believable physical environments;
- real hands, products, print, books, menus, and places;
- natural light;
- visible physical context;
- technology serving a useful moment.

Avoid:

- generic headset portraits;
- dark neon city imagery;
- people pointing at empty holograms;
- stock photos with fake futuristic overlays;
- devices dominating the human outcome.

### 21.2 Product imagery

Use physical objects as portals:

- book;
- menu;
- card;
- advertisement;
- magazine or comic;
- packaging;
- poster;
- place marker.

Show a clear before-and-after relationship between the object and its interactive layer.

### 21.3 Illustration

Use:

- frames;
- paths;
- layers;
- simplified contextual objects;
- consistent line weights;
- purposeful diagrams.

Avoid decorative complexity that does not explain a relationship.

## 22. Voice and Copy

Arvenilo should sound like a thoughtful guide to a new environment.

### Use

- direct statements;
- plain language;
- active verbs;
- current product truth;
- clear next actions;
- explicit status and limitations.

### Avoid

- revolutionary;
- world-changing;
- seamless;
- limitless;
- the future is here;
- unexplained Web3 terminology;
- long lists of AI, XR, and blockchain buzzwords;
- claims that reserved concepts are available.

### Messaging order

1. Outcome
2. Category
3. Method
4. Proof

Example:

```text
Build intelligence into the world around you.

Arvenilo is an Intelligent Reality company.

We combine Agentic AI, XR, and trusted digital systems.

AnchorAR makes physical touchpoints interactive through the web.
```

## 23. Accessibility Requirements

Target: WCAG 2.2 AA.

Required:

- meaningful heading hierarchy;
- keyboard access to all controls;
- visible focus indicators;
- skip-to-content link;
- 44x44px minimum touch targets;
- colour-independent status;
- reduced-motion support;
- high-contrast text;
- captions and transcripts for video;
- text alternatives for 3D demonstrations;
- no essential text inside WebGL;
- explicit camera and sensor permission explanations;
- visible exits from all immersive modes;
- understandable error and recovery states;
- logical DOM order matching the visible mobile order.

The site must remain complete and navigable when:

- JavaScript fails;
- WebGL is unavailable;
- motion is reduced;
- images are disabled;
- the user navigates only with a keyboard;
- a screen reader is used.

## 24. Performance Requirements

The 3D experience must be progressive enhancement, not a prerequisite for using the website.

### Core Web Vitals targets

- LCP: under 2.5 seconds at the 75th percentile on mobile;
- INP: under 200 ms;
- CLS: under 0.1.

### Asset budgets

- initial non-3D JavaScript: target under 170 KB gzip;
- deferred 3D runtime and scene code: target under 300 KB gzip;
- mobile hero GLB: target under 800 KB compressed;
- desktop hero GLB: target under 1.8 MB compressed;
- mobile texture set: target under 1 MB;
- desktop texture set: target under 2.5 MB;
- static hero poster: target under 180 KB in AVIF or WebP.

### Rendering budgets

- desktop target: 60 FPS on capable hardware;
- mobile target: stable 30 FPS;
- mobile hero geometry: target under 80,000 visible triangles;
- desktop hero geometry: target under 250,000 visible triangles;
- one primary WebGL canvas active at a time;
- pause rendering when the canvas is off-screen or the page is hidden.

### Delivery

- use route-level code splitting;
- lazy-load subpage scenes;
- use GLB with Meshopt or Draco where appropriate;
- use KTX2 or efficiently compressed textures;
- preload the poster, not the entire 3D scene;
- load fonts with subsets and `font-display: swap`;
- avoid autoplay video on mobile;
- offer a low-power mode based on device capability or user choice.

## 25. Progressive Enhancement and Failure States

### 3D loading

1. Render content and poster.
2. Detect support and capability.
3. Load the scene asynchronously.
4. Replace the poster only after the first valid frame.

### WebGL unavailable

Show:

- static brand artwork;
- the same title and explanation;
- all normal links and actions.

Do not show a broken black rectangle or block navigation.

### Scene load failure

Show:

- static poster;
- concise message: `Interactive preview unavailable.`;
- optional retry action;
- no repeated automatic retries.

### Slow connection

- preserve the poster;
- do not delay LCP for 3D;
- avoid loading later scenes until requested.

### Camera or permission failure

- explain what permission was requested;
- explain why it was needed;
- provide a retry;
- provide a non-camera path;
- keep a visible exit.

## 26. Content and Status Data Model

Product status should come from one structured content source so labels remain consistent.

Recommended model:

```ts
type OfferingStatus = "available" | "possibility" | "coming-soon";

type Offering = {
  name: string;
  slug: string;
  status: OfferingStatus;
  parent?: "Arvenilo" | "AnchorAR";
  summary: string;
  primaryAction: string;
  logoAsset: string;
  sceneAsset?: string;
};
```

Required records:

- AnchorAR -> `available`
- Books -> `possibility`
- Menu -> `possibility`
- Cards -> `possibility`
- Ads -> `possibility`
- Stories -> `possibility`
- Arvenilo Agents -> `coming-soon`
- Arvenilo Spatial -> `coming-soon`
- Arvenilo Network -> `coming-soon`

This prevents different pages from accidentally publishing conflicting availability.

## 27. SEO and Social Presentation

### Page metadata

Each page requires:

- unique title;
- unique description;
- canonical URL;
- Open Graph title, description, and image;
- social image using approved logo and palette;
- structured heading hierarchy.

### Structured data

Recommended:

- `Organization` for Arvenilo;
- `SoftwareApplication` for AnchorAR only when the current product details support it;
- `WebSite` and `WebPage` where appropriate.

Do not publish Product or SoftwareApplication schema for:

- Books;
- Menu;
- Cards;
- Ads;
- Stories;
- Agents;
- Spatial;
- Network.

They are not separate available products.

## 28. Analytics

Use privacy-conscious event tracking for:

- Create an experience clicks;
- Explore experiences clicks;
- Open AnchorAR clicks;
- demo starts and completions;
- possibility-page views;
- possibility selector changes;
- coming-next card engagement;
- contact path selection;
- contact submission success;
- 3D fallback frequency;
- WebGL or camera failure categories.

Do not record camera imagery or sensitive sensor data as marketing analytics.

## 29. Recommended Site Architecture

The implementation should separate:

1. content and product-status data;
2. page and component UI;
3. route-specific 3D scenes;
4. analytics;
5. accessibility and fallback behaviour.

Recommended characteristics:

- server-rendered or statically generated public pages;
- route-level scene loading;
- reusable page and product components;
- one source for availability labels;
- Three.js-compatible 3D layer;
- no dependency on WebGL for routing, copy, SEO, or conversion.

The final technology choice may follow the existing development environment, but the design requirements in this document are framework-independent.

## 30. Testing and Acceptance Criteria

### Brand and content

- AnchorAR is clearly marked available now.
- Books, Menu, Cards, Ads, and Stories are clearly described as AnchorAR possibilities.
- Agents, Spatial, and Network are clearly marked coming soon.
- No page contradicts the approved product hierarchy.
- Logo artwork is not recoloured or distorted.
- Gold is used only for spatial focus or restrained premium detail.

### Responsive design

- No horizontal overflow at 320, 390, 768, 1024, 1440, or 1920px.
- Mobile content appears before nonessential 3D.
- Both B2C hero paths remain equally prominent.
- Navigation is fully usable by touch and keyboard.
- Every route remains understandable without hover.

### 3D

- The page remains usable before the 3D scene loads.
- Static fallback appears when WebGL is unavailable.
- Only one primary scene actively renders at a time.
- Mobile uses simplified assets.
- Reduced motion removes camera travel and scroll transformations.
- 3D interaction never traps pointer, touch, or keyboard focus.

### Accessibility

- WCAG 2.2 AA automated checks pass.
- Keyboard navigation passes manual review.
- Screen-reader route and status checks pass.
- Focus remains visible on light and dark backgrounds.
- All immersive experiences provide a visible exit.
- Colour is not the only status indicator.

### Performance

- Core Web Vitals meet the stated targets in production-like testing.
- Initial content does not wait for WebGL.
- 3D assets remain within route budgets.
- Off-screen rendering pauses.
- Mobile performance is tested on a real mid-range Android device.

### Content quality

- Every section leads with a user outcome.
- Technical language follows the benefit rather than preceding it.
- Error states explain what happened and what to do next.
- Coming-soon copy avoids unsupported claims.
- Possibility pages do not imply independent product availability.

## 31. Final Design Summary

Arvenilo's website should be remembered for one controlled spatial idea:

> A familiar part of reality passes through the Arvenilo aperture and becomes interactive.

Everything else supports that idea:

- Spatial Ink creates authority;
- Reality Mist keeps the experience human and readable;
- Signal Mint shows active intelligence;
- Anchor Gold identifies one spatial focus;
- Digital Violet distinguishes future intelligent and network capabilities;
- Sora, Inter, and IBM Plex Mono balance future geometry with practical clarity;
- AnchorAR provides current product proof;
- Books, Menu, Cards, Ads, and Stories show possibility;
- Agents, Spatial, and Network show what may come next;
- responsive and accessible fallbacks ensure the experience works beyond high-end desktop hardware.

The result should feel futuristic because of spatial behaviour, precision, and meaning - not because of decorative neon effects.
