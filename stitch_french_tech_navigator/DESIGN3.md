# Design System Specification: The Strategic Intelligence Map

## 1. Overview & Creative North Star
**Creative North Star: The Modern Archivist**
This design system moves away from the sterile, high-frequency "SaaS Blue" aesthetic and toward the authoritative weight of a 19th-century naval intelligence bureau. It is designed to feel like a living document—a "Strategic Intelligence Map"—where data is not merely reported, but curated.

We break the "template" look by rejecting the rigid, boxy constraints of modern financial tools. Instead, we use **intentional asymmetry**, **tonal layering**, and **high-contrast typography** to create a digital experience that feels bespoke, premium, and institutional. The layout should breathe like a broadsheet newspaper, but function with the precision of a master cartographer’s tools.

---

## 2. Colors & Surface Philosophy
The palette is rooted in history, replacing generic navy with deep, ink-stained depths and warm, vellum-like surfaces.

### The Palette
*   **Primary (Historical Ink Blue - `#01242a`):** A dense, teal-leaning navy. Use this for the most critical navigational elements and authoritative text.
*   **Secondary (Antique Gold - `#775a0f`):** Replaces the "standard blue" for highlights. It signifies value, curation, and intelligence.
*   **Tertiary (Oxblood - `#460602`):** Used sparingly for alerts, critical data points, or "the path less traveled."
*   **Neutral (Paper Tone - `#fcf9f2`):** The foundation. It is warm, tactile, and reduces eye strain compared to pure white.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders to section content. Horizontal rules and container outlines are forbidden. Boundaries must be defined through:
1.  **Background Color Shifts:** Use `surface-container-low` (`#f6f3ec`) against the `background` (`#fcf9f2`) to define regions.
2.  **Negative Space:** Utilize the **Spacing Scale** (specifically `8`, `10`, and `12`) to create clear logical groupings without physical ink.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers.
*   **Base:** `surface` (`#fcf9f2`)
*   **Sectioning:** `surface-container-low` (`#f6f3ec`) for large layout blocks.
*   **Interactive Cards:** `surface-container-lowest` (`#ffffff`) to create a subtle "pop" from the warm background.
*   **Floating Elements:** Use **Glassmorphism**. Apply `surface-tint` at 10% opacity with a `20px` backdrop-blur to create menus that feel like vellum overlays.

---

## 3. Typography: Editorial Authority
We pair the intellectual weight of **Newsreader** (Serif) with the utilitarian clarity of **Public Sans** (Sans-Serif).

*   **Display & Headlines (Newsreader):** Used for storytelling and data titles. The slight "ink-bleed" feel of Newsreader provides an archival authority. Use `display-lg` for hero statements and `headline-md` for section entries.
*   **Body & Titles (Public Sans):** Used for high-density data and functional labels. It provides the "institutional" contrast to the serif’s "literary" feel.
*   **Monospace (Fallback):** Reserved strictly for raw data coordinates or technical metadata to reinforce the "Map" aesthetic.

---

## 4. Elevation & Depth
In this design system, shadows represent atmosphere, not just physics.

*   **The Layering Principle:** Depth is achieved by "stacking" tones. A `surface-container-highest` (`#e5e2db`) element should be used for the most deeply recessed information, while `surface-container-lowest` (`#ffffff`) represents the uppermost layer of the "desk."
*   **Ambient Shadows:** For floating modals, use an extra-diffused shadow: `box-shadow: 0 20px 50px rgba(28, 28, 24, 0.06)`. The tint is derived from the `on-surface` color, ensuring the shadow feels like a natural obstruction of light on paper.
*   **The "Ghost Border":** If a distinction is absolutely required for accessibility, use `outline-variant` (`#c1c8c9`) at **15% opacity**. It should be felt, not seen.

---

## 5. Components

### Buttons & Interaction
*   **Primary:** A solid `primary` (`#01242a`) fill with `on-primary` (`#ffffff`) text. No rounded corners beyond `sm` (`0.125rem`) to maintain a serious, architectural edge.
*   **Secondary:** A `surface-container-highest` fill with `primary` text. This feels integrated into the "paper."
*   **Tertiary:** Text-only in `secondary` (`#775a0f`) with a `title-sm` weight. Use for "Explore" or "View More" actions.

### Cards & Data Lists
*   **The Constraint:** No dividers. Separate list items using `spacing-4` (`0.9rem`) of vertical padding and a background shift to `surface-container-low` on `:hover`.
*   **Typography Lead:** Use `headline-sm` for card titles. High density is encouraged; use `body-sm` for metadata.

### Data Chips
*   Compact and rectangular (`rounded-sm`). Backgrounds should use `primary-container` (`#1a3a40`) for neutral tags and `secondary-container` (`#fdd580`) for featured insights.

### Inputs & Forms
*   Fields are not boxes; they are underlines. Use a bottom-only "Ghost Border" that transitions to a `secondary` (`#775a0f`) 2px line on focus. This mimics the act of filling out a ledger.

---

## 6. Do’s and Don'ts

### Do
*   **Do** embrace the "Wide Margin." Use `spacing-20` for page gutters to give the intelligence map an expensive, airy feel.
*   **Do** use asymmetrical layouts. A 60/40 split is often more sophisticated than a 50/50 split.
*   **Do** use the **Oxblood** (`tertiary`) color for "Risk" or "Negative" data—it feels more institutional than a standard "SaaS Red."

### Don't
*   **Don't** use standard blue (`#0051C3`) anywhere. It breaks the historical immersion.
*   **Don't** use `rounded-full` for anything other than status indicators. High-end design favors the deliberate corner over the "bubbly" pill shape.
*   **Don't** use heavy dropshadows. If the surface hierarchy is correct, the background color shifts will do the work for you.
*   **Don't** use pure black. All "dark" text should use `on-surface` (`#1c1c18`) or `primary` (`#01242a`) to keep the "Ink" feel consistent.