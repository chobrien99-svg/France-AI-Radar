```markdown
# Design System Document

## 1. Overview & Creative North Star: "The Digital Curator"

This design system is built to evoke the "French Institutional Intelligence" archetype. It rejects the frantic, neon-soaked tropes of modern SaaS in favor of a **"Digital Curator"** aesthetic—one that feels like a prestigious archival document brought into a high-performance digital space.

The system prioritizes **intellectual authority, sovereignty, and endurance.** We move away from "cards" and "widgets" to focus on **Spatial Cartography**: the UI is a landscape of information where depth is defined by tonal shifts and precise, thin-line relationships rather than drop shadows. It is a "Calm Interface" designed for deep work, where the density of data is high but the visual noise is non-existent.

---

## 2. Colors & Surface Logic

The palette is rooted in a heritage-inspired spectrum—creams, linens, and deep architectural blues—supplemented by muted domain-specific tones.

### Surface Hierarchy & The "No-Line" Rule
To maintain a premium editorial feel, **1px solid borders for sectioning are strictly prohibited.** We define boundaries through tonal transitions.
- **Base Canvas:** `surface` (#FEF9EE) serves as the primary "paper" background.
- **Structural Paneling:** Use `surface-container` (#F2EDE2) for sidebars or persistent navigation.
- **Information Layers:** Use `surface-container-low` (#F8F3E8) to create subtle inset areas and `surface-container-lowest` (#FFFFFF) for active data workspaces or "focal" documents.
- **Nesting:** Always shift by one tier (e.g., a white `surface-container-lowest` workspace should sit on a `surface-container-low` background) to create a sense of stacked vellum.

### Glass & Tone
- **The Glassmorphism Rule:** For floating menus or contextual overlays, use `surface` at 80% opacity with a `20px` backdrop-blur. This ensures the "institutional" background colors bleed through, preventing the UI from feeling "pasted on."
- **Signature Textures:** For high-level actions, use a subtle linear gradient from `primary` (#114563) to `primary_container` (#2F5D7C) at 135°. Avoid vibrant gradients; keep them architectural and deep.

---

## 3. Typography: Intellectual Authority

The typographic system utilizes a "High-Contrast Pairing" to balance heritage with technical precision.

- **Headlines (Spectral / Newsreader):** Used for titles, section headers, and data storytelling. The serif typeface provides the "Institutional" voice—serious, historical, and credible.
  - *Display-LG (3.5rem):* Reserved for major landing moments.
  - *Headline-SM (1.5rem):* The standard for report titles.
- **Body & UI (Source Sans 3 / Public Sans):** Used for data, labels, and functional interface elements. 
  - *Body-MD (0.875rem):* The primary reading size.
  - *Label-SM (0.6875rem):* Used for high-density metadata. Use `on_surface_variant` (#41474D) for these to reduce visual weight.

---

## 4. Elevation & Depth: Tonal Layering

Traditional drop shadows represent "weight"; this system uses **Tonal Layering** to represent "focus."

- **The Layering Principle:** Depth is achieved by stacking. A `surface-container-lowest` (white) workspace on a `surface-dim` (#DEDACF) background creates a natural lift without a single pixel of shadow.
- **Ambient Shadows:** Only use shadows for "Temporary Overlays" (Popovers, Tooltips). Use a `32px` blur with `4%` opacity of `on_surface`. The shadow should feel like a soft atmospheric occlusion, not a physical lift.
- **The Ghost Border:** If high-density data requires containment (e.g., a complex data table), use a **Ghost Border**: `outline_variant` (#C1C7CE) at `15%` opacity. 
- **The "Thin Line" Rule:** For connecting entities (Graph Links), use `Graph Links` (#C9C1B3) at `0.5px` or `1px` thickness. These lines represent relationships, not containers.

---

## 5. Components & Data Objects

### Buttons: The Formal Signature
- **Primary:** Solid `primary` (#114563) with `on_primary` (White) text. 0px corner radius.
- **Secondary:** `surface-container-highest` background with `primary` text. No border.
- **Tertiary/Ghost:** `on_surface` text with no background. Underline on hover (1px offset).

### Input Fields: Minimalist Precision
Forget the "box." Use a bottom-only border (Ghost Border style) for inputs. Labels are always `label-sm` and persistent above the field. Error states use `error` (#BA1A1A) text only, no red boxes.

### Chips & Domain Markers
Instead of "pills," use small, square-edged indicators.
- **Funding:** `secondary` (#3C6840)
- **Government:** `tertiary` (#503863)
- **Research:** `Research/Academia Domain` (#7C8C9E)
Use a subtle `10%` opacity background of the color with a solid `2px` vertical accent line on the left.

### Lists & Data Density
- **Forbid Dividers:** Use `spacing-4` (0.9rem) of vertical white space to separate items.
- **Progressive Disclosure:** Data rows should show only "Core Identity" (Name, Type). Hovering reveals "Secondary Intelligence" (Tags, Links, Metadata) via a soft fade-in (200ms ease-out).

---

## 6. Do’s and Don’ts

### Do:
- **Use "Asymmetric Breathing":** Allow larger margins on the left (e.g., `spacing-16`) and tighter margins on the right to mimic a high-end editorial magazine layout.
- **Embrace the 0px Radius:** Everything is sharp-edged. The "softness" comes from the colors (creams/linens), not the corners.
- **Focus on Micro-interactions:** Transitions should be "Calm"—use `300ms cubic-bezier(0.4, 0, 0.2, 1)` for all surface transitions.

### Don't:
- **No KPI Tiles:** Do not wrap single numbers in boxes. Present them as "Display" typography directly on the surface.
- **No Vibrant Badges:** Avoid bright red/green/yellow status indicators. Use the muted Domain Palette to categorize information.
- **No Icons as Decorations:** Icons must be functional and sparse. Use the `outline` (#72787E) token for icon strokes.
- **No Aggressive Animations:** No "sliding" or "bouncing" panels. Surfaces should fade or expand with precise, linear-esque ease.```