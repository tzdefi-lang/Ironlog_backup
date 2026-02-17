# Botanical / Organic Serif Design Refactor (PWA -> Native-ready)

## Goals
- Replace the previous high-saturation yellow visual system with a natural botanical palette.
- Decouple design tokens from feature code so they can be exported to React Native, Flutter, and Swift/Kotlin.
- Move interaction patterns toward native behavior (bottom sheets, stack-like transitions, touch-first controls).

## Token Architecture
- `src/design/tokens.ts`: source-of-truth token object for TypeScript runtime usage.
- `src/design/token-export.json`: neutral token export for future mobile pipeline ingestion.
- `src/design/tokens.css`: web token mapping (`@theme` + CSS vars) consumed globally.

## Visual Foundation
- Global background: warm paper color (`#F9F8F4`) plus subtle SVG fractal-noise texture.
- Typography system:
  - Display/data: Playfair Display
  - Body/supporting: Source Sans 3
- Surface language:
  - Soft card layering and diffused shadows
  - Organic radii with 24px cards and 40px top-arch sheets
- Motion:
  - Slower organic timing defaults (`220ms / 360ms / 500ms`)
  - Gentle press feedback (`scale 0.98`)

## Native Interaction Direction
- Modal primitive updated to bottom-sheet presentation with drag-down-to-close.
- Route container animation moved toward stack push/pop feel.
- Edge-swipe back gesture added for non-root routes.
- Bottom tab shell made floating and blurred for app-like composition.

## Rollout Phasing
1. Foundation (tokens, app shell, primitives, motion): completed.
2. Component migration pass (cards, forms, sheets, navigation polish): completed for Dashboard, Calendar, History, Stats, and WorkoutEditor shell.
3. Data panel refinement (charts, calendar/history breathing rhythm, serif emphasis): in progress, with Profile/Profile Settings/Login also migrated to semantic surfaces and organic motion.
4. Native extraction prep (token converters + shared interaction contracts): pending.
