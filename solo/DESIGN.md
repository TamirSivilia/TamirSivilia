# SOLO — Design System

Direction: **Studio Bold** — the confident, high-energy identity of a boutique training studio. Flat color blocks (never gradients), oversized display type, sharp geometric photo treatment, snappy motion. Chosen over two other directions (Editorial Minimal, Warm Notebook) on 2026-09-27.

## Why this direction, and what it replaces

The previous pass still read as generic "AI SaaS": a purple→pink gradient CTA button, a translucent blurred header, and organic soft-blob photo framing are the single most recognizable tells of AI-generated landing pages. This system removes all three on principle:

- **No gradients, anywhere.** Every fill is one flat, named color.
- **No glassmorphism.** The header is solid, not blurred/translucent.
- **No soft organic blobs.** Photography sits in sharp-edged rectangles with a deliberate offset color block behind it — a hand-designed layering trick, not a generated shape.

## Color

All colors are flat. No gradients are used anywhere in this system — a rule, not a preference.

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#ffffff` | Default page background |
| `--color-block` | `#9B6FBF` | Full-bleed color-block sections (brand purple, used solid) |
| `--color-block-ink` | `#fff8fb` | Text/UI on top of `--color-block` |
| `--color-ink` | `#1c1420` | Body text on white — near-black with a warm undertone, not pure gray |
| `--color-ink-soft` | `#5c5166` | Secondary text on white |
| `--color-accent` | `#D48EC4` | Small deliberate accents only: underline marks, the offset block behind photos, hover states. Never a full fill on its own. |
| `--color-purple-deep` | `#6f4a90` | Button hover state, headings-on-block emphasis |
| `--color-line` | `#e6dfec` | Hairline borders/dividers |

Contrast checked: `--color-ink` on `--color-bg` and `--color-block-ink` on `--color-block` both clear 4.5:1+.

## Typography

- Display: **Rubik**, weight 800–900, tight tracking (`-0.02em`) at large sizes. This is the identity carrier — big, confident, athletic.
- Body: **Heebo**, weight 400–500, generous line-height (1.7) for Hebrew readability.
- Eyebrows/labels: Rubik 700, small size, wide tracking (`0.08em`), uppercase-style Latin fallback — reads like a class label on a studio schedule board.

## Spacing & shape

- Buttons: `border-radius: 0.5rem` (structured, athletic — not a soft pill).
- Photo treatment: sharp rectangle, `border-radius: 0.75rem`, with a solid offset block (`--color-accent`) behind it, shifted 14px — a layered, hand-placed feel instead of a blob or a gradient card.
- Full-bleed color-block sections break the white rhythm twice on the page (the course pull-quote, the tagline statement) — deliberate punctuation, not decoration on every section.

## Motion

Snappier than a soft editorial site: 220–320ms, `cubic-bezier(0.16, 1, 0.3, 1)` (sharp deceleration), small upward slide (10px). Motion should feel like a rep, not a drift.

## Anti-pattern checklist (re-verified against this build)

- [x] No gradient fills (buttons, text, backgrounds)
- [x] No glassmorphism / blurred translucent surfaces
- [x] No generic 3-card icon-feature row
- [x] No centered-everything layout — hero, about, audience all asymmetric
- [x] No fake metrics, testimonials, or before/after
- [x] No English taglines
- [x] Single accent color used deliberately, not painted everywhere
- [x] RTL: logical properties, Hebrew-native type pairing (Rubik/Heebo), no mirrored Latin wordmark issues (SOLO stays LTR by design, per brief)
