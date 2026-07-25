# Locked Object Tint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every visible locked Studio object a semi-transparent blue material tint without persisting the visual state.

**Architecture:** Add one focused Three.js material-treatment helper, resolve temporary object/group lock keys into object IDs in `main.ts`, and pass those IDs explicitly into `ImageTargetPreview`. The preview applies cloned tinted materials only after a visible object is created, keeping hidden filtering, transform locking, and persistence responsibilities separate.

**Tech Stack:** TypeScript, Three.js, Vitest, Vite

## Global Constraints

- Use lock blue `#2457a7`.
- Set opacity to the lower of the original material opacity or `0.62`.
- Blend color-bearing materials 55% toward the lock blue.
- Clone materials before modification.
- Hidden state takes precedence and hidden locked objects must not load.
- Lock state and tint must never enter save or update payloads.
- Preserve existing object selection and locked-transform behavior.

---

### Task 1: Locked Material Treatment

**Files:**
- Create: `src/scene/lockedObjectTint.ts`
- Create: `tests/lockedObjectTint.test.ts`

**Interfaces:**
- Consumes: Three.js `Object3D`, `Mesh`, `Material`, and `Color`.
- Produces: `applyLockedObjectTint(root: Object3D): void`.

- [ ] **Step 1: Write failing tests for cloned tint materials**

Create `tests/lockedObjectTint.test.ts` with cases for a single material and a material array:

```ts
import { Color, Group, Mesh, MeshStandardMaterial, PlaneGeometry } from 'three';
import { describe, expect, it } from 'vitest';
import { applyLockedObjectTint } from '../src/scene/lockedObjectTint';

describe('applyLockedObjectTint', () => {
  it('clones, fades, and blends color-bearing mesh materials', () => {
    const original = new MeshStandardMaterial({ color: '#ffffff', opacity: 1 });
    const mesh = new Mesh(new PlaneGeometry(1, 1), original);
    const root = new Group();
    root.add(mesh);

    applyLockedObjectTint(root);

    const tinted = mesh.material as MeshStandardMaterial;
    expect(tinted).not.toBe(original);
    expect(original.opacity).toBe(1);
    expect(tinted.transparent).toBe(true);
    expect(tinted.opacity).toBe(0.62);
    expect(tinted.color.getHex()).toBe(
      new Color('#ffffff').lerp(new Color('#2457a7'), 0.55).getHex(),
    );
  });

  it('tints every entry in a material array and preserves lower original opacity', () => {
    const first = new MeshStandardMaterial({ color: '#ff0000', opacity: 0.4 });
    const second = new MeshStandardMaterial({ color: '#00ff00', opacity: 1 });
    const mesh = new Mesh(new PlaneGeometry(1, 1), [first, second]);

    applyLockedObjectTint(mesh);

    const tinted = mesh.material as MeshStandardMaterial[];
    expect(tinted[0]).not.toBe(first);
    expect(tinted[1]).not.toBe(second);
    expect(tinted[0].opacity).toBe(0.4);
    expect(tinted[1].opacity).toBe(0.62);
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the red state**

Run:

```bash
npx vitest run tests/lockedObjectTint.test.ts --maxWorkers=1
```

Expected: FAIL because `src/scene/lockedObjectTint.ts` does not exist.

- [ ] **Step 3: Implement the minimal tint helper**

Create `src/scene/lockedObjectTint.ts`:

```ts
import { Color, Material, Mesh, Object3D } from 'three';

const lockColor = new Color('#2457a7');
const lockColorBlend = 0.55;
const lockOpacity = 0.62;

type ColorMaterial = Material & { color: Color };

export function applyLockedObjectTint(root: Object3D): void {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return;
    }
    object.material = Array.isArray(object.material)
      ? object.material.map(cloneTintedMaterial)
      : cloneTintedMaterial(object.material);
  });
}

function cloneTintedMaterial(material: Material): Material {
  const tinted = material.clone();
  tinted.transparent = true;
  tinted.opacity = Math.min(material.opacity, lockOpacity);
  if (hasColor(tinted)) {
    tinted.color.lerp(lockColor, lockColorBlend);
  }
  tinted.needsUpdate = true;
  return tinted;
}

