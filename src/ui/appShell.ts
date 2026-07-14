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
    title: 'Scan target',
    text: 'Open the camera and place saved target objects in AR.',
    action: 'Open scanner',
  },
  {
    route: 'targets',
    badge: 'IMG+3D',
    title: 'Image targets',
    text: 'Upload a target image, bind it to Cloudflare models, and save it to the cloud.',
    action: 'Create target',
  },
  {
    route: 'account',
    badge: 'ID',
    title: 'Account',
    text: 'Sign in to the Web-AR Worker for protected image processing routes.',
    action: 'Sign in',
  },
];

export function renderAppShell(): string {
  return `
    <main class="app-shell" data-app-shell>
      <nav class="shell-nav" aria-label="Marker AR pages">
        <a class="brand-link" href="${hrefForRoute('home')}" data-route-link="home">Marker AR studio</a>
        <div class="route-tabs">
          ${renderRouteLink('scan', 'Scan')}
          ${renderRouteLink('targets', 'Targets')}
          ${renderRouteLink('account', '<span data-auth-account-label>Sign in</span>')}
        </div>
      </nav>

      <section class="page landing-page" data-page="home" aria-label="Marker AR studio home">
        <div class="landing-inner">
          <div class="landing-copy">
            <p class="landing-kicker">Marker Web AR</p>
            <h1>Marker AR studio</h1>
            <p>Create cloud image targets, place Cloudflare models above them, and scan the saved target in AR.</p>
            <div class="landing-flow" aria-label="Marker AR workflow">
              <div class="landing-flow-step">
                <span>01</span>
                <strong>Target</strong>
                <small>Upload image</small>
              </div>
              <div class="landing-flow-step">
                <span>02</span>
                <strong>Objects</strong>
                <small>Place GLB</small>
              </div>
              <div class="landing-flow-step">
                <span>03</span>
                <strong>AR</strong>
                <small>Scan target</small>
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
        ${renderPageHeader('Scan target', 'Use saved cloud image targets to anchor placed objects in AR.')}
        <div class="scanner-panel">
          <div id="ar-stage" class="ar-stage" aria-label="AR camera stage">
            <div class="stage-idle">
              <span>Scan target</span>
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

      <section class="page target-page" data-page="targets" hidden aria-label="Cloud image targets">
        ${renderPageHeader('Image targets', 'Upload a scan image, place models above it, and save the pairing to Cloudflare.')}
        <section class="target-workspace">
          <div class="target-preview-shell">
            <div class="target-preview-controls">
              <div class="target-transform-toolbar" aria-label="Transform tools">
                <button type="button" data-transform-mode="translate" aria-pressed="true">Move</button>
                <button type="button" data-transform-mode="rotate" aria-pressed="false">Rotate</button>
                <button type="button" data-transform-mode="scale" aria-pressed="false">Scale</button>
              </div>
              <div class="target-camera-view-controls" aria-label="Camera view">
                <div class="target-camera-view-head">
                  <p class="eyebrow">Camera view</p>
                  <div class="target-camera-preset-row" aria-label="Camera presets">
                    <button type="button" data-camera-preset="reset">Reset</button>
                    <button type="button" data-camera-preset="front">Front</button>
                    <button type="button" data-camera-preset="left">Left</button>
                    <button type="button" data-camera-preset="right">Right</button>
                    <button type="button" data-camera-preset="top">Top</button>
                  </div>
                </div>
                <div class="target-camera-view-grid">
                  <label><span>Distance</span><input id="target-camera-distance" type="range" min="0.8" max="5" step="0.05" value="2.1" /></label>
                  <label><span>View height</span><input id="target-camera-height" type="range" min="0.1" max="3" step="0.05" value="1.1" /></label>
                  <label><span>Orbit</span><input id="target-camera-yaw" type="range" min="-180" max="180" step="1" value="0" /></label>
                  <label><span>Look height</span><input id="target-camera-target" type="range" min="-0.5" max="1.5" step="0.02" value="0" /></label>
                </div>
              </div>
            </div>
            <div id="target-preview-stage" class="target-preview-stage" aria-label="3D target preview"></div>
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
              <button type="button" id="target-tab-object-controls" role="tab" data-target-inspector-tab="object-controls" aria-selected="false" aria-disabled="true" aria-controls="target-inspector-object-controls" disabled>Object</button>
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
                <div class="target-object-toolbar">
                  <p>Ctrl/Command-click to select more than one object.</p>
                  <button id="group-selected-objects" type="button" disabled>Group selected</button>
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
                </div>
              </section>

              <section id="target-inspector-object-controls" class="target-inspector-panel" role="tabpanel" data-target-inspector-panel="object-controls" aria-labelledby="target-tab-object-controls" hidden>
                <div class="tool-card-head target-controls-head">
                  <p class="eyebrow">Object controls</p>
                  <p>Transform and animation</p>
                </div>
                <details class="target-text-advanced" data-selected-text-style hidden>
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
                <div class="transform-control-stack">
                  <details class="transform-control-group" data-control-group="move">
                    <summary class="transform-control-summary"><span class="eyebrow">Move</span></summary>
                    <div class="transform-control-body">
                      <div class="transform-control-actions">
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
                  </details>
                  <details class="transform-control-group" data-control-group="rotate">
                    <summary class="transform-control-summary"><span class="eyebrow">Rotate</span></summary>
                    <div class="transform-control-body">
                      <div class="transform-control-actions">
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
                  </details>
                  <details class="transform-control-group" data-control-group="scale">
                    <summary class="transform-control-summary"><span class="eyebrow">Scale</span></summary>
                    <div class="transform-control-body">
                      <div class="transform-control-actions">
                        <button type="button" data-reset-transform="scale" data-reset-axis="all">Reset scale</button>
                      </div>
                      <div class="placement-grid">
                        <div class="axis-control">
                          <label><span>Overall</span><input id="target-scale" type="range" min="0.1" max="5" step="0.1" value="1" /></label>
                          <button type="button" data-reset-transform="scale" data-reset-axis="all" title="Reset overall scale">Overall</button>
                        </div>
                      </div>
                    </div>
                  </details>
                  <details class="transform-control-group" data-control-group="animation">
                    <summary class="transform-control-summary"><span class="eyebrow">Animation</span></summary>
                    <div class="transform-control-body">
                      <label>
                        <span>Preset</span>
                        <select id="target-animation-preset">
                          <option value="mixed" disabled hidden>Mixed</option>
                          <option value="none" selected>None</option>
                          <option value="gentle-float">Gentle float</option>
                          <option value="turntable">Turntable</option>
                          <option value="showcase">Showcase</option>
                          <option value="sway">Sway</option>
                          <option value="pulse">Pulse</option>
                          <option value="orbit">Orbit</option>
                          <option value="bounce">Bounce</option>
                          <option value="custom">Custom</option>
                        </select>
                      </label>
                      <div class="animation-track-toolbar">
                        <div>
                          <strong>Fine-tune motion</strong>
                          <span>Combine position, rotation, and scale.</span>
                        </div>
                        <button id="add-target-animation-track" type="button">+ Add motion</button>
                      </div>
                      <div id="target-animation-tracks" class="animation-track-list" aria-live="polite"></div>
                      <div class="animation-track-footer">
                        <button id="reset-target-animation" type="button">Reset animation</button>
                      </div>
                    </div>
                  </details>
                </div>
              </section>
            </div>
          </section>
        </section>
      </section>

      <section class="page" data-page="account" hidden aria-label="Web AR Worker login">
        ${renderPageHeader('Account', 'Sign in to create and manage cloud image targets.')}
        <section class="auth-layout">
          <aside class="auth-access-card" aria-label="Image Targets access status">
            <div class="auth-orbit" aria-hidden="true">
              <span></span>
              <i></i>
            </div>
            <div class="auth-access-copy">
              <p class="eyebrow">Image Targets access</p>
              <h3>Your cloud workspace stays protected.</h3>
              <p>Sign in with your Web-AR account to upload target images, place 3D objects, and save the result.</p>
            </div>
            <div class="auth-access-state">
              <span class="auth-access-dot" aria-hidden="true"></span>
              <span>
                <small>Workspace</small>
                <strong data-auth-access-label>Locked</strong>
              </span>
            </div>
          </aside>

          <section class="tool-card worker-card auth-control-card">
            <div class="tool-card-head auth-card-head">
              <p class="eyebrow">Web-AR account</p>
              <h3 data-auth-form-heading>Continue to Marker AR studio</h3>
              <p id="worker-status" data-auth-mode-help aria-live="polite">Sign in with an approved account to use Image Targets.</p>
            </div>

            <div data-auth-panel="signed-out">
              <div class="auth-form-shell" data-auth-form-mode="login">
                <div class="auth-mode-switch" role="group" aria-label="Account action">
                  <button type="button" data-auth-mode="login" aria-pressed="true">Sign in</button>
                  <button type="button" data-auth-mode="signup" aria-pressed="false">Create account</button>
                </div>
                <form id="worker-login-form" class="login-form">
                  <label data-auth-name-field hidden>
                    <span>Name</span>
                    <input id="worker-name" name="name" type="text" autocomplete="name" placeholder="Your name" disabled />
                  </label>
                  <label>
                    <span>Email</span>
                    <input id="worker-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required />
                  </label>
                  <label>
                    <span>Password</span>
                    <input id="worker-password" name="password" type="password" minlength="8" autocomplete="current-password" required />
                  </label>
                  <button id="worker-login" class="primary auth-primary-action" type="submit"><span data-auth-submit-label>Sign in</span></button>
                </form>
              </div>
            </div>

            <div class="auth-checking" data-auth-panel="checking" hidden aria-live="polite">
              <span class="auth-spinner" aria-hidden="true"></span>
              <strong>Checking your saved session</strong>
              <p>This only takes a moment.</p>
            </div>

            <div class="auth-signed-in" data-auth-panel="signed-in" hidden>
              <div class="auth-identity">
                <span class="auth-avatar" aria-hidden="true">ID</span>
                <span>
                  <small>Signed in as</small>
                  <strong data-auth-email></strong>
                </span>
              </div>
              <a class="auth-primary-action primary-link" href="${hrefForRoute('targets')}" data-auth-open-targets>
                Open Image Targets
              </a>
              <div class="auth-signout-row">
                <span>Finished on this device?</span>
                <button id="worker-logout" type="button">Sign out</button>
              </div>
            </div>
          </section>
        </section>
      </section>
    </main>
  `;
}

function renderRouteLink(route: AppRoute, label: string): string {
  if (route === 'targets') {
    return `<a href="${hrefForRoute('account')}" data-route-link="targets" data-auth-protected data-auth-locked="true" data-unlocked-href="${hrefForRoute('targets')}" aria-disabled="true" title="Sign in with an approved account to use Image Targets">${label}</a>`;
  }
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
  const protectedAttributes = card.route === 'targets'
    ? `href="${hrefForRoute('account')}" data-auth-protected data-auth-locked="true" data-unlocked-href="${hrefForRoute('targets')}" aria-disabled="true" title="Sign in with an approved account to use Image Targets"`
    : `href="${hrefForRoute(card.route)}"`;
  const actionAttribute = card.route === 'targets'
    ? ' data-auth-protected-label'
    : card.route === 'account'
      ? ' data-auth-account-action'
      : '';
  return `
    <a class="mode-card" ${protectedAttributes}>
      <span>${card.badge}</span>
      <strong>${card.title}</strong>
      <small>${card.text}</small>
      <em${actionAttribute}>${card.route === 'targets' ? 'Sign in to unlock' : card.action}</em>
    </a>
  `;
}
