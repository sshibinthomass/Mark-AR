# Locked Object Tint Design

## Goal

Make locked objects immediately distinguishable inside the Studio 3D preview, in addition to the existing Locked badge in the object list.

## Visual Behavior

- Every visible locked object receives a semi-transparent blue treatment based on `#2457a7`.
- The treatment sets material opacity to the lower of its original value or `0.62` and blends color-bearing materials 55% toward the lock blue, preserving recognizable textures and model details beneath the tint.
- Locking a group applies the treatment to every visible member of that group.
- The treatment applies whether or not the locked object or group is currently selected.
- Hidden state takes precedence: an object that is both hidden and locked is not loaded or rendered.
- Unlocking restores the model or text object's normal materials and opacity.

## Architecture and Data Flow

The editor continues to own temporary lock state in `lockedTargetKeys`. A helper in `main.ts` resolves those object and group keys into explicit locked object IDs and passes them to `ImageTargetPreview` as `lockedObjectIds`.

`ImageTargetPreview` applies the visual treatment after each visible model or text object is created. Materials are cloned before modification so the tint cannot mutate shared source materials. Because preview updates rebuild preview objects, unlocking naturally restores the unmodified materials.

The existing `selectionLocked` flag remains responsible for disabling transform controls and gestures. `lockedObjectIds` is visual state only.

## Persistence

The tint and locked identifiers remain temporary editor state. They are excluded from save and update payloads and do not appear in published AR experiences.

## Edge Cases

- Materials that expose a color are blended toward the lock blue rather than replaced outright.
- Materials without a color still receive reduced opacity.
- Material arrays are handled element by element.
- Hidden locked objects remain filtered before model loading.
- Disposing or rebuilding the preview disposes cloned tinted materials with the rest of the preview resources.

## Testing

Automated tests will verify:

- an individually locked model receives cloned, transparent, blue-tinted materials;
- all members of a locked group receive the treatment;
- unlocked objects retain their original material appearance;
- hidden-and-locked objects are not loaded;
- `main.ts` passes resolved locked object IDs without adding lock state to persistence payloads.
