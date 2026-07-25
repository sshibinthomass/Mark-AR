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
npm run worker:check
```

For GitHub Pages builds, the workflow sets:

```powershell
$env:GITHUB_PAGES = "true"
npm run build
```

## Target API and Cloud Image Storage

This repository now includes the Cloudflare Worker used for authentication, model
listing, target CRUD/scan access, and image storage in R2. Target images and image
objects are copied into the `ASSET_BUCKET` R2 bucket; external image URLs are
validated and imported before a target is saved.

1. Copy `.dev.vars.example` to `.dev.vars` and set a strong `AUTH_SECRET`.
2. Update the bucket and Worker names in `wrangler.jsonc`.
3. Run the Worker locally with `npm run worker:dev`.
4. Point the Vite app at it with `VITE_TARGET_API_URL`, including `/generate-3d`.

For example:

```powershell
$env:VITE_TARGET_API_URL = "http://localhost:8787/generate-3d"
npm run dev
```

Before deploying, replace `PUBLIC_ORIGIN` in `wrangler.jsonc` with the deployed
Worker origin, create the configured R2 bucket, and add `AUTH_SECRET` with
`npx wrangler secret put AUTH_SECRET`.