function hasColor(material: Material): material is ColorMaterial {
  return 'color' in material && material.color instanceof Color;
}
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npx vitest run tests/lockedObjectTint.test.ts --maxWorkers=1
```

Expected: PASS.

- [ ] **Step 5: Commit the material helper**

```bash
git add src/scene/lockedObjectTint.ts tests/lockedObjectTint.test.ts
git commit -m "feat: add locked object material tint"
```

---

### Task 2: Preview Lock-ID Integration

**Files:**
- Modify: `src/main.ts`
- Modify: `src/scene/ImageTargetPreview.ts`
- Modify: `tests/imageTargetPreview.test.ts`
- Modify: `tests/targetEditorKeyboardIntegration.test.ts`

**Interfaces:**
- Consumes: `applyLockedObjectTint(root: Object3D): void`.
- Produces: `PreviewState.lockedObjectIds?: readonly string[]` and `lockedTargetObjectIds(): string[]`.

- [ ] **Step 1: Extend integration-test preview state**

In `tests/targetEditorKeyboardIntegration.test.ts`, add `lockedObjectIds?: string[]` to `PreviewUpdate`. After locking an object, require:

```ts
expect(latest().lockedObjectIds).toEqual([latest().objects[0].id]);
```

In the locked-group test, require all group member IDs:

```ts
expect(new Set(latest().lockedObjectIds)).toEqual(
  new Set(latest().objects.map((object) => object.id)),
);
```

- [ ] **Step 2: Add a failing preview material test**

In `tests/imageTargetPreview.test.ts`, load one unlocked and one locked model with distinct material instances, pass `lockedObjectIds: ['locked']`, and assert:

```ts
expect((unlocked.group.children[0] as Mesh).material).toBe(unlockedMaterial);
expect((locked.group.children[0] as Mesh).material).not.toBe(lockedMaterial);
expect(((locked.group.children[0] as Mesh).material as Material).opacity).toBe(0.62);
```

Keep the existing hidden-and-locked test and require `loadModel` not to be called for the hidden object.

- [ ] **Step 3: Run focused integration tests and confirm the red state**

Run:

```bash
npx vitest run tests/imageTargetPreview.test.ts tests/targetEditorKeyboardIntegration.test.ts --maxWorkers=2
```

Expected: FAIL because `lockedObjectIds` is not produced or consumed and locked materials are unchanged.

- [ ] **Step 4: Resolve object and group lock keys in `main.ts`**

Add:

```ts
function lockedTargetObjectIds(): string[] {
  const lockedGroupIds = new Set(
    [...lockedTargetKeys]
      .filter((key) => key.startsWith('group:'))
      .map((key) => key.slice('group:'.length)),
  );
  return targetObjects
    .filter((object) => (
      lockedTargetKeys.has(`object:${object.id}`)
      || Boolean(object.groupId && lockedGroupIds.has(object.groupId))
    ))
    .map((object) => object.id);
}
```

Pass the result to `preview.update`:

```ts
lockedObjectIds: lockedTargetObjectIds(),
```

Do not add the property to any cloud save or update request.

- [ ] **Step 5: Apply tint inside `ImageTargetPreview`**

Import `applyLockedObjectTint`, extend `PreviewState`, and add preview state:

```ts
lockedObjectIds?: readonly string[];
```

```ts
private lockedObjectIds = new Set<string>();
```

During `update`:

```ts
this.lockedObjectIds = new Set(state.lockedObjectIds ?? []);
```

After creating a visible text object or loading a visible model:

```ts
if (this.lockedObjectIds.has(object.id)) {
  applyLockedObjectTint(loadedObject);
}
```

Apply the helper before placing the object into `loadedModels`. Do not move it before the existing hidden-object early return.

- [ ] **Step 6: Run focused tests**

Run:

```bash
npx vitest run tests/lockedObjectTint.test.ts tests/imageTargetPreview.test.ts tests/targetEditorKeyboardIntegration.test.ts --maxWorkers=2
```

Expected: PASS.

- [ ] **Step 7: Run type-check/build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 8: Commit preview integration**

```bash
git add src/main.ts src/scene/ImageTargetPreview.ts tests/imageTargetPreview.test.ts tests/targetEditorKeyboardIntegration.test.ts
git commit -m "feat: tint locked preview objects"
```

---

### Task 3: Full Verification and Running App

**Files:**
- Verify only; no planned source changes.

**Interfaces:**
- Consumes: completed locked tint implementation.
- Produces: a verified branch and restarted development server.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npx vitest run --exclude=.worktrees/** --maxWorkers=4
```

Expected: all test files pass with zero failures.

- [ ] **Step 2: Run production build and diff validation**

Run:

```bash
npm run build
git diff --check
```

Expected: both commands exit successfully.

- [ ] **Step 3: Review the completed diff**

Compare the implementation against `docs/superpowers/specs/2026-07-26-locked-object-tint-design.md`. Confirm:

- every visible locked object is tinted;
- locked groups resolve to every member;
- hidden locked objects are not loaded;
- materials are cloned before mutation;
- no lock state enters save or update payloads.

- [ ] **Step 4: Restart and verify the app**

Restart the Vite development server on `127.0.0.1:5175`, then verify:

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:5175/" -UseBasicParsing
```

Expected: HTTP 200 from the current branch and commit.

