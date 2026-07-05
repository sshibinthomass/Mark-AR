import type { MarkerSpec } from '../ar/markerCatalog';

export function renderAppShell(markers: MarkerSpec[]): string {
  return `
    <main class="app-shell">
      <header class="topbar">
        <div>
          <p class="eyebrow">Marker Web AR</p>
          <h1>Scan marker</h1>
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

        <aside id="markers" class="marker-panel" aria-label="Generated marker images">
          ${markers.map(renderMarkerCard).join('')}
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
