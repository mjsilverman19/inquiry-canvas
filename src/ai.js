import { parseResult } from './inquiry';
export const MODELS = [
  { id: 'Qwen3.5-4B-q4f16_1-MLC', label: 'Qwen 3.5 · 4B', note: 'More capable · about 3.9 GB GPU memory' },
  { id: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC', label: 'Qwen 2.5 · 1.5B', note: 'Lighter · about 1.9 GB GPU memory' },
];
let engine, worker;
export async function loadModel(model, onProgress) {
  if (!navigator.gpu) throw new Error('Browser AI needs WebGPU. Try a recent Chrome or Edge on a desktop, or use the manual canvas.');
  if (!await navigator.gpu.requestAdapter()) throw new Error('No compatible GPU is available. The manual canvas still works.');
  if (engine) { await engine.unload(); engine = null; }
  worker?.terminate();
  const { CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
  worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
  engine = await CreateWebWorkerMLCEngine(worker, model, { initProgressCallback: onProgress });
}
export async function generate(kind, context, question, framing = '') {
  if (!engine) throw new Error('Load a browser model in AI settings first, or add a question and answer by hand.');
  const schema = kind === 'framings'
    ? '{"framings":[{"title":"short name","sketch":"one sentence explaining this distinct approach"}]}'
    : '{"title":"short answer title","paragraphs":["paragraph","paragraph"],"concepts":["concept"],"tensions":[{"title":"short name","content":"specific unresolved tension with an earlier claim"}],"suggestions":["a next question","another distinct next question"]}';
  const instruction = kind === 'framings' ? 'Offer 3 substantively different ways to frame the question before answering.' : 'Answer in 2-4 substantive paragraphs. Identify 2-3 conceptual threads, genuine tensions with prior claims (or an empty array), and 2 distinct next questions. Do not invent citations. State uncertainty where warranted.';
  const response = await engine.chat.completions.create({
    messages: [{ role: 'system', content: `You help an expert explore an intellectual inquiry. ${instruction} Return only valid JSON matching ${schema}. Avoid bullets and em-dashes.` }, { role: 'user', content: `Ancestor context (other branches excluded):\n${context || '(new inquiry)'}\n\nQuestion: ${question}\nFraming: ${framing || 'Consider the question on its merits.'}\n/no_think` }],
    max_tokens: kind === 'framings' ? 500 : 1500, temperature: 0.6,
  });
  const result = parseResult(response.choices[0].message.content || '');
  if (kind === 'framings') {
    if (!Array.isArray(result.framings) || !result.framings.length) throw new Error('No framings returned. Retry or answer directly.');
    const framings = result.framings.filter(f => typeof f.title === 'string' && typeof f.sketch === 'string').slice(0, 4);
    if (!framings.length) throw new Error('No valid framings returned. Retry or answer directly.');
    return framings;
  }
  if (!Array.isArray(result.paragraphs) || !result.paragraphs.some(p => typeof p === 'string' && p.trim())) throw new Error('No answer returned. Retry or write your own.');
  return { title: typeof result.title === 'string' ? result.title : 'Answer', content: result.paragraphs.filter(p => typeof p === 'string').join('\n\n'), concepts: Array.isArray(result.concepts) ? [...new Set(result.concepts.filter(c => typeof c === 'string').map(c => c.toLowerCase().trim()).filter(Boolean))].slice(0, 5) : [], tensions: Array.isArray(result.tensions) ? result.tensions.filter(t => typeof t.title === 'string' && typeof t.content === 'string').slice(0, 3) : [], suggestions: Array.isArray(result.suggestions) ? result.suggestions.filter(s => typeof s === 'string').slice(0, 3) : [] };
}
