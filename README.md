# Victory Liner — Careers Site

A Vite + React implementation of the Victory Liner careers/recruitment site, built from the
`Victory Liner Design System` Claude Design export in `../project/`.

Screens: Homepage → Job Filter (search results) → Job Details → Sign In → Create Account.
Click a job card or "Apply" to move forward; header/breadcrumb/"Back to Job Posting" links move back.
Navigation between screens is client-side state (no router, no backend) — this recreates the
design's interaction model rather than a production account/application system.

## Structure

- `src/styles/` — design tokens (`tokens/colors.css`, `typography.css`, `spacing.css`, `fig-tokens.css`)
  and the root `styles.css` that imports them.
- `src/components/` — reusable UI primitives ported from the design system (`core/`, `cards/`,
  `layout/`, `navigation/`, `feedback/`, `icons/`), unchanged apart from becoming real ES module imports.
- `src/pages/` — the 5 screens (`Homepage`, `JobFilter`, `JobDetails`, `SignIn`, `CreateAccount`).
- `src/assets/` — logo, hero photography, map basemap, and search icons copied from the design system.
- `src/App.jsx` — screen switcher (mirrors the original prototype's `nav(screen, job)` pattern).

Repeated job listings are abbreviated (4–5 cards shown instead of the source's 11), matching the
original design system's UI kit.

## Develop

```
npm install
npm run dev
```

## Build

```
npm run build
```
