# Design System — Mind in Control / Mente en Control

## 1. Color palette

The six formally-specified colors from the modernization directive, as
implemented in `:root` custom properties in `index.html`:

| Role | Hex | CSS variable | Usage |
|---|---|---|---|
| Primary | `#14243A` | `--primary` (aliased as `--navy` for back-compat) | Headings, nav text, primary button fill |
| Secondary | `#20B7AC` | `--secondary` (aliased as `--teal`, `--accent`) | Brand accent — progress fill, selected states, focus ring |
| Background | `#E9F3F6` | `--bg` | Page background |
| Accent | `#697DE5` | `--indigo` (aliased as `--azure`, `--accent2`) | Second gradient stop, informational pill badges |
| Highlight | `#F1B967` | `--highlight` | **Background tints only** (see note below) |
| Surface | `#FFFFFF` | `--surface` (aliased as `--panel`) | Card/panel backgrounds |

### Important: `--highlight` vs `--warn`
`--highlight` (`#F1B967`) measures **1.77:1 contrast against white** —
it fails WCAG AA (needs 4.5:1) if used as text or a border on a light
background. It is used **only** as a background tint, always via an
explicit low-opacity `rgba()` value, never as the `color` of text.

A separate `--warn: #8A6212` (same gold hue family, 5.47:1 contrast) is
used anywhere a warning/flag needs to be **legible text or a border**
(the inline validation message under "Next", the live-sufficiency-flag
callout's border). This split was a deliberate fix made during this pass
— see `docs/application-audit.md` §4 defect #2 for the full writeup.

### Brand mark preservation
The existing logo/icon SVG assets (`assets/brand/*.svg`) have their own
colors **hardcoded into the SVG markup itself** (`#0F2D4A` navy,
`#14B8A6` teal) — they do not, and structurally cannot, inherit the
page's CSS custom properties (an externally `<img src="...">`-referenced
SVG is opaque to the parent page's styles). These are deliberately
**not** regenerated; they are a close, same-family variant of the new
`--primary`/`--secondary` tokens, consistent with "preserve the existing
logo and brand identity wherever practical."

## 2. Typography

- Headings (`h1`/`h2`/`h3`, `.brand b`): **Montserrat** (600/700).
- Body text: **Inter** (400/500/600).
- Both loaded via Google Fonts (`fonts.googleapis.com` stylesheet,
  `fonts.gstatic.com` font files) — the only external network dependency
  the site has, explicitly allow-listed in the Content-Security-Policy
  (see `docs/application-audit.md` §7).
- Scale: `h1` 36px / `h2` 25px / `h3` 14px (uppercase, letter-spaced,
  used as small section labels) / body 16px / `.lead` 17px.

## 3. Layout

- **Mobile (<900px):** horizontal, scrollable stepper under the header.
- **Desktop (≥900px):** sticky left sidebar containing the stepper,
  content column to the right (`.wrap`, max-width ~800px for readable
  line length).
- **No outer page "card."** Content flows directly against the page
  background; card/border/shadow treatment is reserved for genuinely
  discrete, repeated items: choice buttons, rule cards, the identity
  card, team member cards. This was a deliberate structural fix (not a
  recolor) made in response to feedback that the site read as "one big
  box" — see the session history for before/after reasoning.

## 4. Navigation structure

Three groups in the sidebar/stepper, not one undifferentiated list:
1. **Introduction** — standalone menu link (no connector line to its
   neighbors; it's a reference page, not a workflow step).
2. **Task → Process → Result → Evaluation** — the connected, gated
   workflow stepper (circular icon nodes joined by a progress line;
   locked/current/done visual states).
3. **Meet the Team, Resources** — grouped together as standalone
   reference pages after the stepper (both always open — see `FREE` in
   `index.html` — neither requires completing the gated steps first).

## 5. Components

| Component | Notes |
|---|---|
| `.btn` / `.btn.primary` | Flat solid fill (no gradient/glow), subtle 1-2px shadow, `-1px` lift on hover. Matches the "clean academic platform" reference sites reviewed during this pass (flat buttons, not glowing SaaS-dashboard gradients). |
| `.choice` | Selectable answer card; `aria-checked` + a `.tick` glyph for the selected state; `role="radio"` groups use `role="radiogroup"`. |
| `.callout` / `.callout.warn/.lock/.open` | Inline notice boxes; semantic border color + matching low-opacity background tint. |
| `.idcard` | The Digital Thinking Identity result card — a soft gradient surface, distinct from ordinary content cards. |
| Stepper icon nodes (`.tab .ti`) | 52px circles (enlarged from an earlier 34px pass per explicit feedback that they were too small), brand SVG icon on a light tinted chip background (`.ichip`) since the icons are drawn with a dark stroke meant for light backgrounds. |

## 6. Accessibility

- `:focus-visible` outline on all interactive elements (3px, `--focus`
  color, 2px offset).
- `prefers-reduced-motion: reduce` disables the panel entrance animation
  and all CSS transitions site-wide.
- Skip-to-content link (new this pass — visually hidden until
  keyboard-focused, jumps to `#screen`).
- Programmatic focus management on navigation (new this pass — `go()`
  moves focus to `#screen` after each page change).
- All color pairs used for text were checked for WCAG AA contrast (see
  §1 above for the one defect found and fixed).

## 7. What was deliberately NOT done

- **Dark mode** — the directive allows light-mode-only when dark mode
  "can't be maintained consistently"; given the scope of this pass and
  that the live site was explicitly critiqued for reading as a dark
  glowing dashboard rather than a clean academic site, light mode only
  was kept as the single, consistently-maintained mode.
- **A component library / CSS framework** — the single-file, no-build
  architecture was preserved per the directive ("do not rewrite... unless
  demonstrably required"); the design system above is implemented as
  plain CSS custom properties and utility classes within the existing
  `<style>` block, not a separate framework.
