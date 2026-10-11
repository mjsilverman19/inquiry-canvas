export const STORAGE = 'inquiry-canvas-v2';
export const uid = () => crypto.randomUUID();
export const emptySession = () => ({ version: 2, title: 'Untitled inquiry', nodes: [] });
export function ancestors(nodes, id) {
  const path = [], seen = new Set();
  while (id && !seen.has(id)) {
    seen.add(id);
    const node = nodes.find(n => n.id === id);
    if (!node) break;
    path.unshift(node); id = node.parentId;
  }
  return path;
}
export function contextFor(nodes, id) {
  return ancestors(nodes, id).map(n => `${n.type === 'question' ? 'Question' : 'Answer'}: ${n.content}`).join('\n\n').slice(-10000);
}
export function layout(nodes) {
  const points = new Map(); let leaf = 0;
  const visit = (node, depth) => {
    const children = nodes.filter(n => n.parentId === node.id);
    const xs = children.map(n => visit(n, depth + 1));
    const x = xs.length ? (xs[0] + xs.at(-1)) / 2 : leaf++ * 280 + 32;
    points.set(node.id, { x, y: depth * 155 + 32 }); return x;
  };
  nodes.filter(n => !n.parentId).forEach(n => visit(n, 0));
  return { points, width: Math.max(800, leaf * 280 + 64), height: Math.max(520, ...[...points.values()].map(p => p.y + 180)) };
}
export function validateSession(value) {
  if (value?.version !== 2 || !Array.isArray(value.nodes) || value.nodes.length > 2000) throw new Error('This is not an Inquiry Canvas export.');
  const ids = new Set();
  for (const n of value.nodes) {
    if (!n || typeof n.id !== 'string' || ids.has(n.id) || !['question', 'answer'].includes(n.type) || typeof n.content !== 'string' || typeof n.title !== 'string') throw new Error('Invalid inquiry node.');
    if (n.parentId != null && !ids.has(n.parentId)) throw new Error('Invalid branch connection.');
    if (n.framings != null && (!Array.isArray(n.framings) || n.framings.some(f => typeof f.title !== 'string' || typeof f.sketch !== 'string'))) throw new Error('Invalid framings.');
    for (const key of ['concepts', 'suggestions']) if (n[key] != null && (!Array.isArray(n[key]) || n[key].some(x => typeof x !== 'string'))) throw new Error(`Invalid ${key}.`);
    if (n.tensions != null && (!Array.isArray(n.tensions) || n.tensions.some(t => typeof t.title !== 'string' || typeof t.content !== 'string'))) throw new Error('Invalid tensions.');
    ids.add(n.id);
  }
  return { version: 2, title: typeof value.title === 'string' ? value.title : 'Imported inquiry', nodes: value.nodes };
}
export function parseResult(text) {
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/```(?:json)?/g, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start < 0) throw new Error('The model returned an incomplete response. Retry or write an answer yourself.');
  try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { throw new Error('The model returned invalid JSON. Retry or write an answer yourself.'); }
}
export const EXAMPLE = { version: 2, title: 'What makes a city worth living in?', nodes: [
  { id: 'q1', type: 'question', title: 'What makes a city worth living in?', content: 'What makes a city worth living in?', parentId: null, framings: [{ title: 'Everyday life', sketch: 'Start with the conditions that let ordinary days go well.' }, { title: 'Political agency', sketch: 'Ask who can shape the city and whose preferences count.' }, { title: 'Belonging', sketch: 'Examine the relationships and institutions that make a place feel like home.' }] },
  { id: 'a1', type: 'answer', parentId: 'q1', title: 'A city measured in ordinary days', framing: 'Everyday life', content: 'One useful starting point is the ordinary day: whether housing, movement, work, care, and sociability can coexist without consuming all of a person’s time or income. A city’s attractions matter less if the conditions of access exclude the people who sustain it.\n\nThis makes proximity and affordability joint requirements. Density can put more opportunities within reach, yet scarcity can make that reach expensive. The question becomes how a city distributes both access and the power to remain.', concepts: ['access', 'belonging'], tensions: [{ title: 'Proximity versus affordability', content: 'The neighborhoods with the richest access can become the least accessible to people with low incomes.' }], suggestions: ['Who should have the power to shape a neighborhood?', 'Can density improve access without displacement?'] },
  { id: 'q2', type: 'question', parentId: 'a1', title: 'Who gets to shape the neighborhood?', content: 'Who should have the power to shape a neighborhood?' },
  { id: 'a2', type: 'answer', parentId: 'q2', title: 'Residents, newcomers, and absent voices', framing: 'Political agency', content: 'Current residents have knowledge and attachments that planning should respect. They also occupy a position that prospective residents cannot share: a formal voice in decisions about homes they may never be allowed to inhabit.\n\nA defensible process would represent those who live there, those who work there, and those excluded by the existing arrangements. Participation alone does not settle the question; the constituency of participation matters.', concepts: ['access', 'political agency'], tensions: [{ title: 'Belonging versus exclusion', content: 'Protecting a community can preserve relationships while closing the door to people who would join it.' }], suggestions: ['How could planning represent prospective residents?'] },
  { id: 'q3', type: 'question', parentId: 'a1', title: 'Can density avoid displacement?', content: 'Can density improve access without displacement?' },
  { id: 'a3', type: 'answer', parentId: 'q3', title: 'More homes and a right to remain', framing: 'Housing institutions', content: 'Adding homes and protecting existing residents address different parts of the problem. Supply can reduce scarcity over time, while tenant protections and nonmarket housing address who bears the costs of change.\n\nThe relevant comparison is between institutional packages, rather than density in isolation. A city can accommodate newcomers while treating continuity for existing residents as a design constraint.', concepts: ['access', 'belonging'], tensions: [], suggestions: ['What institutions make a right to remain practical?'] },
] };
