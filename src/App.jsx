import { useRef, useState } from 'react';
import { ancestors, contextFor, emptySession, EXAMPLE, layout, STORAGE, uid, validateSession } from './inquiry';
import { connectAI, disconnectAI, generate, initialAccessCode, initialEndpoint } from './ai';

function restore() { try { const value = localStorage.getItem(STORAGE); return value ? validateSession(JSON.parse(value)) : emptySession(); } catch { return emptySession(); } }
export default function App() {
  const [session, setSession] = useState(restore);
  const [selectedId, setSelectedId] = useState(null);
  const [parentId, setParentId] = useState(null);
  const [input, setInput] = useState('');
  const [manual, setManual] = useState('');
  const [tab, setTab] = useState('canvas');
  const [concept, setConcept] = useState(null);
  const [settings, setSettings] = useState(false);
  const [endpoint, setEndpoint] = useState(initialEndpoint);
  const [accessCode, setAccessCode] = useState(initialAccessCode);
  const [modelName, setModelName] = useState('');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [saveError, setSaveError] = useState('');
  const fileRef = useRef(null), inputRef = useRef(null), lock = useRef(false);
  const nodes = session.nodes;
  const selected = nodes.find(n => n.id === selectedId);
  const { points, width, height } = layout(nodes);
  const path = new Set(ancestors(nodes, selectedId).map(n => n.id));
  const concepts = [...new Set(nodes.flatMap(n => n.concepts || []))];
  const tensions = nodes.flatMap(n => (n.tensions || []).map(t => ({ ...t, node: n })));
  const update = next => {
    setSession(next);
    try { localStorage.setItem(STORAGE, JSON.stringify(next)); setSaveError(''); } catch { setSaveError('This browser could not save the inquiry. Export a copy before closing.'); }
  };
  const add = node => update({ ...session, title: nodes.length ? session.title : node.title, nodes: [...nodes, node] });
  const run = async (label, task) => {
    if (lock.current) return;
    lock.current = true; setBusy(label); setError('');
    try { await task(); } catch (e) { setError(e.message); } finally { lock.current = false; setBusy(''); }
  };
  const ask = async (text = input, parent = parentId, ai = ready) => {
    if (!text.trim() || lock.current) return;
    const q = { id: uid(), type: 'question', title: text.trim().slice(0, 85), content: text.trim(), parentId: parent };
    add(q); setSelectedId(q.id); setConcept(null); setInput(''); setManual(''); setTab('canvas');
    if (ai) await run('Finding framings', async () => {
      const framings = await generate('framings', contextFor(nodes, parent), q.content);
      update({ ...session, title: nodes.length ? session.title : q.title, nodes: [...nodes, { ...q, framings }] });
    });
  };
  const answer = (q, framing = null) => run('Developing an answer', async () => {
    const hint = framing === 'all' ? `Synthesize these framings: ${(q.framings || []).map(f => `${f.title}: ${f.sketch}`).join('; ')}` : framing ? `${framing.title}: ${framing.sketch}` : '';
    const result = await generate('answer', contextFor(nodes, q.parentId), q.content, hint);
    const a = { ...result, id: uid(), type: 'answer', parentId: q.id, framing: framing === 'all' ? 'Synthesis' : framing?.title || 'Direct' };
    add(a); setSelectedId(a.id); setParentId(a.id); setManual('');
  });
  const focusBranch = id => { setParentId(id); setConcept(null); inputRef.current?.focus(); };
  const replace = next => { update(next); setSelectedId(null); setParentId(null); setConcept(null); setError(''); setInput(''); setManual(''); };
  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'inquiry.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importFile = async e => {
    const file = e.target.files[0]; e.target.value = ''; if (!file) return;
    try {
      if (file.size > 10000000) throw new Error('Choose an export smaller than 10 MB.');
      const next = validateSession(JSON.parse(await file.text()));
      if (nodes.length && !window.confirm('Replace the current inquiry? Export it first if you want to keep it.')) return;
      replace(next);
    } catch (e) { setError(e.message); }
  };
  const select = id => { setSelectedId(id); setConcept(null); setManual(''); };
  const card = n => <button className={`node ${n.type} ${selectedId === n.id ? 'selected' : ''} ${concept && !n.concepts?.includes(concept) ? 'faded' : ''}`} key={n.id} onClick={() => select(n.id)} style={{ left: points.get(n.id)?.x, top: points.get(n.id)?.y }}><span className="kind">{n.type}{n.framing ? ` · ${n.framing}` : ''}</span><span className="node-title">{n.title}</span><span className="excerpt">{n.content}</span>{n.tensions?.length > 0 && <span className="node-foot">{n.tensions.length} unresolved tension{n.tensions.length > 1 ? 's' : ''}</span>}</button>;
  return <div className="app">
    <header><h1>Inquiry Canvas</h1><nav aria-label="Views">{['canvas', 'threads', 'tensions'].map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}{t === 'threads' ? ` ${concepts.length}` : t === 'tensions' ? ` ${tensions.length}` : ''}</button>)}</nav><div className="tools"><button disabled={!!busy} onClick={() => { if (!nodes.length || window.confirm('Start a new inquiry? Export this one to keep a copy.')) replace(emptySession()); }}>new</button><button onClick={exportFile}>export</button><button disabled={!!busy} onClick={() => fileRef.current.click()}>import</button><button aria-expanded={settings} onClick={() => setSettings(!settings)}>AI {ready ? 'ready' : 'settings'}</button></div></header>
    <input type="file" accept="application/json,.json" ref={fileRef} hidden onChange={importFile} />
    {settings && <section className="settings" aria-label="AI settings"><div><h2>Hosted AI</h2><p>Connect once, then ask questions without a model download or a personal API key.</p><p className="dim">Questions and ancestor context are sent to the hosted model. Your inquiry is saved in this browser. Answers have no live web search or verified citations.</p><p className="dim">{ready ? `Connected · ${modelName}` : 'The owner must deploy and configure the backend before AI can be used.'}</p></div><div><label htmlFor="endpoint">Backend URL</label><input id="endpoint" type="url" value={endpoint} disabled={!!busy || ready} onChange={e => setEndpoint(e.target.value)} placeholder="https://your-backend.vercel.app/api/inquiry" /><label htmlFor="access-code">Access code</label><input id="access-code" type="password" value={accessCode} disabled={!!busy || ready} onChange={e => setAccessCode(e.target.value)} autoComplete="off" placeholder="Provided by the owner" /><p className="dim">The access code is kept for this tab session. It is separate from the owner's AI credentials.</p><button className="action" disabled={!!busy} onClick={() => ready ? (disconnectAI(), setReady(false), setAccessCode(''), setModelName('')) : run('Connecting hosted AI', async () => { setReady(false); const name = await connectAI(endpoint, accessCode); setModelName(name); setReady(true); })}>{ready ? 'Disconnect' : 'Connect hosted AI'}</button></div><button className="close" onClick={() => setSettings(false)} aria-label="Close AI settings">×</button></section>}
    <div className="session-bar"><span>{session.title}</span><span className="dim">{nodes.filter(n => n.type === 'question').length} questions · {nodes.filter(n => n.type === 'answer').length} answers · {ready ? 'hosted AI' : 'manual canvas'}</span></div>
    {error && <div className="notice" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}{saveError && <div className="notice" role="alert">{saveError}</div>}
    <div className="workspace"><main>
      {!nodes.length ? <div className="empty"><h2>A question can lead in more than one direction.</h2><p>Choose how to frame it. Follow a thread. Return to a path you left open.</p><div><button className="action" onClick={() => setSettings(true)}>Connect hosted AI</button><button onClick={() => replace(structuredClone(EXAMPLE))}>Explore an example ↗</button></div><p className="dim">You can also write questions and answers yourself. This inquiry is saved in this browser.</p></div> : tab === 'canvas' ? <div className="canvas" aria-label="Inquiry graph"><div className="graph" style={{ width, height }}><svg width={width} height={height} aria-hidden="true">{nodes.filter(n => n.parentId && points.has(n.parentId)).map(n => { const p = points.get(n.parentId), c = points.get(n.id); return <path key={n.id} className={path.has(n.id) ? 'active-edge' : ''} d={`M ${p.x + 116} ${p.y + 116} C ${p.x + 116} ${p.y + 138}, ${c.x + 116} ${c.y - 22}, ${c.x + 116} ${c.y}`} />; })}</svg>{nodes.map(card)}</div></div> : tab === 'threads' ? <section className="list"><h2>Conceptual threads</h2><p className="dim">Recurring concepts connect answers across branches.</p>{!concepts.length && <p>No concepts yet. AI answers will identify them.</p>}{concepts.map(c => <button className="list-row" key={c} onClick={() => { setConcept(c); setSelectedId(null); }}><span>{c}</span><span className="dim">{nodes.filter(n => n.concepts?.includes(c)).length} answers →</span></button>)}</section> : <section className="list"><h2>Unresolved tensions</h2><p className="dim">Each tension can become a new branch.</p>{!tensions.length && <p>No tensions identified yet.</p>}{tensions.map((t, i) => <div className="tension-row" key={i}><button onClick={() => select(t.node.id)}>{t.title}</button><p>{t.content}</p><button disabled={!!busy} onClick={() => ask(`Explore this tension: ${t.title}. ${t.content}`, t.node.id)}>Open a branch →</button></div>)}</section>}
    </main><aside>
      <div className="inspector">
        {concept ? <><span className="kind">Conceptual thread</span><h2>{concept}</h2>{nodes.filter(n => n.concepts?.includes(concept)).map(n => <button className="list-row" key={n.id} onClick={() => select(n.id)}>{n.title} →</button>)}<p className="dim">Compare how this concept works in each answer.</p><button disabled={!!busy} onClick={() => ask(`Synthesize the concept "${concept}" across these answers, comparing their claims and unresolved questions:\n\n${nodes.filter(n => n.concepts?.includes(concept)).map(n => `${n.title}: ${n.content}`).join('\n\n')}`, null)}>Synthesize this thread →</button></> : selected ? <><div className="inspector-heading"><span className="kind">{selected.type}{selected.framing ? ` · ${selected.framing}` : ''}</span><button onClick={() => setSelectedId(null)} aria-label="Close selection">×</button></div><h2>{selected.title}</h2>{selected.content.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
          {selected.type === 'question' ? <><h3>Available framings</h3>{selected.framings?.map((f, i) => <button className="framing" disabled={!!busy || !ready} key={i} onClick={() => answer(selected, f)}><span>{f.title}</span><span className="dim">{f.sketch}</span><small>{nodes.some(n => n.parentId === selected.id && n.framing === f.title) ? 'Explore again →' : 'Take this path →'}</small></button>)}{!selected.framings?.length && <p className="dim">Connect AI to discover framings, or write an answer below.</p>}<div className="inline-actions"><button disabled={!!busy || !ready} onClick={() => run('Finding framings', async () => { const framings = await generate('framings', contextFor(nodes, selected.parentId), selected.content); update({ ...session, nodes: nodes.map(n => n.id === selected.id ? { ...n, framings } : n) }); })}>{selected.framings?.length ? 'Refresh framings' : 'Find framings'}</button><button disabled={!!busy || !ready} onClick={() => answer(selected, selected.framings?.length ? 'all' : null)}>{selected.framings?.length ? 'Synthesize all →' : 'Answer directly →'}</button></div><label htmlFor="manual">Your own answer</label><textarea id="manual" value={manual} disabled={!!busy} onChange={e => setManual(e.target.value)} placeholder="Add a claim, a note, or an answer…" rows={4} /><button className="action" disabled={!!busy || !manual.trim()} onClick={() => { const a = { id: uid(), type: 'answer', parentId: selected.id, title: manual.trim().slice(0, 70), content: manual.trim(), framing: 'Your note', concepts: [], tensions: [], suggestions: [] }; add(a); setSelectedId(a.id); setParentId(a.id); setManual(''); }}>Add answer →</button></> : <><div className="tags">{selected.concepts?.map(c => <button key={c} onClick={() => { setConcept(c); setSelectedId(null); }}>{c}</button>)}</div><button className="action" disabled={!!busy} onClick={() => focusBranch(selected.id)}>Fork from here →</button>{selected.tensions?.map((t, i) => <div className="tension-row" key={i}><span className="kind">Tension</span><h3>{t.title}</h3><p>{t.content}</p><button disabled={!!busy} onClick={() => ask(`Explore this tension: ${t.title}. ${t.content}`, selected.id)}>Open a branch →</button></div>)}{selected.suggestions?.length > 0 && <><h3>Next directions</h3>{selected.suggestions.map(s => <button disabled={!!busy} className="list-row" key={s} onClick={() => ask(s, selected.id)}>{s} →</button>)}</>}</>}
        </> : <><span className="kind">Inquiry</span><h2>{nodes.length ? 'Follow a path' : 'Start with a question'}</h2><p>{nodes.length ? 'Select a question to revisit its framings, or an answer to inspect its concepts and tensions.' : 'The canvas keeps your questions, answers, and alternative directions together.'}</p><p className="dim">Branches inherit the context of their ancestors. Other branches remain available for comparison.</p>{!ready && <button onClick={() => setSettings(true)}>Connect hosted AI →</button>}</>}
      </div>
      <form className="composer" onSubmit={e => { e.preventDefault(); ask(); }}><div className="branch-label"><span>{parentId ? `From: ${nodes.find(n => n.id === parentId)?.title || 'selected answer'}` : 'New root question'}</span>{parentId && <button type="button" disabled={!!busy} onClick={() => setParentId(null)}>clear</button>}</div><label className="sr-only" htmlFor="question">Question</label><textarea id="question" ref={inputRef} value={input} disabled={!!busy} onChange={e => setInput(e.target.value)} placeholder="Continue the inquiry…" rows={3} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(); } }} /><div className="composer-foot"><span role="status">{busy || (ready ? 'Hosted AI connected' : 'AI not connected')}</span><button className="action" disabled={!!busy || !input.trim()}>{ready ? 'Ask →' : 'Add question →'}</button></div></form>
    </aside></div><footer><span>Saved on this device · export to keep a copy</span><a href="https://github.com/mjsilverman19/inquiry-canvas">source ↗</a></footer>
  </div>;
}
