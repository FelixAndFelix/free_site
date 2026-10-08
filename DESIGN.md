# free_site design system

How free_site looks and why. Read this before building or changing a screen; the tokens live in
`frontend/src/styles.css` and must match the values here.

## Overview

free_site answers one question for a DHBW course: which exams are free? Students open it on their
phones between lectures, check a module's verdict and cast their own vote. The design is a calm,
neutral tool so the data stands out: a cool grey page, white panels, one grotesk typeface, and the
three vote colors as the only color on the page.

- **Mobile first.** Every screen is designed at 390px wide first; desktop widens the column and puts
  two module tiles side by side.
- **The verdict is the signature.** Each module leads with a short phrase and a share ("Leaning
  impossible 50%"), so the question is answered before anyone reads the legend.
- **Color carries identity, text carries meaning.** The vote colors mark bars, swatches and the
  verdict square. Labels, values and the verdict text always stay in ink.
- **Light and dark mode** follow the system setting. Dark mode has its own steps; it is not an
  inverted light mode.

## Colors

### Surfaces and text

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#eef0f3` | `#0f1218` | Page background, app bar (88% with blur) |
| `--surface` | `#ffffff` | `#171b23` | Panels, inputs, the selected vote |
| `--surface-sunk` | `#f5f6f8` | `#1d222c` | Track of the vote control, skeletons, selected list row |
| `--line` | `#dde1e7` | `#2a303c` | Panel borders, dividers, chart grid |
| `--line-strong` | `#858c99` | `#6b7383` | Input and secondary-button borders (≥ 3:1 against the surface) |
| `--ink` | `#1d2230` | `#e7e9ee` | Headings, body text, primary buttons, focus ring |
| `--ink-2` | `#474e5c` | `#c2c7d0` | Secondary text, labels, legends |
| `--muted` | `#5d6474` | `#9aa1ae` | Hints, counts, axis labels (≥ 4.5:1 on `--bg`) |
| `--on-ink` | `#ffffff` | `#0f1218` | Text on primary buttons |
| `--danger` | `#b42318` | `#ff8a80` | Errors, destructive buttons |

There is no separate brand accent: primary actions are ink-filled, so the vote colors never compete
with a button.

### Vote colors

| Value | Light | Dark | Tint light | Tint dark |
|---|---|---|---|---|
| Free | `#15803d` | `#127c41` | `#e3f5e9` | `#12291c` |
| Possible | `#e0a100` | `#c28900` | `#fdf3d4` | `#2e250d` |
| Impossible | `#dc2626` | `#d93b3b` | `#fde7e7` | `#331819` |

Both sets pass the dataviz palette validator (lightness band, chroma, color-vision separation,
normal-vision floor) against their surface, `#ffffff` and `#171b23`. Amber is below 3:1 against white,
which is why every bar has a legend with counts and the chart has a table view. Tints are only used
as the background of the selected vote button.

## Typography

- **Family:** Geist Variable (`@fontsource-variable/geist`, self-hosted), fallback `system-ui`. One
  family for everything; hierarchy comes from size and weight.
- **Numbers:** `font-variant-numeric: tabular-nums` on counts, shares, axes and tables.

| Role | Size | Weight | Notes |
|---|---|---|---|
| Page title (h1) | 2rem, 2.5rem from 768px | 700 | `-0.02em`, balanced wrapping |
| Module page share | 2.5rem, 3rem from 768px | 700 | The page's headline figure |
| Section (h2) | 1.125rem | 650 | |
| Module name (tile h3) | 1.125rem | 600 | |
| Verdict | 1rem (tile), 1.375rem (module page) | 600 | |
| Body | 1rem | 400 | line-height 1.5, prose max 68ch |
| Small | 0.875rem | 400–500 | Legends, labels, nav, footer |
| Extra small | 0.8125rem | 400 | Cooldown note |

Sentence case everywhere, including buttons and headings. No all-caps labels, no eyebrows.

## Layout

- **Container:** 44rem wide, 60rem from 1024px; side gutter 1rem on phones, 2rem from 768px.
- **Rhythm:** 2rem between page sections (`.stack-lg`), 1rem inside panels, 0.875rem between tiles.
- **App bar:** sticky, 3.5rem high, wordmark left, navigation right. On phones under 480px the
  Admin and Log out labels collapse to icons (the label stays for screen readers); the account
  item always shows the username.
- **Overview:** one column of module tiles, two from 1024px, grouped under "Semester N" with the
  module count on the right.
- **Module page:** title block, then a verdict panel (verdict and share left, bar and legend right
  from 768px, "Your vote" below a divider), then the "Over time" chart panel.
- **Login, registration, reset:** a short explanation ("Which exams are free?") next to the form
  from 768px, stacked above it on phones.

## Shapes and depth

| Element | Radius |
|---|---|
| Panels (`.card`), empty states | 12px |
| Inputs, buttons, vote control track | 8px |
| Vote buttons inside the track | 6px |
| Bar ends, verdict square | 4px (3px small) |
| Swatches | round |

Panels have a 1px `--line` border and a barely visible shadow in light mode, none in dark mode.
Only the chart tooltip floats with a real shadow.

## Components

### Module tile

Name (links to the module page, with a caret) → verdict line → stacked bar → legend with counts and
total → vote control. Without votes the bar is an empty track, the verdict reads "No votes yet" and
the legend says "Be the first to vote."

### Verdict

`verdictOf()` in `frontend/src/votes.ts`: the leading value and its share. At 60% or more it reads
"Mostly …", below that "Leaning …"; a tie for the lead reads "Split". The colored square shows the
leading value; a split or empty module gets a neutral square.

### Vote control

Three buttons joined in one sunken track. Unselected: a swatch and the label in `--ink-2`.
Selected: the value's tint, a 1px border in the value's color and a check icon instead of the
swatch. During the cooldown the buttons are disabled but the selected one keeps full color, and a
lock icon note says when voting is possible again. Under 360px the swatches and check hide.

### Buttons

Primary: ink fill, `--on-ink` text. Secondary: surface with `--line-strong` border. Danger: surface
with danger text and border, tinted on hover. All are at least 2.75rem high (2.5rem in dense admin
lists), move down 1px when pressed and never wrap their label. A link that acts like a button
(navigation, e.g. "Create account" on the invite page) is an `<a class="button">`, optionally
`secondary`; real actions stay `<button>`.

### Forms

Label above the input (`.field`), 2.75rem inputs with a `--line-strong` border, errors below in
`--danger` as `role="alert"`. Never a placeholder as the only label.

### History chart

Inline SVG line chart, one 2px line per vote value, recessive grid in `--line`, axis labels in
`--muted`, end dots with a 2px surface ring, crosshair tooltip on pointer and arrow keys, and a
"Show as table" disclosure. Follow the dataviz rules for any new chart.

### States

- **Loading:** the overview shows three skeleton tiles (pulse disabled for reduced motion); other
  pages show "Loading…".
- **Empty:** dashed panel with a sentence that says what happens next.
- **Errors:** inline, next to what failed, with the next step.

## Icons

Phosphor (`@phosphor-icons/react`), regular weight, `aria-hidden` when next to a text label. In use:
`ShieldCheck` (Admin), `UserCircle` (account), `SignOut`, `ArrowLeft` (back links), `CaretRight`
(module link), `Check` (selected vote), `LockSimple` (cooldown). Do not draw icons by hand or mix
icon families.

## Do's and don'ts

### Do

- Use the tokens; never write a raw color in a component.
- Keep text in ink colors and put the vote color on a mark beside it.
- Give every interactive element a visible `:focus-visible` ring and a hover state.
- Check new screens at 360px, 390px, 768px and 1280px, in light and dark mode.

### Don't

- Don't add a second accent color, gradients or glows.
- Don't put cards inside cards; group with dividers or spacing instead.
- Don't add motion that is not feedback for an action; respect `prefers-reduced-motion`.
- Don't use em dashes, all-caps labels or decorative dots in the interface copy.
- Don't load fonts or scripts from third-party hosts (the privacy page promises no tracking).

## Responsive behavior

| Breakpoint | Change |
|---|---|
| < 360px | Vote buttons show the label only |
| < 480px | App bar: Admin and Log out as icons |
| < 600px | Privacy table rows become blocks |
| ≥ 768px | Larger titles, 2rem gutter, verdict panel side by side, auth layout in two columns, inline admin forms |
| ≥ 1024px | 60rem container, two module tiles per row |

Touch targets are at least 2.5rem; the sticky app bar is accounted for with `scroll-padding-top`, so
focused elements never hide underneath it.

## Iteration guide

1. Start from an existing component and its tokens; add a token here first if a new value is needed.
2. Build the phone layout, then add `min-width` media queries.
3. Screenshot light and dark, phone and desktop, before opening a pull request.
4. Update this file in the same pull request when a rule or token changes.
