import type { MarkerSpec } from '../ar/markerCatalog';
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
    text: 'Upload a target image, bind it to a Cloudflare model, and save it to the cloud.',
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

      <section class="page" data-page="targets" hidden aria-label="Cloud image targets">
        ${renderPageHeader('Image targets', 'Upload a scan image, place a model above it, and save the pairing to Cloudflare.')}
        <section class="target-workspace">
          <div class="target-editor">
            <section class="tool-card">
              <div class="tool-card-head">
                <p class="eyebrow">Cloud target</p>
                <p id="image-target-status">Sign in, choose an image, and select a model.</p>
              </div>
              <label>
                <span>Target label</span>
                <input id="target-label" type="text" value="" aria-label="Target label" />
              </label>
              <label class="file-control">
                <span>Target image</span>
                <input id="target-image-file" type="file" accept="image/png,image/jpeg,image/webp" />
              </label>
              <label>
                <span>Cloudflare model</span>
                <select id="target-model-select">
                  <option value="">Loading models...</option>
                </select>
              </label>
              <div class="placement-grid">
                <label><span>Scale</span><input id="target-scale" type="range" min="0.1" max="5" step="0.1" value="1" /></label>
                <label><span>X offset</span><input id="target-offset-x" type="range" min="-1" max="1" step="0.05" value="0" /></label>
                <label><span>Y offset</span><input id="target-offset-y" type="range" min="-1" max="1" step="0.05" value="0" /></label>
                <label><span>Height</span><input id="target-height" type="range" min="0" max="1" step="0.02" value="0.12" /></label>
              </div>
              <div class="button-row">
                <button id="save-image-target" class="primary" type="button">Save target</button>
                <button id="refresh-image-targets" type="button">Refresh targets</button>
              </div>
            </section>
            <section class="tool-card saved-target-card">
              <div class="tool-card-head">
                <p class="eyebrow">Saved</p>
                <p>Cloud image targets</p>
              </div>
              <div id="saved-image-target-list" class="saved-target-list"></div>
            </section>
          </div>
          <div id="target-preview-stage" class="target-preview-stage" aria-label="3D target preview"></div>
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
