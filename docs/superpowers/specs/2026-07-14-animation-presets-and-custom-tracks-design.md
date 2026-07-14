# Animation Presets and Custom Tracks Design

## Goal

Expand per-object target animation from the current spin-and-bob controls into two complementary workflows:

- Presets for users who want a polished result immediately.
- Editable animation tracks for users who want to animate every transform channel manually.

The same saved configuration must play consistently in the target preview and the MindAR runtime.

## User Experience

The Animation inspector begins with a **Preset** selector. It offers:

- None
- Gentle float
- Turntable
- Showcase
- Sway
- Pulse
- Orbit
- Bounce
- Custom

Choosing a named preset replaces the current track list with that preset's configured tracks. The generated tracks remain visible and editable. Editing, adding, reordering, or removing a generated track changes the selector to **Custom**. Choosing another named preset asks for no confirmation because animation edits are not saved until the target itself is saved, and Reset animation already establishes the editor's replacement behavior.

Below the selector, a compact **Fine-tune motion** area displays animation track cards. Each card contains:

- Property: Position X, Position Y, Position Z, Rotation X, Rotation Y, Rotation Z, or Overall scale.
- Motion: Smooth, Triangle, or Spin. Spin is available only for rotation properties.
- Amount: property-specific displacement, angle, or scale ratio.
- Speed: cycles per second. A negative speed reverses Spin.
- Phase: a 0-359 degree offset used to coordinate tracks, including circular orbits.
- Remove action.

An **Add motion** button appends a sensible Position Y smooth track. Reset animation returns to None with no tracks. Track controls include visible numeric values, keyboard-operable native controls, and property-specific units.

## Preset Definitions

Presets are deterministic data, not separate runtime code paths:

| Preset | Tracks |
| --- | --- |
| Gentle float | Position Y, Smooth, 0.12 units, 0.5 cycles/s |
| Turntable | Rotation Y, Spin, 360 degrees, 0.15 cycles/s |
| Showcase | Turntable plus Position Y, Smooth, 0.08 units, 0.5 cycles/s |
| Sway | Rotation Z, Smooth, 12 degrees, 0.5 cycles/s |
| Pulse | Overall scale, Smooth, 0.12 ratio, 0.75 cycles/s |
| Orbit | Position X and Position Z, Smooth, 0.18 units, 0.3 cycles/s, 90-degree phase separation |
| Bounce | Position Y, Triangle, 0.18 units, 0.65 cycles/s |

These values are intentionally moderate so selecting a preset does not make a model leave the target area or become difficult to select.

## Data Model

`ImageTargetAnimation` becomes a versioned conceptual structure with a preset identifier and a list of tracks:

```ts
type ImageTargetAnimation = {
  preset: ImageTargetAnimationPreset;
  tracks: ImageTargetAnimationTrack[];
};

type ImageTargetAnimationTrack = {
  property: 'positionX' | 'positionY' | 'positionZ'
    | 'rotationX' | 'rotationY' | 'rotationZ' | 'scale';
  motion: 'smooth' | 'triangle' | 'spin';
  amount: number;
  speed: number;
  phase: number;
};
```

Normalization validates enum values, rejects invalid property/motion combinations, clamps property-specific amounts and speeds, normalizes phase to 0-359 degrees, limits the track count, and returns cloned values so preset constants cannot be mutated.

Legacy records containing `spinAxis`, `spinSpeed`, `bobHeight`, and `bobSpeed` are migrated during normalization. Spin radians per second and bob angular speed are converted to cycles per second without changing the visible motion. Legacy fields remain accepted indefinitely so already-saved cloud targets continue to work.

## Runtime Evaluation

A pure evaluator converts normalized tracks and elapsed time into a frame offset:

```ts
type ImageTargetAnimationFrame = {
  position: { x: number; y: number; z: number };
  rotationRadians: { x: number; y: number; z: number };
  scaleMultiplier: number;
};
```

Smooth uses a sine wave. Triangle uses a centered triangle wave. Spin advances continuously using `amount * speed * elapsedSeconds`. Multiple tracks targeting the same property add together. Scale is clamped to a small positive multiplier so aggressive custom settings cannot mirror or collapse a model.

Both preview and AR apply each frame relative to the saved placement transform. This prevents accumulated floating-point drift and makes changing presets or resetting animation immediately restore the correct base transform.

## Cloud Compatibility

Cloud requests store `preset` and a snake-case `tracks` array inside the existing per-object `animation` object. The client continues to read legacy spin/bob fields. When a new configuration contains a compatible Rotation Spin or Position Y Smooth track, the request also includes best-effort legacy spin/bob aliases so older consumers retain partial motion instead of becoming static.

The Worker round trip must be verified. If the existing Worker preserves the animation object, no backend change is needed. If it filters animation keys, the minimum matching schema extension belongs in the Web-AR Worker and must remain backward-compatible.

## Code Boundaries

- `src/app/imageTargetAnimation.ts`: types, normalization, preset generation, legacy migration, and pure frame evaluation.
- `src/ui/animationTrackEditor.ts`: DOM rendering and editor change events for track cards.
- `src/ui/appShell.ts`: static preset selector, manual editor host, Add motion, and Reset animation controls.
- `src/main.ts`: thin state bridge between the editor, selected target object, and preview refresh.
- `src/scene/ImageTargetPreview.ts`: apply evaluated frames relative to preview placements.
- `src/ar/cloudflareMarkerObject.ts`: apply the same evaluated frames relative to AR placements.
- `src/app/cloudImageTargets.ts`: new cloud wire shape plus legacy-compatible parsing and serialization.

## Testing

Focused tests cover:

- Exact preset track definitions and defensive cloning.
- Normalization, clamping, invalid combinations, and legacy migration.
- Smooth, triangle, spin, phase, combined tracks, and positive scale evaluation.
- Preview and AR parity using the shared evaluator.
- Cloud parsing and request serialization for both new and legacy records.
- Shell accessibility and track editor add/edit/remove behavior.
- Main integration: preset selection, edits becoming Custom, reset, selected-object isolation, and preview refresh.

After focused tests pass, run the full Vitest suite, the normal production build, and the GitHub Pages build. Finally, open `#/targets` in the local Vite app, select several presets, edit tracks, and confirm the visible preview changes and responsive inspector layout.

## Scope Boundaries

- No keyframe timeline or scrubbing UI in this iteration.
- No easing curve editor beyond Smooth, Triangle, and Spin.
- No animation of material, lighting, text content, or camera properties.
- No audio-driven or event-triggered animation.
- No change to the saved placement controls; animation remains a non-destructive offset over placement.
