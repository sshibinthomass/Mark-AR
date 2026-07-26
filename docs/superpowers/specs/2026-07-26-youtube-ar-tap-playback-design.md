# YouTube AR Tap Playback Design

## Goal

Make a saved YouTube object respond to a tap in both image-marker AR and
markerless floor AR. The thumbnail remains a draggable 3D object in Studio and
becomes an inline YouTube player at its placed transform only after a viewer
taps it in AR.

## Confirmed Root Causes

### Image-marker AR

`startMarkerAR` attaches its `pointerup` listener to the MindAR WebGL canvas.
After the camera starts, `normalizeMindARCameraLayers` deliberately sets that
canvas to `pointer-events: none` so the camera and AR layers stack correctly.
The browser therefore cannot deliver the viewer's tap to the listener.

### Markerless floor AR

`FloorPlacementRuntime` creates the same target scene, including YouTube
surfaces, but never registers those surfaces with `YouTubePlayerManager`.
Its tap gesture only attempts floor placement, so a placed video object has no
playback path.

## Behavior

### Shared behavior

- A YouTube object initially renders as its thumbnail and play indicator.
- A tap that raycasts to a visible YouTube plane replaces that thumbnail with
  an inline YouTube player and starts playback.
- A tap outside a YouTube plane keeps the existing AR gesture behavior.
- The player is removed and paused when its marker/session is lost, stopped, or
  disposed.
- Player initialization failures restore the thumbnail and report a visible
  scanner status instead of failing silently.
- Images, text, models, transforms, and animation behavior remain unchanged.

### Image-marker AR

- Listen for the initial playback tap on the AR stage container, not on the
  non-interactive MindAR canvas.
- Calculate normalized pointer coordinates against the canvas bounds so
  raycasting continues to match the rendered camera.
- Ignore playback taps originating inside an already-active YouTube iframe or
  other interactive controls.

### Markerless floor AR

- Create a `YouTubePlayerManager` only when the target contains YouTube
  objects.
- Register the floor target's YouTube surfaces when its scene is created.
- Mark those surfaces interactive only after the target has been placed.
- On a floor gesture tap, attempt YouTube activation before treating the tap as
  a placement gesture. A video hit consumes the tap; a miss preserves the
  existing placement behavior.
- Render and resize the CSS3D player layer alongside the WebXR scene and dispose
  it with the floor session.
- Use the existing WebXR DOM overlay root. Android Chrome is the supported
  markerless browser; if the player cannot initialize, report that failure and
  retain the thumbnail.

## Component Changes

### `src/ar/youtubePlayerManager.ts`

- Accept an optional playback-error callback.
- Keep hit testing and player lifecycle shared by marker and floor runtimes.
- Expose no floor-specific behavior.

### `src/ar/mindarRuntime.ts`

- Move the tap listener to the stage container.
- Guard interactive descendants.
- Forward playback failures through a new optional runtime hook.

### `src/ar/floorPlacementRuntime.ts`

- Own a YouTube manager for the active floor session.
- Register surfaces and route taps before placement.
- Update, resize, hide, and dispose the player layer with session lifecycle.

### `src/main.ts`

- Forward marker and floor playback failures to the existing scanner status
  surface.

## Error Handling

- YouTube API load, unavailable-video, and embed-disabled errors continue to use
  the manager's existing messages.
- Both AR modes surface the message through scanner status.
- Failed activation restores the thumbnail and does not corrupt later taps.

## Testing

Automated regression coverage will prove:

1. Marker AR receives taps from the stage even while the canvas is
   non-interactive and removes the listener on stop.
2. Taps from interactive player descendants are not reprocessed.
3. Floor AR registers YouTube surfaces and marks them visible only after
   placement.
4. A floor tap on a video activates playback without moving/replacing the
   placement.
5. A floor tap that misses the video preserves existing placement behavior.
6. Player errors are forwarded and cleanup remains idempotent.
7. The full existing test suite and production build remain green.

Browser verification will exercise a saved YouTube-only target in both modes
where the environment supports the required camera/WebXR capability. The
in-app browser can verify DOM player creation and event routing; physical-camera
and immersive-WebXR behavior must additionally be validated on Android Chrome
when those device capabilities are unavailable in the test browser.
