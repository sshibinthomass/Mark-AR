import type { MarkerSpec } from '../ar/markerCatalog';
import {
  DEFAULT_TARGET_TEXT,
  TEXT_FILL_MODE_OPTIONS,
  TEXT_FONT_OPTIONS,
  TEXT_GRADIENT_DIRECTION_OPTIONS,
  TEXT_LANGUAGE_OPTIONS,
  TEXT_STYLE_PRESETS,
} from '../app/targetEditorObjects';
import { hrefForRoute, type AppRoute } from './pageRoutes';

type ModeCard = {
  route: AppRoute;
  badge: string;
  title: string;
  text: string;
  action: string;
};

const modeCards: ModeCard[] = [
  {
    route: 'scan',
    badge: 'AR',
    title: 'Scan marker',
    text: 'Open the marker camera and place the selected model on a tracked image.',
    action: 'Open scanner',
  },
  {
    route: 'base',
    badge: 'IMG',
    title: 'Base image',
    text: 'Capture or upload an image and let the Cloudflare Worker process it with OpenAI.',
    action: 'Prepare base',
  },
  {
    route: 'models',
    badge: '3D',
    title: 'Models',
    text: 'Load all Cloudflare-hosted GLB models and choose the object for marker AR.',
    action: 'Choose model',
  },
  {
    route: 'targets',
    badge: 'IMG+3D',
    title: 'Image targets',
    text: 'Upload a target image, bind it to Cloudflare models, and save it to the cloud.',
    action: 'Create target',
  },
  {
    route: 'markers',
    badge: 'MK',
    title: 'Markers',
    text: 'Download the generated marker images used by the MindAR scanner.',
    action: 'View markers',
  },
  {
    route: 'account',
    badge: 'ID',
    title: 'Account',
    text: 'Sign in to the Web-AR Worker for protected image processing routes.',
    action: 'Sign in',
  },
];

