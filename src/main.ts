import './style.css';
import { AR_MARKERS } from './ar/markerCatalog';
import { startMarkerAR, type MarkerARSession } from './ar/mindarRuntime';
import { renderAppShell } from './ui/appShell';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App root not found');
}

app.innerHTML = renderAppShell(AR_MARKERS);

const stage = document.querySelector<HTMLDivElement>('#ar-stage');
const startButton = document.querySelector<HTMLButtonElement>('#start-ar');
const status = document.querySelector<HTMLParagraphElement>('#ar-status');
let session: MarkerARSession | undefined;

if (!stage || !startButton || !status) {
  throw new Error('AR shell controls not found');
}

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  status.textContent = 'Preparing marker targets';
  session?.stop();
  stage.replaceChildren();

  try {
    session = await startMarkerAR(stage, {
      onCompileProgress: (percent) => {
        status.textContent = `Preparing marker targets ${Math.round(percent)}%`;
      },
      onMarkerVisibility: ({ marker, visible }) => {
        status.textContent = visible ? `${marker.label} active` : 'Scan marker';
      },
      onReady: () => {
        status.textContent = 'Scan marker';
      },
    });
    startButton.textContent = 'Restart AR';
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to start AR';
    status.textContent = message;
  } finally {
    startButton.disabled = false;
  }
});
