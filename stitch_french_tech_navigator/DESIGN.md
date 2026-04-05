# Design System Strategy: The Editorial Diplomat

## 1. Overview & Creative North Star
**The Creative North Star: "The Modern Archivist"**
This design system rejects the "template-ready" aesthetic of modern SaaS in favor of the authoritative, tactile feel of prestigious print journalism. It is inspired by the legendary layout of *Le Monde* and the quiet power of diplomatic correspondence. 

The system moves beyond a standard digital grid by prioritizing **intentional asymmetry** and **tonal depth**. Rather than using lines to divide information, we use the "printed page" philosophy: hierarchy is established through extreme typographic contrast, expansive white space, and a sophisticated layering of bone, charcoal, and ochre. The result is a digital experience that feels curated, permanent, and deeply prestigious.

## 2. Colors & Surface Architecture
The palette is rooted in a high-contrast relationship between deep charcoals and warm, organic whites, punctuated by a regal bronze.

### The "No-Line" Rule
**Explicit Instruction:** Designers are prohibited from using 1px solid borders for sectioning. Structural boundaries must be defined solely through background color shifts. Use `surface-container-low` (#f4f4f0) sections sitting on a `surface` (#faf9f5) background to indicate transition.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers—like stacked sheets of fine vellum.
*   **Base:** `surface` (#faf9f5) for the primary page background.
*   **Containers:** Use `surface-container-low` through `surface-container-highest` to create "nested" depth. 
*   **Signature Textures:** For hero sections or high-impact CTAs, use a subtle linear gradient from `primary` (#181512) to `primary-container` (#2d2926) at a 15-degree angle. This provides a "carbon" finish that flat hex codes cannot replicate.

### The "Glass & Gradient" Rule
Floating elements (such as navigation bars or utility drawers) should utilize **Glassmorphism**. Use `surface` colors at 85% opacity with a `20px` backdrop-blur. This allows the prestigious typography of the layer below to bleed through, softening the layout's rigid edges.

## 3. Typography
Typography is the primary architect of this system. We pair the intellectual weight of a high-contrast serif with the functional clarity of a modern geometric sans.

*   **Display & Headlines (Newsreader):** Use these for the "voice" of the system. `display-lg` (3.5rem) should be used with tight letter-spacing (-0.02em) to mimic premium editorial mastheads.
*   **Body & Titles (DM Sans/Public Sans):** DM Sans provides a neutral, highly readable counterpoint. It should be used for all functional data, navigation, and long-form reading.
*   **The Contrast Rule:** Never pair a serif headline with a serif subline. Use `headline-lg` (Newsreader) followed immediately by `label-md` (Public Sans) in all-caps with 0.1rem tracking to create a "Diplomatic Header" style.

## 4. Elevation & Depth
In this design system, shadows are an admission of failure in tonal layering. Use them sparingly.

*   **The Layering Principle:** Achieve lift by placing a `surface-container-lowest` (#ffffff) card on a `surface-container-low` (#f4f4f0) section. This "paper-on-paper" look is more prestigious than a drop shadow.
*   **Ambient Shadows:** If an element must float (e.g., a modal), use an ultra-diffused shadow: `box-shadow: 0 20px 50px rgba(45, 41, 38, 0.05)`. The shadow color must be a tint of `primary`, never pure black.
*   **The "Ghost Border" Fallback:** For accessibility in form fields, use a "Ghost Border": the `outline-variant` token at 15% opacity. High-contrast, 100% opaque borders are strictly forbidden.

## 5. Components

### Buttons
*   **Primary:** `primary` background with `on-primary` text. Square corners (`0px` radius).
*   **Secondary:** `secondary` (Deep Ochre) background. Reserved for high-priority global actions (e.g., "Submit Credentials").
*   **Tertiary:** No background or border. Text-only using `primary` with a `2px` underline in `secondary_fixed_dim` (#edbf74).

### Input Fields
*   **Style:** Minimalist. No enclosing box. Only a bottom stroke using `outline-variant` (#cfc4bd). 
*   **Focus State:** The bottom stroke transitions to `secondary` (#7a5817) and the label (Newsreader) shifts upward.

### Cards & Editorial Modules
*   **Rule:** Forbid the use of divider lines. 
*   **Spacing:** Use the `12` (4rem) or `16` (5.5rem) spacing tokens to separate content blocks. 
*   **Composition:** Place an `icy blue wash` (`tertiary_container`) block behind images to create a "mounting" effect, making photography feel like a framed exhibit.

### Chips & Tags
*   **Style:** Rectangular, `0px` radius. Use `primary_fixed` (#e9e1dc) backgrounds with `on-primary_fixed` text for a subtle, archival look.

## 6. Do's and Don'ts

### Do:
*   **Do** embrace extreme white space. A single line of Newsreader text in the center of a `surface` screen is a valid layout choice.
*   **Do** use `secondary` (Ochre) for accents only. It is the "wax seal" on the document; use it once per view to draw the eye to the most critical action.
*   **Do** use asymmetrical layouts. Align a headline to the left and the body text to a narrow right-side column to mimic a broadsheet newspaper.

### Don't:
*   **Don't** use rounded corners. Every element must have a hard, 90-degree edge. Rounded corners break the "official document" metaphor.
*   **Don't** use standard "Success" green or "Warning" yellow if possible. Lean on typographic weight and `error` (#ba1a1a) for critical states.
*   **Don't** use icons as primary navigation. The system relies on the beauty of DM Sans; use text labels wherever possible to maintain the high-end editorial feel.

## 7. Spacing Scale
The spacing is generous to ensure the "Diplomatic" feel of exclusivity and calm.
*   **Large-scale separation:** Use `20` (7rem) or `24` (8.5rem) for section breaks.
*   **Component internal padding:** Standardize on `4` (1.4rem) for a breathable, "un-crowded" feel.