export function renderAppShell(markers: MarkerSpec[]): string {
  return `
    <main class="app-shell" data-app-shell>
      <nav class="shell-nav" aria-label="Marker AR pages">
        <a class="brand-link" href="${hrefForRoute('home')}" data-route-link="home">Marker AR studio</a>
        <div class="route-tabs">
          ${renderRouteLink('scan', 'Scan')}
          ${renderRouteLink('base', 'Base')}
          ${renderRouteLink('models', 'Models')}
          ${renderRouteLink('targets', 'Targets')}
          ${renderRouteLink('markers', 'Markers')}
          ${renderRouteLink('account', 'Account')}
        </div>
      </nav>

      <section class="page landing-page" data-page="home" aria-label="Marker AR studio home">
        <div class="landing-inner">
          <div class="landing-copy">
            <p class="landing-kicker">Marker Web AR</p>
            <h1>Marker AR studio</h1>
            <p>Prepare a processed base image, choose a Cloudflare 3D model, and scan a generated marker to place it in AR.</p>
            <div class="landing-flow" aria-label="Marker AR workflow">
              <div class="landing-flow-step">
                <span>01</span>
                <strong>Base</strong>
                <small>Capture image</small>
              </div>
              <div class="landing-flow-step">
                <span>02</span>
                <strong>Model</strong>
                <small>Select GLB</small>
              </div>
              <div class="landing-flow-step">
                <span>03</span>
                <strong>Marker</strong>
                <small>Scan and place</small>
              </div>
            </div>
          </div>
          <div class="landing-preview" aria-hidden="true">
            <div class="preview-stage">
              <span class="preview-floor"></span>
              <span class="preview-marker"></span>
              <span class="preview-object"></span>
            </div>
            <p><strong>Cloudflare ready</strong><span>Models load from the Web-AR Worker.</span></p>
          </div>
          <div class="mode-picker" aria-label="Workflow options">
            ${modeCards.map(renderModeCard).join('')}
          </div>
        </div>
      </section>

      <section class="page" data-page="scan" hidden aria-label="Marker scanner">
        ${renderPageHeader('Scan marker', 'Use the generated markers to anchor your selected Cloudflare model.')}
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
      </section>

      <section class="page" data-page="base" hidden aria-label="Capture base image">
        ${renderPageHeader('Base image', 'Capture or upload an image, then process it through the Web-AR Worker.')}
        <section class="tool-card capture-card">
          <div class="tool-card-head">
            <p class="eyebrow">Base image</p>
            <p id="base-image-status">Capture a surface to process</p>
          </div>
          <video id="base-capture-video" class="capture-video" playsinline muted></video>
          <div class="button-row">
            <button id="start-base-camera" type="button">Start camera</button>
            <button id="process-base-image" class="primary" type="button">Process base</button>
          </div>
          <label class="file-control">
            <span>Or choose image</span>
            <input id="base-image-file" type="file" accept="image/*" />
          </label>
          <img id="processed-base-preview" class="base-preview" alt="Processed base preview" hidden />
        </section>
      </section>

      <section class="page" data-page="models" hidden aria-label="Cloudflare 3D models">
        ${renderPageHeader('Models', 'Choose the 3D object that will appear above the processed base image.')}
        <section class="tool-card model-card">
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
      </section>

      <section class="page target-page" data-page="targets" hidden aria-label="Cloud image targets">
        ${renderPageHeader('Image targets', 'Upload a scan image, place models above it, and save the pairing to Cloudflare.')}
        <section class="target-workspace">
          <div class="target-preview-shell">
            <div class="target-transform-toolbar" aria-label="Transform tools">
              <button type="button" data-transform-mode="translate" aria-pressed="true">Move</button>
              <button type="button" data-transform-mode="rotate" aria-pressed="false">Rotate</button>
              <button type="button" data-transform-mode="scale" aria-pressed="false">Scale</button>
            </div>
            <div id="target-preview-stage" class="target-preview-stage" aria-label="3D target preview"></div>
            <div id="target-camera-gizmo" class="target-camera-gizmo" aria-label="Camera view controls">
              <button type="button" class="gizmo-button gizmo-button-up" data-camera-nudge="up" aria-label="Move view up" title="Move view up"><span class="gizmo-arrow gizmo-arrow-up" aria-hidden="true"></span></button>
              <button type="button" class="gizmo-button gizmo-button-left" data-camera-nudge="left" aria-label="Move view left" title="Move view left"><span class="gizmo-arrow gizmo-arrow-left" aria-hidden="true"></span></button>
              <button type="button" class="gizmo-button gizmo-button-right" data-camera-nudge="right" aria-label="Move view right" title="Move view right"><span class="gizmo-arrow gizmo-arrow-right" aria-hidden="true"></span></button>
              <button type="button" class="gizmo-button gizmo-button-down" data-camera-nudge="down" aria-label="Move view down" title="Move view down"><span class="gizmo-arrow gizmo-arrow-down" aria-hidden="true"></span></button>
            </div>
            <div id="target-model-rail" class="target-model-rail" role="listbox" aria-label="Cloudflare models">
              <p class="target-model-rail-empty">Loading models...</p>
            </div>
          </div>

          <section class="tool-card target-inspector-card target-setup-card">
            <div class="tool-card-head target-inspector-head">
              <p class="eyebrow">Cloud target</p>
              <p id="image-target-status">Sign in, choose an image, and select a model.</p>
            </div>
            <div class="target-inspector-tabs" role="tablist" aria-label="Target editor sections">
              <button type="button" id="target-tab-target" role="tab" data-target-inspector-tab="target" aria-selected="true" aria-controls="target-inspector-target">Target</button>
              <button type="button" id="target-tab-objects" role="tab" data-target-inspector-tab="objects" aria-selected="false" aria-controls="target-inspector-objects">Objects</button>
              <button type="button" id="target-tab-text" role="tab" data-target-inspector-tab="text" aria-selected="false" aria-controls="target-inspector-text">Text</button>
              <button type="button" id="target-tab-transform" role="tab" data-target-inspector-tab="transform" aria-selected="false" aria-controls="target-inspector-transform">Transform</button>
              <button type="button" id="target-tab-animation" role="tab" data-target-inspector-tab="animation" aria-selected="false" aria-controls="target-inspector-animation">Animation</button>
            </div>
            <div class="target-inspector-panels">
              <section id="target-inspector-target" class="target-inspector-panel" role="tabpanel" data-target-inspector-panel="target" aria-labelledby="target-tab-target">
                <div class="target-setup-fields">
                  <label>
                    <span>Target label</span>
                    <input id="target-label" type="text" value="" aria-label="Target label" />
                  </label>
                  <label class="file-control">
                    <span>Target image</span>
                    <input id="target-image-file" type="file" accept="image/png,image/jpeg,image/webp" />
                  </label>
                  <label class="target-model-select-sentinel" hidden aria-hidden="true">
                    <span>Cloudflare model</span>
                    <select id="target-model-select">
                      <option value="">Loading models...</option>
                    </select>
                  </label>
                </div>
                <div class="button-row target-save-strip">
                  <button id="save-image-target" class="primary" type="button">Save target</button>
                  <button id="refresh-image-targets" type="button">Refresh targets</button>
                </div>
                <div class="saved-target-compact">
                  <div class="tool-card-head">
                    <p class="eyebrow">Saved</p>
                    <p>Cloud image targets</p>
                  </div>
                  <div id="saved-image-target-list" class="saved-target-list"></div>
                </div>
              </section>

              <section id="target-inspector-objects" class="target-inspector-panel" role="tabpanel" data-target-inspector-panel="objects" aria-labelledby="target-tab-objects" hidden>
                <div class="object-action-row">
                  <button id="add-target-object" type="button">Add object</button>
                  <button id="remove-target-object" type="button">Remove object</button>
                </div>
                <div id="target-object-list" class="target-object-list" role="list" aria-label="Placed 3D objects"></div>
              </section>

              <section id="target-inspector-text" class="target-inspector-panel" role="tabpanel" data-target-inspector-panel="text" aria-labelledby="target-tab-text" hidden>
                <div class="target-text-panel">
                  <label>
                    <span>Text content</span>
                    <textarea id="target-text-value" rows="2" aria-label="Text content">${TEXT_LANGUAGE_OPTIONS[0].sample}</textarea>
                  </label>
                  <div class="target-text-quick-grid">
                    <label>
                      <span>Style preset</span>
                      <select id="target-text-preset">
                        ${TEXT_STYLE_PRESETS.map((option) => (
                          `<option value="${option.id}">${option.label}</option>`
                        )).join('')}
                      </select>
                    </label>
                    <label>
                      <span>Language</span>
                      <select id="target-text-language">
                        ${TEXT_LANGUAGE_OPTIONS.map((option) => (
                          `<option value="${option.id}">${option.label}</option>`
                        )).join('')}
                      </select>
                    </label>
                    <label>
                      <span>Font</span>
                      <select id="target-text-font">
                        ${TEXT_FONT_OPTIONS.map((option) => (
                          `<option value="${option.id}">${option.label}</option>`
                        )).join('')}
                      </select>
                    </label>
                  </div>
                  <button id="add-target-text" type="button">Add text</button>
                  <details class="target-text-advanced">
                    <summary>Customize style</summary>
                    <div class="target-text-options">
                      <label class="target-text-color-control target-style-swatch-field">
                        <span>Color</span>
                        <input id="target-text-color" type="color" value="${DEFAULT_TARGET_TEXT.color}" aria-label="Text color" />
                      </label>
                      <label>
                        <span>Fill</span>
                        <select id="target-text-fill-mode">
                          ${TEXT_FILL_MODE_OPTIONS.map((option) => (
                            `<option value="${option.id}">${option.label}</option>`
                          )).join('')}
                        </select>
                      </label>
                      <label class="target-text-color-control target-style-swatch-field">
                        <span>Gradient A</span>
                        <input id="target-text-gradient-start" type="color" value="${DEFAULT_TARGET_TEXT.gradientStart}" aria-label="Gradient start color" />
                      </label>
                      <label class="target-text-color-control target-style-swatch-field">
                        <span>Gradient B</span>
                        <input id="target-text-gradient-end" type="color" value="${DEFAULT_TARGET_TEXT.gradientEnd}" aria-label="Gradient end color" />
                      </label>
                      <label>
                        <span>Direction</span>
                        <select id="target-text-gradient-direction">
                          ${TEXT_GRADIENT_DIRECTION_OPTIONS.map((option) => (
                            `<option value="${option.id}">${option.label}</option>`
                          )).join('')}
                        </select>
                      </label>
                      <label class="target-text-color-control target-style-swatch-field">
                        <span>Side</span>
                        <input id="target-text-side-color" type="color" value="${DEFAULT_TARGET_TEXT.sideColor}" aria-label="Side color" />
                      </label>
                      <label>
                        <span>Depth</span>
                        <input id="target-text-depth" type="range" min="0.02" max="0.16" step="0.005" value="${DEFAULT_TARGET_TEXT.depth}" />
                      </label>
                      <label>
                        <span>Bevel</span>
                        <input id="target-text-bevel" type="range" min="0" max="0.024" step="0.001" value="${DEFAULT_TARGET_TEXT.bevel}" />
                      </label>
                      <label>
                        <span>Gloss</span>
                        <input id="target-text-gloss" type="range" min="0" max="1" step="0.01" value="${DEFAULT_TARGET_TEXT.gloss}" />
                      </label>
                    </div>
                  </details>
                </div>
              </section>

              <section id="target-inspector-transform" class="target-inspector-panel" role="tabpanel" data-target-inspector-panel="transform" aria-labelledby="target-tab-transform" hidden>
                <div class="tool-card-head target-controls-head">
                  <p class="eyebrow">Adjust placement</p>
                  <p>Selected object controls</p>
                </div>
                <div class="transform-control-stack">
                  <div class="transform-control-group">
                    <div class="transform-control-head">
                      <p class="eyebrow">Move</p>
                      <button type="button" data-reset-transform="move" data-reset-axis="all">Reset move</button>
                    </div>
                    <div class="placement-grid">
                      <div class="axis-control">
                        <label><span>X offset</span><input id="target-offset-x" type="range" min="-1" max="1" step="0.05" value="0" /></label>
                        <button type="button" data-reset-transform="move" data-reset-axis="x" title="Reset move X">X</button>
                      </div>
                      <div class="axis-control">
                        <label><span>Y height</span><input id="target-height" type="range" min="0" max="1" step="0.02" value="0.12" /></label>
                        <button type="button" data-reset-transform="move" data-reset-axis="y" title="Reset move Y">Y</button>
                      </div>
                      <div class="axis-control">
                        <label><span>Z offset</span><input id="target-offset-y" type="range" min="-1" max="1" step="0.05" value="0" /></label>
                        <button type="button" data-reset-transform="move" data-reset-axis="z" title="Reset move Z">Z</button>
                      </div>
                    </div>
                  </div>
                  <div class="transform-control-group">
                    <div class="transform-control-head">
                      <p class="eyebrow">Rotate</p>
                      <button type="button" data-reset-transform="rotate" data-reset-axis="all">Reset rotate</button>
                    </div>
                    <div class="placement-grid">
                      <div class="axis-control">
                        <label><span>Rotate X</span><input id="target-rotation-x" type="range" min="-180" max="180" step="1" value="0" /></label>
                        <button type="button" data-reset-transform="rotate" data-reset-axis="x" title="Reset rotate X">X</button>
                      </div>
                      <div class="axis-control">
                        <label><span>Rotate Y</span><input id="target-rotation-y" type="range" min="-180" max="180" step="1" value="0" /></label>
                        <button type="button" data-reset-transform="rotate" data-reset-axis="y" title="Reset rotate Y">Y</button>
                      </div>
                      <div class="axis-control">
                        <label><span>Rotate Z</span><input id="target-rotation-z" type="range" min="-180" max="180" step="1" value="0" /></label>
                        <button type="button" data-reset-transform="rotate" data-reset-axis="z" title="Reset rotate Z">Z</button>
                      </div>
                    </div>
                  </div>
                  <div class="transform-control-group">
                    <div class="transform-control-head">
                      <p class="eyebrow">Scale</p>
                      <button type="button" data-reset-transform="scale" data-reset-axis="all">Reset scale</button>
                    </div>
                    <div class="placement-grid">
                      <div class="axis-control">
                        <label><span>Overall</span><input id="target-scale" type="range" min="0.1" max="5" step="0.1" value="1" /></label>
                        <button type="button" data-reset-transform="scale" data-reset-axis="all" title="Reset overall scale">Overall</button>
                      </div>
                    </div>
                  </div>
                </div>
                <div class="control-section">
                  <p class="eyebrow">Camera view</p>
                  <div class="placement-grid">
                    <label><span>Distance</span><input id="target-camera-distance" type="range" min="0.8" max="5" step="0.05" value="2.1" /></label>
                    <label><span>View height</span><input id="target-camera-height" type="range" min="0.1" max="3" step="0.05" value="1.1" /></label>
                    <label><span>Orbit</span><input id="target-camera-yaw" type="range" min="-180" max="180" step="1" value="0" /></label>
                    <label><span>Look height</span><input id="target-camera-target" type="range" min="-0.5" max="1.5" step="0.02" value="0" /></label>
                  </div>
                </div>
              </section>

              <section id="target-inspector-animation" class="target-inspector-panel" role="tabpanel" data-target-inspector-panel="animation" aria-labelledby="target-tab-animation" hidden>
                <div class="tool-card-head target-controls-head">
                  <p class="eyebrow">Animate object</p>
                  <p>Selected object motion</p>
                </div>
                <div class="control-section">
                  <p class="eyebrow">Animation</p>
                  <label>
                    <span>Spin axis</span>
                    <select id="target-spin-axis" value="y">
                      <option value="none">None</option>
                      <option value="x">X</option>
                      <option value="y" selected>Y</option>
                      <option value="z">Z</option>
                    </select>
                  </label>
                  <div class="placement-grid">
                    <label><span>Spin speed</span><input id="target-spin-speed" type="range" min="-6" max="6" step="0.05" value="0" /></label>
                    <label><span>Bob height</span><input id="target-bob-height" type="range" min="0" max="1" step="0.02" value="0" /></label>
                    <label><span>Bob speed</span><input id="target-bob-speed" type="range" min="0" max="8" step="0.05" value="0" /></label>
                    <button id="reset-target-animation" type="button">Reset animation</button>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </section>
      </section>

      <section id="markers" class="page marker-page" data-page="markers" hidden aria-label="Generated marker images">
        ${renderPageHeader('Markers', 'Print or display one of these markers before starting the scanner.')}
        <div class="marker-panel">
          ${markers.map(renderMarkerCard).join('')}
        </div>
      </section>

      <section class="page" data-page="account" hidden aria-label="Web AR Worker login">
        ${renderPageHeader('Account', 'Use your approved Web-AR Worker login for protected OpenAI processing.')}
        <section class="tool-card worker-card">
          <div class="tool-card-head">
            <p class="eyebrow">Web-AR Worker</p>
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
              <button id="worker-login" class="primary" type="submit">Sign in</button>
              <button id="worker-logout" type="button">Sign out</button>
            </div>
          </form>
        </section>
      </section>
    </main>
  `;
}

function renderRouteLink(route: AppRoute, label: string): string {
  return `<a href="${hrefForRoute(route)}" data-route-link="${route}">${label}</a>`;
}

function renderPageHeader(title: string, text: string): string {
  return `
    <header class="page-header">
      <a class="page-back" href="${hrefForRoute('home')}">Back</a>
      <div>
        <p class="eyebrow">Marker Web AR</p>
        <h2>${title}</h2>
        <p>${text}</p>
      </div>
    </header>
  `;
}

function renderModeCard(card: ModeCard): string {
  return `
    <a class="mode-card" href="${hrefForRoute(card.route)}">
      <span>${card.badge}</span>
      <strong>${card.title}</strong>
      <small>${card.text}</small>
      <em>${card.action}</em>
    </a>
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
