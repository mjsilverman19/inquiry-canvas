export function parseResult(text) {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start < 0) throw new Error('The model returned an incomplete response. Retry or write an answer yourself.');
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { throw new Error('The model returned invalid JSON. Retry or write an answer yourself.'); }
}
export function normalizeResult(kind, result) {
  if (kind === 'framings') {
    const framings = Array.isArray(result?.framings) ? result.framings.filter(f => f && typeof f.title === 'string' && typeof f.sketch === 'string').slice(0, 4) : [];
    if (!framings.length) throw new Error('No valid framings returned. Retry or answer directly.');
    return { framings };
  }
  const paragraphs = Array.isArray(result?.paragraphs) ? result.paragraphs.filter(p => typeof p === 'string' && p.trim()) : [];
  if (!paragraphs.length) throw new Error('No answer returned. Retry or write your own.');
  return {
    title: typeof result.title === 'string' ? result.title : 'Answer', paragraphs,
    concepts: Array.isArray(result.concepts) ? [...new Set(result.concepts.filter(c => typeof c === 'string').map(c => c.toLowerCase().trim()).filter(Boolean))].slice(0, 5) : [],
    tensions: Array.isArray(result.tensions) ? result.tensions.filter(t => t && typeof t.title === 'string' && typeof t.content === 'string').slice(0, 3) : [],
    suggestions: Array.isArray(result.suggestions) ? result.suggestions.filter(s => typeof s === 'string').slice(0, 3) : [],
  };
}
