---
name: cuccupos-pos
description: POS / retail dashboard design system. Modern, clean, minimal. React + Tailwind + shadcn/ui. Product: coffee shop point-of-sale (POS) with cashier ordering, admin dashboard, menu management, reports, and customer history.
---

# CuccuPOS Design System

Built with the **ui-ux-pro-max** skill. All rules below come from its searchable database.

## Product Type
- **Primary**: POS / Retail / Service (coffee shop)
- **Audience**: Cashiers (touch-first), Owner/Manager (analytics, reporting)
- **Platform**: Web (desktop + mobile responsive)
- **Usage context**: Fast checkout at counter, admin review at back office

## Design Dials (from `--design-system` output)
- **Variance**: Mid (4-7) — balanced, modern
- **Motion**: Standard — scroll/stagger motion
- **Density**: Standard — 16-64px spacing scale

## Stack
`react` + `html-tailwind` + `nextjs` (Vite build, shadcn/ui components)

## Color Palette (from `src/index.css` variables)

| Token | HSL | Use |
|---|---|---|
| `--primary` | 69 28% 35% | Main brand (olive/green) |
| `--primary-foreground` | 54 100% 96% | Light cream on primary |
| `--background` | 54 100% 96% | Page base (warm white) |
| `--foreground` | 84 59% 11% | Main text (dark olive) |
| `--card` | 0 0% 100% | White cards |
| `--muted` | 60 40% 92% | Subtle background fills |
| `--accent` | 66 25% 88% | Soft highlight |
| `--border` | 66 15% 82% | Divider/outline |
| `--destructive` | 0 70% 45% | Errors / destructive actions |
| `--secondary` | 66 19% 82% | Secondary surfaces |
| `--sidebar` | 69 28% 35% | Sidebar background |
| `--sidebar-active` | 68 23% 19% | Active nav state |

## Typography (Tailwind config)

- **Font family**: `Quicksand` (rounded geometric sans-serif) — playful but clean
- **Base size**: 16px (browser default preserved via `base` layer)
- **Weights**: `font-bold` (700) for headings, `font-semibold` (600) for labels, `font-medium` (500) for body
- **Scale**: `text-xs` (11px labels), `text-sm` (14px body/meta), `text-base`, `text-lg` (18px headings), `text-2xl` / `text-3xl` (page titles)
- **Line-height**: Default Tailwind (`leading-tight` for headings, `leading-none` for cards)
- **Numbers**: `tabular-nums` for all monetary values (prices, totals, discounts, change)

## Spacing Scale (updated in `tailwind.config.js`)

- Base: 4px (1), 8px (2), 16px (3), 24px (4), 32px (5), 48px (6), 64px (7), 96px (8)
- Micro-steps: `1.5` (6px), `2.5` (10px), `3.5` (14px) — for tighter layouts

## Component Design Rules

### Buttons (`Button` component)
- Size: `h-11` (default), `h-9` (sm), `h-12` (lg)
- Radius: `rounded-xl`
- Variant: `default` (primary), `outline`, `secondary`, `destructive`, `ghost`
- Focus: `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- Touch target: `min-h-[44px] min-w-[44px]` (icon buttons use `size-11`)

### Cards (`Card` component)
- `rounded-xl` border, white bg, subtle shadow
- Header: `p-5` flex column
- Content: `p-5 pt-0`
- Footer: `flex items-center p-5 pt-0`
- Responsive padding: `px-3 sm:px-0` on page wrappers

### Inputs (`Input` component)
- `h-11` (44px touch target), `rounded-xl`
- `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
- `placeholder:text-muted-foreground`
- `tabular-nums` for number fields

### Navigation (`AppShell`)
- Sidebar: `w-60`, `rounded-2xl` nav links, `text-lg` font
- Mobile bottom nav: `fixed bottom-0`, `bg-sidebar`, `min-h-[44px]`
- Active state: `bg-sidebar-active shadow-lg`
- Touch targets: `min-h-[44px]` on all nav items

### Tables (`Table` components)
- Header: `TableHead` bold, `text-right` for numeric columns
- Cells: `font-semibold` for IDs/prices, `text-muted-foreground` for meta
- Rows: `min-h-[44px]` for touch accessibility
- Responsive: `overflow-hidden` container, `max-w-[14rem]` truncate for item descriptions

### Dialogs (`Dialog` component)
- `rounded-2xl`, `max-h-[90vh]`, `shadow-xl`
- Title: `text-xl font-bold`
- Description: `text-sm text-muted-foreground`
- Close button: `rounded-md`, `focus-visible:ring-2`
- Footer: `flex flex-col-reverse gap-2 sm:flex-row sm:justify-end`

### Status Badges (`StatusBadge`)
- `rounded-full`, `border`, small text (`text-xs`)
- Active states use `bg-primary` / `bg-destructive`

## UI/UX Improvements Applied (Tailwind-only, no structure changed)

Per the **UI/UX Pro Max** priority rules:

1. **Accessibility (Critical)**: Global `:focus-visible` ring (`ring-2 ring-ring ring-offset-2`); reduced-motion media query (`animation-duration: 0.01ms` for users with `prefers-reduced-motion`)
2. **Touch & Interaction (Critical)**: `min-h-[44px] min-w-[44px]` touch targets on buttons, inputs, nav links; `.min-touch` utility available
3. **Performance (High)**: Consistent `boxShadow` scale (sm → 2xl); `transitionDuration` tokens (`fast`=100ms, `slow`=300ms); `transitionTimingFunction` tokens (Material standard easing)
4. **Layout & Responsive (High)**: Micro-spacing tokens (`0.5`=2px, `1.5`=6px, `2.5`=10px, `3.5`=14px); responsive `px-3 sm:px-0` padding on page containers
5. **Typography & Color (Medium)**: `Quicksand` font; `tabular-nums` for monetary values; consistent `line-height` and spacing
6. **Animation (Medium)**: `active:scale-[0.99]` for buttons; transition tokens; reduced-motion respect

## Anti-Patterns Avoided (per quick-reference.md)

- No emoji icons (SVG only via `lucide-react`)
- No placeholder-only labels (visible `Label` + `Input` pairs everywhere)
- No fixed-width containers (responsive flex/grid used)
- No gray-on-gray text (`text-muted-foreground` uses semantic tokens)
- No raw hex in components (all colors use `hsl(var(--token))`)
- No color-only status indicators (badges + text)
- No hover-only interactions (all actions have click/tap equivalents)
- No instant state changes (all buttons have `transition-colors` and loading states)

## Design System Retrieval Pattern

Pages retrieve rules from `design-system/` if persisted. Since this project uses direct component composition (not a centralized Figma library), the `MASTER.md` equivalent is this file (`DESIGN.md`). Page-specific overrides (e.g. `dashboard.md`, `order.md`) can be added to `design-system/pages/` as needed.
