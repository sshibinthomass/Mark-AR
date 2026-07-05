# Mark AR

Marker based Web AR app built with Vite, TypeScript, Three.js, and MindAR image tracking.

## What It Does

- Scans the generated `Aurora Gate` marker and places a crystal tower object on it.
- Scans the generated `Orbit Key` marker and places an orbit beacon object on it.
- Keeps the generated marker images in `public/markers/`.
- Compiles those marker images into MindAR tracking data in the browser at AR startup.

## Run Locally

```powershell
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

Open the local URL shown by Vite. Camera access works on `localhost` or an HTTPS URL.

## Markers

The generated marker images are:

- `public/markers/aurora-gate.svg`
- `public/markers/orbit-key.svg`

Open either file in a browser or print it, then use `Start AR` in the app.

## Checks

```powershell
npm test
npm run build
```

For GitHub Pages builds, the workflow sets:

```powershell
$env:GITHUB_PAGES = "true"
npm run build
```
