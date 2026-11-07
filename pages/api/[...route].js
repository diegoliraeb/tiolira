export { default } from '../../server/handler.mjs';
// The handler authenticates privileged requests and applies per-route byte limits.
export const config = { api: { bodyParser: false } };

export const maxDuration = 90;
