# Home Page Redesign — Design Spec

## Goal
Replace the current basic, centered-card Home lobby with a polished, modern, two-pane layout that matches the user-provided reference while staying consistent with the existing "Studio Console" theme.

## Approach
**Minimal reference match with subtle Studio Console accents.**

The layout follows the reference screenshot closely: a full-height split screen with the join form on the left and a large camera preview on the right. Studio Console colors are used sparingly — waveform green for active states and loading, tally red for muted/off states — so the page feels cohesive with `Conference.tsx` without looking busy.

## Layout

### Desktop (two-pane)
```
┌─────────────────────────┬─────────────────────────────┐
│  Roomly                 │                             │
│  Multi-party video      │                             │
│  calls, simplified      │      Camera preview         │
│                         │      (large, centered)      │
│  [ Enter room ID      ] │                             │
│  [ Join room          ] │                             │
│         or              │                             │
│  [ Create new room    ] │                             │
│                         │                             │
│  [Cam off] [Mic off]    │                             │
└─────────────────────────┴─────────────────────────────┘
```

### Mobile (stacked)
The left pane fills the viewport. The camera preview sits below the form and is reachable by scrolling.

## Left Pane

### Header
- **Wordmark:** `Roomly`
  - Font: `Chakra Petch` (display/heading font), 24–28px, font-weight 600, white.
- **Tagline:** `Multi-party video calls, simplified`
  - Font: `Inter`, 14px, `text-stone-500`.
- Positioned top-left with comfortable padding (`p-8` to `p-12`).

### Form (centered vertically)
All form elements share a max width of ~360px and are centered in the left pane.

1. **Room ID input**
   - Placeholder: `Enter room ID`
   - Dark input field (`bg-[#141416]`), subtle border (`border-white/8`), rounded-xl.
   - Focus: border shifts to `waveform-green/40`.
   - Disabled while loading.

2. **Primary button: `Join room`**
   - Full width, rounded-xl, py-3.
   - Background `bg-[#1c1c1f]`, white text, subtle border.
   - Hover: background brightens slightly, top border shows `waveform-green`.
   - Active: `scale-[0.98]`.
   - Disabled while loading.

3. **Divider**
   - Thin horizontal line with lowercase `or` centered in muted gray.

4. **Secondary button: `Create new room`**
   - Transparent background, subtle border.
   - Hover: `bg-white/[0.04]`.
   - Disabled while loading.

### Media Toggles (bottom of left pane)
Two equal-width buttons side by side at the bottom of the pane:
- **Camera toggle**
  - Icon + label `Camera on` / `Camera off`.
  - Off state: tally-red background/ border, tally-red text.
  - On state: surface background, white text, small waveform-green dot.
- **Mic toggle**
  - Same treatment as camera.

## Right Pane

### Camera Preview Card
- Large, centered card occupying most of the right pane.
- Aspect ratio roughly 16:9, max-width ~720px.
- Rounded-2xl, dark surface background (`bg-[#141416]`), subtle border.
- Mirrored local video feed when camera is on.
- When camera is off: centered `Camera off` text in `text-stone-500`.

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `bg-canvas` | `#0a0a0c` | Page background |
| `bg-surface` | `#141416` | Cards, inputs, preview background |
| `border` | `white/8` | Default borders |
| `text-ink` | `stone-100` | Primary text |
| `text-muted` | `stone-500` | Muted text, placeholders |
| `waveform-green` | existing | Active dot, focus border, loading spinner |
| `tally-red` | existing | Muted toggle states, errors |

## Typography
- `Chakra Petch` — wordmark only.
- `Inter` — body, buttons, labels.
- `JetBrains Mono` — not used on Home, reserved for room IDs in `Conference`.

## States & Interactions

### Loading
- Full-screen overlay with `bg-[#0a0a0c]/80 backdrop-blur-sm`.
- Waveform-green spinner + `Joining...` text.
- Input and all buttons disabled.

### Error
- Inline banner above the input.
- Background `bg-tally-red/10`, border `border-tally-red/20`, text `text-tally-red`.
- Replaces the native `alert()` currently used for empty room ID.

### Empty room ID submission
- Show inline error: `Please enter a room ID`.
- Do not open the WebSocket.

### Camera/Mic toggles
- Toggle immediately updates local track state.
- Visual state updates synchronously.

## Responsive Behavior
- **≥1024px:** Two-pane split, left ~45%, right ~55%.
- **<1024px:** Single column, left pane first, preview scrolls below.
- Preview maintains 16:9 aspect ratio and max-width on all sizes.

## Functional Fixes Bundled In
1. Move `setLoading(false)` into the `enter-conference` handler so toggling mic/camera while joining does not hide the spinner.
2. Disable buttons/input while `loading` is true to prevent rapid-click/double WebSocket creation.
3. Replace `alert("Please enter a room ID")` with inline error banner.
4. Add `try/catch` around `mediaService.init()` so camera-permission denial is handled gracefully.
5. Stabilize signaling event listeners so toggling mic/camera does not re-subscribe.
6. Guard async join/create handlers against unmount to avoid state updates on a defunct component.
7. Add accessible labels and live-region roles.

> Note: `Home.tsx` intentionally does **not** stop the camera stream on unmount. `mediaService.init()` caches the stream, and `Conference.tsx` reuses it when the user enters the room. Stream cleanup happens in `Conference.tsx` via `mediaService.close()` on unmount/leave.

## Out of Scope
- Environment-based WebSocket URL configuration (separate task).
- Redux removal (separate task; Redux state will still be written to, but not relied upon for the new UI).
- Conference page changes.

## Files to Modify
- `client/src/pages/Home.tsx` — main redesign and behavior fixes.
- `client/src/index.css` — add any new utility classes only if needed (prefer existing Tailwind config).

## Success Criteria
- Home page renders the new two-pane layout.
- Camera preview works and mirrors.
- Join/Create flow still navigates to `/conference` correctly.
- Loading overlay appears during join/create.
- Inline error appears for empty room ID.
- Toggling camera/mic while joining does not dismiss the loading overlay.
- Toggling camera/mic does not re-subscribe signaling event listeners.
- Async join/create handlers guard against updates after unmount.
- Room ID input has an accessible label; toggle buttons expose `aria-pressed`; error/loading regions are announced.
