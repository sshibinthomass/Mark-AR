const browserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);

export default browserFetch;
export const Headers = globalThis.Headers;
export const Request = globalThis.Request;
export const Response = globalThis.Response;
