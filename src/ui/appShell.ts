import type { MarkerSpec } from '../ar/markerCatalog';

export function renderAppShell(markers: MarkerSpec[]): string {
  return `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Marker Web AR</p>
          <h1>Scan and place</h1>
        </div>
        <a class="repo-link" href="#markers">Markers</a>
      </header>

      <section class="scanner-layout" aria-label="Marker based augmented reality scanner">
        <div class="scanner-panel">
          <div id="ar-stage" class="ar-stage" aria-label="AR camera stage">
            <div class="stage-idle">
              <span>Scan marker</span>
            </div>
          </div>
          <div class="scanner-controls" aria-live="polite">
            <div>
              <span class="status-label">Status</span>
              <p id="ar-status">Camera waiting</p>
            </div>
            <button id="start-ar" type="button">Start AR</button>
          </div>
        </div>

        <aside class="workspace-panel" aria-label="AR setup controls">
          <section class="tool-card worker-card" aria-label="Web AR Worker login">
            <div class="tool-card-head">
              <p class="eyebrow">Cloudflare Worker</p>
              <p id="worker-status">Public models loading</p>
            </div>
            <form id="worker-login-form" class="login-form">
              <label>
                <span>Email</span>
                <input id="worker-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" />
              </label>
              <label>
                <span>Password</span>
                <input id="worker-password" name="password" type="password" autocomplete="current-password" />
              </label>
              <div class="button-row">
                <button id="worker-login" type="submit">Sign in</button>
                <button id="worker-logout" type="button">Sign out</button>
              </div>
            </form>
          </section>

          <section class="tool-card capture-card" aria-label="Capture base image">
            <div class="tool-card-head">
              <p class="eyebrow">Base image</p>
              <p id="base-image-status">Capture a surface to process</p>
            </div>
            <video id="base-capture-video" class="capture-video" playsinline muted></video>
            <div class="button-row">
              <button id="start-base-camera" type="button">Start camera</button>
              <button id="process-base-image" type="button">Process base</button>
            </div>
            <label class="file-control">
              <span>Or choose image</span>
              <input id="base-image-file" type="file" accept="image/*" />
            </label>
            <img id="processed-base-preview" class="base-preview" alt="Processed base preview" hidden />
          </section>

          <section class="tool-card model-card" aria-label="Cloudflare 3D models">
            <div class="tool-card-head">
              <p class="eyebrow">3D object</p>
              <p id="cloudflare-model-status">No model selected</p>
            </div>
            <label>
              <span>Cloudflare models</span>
              <select id="cloudflare-model-select">
                <option value="">Loading models...</option>
              </select>
            </label>
            <button id="reload-cloudflare-models" type="button">Refresh models</button>
          </section>

          <section id="markers" class="marker-panel" aria-label="Generated marker images">
            ${markers.map(renderMarkerCard).join('')}
          </section>
        </aside>
      </section>
    </main>
  `;
}

function renderMarkerCard(marker: MarkerSpec): string {
  return `
    <article class="marker-card">
      <img src="${marker.imagePath}" alt="${marker.label} marker image" width="280" height="280" />
      <div>
        <p class="marker-index">Target ${String(marker.targetIndex + 1).padStart(2, '0')}</p>
        <h2>${marker.label}</h2>
        <a href="${marker.imagePath}" download="${marker.id}.svg">Download</a>
      </div>
    </article>
  `;
}
