import { normalizeResult } from '../backend/lib/results.js';
const ENDPOINT_STORAGE = 'inquiry-canvas-api-url';
const ACCESS_STORAGE = 'inquiry-canvas-access';
let connection = null;
export function initialEndpoint() {
  try { return localStorage.getItem(ENDPOINT_STORAGE) || import.meta.env.VITE_INQUIRY_API_URL || 'https://inquiry-canvas-api.vercel.app/api/inquiry'; } catch { return import.meta.env.VITE_INQUIRY_API_URL || 'https://inquiry-canvas-api.vercel.app/api/inquiry'; }
}
export function initialAccessCode() { try { return sessionStorage.getItem(ACCESS_STORAGE) || ''; } catch { return ''; } }
export function validateEndpoint(value) {
  let url; try { url = new URL(value.trim()); } catch { throw new Error('Enter the full hosted backend URL, ending in /api/inquiry.'); }
  if (url.username || url.password || url.search || url.hash || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))) throw new Error('Use an HTTPS backend URL without embedded credentials.');
  if (url.pathname === '/' || !url.pathname) url.pathname = '/api/inquiry';
  return url.href;
}
async function request(config, body) {
  let response;
  try { response = await fetch(config.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.code}` }, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) }); }
  catch (e) { throw new Error(e.name === 'TimeoutError' ? 'The AI backend took too long. Try again.' : 'Could not reach the AI backend. Check its URL and allowed origin.', { cause: e }); }
  let data; try { data = await response.json(); } catch { throw new Error('The backend did not return JSON. Check its URL and deployment protection.'); }
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The hosted AI request failed.');
  return data;
}
export async function connectAI(endpoint, code) {
  connection = null;
  if (!code.trim()) throw new Error('Enter the access code provided by the owner.');
  const config = { endpoint: validateEndpoint(endpoint), code: code.trim() };
  const data = await request(config, { kind: 'connect' });
  if (!data.ready) throw new Error('The hosted AI backend is not ready.');
  connection = config;
  try { localStorage.setItem(ENDPOINT_STORAGE, config.endpoint); sessionStorage.setItem(ACCESS_STORAGE, config.code); } catch { /* Connection remains usable for this tab. */ }
  return data.model || 'Hosted model';
}
export function disconnectAI() { connection = null; try { sessionStorage.removeItem(ACCESS_STORAGE); } catch { /* No stored code. */ } }
export async function generate(kind, context, question, framing = '') {
  if (!connection) throw new Error('Connect hosted AI in settings first, or write an answer yourself.');
  const data = await request(connection, { kind, context, question, framing });
  const result = normalizeResult(kind, data.result);
  if (kind === 'framings') return result.framings;
  return { ...result, content: result.paragraphs.join('\n\n') };
}
