# Design — Vocab Battle

A locked design system for the client app. Every page redesign reads this file
before emitting code. Amend this file before introducing a page-level exception.

## Genre

Playful — adult, focused, tactile. The interface may feel lively; it must never
feel childish or ornamental.

## Macrostructure family

- Marketing pages: Marquee Hero; keep the existing home route unless it is explicitly in scope.
- App pages: Workbench; a compact utility rail frames one focused working stage.
- Learning content: Workbench variation; catalogue → unit queue → focused study stage.

## Theme

- Dark paper: `oklch(14% 0.018 235)`
- Light paper: `oklch(97% 0.014 112)`
- Primary accent: phosphor lime `oklch(88% 0.19 116)` in dark mode
- Information/focus: cyan `oklch(79% 0.13 210)` in dark mode
- Accent footprint: lime and cyan together stay below 5% of each viewport.

## Typography

- Display: Bricolage Grotesque, weight 800, roman.
- Body: IBM Plex Sans, weight 400; UI emphasis 600–700.
- Mono: IBM Plex Mono, weight 600, for progress and counts only.
- Type scale: major third, body floor `1rem`.

## Spacing

4-point named scale in `tokens.css`. Components use named tokens or Tailwind
utilities aligned to the same scale.

## Motion

- Easings: `--ease-out`, `--ease-in`, `--ease-in-out`.
- One route/state crossfade plus direct press feedback.
- Reduced motion: opacity-only, no more than 150 ms.

## Microinteractions stance

- Visible state changes are silent success.
- Focus appears instantly; hover and press use transform/colour only.
- Inputs and buttons are at least 44 px high.

## CTA voice

- Primary: solid accent, short verb-first label, 8 px radius.
- Secondary: paper surface with a fine rule; never competes with primary.

## Per-page allowances

- Marketing pages may use one purposeful enrichment.
- App surfaces use no enrichment; function carries the page.
- Learning images come from vocabulary data and remain optional.

## What pages MUST share

- Bricolage/IBM Plex pairing, token palette, 8 px control radius.
- Lime for the primary action and completed state; cyan for information/focus.
- Direct Vietnamese copy, visible focus, reduced-motion support.

## What pages MAY differ on

- Category browsing may use an asymmetric catalogue.
- Unit browsing may use dense horizontal rows.
- Study mode may use a single elevated stage.

## Exports

### tokens.css

`tokens.css` in this directory is the canonical export.

### Tailwind v4 `@theme`

```css
@theme {
  --color-paper: var(--color-paper);
  --color-ink: var(--color-ink);
  --color-accent: var(--color-accent);
  --color-info: var(--color-info);
  --font-display: var(--font-display);
  --font-body: var(--font-body);
  --font-outlier: var(--font-outlier);
  --spacing-md: var(--space-md);
  --ease-out: var(--ease-out);
}
```

### DTCG `tokens.json`

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(14% 0.018 235)", "$type": "color" },
    "ink": { "$value": "oklch(95% 0.012 105)", "$type": "color" },
    "accent": { "$value": "oklch(88% 0.19 116)", "$type": "color" },
    "info": { "$value": "oklch(79% 0.13 210)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Bricolage Grotesque", "$type": "fontFamily" },
    "body": { "$value": "IBM Plex Sans", "$type": "fontFamily" },
    "mono": { "$value": "IBM Plex Mono", "$type": "fontFamily" }
  },
  "space": {
    "md": { "$value": "1.5rem", "$type": "dimension" }
  }
}
```

### shadcn/ui CSS variables

```css
:root {
  --background: 14% 0.018 235;
  --foreground: 95% 0.012 105;
  --card: 18% 0.020 235;
  --card-foreground: 95% 0.012 105;
  --primary: 88% 0.190 116;
  --primary-foreground: 18% 0.025 116;
  --muted: 25% 0.022 235;
  --muted-foreground: 70% 0.018 225;
  --border: 31% 0.024 235;
  --input: 31% 0.024 235;
  --ring: 82% 0.170 210;
  --radius: 0.5rem;
}
```
