# SOLO — רותם כהנים

A Hebrew, RTL, light-themed site for Rotem Cohanim's digital coaching course:
a landing page, an admin panel she can run from her phone, and a learner area
with lessons, an exercise library, and a training log.

**Important context for whoever picks this up next:** this was built *fresh*,
not migrated from the earlier `it-fits-academy` Node/SQLite project described
in the original brief. That project's source (`It-FITS-source.zip`) was never
actually available in the session that built this — only two images came
through (the hero photo now used at `public/assets/rotem-hero.jpg`, and a
plain color swatch). Per an explicit decision at the time, this is a new
build against the same spec rather than a port, so **no prior learners,
videos, or admin data were carried over** — there was nothing to carry over
from. If the original app's database still exists somewhere, it has not been
touched by this work and would need a separate migration.

## Stack

Zero external dependencies on purpose, matching the brief's "vanilla
Node + SQLite" direction: Node's built-in `http` and `node:sqlite` (stable
enough for this use, currently flagged experimental by Node — pin a Node
version ≥22 in production and watch for that flag graduating), no build step,
no framework. `public/` is served as-is.

```
solo/
  server.mjs        — HTTP server, routing, sessions, all API endpoints
  db.mjs             — schema, seed data, password hashing helpers
  util.mjs           — phone normalization, YouTube URL validation, CSV, cookies
  tests.mjs          — node --test integration + unit tests (run: npm test)
  public/
    index.html/app.js/style.css   — the landing page
    admin/                         — admin panel (/admin)
    learn/                         — learner area (/learn)
    accessibility.html, privacy.html
  DESIGN.md          — design tokens and rationale
```

## Running it

```
cd solo
cp .env.example .env   # set ADMIN_PASSWORD, or read the generated one from the console on first run
npm start               # production
npm run dev             # development — enables the OTP dev-code echo, see below
npm test                 # 19 integration/unit tests
```

Local URL: `http://127.0.0.1:4317`. `/admin` for Rotem, `/learn` for
learners, `/` is the public landing page.

## What works and is verified (tests pass, `npm test`)

- Admin login (single account, password from `ADMIN_PASSWORD`, generated and
  printed once if unset), session-cookie auth, logout.
- Learners: add (name + phone), duplicate phone numbers rejected with a plain
  Hebrew error, pause/resume, delete. **Pausing immediately destroys the
  learner's active session** — verified by test, not just documented.
- Videos/lessons: add as lesson or exercise, muscle group, order, YouTube URL
  validated (rejects non-YouTube links, allows a blank URL for a lesson
  that's written but not filmed yet), draft/publish toggle, remove from site
  (does not touch YouTube itself).
- **Drafts are never sent to learners** — verified: an unpublished lesson is
  absent from `/api/learner/lessons` until published.
- Landing copy (headline, sub, problem lines, for/not-for lists, course
  contents, how-it-works steps, about text, coaching intro, FAQ, WhatsApp
  numbers/messages, Instagram link) is editable from `/admin` → "תוכן האתר",
  each field with its own draft flag. **A field marked draft is withheld —
  not just hidden by CSS — from the public `/api/content` endpoint**, so
  unapproved copy can't leak by inspecting network traffic either.
- Learner area: phone + one-time-code login, lesson list with a
  mark-complete toggle that persists, exercise library filterable by muscle
  group, a training log (add/delete/list) with a Hebrew-labeled CSV export.
- RTL throughout (`dir="rtl"`, logical CSS properties only), no horizontal
  scroll at 390px or 1440px (checked with a real headless-Chromium
  screenshot), reduced-motion respected, accessibility statement and privacy
  pages exist (see caveats below).

## Demonstrated locally, not yet real

- **Learner login codes are not actually sent by SMS.** No Twilio (or other)
  account is configured — that was explicitly out of scope without approved
  cost. Right now, a requested code is written to the server console
  (`[SOLO] OTP for 0501234567 (שם): 123456`) so Rotem/Tamir can read it and
  relay it manually over WhatsApp; in development mode only
  (`NODE_ENV=development` / `npm run dev`) the API response also echoes the
  code directly so the flow can be tested end-to-end without console access.
  **Production (`NODE_ENV=production`, i.e. `npm start`) never echoes the
  code over the API** — this is covered by an integration test that spawns a
  real production-mode server and checks the field is absent.
- The 8 lesson topics in the database are **assistant drafts** (unpublished,
  no video attached) — not an approved syllabus, and they will not appear on
  the public site until published from `/admin`.
- `about_text`, `coaching_intro`, and `faq_items` are seeded as drafts (the
  about/coaching sections stay `hidden` on the landing page, and the FAQ
  section doesn't render, until Rotem approves real copy and someone clears
  the draft flag in `/admin` → "תוכן האתר"). The seven sales objections for
  the FAQ were never supplied — the FAQ section will simply stay hidden
  until they are.
- Accessibility and privacy pages are written honestly and follow the
  requirements listed in the brief, but are marked with an on-page draft
  banner because **no manual accessibility audit or legal review has been
  done** — don't represent them as certified compliance.

## Still missing / explicitly out of scope here

- **Real SMS delivery** (Twilio or otherwise) — needs an account and cost
  approval before wiring it in; the code path is otherwise ready for it (see
  `.env.example`).
- **Hosting/deployment.** This has only run locally. It needs a host with a
  persistent volume (SQLite + backups), not static hosting — nothing has
  been provisioned.
- **Self-hosted/subset fonts.** Heebo/Rubik currently load from Google Fonts
  at runtime; the brief asks for self-hosted, subset fonts for performance.
  Follow-up item, not done here.
- **OG image.** No custom Open Graph image; only the SVG favicon exists.
- Prices, testimonials, certifications, a validated coaching-program
  description — none of these were supplied, and none are shown, per the
  brief's honesty rule.

## A note on the OTP design

Codes are hashed (`scrypt`) before being stored — nothing plaintext sits in
the database — which is why there's no "view pending codes" screen in
`/admin`: that would mean storing the code in a way an attacker (or a
leaked screenshot) could read. The console log is the intended manual
channel until a real SMS provider is wired up; it's read by whoever has
server/log access, not exposed over HTTP.
