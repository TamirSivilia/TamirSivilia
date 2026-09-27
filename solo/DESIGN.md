# SOLO — Design system notes

Source of truth for tokens is `public/style.css` (`:root`). This file explains the
choices so future edits stay consistent.

## Palette

| Token | Value | Use |
|---|---|---|
| `--color-bg` | `#faf7f4` | Page background — warm off-white, never pure white |
| `--color-surface` | `#ffffff` | Cards |
| `--color-surface-alt` | `#f2ece6` | Alternating section background |
| `--color-ink` | `#1e1a22` | Body text — warm near-black, never `#000` |
| `--color-muted` | `#5e5866` | Secondary text (≥4.5:1 on `--color-bg`) |
| `--color-plum` | `#9b6fbf` | **Decorative only** — ~3.9:1 on white, fails body text. Large display accents, the step numerals, the hero's decorative circle. |
| `--color-plum-strong` | `#7a4fa0` | **Accessible** (~6:1 on white) — buttons, links, small text, focus rings |
| `--color-pink` | `#d48ec4` | **Decorative only** — the problem-list rule, nothing else. One accent per screen. |

Rule of thumb from the brief: ~85% neutral, ~12% plum, ~3% pink. The page is a
warm paper background with quiet purple accents, not a purple site.

## Type

- Body: Heebo. Display (`h1`–`h3`, wordmark, step numerals): Rubik.
- Loaded via Google Fonts `<link>` for now — **known follow-up**: self-host and
  subset for the Hebrew glyph range once real content is final, per the brief's
  performance requirement.
- Fluid sizes via `clamp()`. Hero headline keeps its manual line break
  (`white-space: pre-line` + `\n` in the content value) rather than letting the
  browser wrap the core line arbitrarily.

## Layout

- `<html lang="he" dir="rtl">` everywhere; CSS uses logical properties
  (`margin-inline-*`, `padding-inline-*`, `border-inline-start`, `inset-inline-*`)
  exclusively — no `left`/`right`.
- Phone numbers are wrapped in `<bdi dir="ltr">` so they read correctly inside
  RTL text.
- Each section is a distinct composition, not a repeated card grid: an
  asymmetric hero, a rule-marked list for the problem statement, a two-column
  contrast for "for / not for", a list + real mockups (a tracking-table
  preview, muscle-group chips) for what's included, a numbered 3-step list,
  and an accordion FAQ.

## Motion

- `.reveal` elements fade/translate in once via `IntersectionObserver`
  (150–300ms, `cubic-bezier(0.16, 1, 0.3, 1)`).
- `prefers-reduced-motion: reduce` short-circuits this — all reveals are
  immediately visible and CSS `scroll-behavior` falls back to `auto`.

## Anti-AI-look checklist (from the brief, §6) applied here

- No icon-grid cards, no glassmorphism/glow/gradients, no emoji/sparkle
  bullets, no English slogans, no stock photography — the hero and about photo
  are Rotem's real provided photo, not a placeholder.
- The honest "not for you" list is a real, styled section, not fine print.
- Section rhythm varies; no two sections share the same layout shape.
