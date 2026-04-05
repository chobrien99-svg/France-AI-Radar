```markdown
# Design System Documentation

## 1. Overview & Creative North Star

### Creative North Star: The Modern Archivist
This design system moves away from the generic, rounded aesthetic of modern SaaS and returns to the precision of French cartography and the gravity of institutional intelligence. The objective is to treat data not as a commodity, but as a territory to be explored. 

We break the "template" look by leaning into **Structural Brutalism**—using sharp 0px corners, high-density information layouts, and intentional asymmetry. The experience should feel like a high-end digital desk: layers of parchment (surfaces) overlaid with precise, technical instruments. We avoid "bubbly" interactions in favor of "zooming" through data layers, where hierarchy is defined by tonal depth rather than heavy borders.

---

## 2. Colors & Surface Architecture

The palette is rooted in the "Cartographic Blue" of the French Navy and the "Warm Paper" of historical archives.

### The Palette
- **Primary (`#1A3A5C`):** Our "Institutional Ink." Used for high-authority elements and primary actions.
- **Surface (`#FCF9F2`):** The "Parchment Base." This warm neutral eliminates the sterile blue light of standard displays.
- **Tertiary (`#470E02`):** The "Wax Seal." A muted terracotta used sparingly for critical highlights, alerts, and historical markers.

### The "No-Line" Rule
Standard 1px solid borders are strictly prohibited for sectioning. Boundaries must be defined through:
1.  **Background Color Shifts:** Use `surface-container-low` for secondary sidebars against a `surface` background.
2.  **Tonal Transitions:** Use `surface-container-highest` to define a header area without drawing a line under it.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Each inner container should use a slightly higher or lower tier to define its importance:
- **Lowest Tier:** `surface-container-lowest` (#FFFFFF) for the most prominent content cards.
- **Base Tier:** `surface` (#FCF9F2) for the main application background.
- **Highest Tier:** `surface-container-highest` (#E5E2DB) for utility bars and global navigation.

### The "Glass & Gradient" Rule
To add visual "soul," use subtle linear gradients (e.g., `primary` to `primary-container`) for primary CTAs. For floating panels or "zoom" overlays, use **Glassmorphism**:
- **Token:** Semi-transparent `surface-container-low` (80% opacity).
- **Effect:** 12px-20px Backdrop Blur. This ensures the "map" remains visible beneath the active intelligence layer.

---

## 3. Typography: Authority vs. Precision

The typography system relies on a high-contrast pairing: a sophisticated serif for heritage and a technical sans-serif for data density.

### Serif: Newsreader (Display & Headlines)
Used for `display-lg` through `headline-sm`. This conveys the institutional authority of a French journal.
- **Role:** Editorial storytelling, section titles, and high-level insights.
- **Style:** Tight letter-spacing (-0.02em) for large displays to maintain a premium, custom feel.

### Sans-Serif: Inter (Data & UI)
Used for `title`, `body`, and `label` roles.
- **Role:** Dense data grids, technical navigation, and instructional text.
- **Style:** Highly legible, neutral, and precise. In data-heavy views, use `label-sm` for metadata to maximize information density without sacrificing clarity.

---

## 4. Elevation & Depth

We convey hierarchy through **Tonal Layering** rather than traditional structural lines or heavy shadows.

### The Layering Principle
Depth is achieved by "stacking" surface tiers. A `surface-container-lowest` card sitting on a `surface-container-low` section creates a soft, natural lift.

### Ambient Shadows
When a floating effect is required (e.g., a "Navigation Compass" or "Layer Selector"):
- **Blur:** 32px to 64px.
- **Opacity:** 4%–8%.
- **Tint:** The shadow color must be a tinted version of `on-surface` (warm grey), never pure black. This mimics natural light falling on paper.

### The "Ghost Border" Fallback
If a border is required for accessibility, it must be a **Ghost Border**:
- **Token:** `outline-variant` (#C3C6CF).
- **Opacity:** 15% opacity max. It should be felt rather than seen.

---

## 5. Components

All components must adhere to the **0px Roundedness Scale**. Sharp edges are non-negotiable to maintain a professional, technical aesthetic.

### Buttons
- **Primary:** `primary` background with `on-primary` text. Use a subtle gradient (top-to-bottom) of 5% lighter blue to add "heft."
- **Secondary:** `surface-container-highest` background with `on-surface` text. No border.
- **Tertiary:** Text-only, using `primary` for the label. Use an underline only on hover to maintain an editorial look.

### Input Fields & Search
- **Style:** Underline-only or subtle background shift (`surface-container-low`). Avoid the "box" look. 
- **Focus State:** Transition the underline to `primary` with a 2px weight.

### Cards & Lists
- **Rule:** Forbid divider lines.
- **Separation:** Use the Spacing Scale (e.g., `spacing-4`) to create breathing room, or alternate background colors (`surface` to `surface-container-low`) for list items.

### Special Component: The Connection Line
In navigation and data visualization, use **Hairline Connections**:
- **Token:** `outline` (#73777F) at 0.5px width.
- **Purpose:** To visually link related data nodes, mimicking the thin latitude lines of a map.

---

## 6. Do's and Don'ts

### Do
- **Embrace Density:** Innovation intelligence requires high data visibility. Use the `body-sm` and `label` tokens to pack information intelligently.
- **Use Asymmetry:** Place headlines off-center or use varying column widths to create a bespoke, editorial layout.
- **Stick to 0px:** Every element—from buttons to cards to tooltips—must have square corners.

### Don't
- **No Bubbly UI:** Never use rounded corners or "pill" buttons. It degrades the institutional seriousness of the platform.
- **No Pure White:** Avoid `#FFFFFF` for the main background. Use the `surface` token to keep the "Warm Paper" feel.
- **No Heavy Borders:** If you find yourself reaching for a border, try a 2-unit spacing increase or a background color shift first.

### Accessibility Note
While we use muted tones and thin lines, ensure that all interactive text meets a 4.5:1 contrast ratio. Use the `on-primary` and `on-surface` tokens strictly to guarantee readability against their respective backgrounds.```