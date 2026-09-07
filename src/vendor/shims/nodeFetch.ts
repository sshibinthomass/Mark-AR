/*
 * The vendored MindAR bundle carries TF.js's Node backend, which reaches for
 * `node-fetch` only when `global.fetch` is missing -- unreachable in a browser.
 * This exists so the bundler can resolve that import at all.
 */
const browserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);

export default browserFetch;
