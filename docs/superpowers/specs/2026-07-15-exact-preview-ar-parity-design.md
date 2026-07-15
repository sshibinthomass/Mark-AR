# Exact Preview-to-AR Parity Design

## Goal

Make every saved target render with the same scene transform in the 3D target preview and the MindAR scan. Positions, depth ordering, scale, rotations, text orientation, group hierarchy, and animation must remain identical relative to the image target. The phone camera may still change the apparent perspective as the user moves around the target.

## Success criteria

- A model placed toward the lower or nearer side of the preview remains on that same side of the scanned target.
- Object order and overlap are determined by the same saved coordinates in preview and scan; no Y/Z swap or sign inversion may reorder the scene.
- X, Y, and Z rotations, including combined rotations, produce the same orientation relative to the target.
- Text uses the same upright direction, front direction, scale, and saved rotation as the preview.
- Group placement, child-local placement, and layered group/child animation preserve the same hierarchy and result.
- Animation position, rotation, scale, phase, speed, and direction match the preview at the same elapsed time.
- Model normalization uses the same authored size in both runtimes.
- Existing saved target records work without migration or resaving.

## Current root cause

The editor preview and MindAR use different world frames:

- The preview is Y-up. It stores an authored point as `(offsetX, height, offsetY)`.
- A MindAR image anchor is Z-up.
- The current scan runtime converts these frames piecemeal. Static placement writes `(offsetX, offsetY, height)`, GLB models receive a separate `+90°` X rotation, animation swaps selected axes manually, and text receives no equivalent model-basis rotation.
- Preview model normalization uses a largest dimension of `0.36`, while the scan loader uses `0.72`.

These independent conversions cannot preserve a complete scene. Static depth is mirrored, combined Euler rotations compose in a different order, text and GLB models use different bases, and animation can disagree with static placement.

## Chosen architecture

Create one `preview-space` group directly below the MindAR marker object root and rotate it `+90°` around X. All target groups, model roots, and text roots are children of that group and retain the exact local transforms used by `ImageTargetPreview`.

The single basis transform is:

```text
preview point (x, y, z) -> MindAR point (x, -z, y)
```

This is a proper rotation with determinant `+1`, not a reflection. Because the complete hierarchy is transformed once, Three.js preserves Euler composition, quaternions, child-local transforms, and animation directions without per-property remapping.

The scene hierarchy becomes:

```text
MindAR anchor
└── cloudflare-model-object
    └── cloudflare-preview-space  (rotation.x = +π/2)
        ├── target group root
        │   └── object/text local root
        └── ungrouped object/text root
```

## Placement and rotation

Within `cloudflare-preview-space`, scan placement must match the preview exactly:

```text
position = (offsetX, height, offsetY)
rotation = Euler(rotationX, rotationY, rotationZ, "XYZ")
scale    = (scale, scale, scale)
```

No axis swap, sign change, or quaternion conversion occurs per object. The parent preview-space rotation performs the complete conversion. Group roots use group placement, and grouped children use their normalized local placement exactly as the preview does.

## Model normalization

Extract the GLB normalization behavior into a shared scene helper used by both `ImageTargetPreview` and `cloudflareMarkerObject`.

The helper must:

- scale the largest source-model dimension to `0.36` target units;
- center the model on X and Z;
- place the model base at local Y `0`;
- return a wrapper without any runtime-specific basis rotation.

MindAR no longer rotates each loaded GLB independently. The preview-space parent rotates models and text together. Sharing the normalization helper prevents future preview/scan size drift.

## Text orientation

`createTextObject3D` continues to create the same text geometry for both runtimes. The scan adds the text group beneath its authored placement root, just as the preview does. The preview-space parent then maps the text's preview-up vector to MindAR Z-up and maps its preview-front vector consistently into the target plane.

Text must not receive a special billboard rotation or camera-facing correction. It remains target-anchored and preserves the exact authored orientation as the phone viewpoint changes.

## Animation

Scan animation placement must use the same local equations as `ImageTargetPreview`:

```text
position = (
  offsetX + frame.position.x,
  height  + frame.position.y,
  offsetY + frame.position.z
)

rotation = Euler(
  rotationX + frame.rotationRadians.x,
  rotationY + frame.rotationRadians.y,
  rotationZ + frame.rotationRadians.z,
  "XYZ"
)

scale = placement.scale * frame.scaleMultiplier
```

The preview-space parent converts the evaluated result into MindAR coordinates. The existing manual scan-only Y/Z animation mapping is removed.

## Data flow and compatibility

The saved Worker/R2 record shape does not change. `placement`, `localPlacement`, `groups`, text content/style, and animation tracks keep their current meanings. The correction occurs only when constructing the scan scene, so every existing target automatically receives the fixed rendering.

No API, authentication, sharing-permission, or target URL behavior changes.

## Error handling

Model load failures keep the existing fallback object. The fallback is attached inside preview-space so its placement follows the same authored coordinates. Text font-loading behavior remains unchanged. Invalid or missing placement and animation data continue through the existing normalization functions before scene construction.

## Verification strategy

Automated tests will cover the boundary directly:

1. Static ungrouped model parity: scan roots retain the same local position, Euler rotation, and scale as preview roots beneath the single basis group.
2. World-coordinate mapping: representative preview points map to `(x, -z, y)`, proving the lower/upper and near/far order is not inverted.
3. Combined rotation parity: compare the scan world quaternion with the preview quaternion transformed by the preview-space basis.
4. Text parity: verify text uses the preview-space parent and that its world up/front directions match the transformed preview directions.
5. Group parity: verify group placement plus child-local placement produces the transformed preview world matrix.
6. Animation parity: at deterministic elapsed times, compare preview and scan local position, quaternion, and scale before the shared basis transform.
7. Model normalization parity: feed the same source bounds through preview and scan loaders and assert the same normalized bounds.
8. Regression suite and production build: run the focused tests, full `npm test`, and `npm run build`.
9. Deployment smoke: publish through the existing GitHub Pages workflow, verify the deployed asset, open the saved scan URL, and confirm the camera reaches its active state.

Physical target verification remains the final visual confirmation because the automated environment cannot hold the printed target in front of the camera. The transform-parity tests provide deterministic proof independent of camera pose.

## Out of scope

- Locking AR objects to a fixed screen-space camera composition.
- Changing the preview camera controls or saved preview camera position.
- Migrating or rewriting saved target records.
- Changing sharing permissions, authentication, target URLs, or Worker storage.
