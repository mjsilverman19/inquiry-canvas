import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const TYPE_STYLES = {
  question: { bg: "#1a1814", border: "#c9a94a", accent: "#c9a94a", label: "QUESTION" },
  answer: { bg: "#14171a", border: "#7a8b99", accent: "#9bb0c0", label: "ANSWER" },
  ghost: { bg: "#14130f", border: "#5a5246", accent: "#9b9080", label: "FRAMING" },
  suggestion: { bg: "#14130f", border: "#7a6f5a", accent: "#c9a94a", label: "NEXT?" },
  tension: { bg: "#1a1714", border: "#b87a3a", accent: "#d99a5a", label: "TENSION" }
};

const MODELS = {
  fast: { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5", note: "fastest" },
  balanced: { id: "claude-sonnet-4-6", label: "Sonnet 4.6", note: "balanced" },
  deep: { id: "claude-opus-4-7", label: "Opus 4.7", note: "deepest" },
};

const KEY_STORAGE = "inquiry-canvas-anthropic-key";

const callClaude = async (apiKey, systemPrompt, userMessage, modelId, maxTokens = 1500) => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error("API error:", response.status, errText);
      return { error: `API ${response.status}: ${errText.slice(0, 200)}` };
    }
    const data = await response.json();
    const text = data.content?.filter(b => b.type === "text").map(b => b.text).join("\n") || "";
    return { text };
  } catch (err) {
    console.error("API error:", err);
    return { error: err.message || "Network error" };
  }
};

const parseJSON = (text) => {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try { return JSON.parse(match[0]); } catch (e2) { return null; }
    }
    return null;
  }
};

function KeyEntry({ onSubmit }) {
  const [val, setVal] = useState("");
  const [showVal, setShowVal] = useState(false);
  return (
    <div className="w-full h-screen bg-[#0d0c0a] text-[#e8e4d8] flex items-center justify-center"
         style={{ fontFamily: "'Crimson Pro', 'Iowan Old Style', Georgia, serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
        .mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>
      <div className="max-w-md w-full px-8">
        <div className="mono text-[10px] tracking-[0.2em] text-[#7a6f5a] uppercase mb-3">Inquiry Canvas</div>
        <h1 className="text-2xl italic text-[#e8e4d8] mb-2">Bring your own key</h1>
        <p className="text-sm italic text-[#9b9080] leading-relaxed mb-6">
          This canvas calls the Anthropic API directly from your browser using your own key.
          The key stays in your browser&rsquo;s local storage and is sent only to api.anthropic.com.
          Nothing is logged on any server.
        </p>
        <p className="text-[12px] italic text-[#7a6f5a] leading-relaxed mb-4">
          Get a key at <span className="mono text-[#c9a94a]">console.anthropic.com</span>. You will need credit on the account.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type={showVal ? "text" : "password"}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && val.trim()) onSubmit(val.trim()); }}
            placeholder="sk-ant-..."
            className="mono flex-1 bg-[#14130f] border border-[#2a2620] focus:border-[#c9a94a] outline-none px-3 py-2 text-sm text-[#e8e4d8] placeholder-[#5a5246]"
          />
          <button
            onClick={() => setShowVal(s => !s)}
            className="mono text-[10px] tracking-wider uppercase text-[#7a6f5a] hover:text-[#c9a94a] border border-[#2a2620] px-3"
          >
            {showVal ? "hide" : "show"}
          </button>
        </div>
        <button
          onClick={() => val.trim() && onSubmit(val.trim())}
          disabled={!val.trim()}
          className="w-full mono text-[10px] tracking-wider uppercase text-[#c9a94a] hover:text-[#e8e4d8] border border-[#c9a94a] px-3 py-2 hover:bg-[#c9a94a]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Begin →
        </button>
        <p className="text-[10px] italic text-[#5a5246] leading-relaxed mt-4">
          The key is saved in localStorage on this device only. To clear it later, click &ldquo;key&rdquo; in the header.
        </p>
      </div>
    </div>
  );
}

export default function InquiryCanvasLive() {
  const [apiKey, setApiKey] = useState(() => {
    try { return localStorage.getItem(KEY_STORAGE) || ""; } catch (e) { return ""; }
  });
  const [nodes, setNodes] = useState([]);
  const [concepts, setConcepts] = useState([]);
  const [tensions, setTensions] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [dismissedSuggestions, setDismissedSuggestions] = useState([]);
  const [ghosts, setGhosts] = useState([]);
  const [droppedGhosts, setDroppedGhosts] = useState([]);
  const [userInput, setUserInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [selectedId, setSelectedId] = useState(null);
  const [highlightedConcept, setHighlightedConcept] = useState(null);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const [forkFromId, setForkFromId] = useState(null);
  const [error, setError] = useState(null);
  const [answerModel, setAnswerModel] = useState("balanced");
  const [conceptDeepDive, setConceptDeepDive] = useState(null);
  const [isDeepening, setIsDeepening] = useState(false);
  const inputRef = useRef(null);
  const typingTimerRef = useRef(null);
  const scrollRef = useRef(null);

  const lastAnswer = [...nodes].reverse().find(n => n.type === "answer");
  const conversationContext = nodes
    .filter(n => n.type === "question" || n.type === "answer")
    .map(n => `${n.type === "question" ? "Q" : "A"}: ${n.content || n.title}`)
    .join("\n\n");

  const saveKey = (k) => {
    try { localStorage.setItem(KEY_STORAGE, k); } catch (e) { /* ignore */ }
    setApiKey(k);
  };
  const clearKey = () => {
    try { localStorage.removeItem(KEY_STORAGE); } catch (e) { /* ignore */ }
    setApiKey("");
  };

  const handleInputChange = (e) => {
    setUserInput(e.target.value);
    setIsTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => setIsTyping(false), 1500);
  };

  useEffect(() => {
    if (!apiKey) return;
    if (phase !== "idle" || isTyping || userInput.length > 0) return;
    if (!lastAnswer) return;
    if (suggestions.length > 0) return;

    const generate = async () => {
      const sys = `You are helping map an ongoing intellectual inquiry as a graph. Given the conversation so far, suggest 3 distinct next questions a thoughtful inquirer might ask. Each should open a meaningfully different direction — not minor variants. Prefer questions that surface tensions, test claims, or expand into adjacent terrain.

Respond ONLY with JSON in this exact format, no other text:
[{"title": "<5-7 word handle>", "question": "<the actual question, one sentence>", "rationale": "<one sentence on what this opens>"}]`;
      const msg = `Conversation so far:\n\n${conversationContext}\n\nSuggest 3 next questions.`;
      const result = await callClaude(apiKey, sys, msg, MODELS.fast.id, 600);
      if (result.error) return;
      const parsed = parseJSON(result.text);
      if (Array.isArray(parsed) && parsed.length > 0) {
        setSuggestions(parsed.map((s, i) => ({
          ...s,
          id: `sugg-${Date.now()}-${i}`,
          type: "suggestion"
        })));
      }
    };
    const timer = setTimeout(generate, 600);
    return () => clearTimeout(timer);
  }, [phase, isTyping, userInput, lastAnswer, suggestions.length, conversationContext, apiKey]);

  useEffect(() => {
    if (isTyping || userInput.length > 0) {
      setSuggestions([]);
    }
  }, [isTyping, userInput]);

  useEffect(() => {
    if (scrollRef.current && (phase === "answering" || phase === "ghosting")) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [nodes.length, phase]);

  if (!apiKey) {
    return <KeyEntry onSubmit={saveKey} />;
  }

  const submitQuestion = async (questionText, fromSuggestionId = null) => {
    if (!questionText.trim()) return;
    setError(null);

    if (suggestions.length > 0 && lastAnswer) {
      const notChosen = suggestions.filter(s => s.id !== fromSuggestionId);
      setDismissedSuggestions(prev => [
        ...prev,
        ...notChosen.map(s => ({ ...s, parentId: lastAnswer.id, dismissedAt: Date.now() }))
      ]);
    }

    setSuggestions([]);
    setUserInput("");
    setIsTyping(false);
    setPhase("ghosting");

    const parentId = forkFromId || lastAnswer?.id || null;
    const qNode = {
      id: `q-${Date.now()}`,
      type: "question",
      title: questionText.length > 50 ? questionText.slice(0, 48) + "…" : questionText,
      content: questionText,
      parentId,
      timestamp: Date.now()
    };
    setNodes(prev => [...prev, qNode]);
    setPendingQuestion(qNode);
    setForkFromId(null);

    const ghostSys = `You are helping a user explore a question by surfacing the distinct framings available. Given the conversation so far and the new question, identify 2-4 meaningfully different ways the question could be answered. Each framing should lead to a substantively different answer, not just a different emphasis.

Respond ONLY with JSON in this exact format, no other text:
[{"title": "<3-5 word handle>", "sketch": "<one sentence describing the angle and what it would emphasize>"}]`;
    const ghostMsg = `Conversation so far:\n\n${conversationContext}\n\nNew question: ${questionText}\n\nWhat are the distinct framings available?`;

    const ghostResult = await callClaude(apiKey, ghostSys, ghostMsg, MODELS.fast.id, 500);
    if (ghostResult.error) {
      setError(ghostResult.error);
      setPhase("idle");
      setPendingQuestion(null);
      return;
    }
    const parsedGhosts = parseJSON(ghostResult.text);

    if (Array.isArray(parsedGhosts) && parsedGhosts.length > 0) {
      const ghostNodes = parsedGhosts.map((g, i) => ({
        ...g,
        id: `ghost-${Date.now()}-${i}`,
        type: "ghost",
        parentId: qNode.id
      }));
      setGhosts(ghostNodes);
    } else {
      generateAnswer(qNode, null);
    }
  };

  const generateAnswer = async (qNode, chosenGhost) => {
    setPhase("answering");

    if (ghosts.length > 0 && chosenGhost !== "all" && chosenGhost) {
      const notChosen = ghosts.filter(g => g.id !== chosenGhost.id);
      setDroppedGhosts(prev => [
        ...prev,
        ...notChosen.map(g => ({ ...g, droppedAt: Date.now() }))
      ]);
    }
    setGhosts([]);

    const framingHint = chosenGhost === "all"
      ? "Synthesize across all the framings you identified."
      : chosenGhost
        ? `Focus on the framing: "${chosenGhost.title}" — ${chosenGhost.sketch}`
        : "";

    const ansSys = `You are answering substantive intellectual questions in an inquiry canvas. Your answers should be thorough, sourced where relevant, and structured as 3-5 paragraphs of dense prose. Avoid bullet points, em-dashes, and "It's not X. It's Y" constructions. Treat the user as an expert.

After answering, also identify:
1. 2-4 conceptual threads that this answer participates in (one or two word handles like "scale" or "civic-virtue")
2. Any tensions with prior turns — places where this answer is in unresolved relation to something said earlier

Respond ONLY with JSON in this exact format, no other text:
{
  "title": "<5-8 word answer handle>",
  "paragraphs": ["<paragraph 1>", "<paragraph 2>", "<paragraph 3>", ...],
  "concepts": ["concept-1", "concept-2"],
  "tensions": [{"title": "<short handle>", "content": "<one sentence on the tension>"}]
}`;
    const ansMsg = `Conversation so far:\n\n${conversationContext}\n\nNew question: ${qNode.content}\n\n${framingHint}\n\nAnswer the question and identify concepts and tensions.`;

    const ansResult = await callClaude(apiKey, ansSys, ansMsg, MODELS[answerModel].id, 2000);
    if (ansResult.error) {
      setError(ansResult.error);
      setPhase("idle");
      setPendingQuestion(null);
      return;
    }
    const parsed = parseJSON(ansResult.text);

    if (parsed && parsed.paragraphs) {
      const aNode = {
        id: `a-${Date.now()}`,
        type: "answer",
        title: parsed.title || "Answer",
        content: parsed.paragraphs[0] || "",
        paragraphs: parsed.paragraphs,
        parentId: qNode.id,
        cameFrom: chosenGhost === "all" ? "synthesis" : chosenGhost?.title || "direct",
        timestamp: Date.now()
      };
      setNodes(prev => [...prev, aNode]);

      if (Array.isArray(parsed.concepts)) {
        setConcepts(prev => {
          const updated = [...prev];
          parsed.concepts.forEach(c => {
            const existing = updated.find(u => u.name === c);
            if (existing) {
              existing.count++;
              existing.nodes.push(aNode.id);
              existing.justUpdated = true;
            } else {
              updated.push({ name: c, count: 1, nodes: [aNode.id], justAdded: true });
            }
          });
          return updated;
        });
        setTimeout(() => {
          setConcepts(prev => prev.map(c => ({ ...c, justAdded: false, justUpdated: false })));
        }, 2000);
      }

      if (Array.isArray(parsed.tensions) && parsed.tensions.length > 0) {
        const newTensions = parsed.tensions.map((t, i) => ({
          ...t,
          id: `t-${Date.now()}-${i}`,
          type: "tension",
          parentId: aNode.id,
          timestamp: Date.now()
        }));
        setTensions(prev => [...prev, ...newTensions]);
      }
    } else {
      setError("Failed to parse answer. Try again.");
    }

    setPhase("idle");
    setPendingQuestion(null);
  };

  const reset = () => {
    setNodes([]);
    setConcepts([]);
    setTensions([]);
    setSuggestions([]);
    setDismissedSuggestions([]);
    setGhosts([]);
    setDroppedGhosts([]);
    setUserInput("");
    setPhase("idle");
    setSelectedId(null);
    setError(null);
    setPendingQuestion(null);
    setForkFromId(null);
    setConceptDeepDive(null);
    setHighlightedConcept(null);
  };

  const branchFromGhost = async (ghostNode) => {
    const parentQuestion = nodes.find(n => n.id === ghostNode.parentId);
    if (!parentQuestion) return;

    setDroppedGhosts(prev => prev.filter(g => g.id !== ghostNode.id));
    setSelectedId(null);
    setError(null);

    const qNode = {
      id: `q-${Date.now()}`,
      type: "question",
      title: parentQuestion.title,
      content: parentQuestion.content,
      parentId: parentQuestion.parentId,
      forkOf: parentQuestion.id,
      timestamp: Date.now()
    };
    setNodes(prev => [...prev, qNode]);
    setPendingQuestion(qNode);

    generateAnswer(qNode, ghostNode);
  };

  const deepenConcept = async (conceptName) => {
    setIsDeepening(true);
    setConceptDeepDive({ name: conceptName, content: null });

    const sys = `You are analyzing a recurring concept across an ongoing inquiry. Given the conversation and a specific concept that has appeared multiple times, write a focused 2-3 paragraph synthesis explaining how this concept threads through the discussion, what role it plays, what tensions or questions about it remain unexplored, and which specific moments in the conversation depend on it. Be specific and reference particular claims. Avoid bullet points and em-dashes.

Respond with prose only, no JSON, no headers.`;
    const msg = `Conversation so far:\n\n${conversationContext}\n\nConcept to analyze: "${conceptName}"\n\nWrite the synthesis.`;

    const result = await callClaude(apiKey, sys, msg, MODELS[answerModel].id, 1000);
    setConceptDeepDive({ name: conceptName, content: result.error ? `Failed: ${result.error}` : (result.text || "Failed to generate synthesis.") });
    setIsDeepening(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitQuestion(userInput);
    }
  };

  const layoutNodes = () => {
    const positioned = [];
    const COL_X = 280;
    let y = 40;

    nodes.forEach(n => {
      if (n.type === "question" || n.type === "answer") {
        positioned.push({ ...n, x: COL_X, y });
        y += n.type === "answer" ? 200 : 120;
      }
    });

    tensions.forEach((t) => {
      const parent = positioned.find(p => p.id === t.parentId);
      if (parent) {
        positioned.push({ ...t, x: COL_X + 280, y: parent.y + 40 });
      }
    });

    droppedGhosts.forEach((g, i) => {
      const parent = positioned.find(p => p.id === g.parentId);
      if (parent) {
        const siblingsBefore = droppedGhosts.filter(d => d.parentId === g.parentId && droppedGhosts.indexOf(d) < i).length;
        positioned.push({ ...g, x: COL_X - 260, y: parent.y + siblingsBefore * 90, faded: true });
      }
    });

    dismissedSuggestions.forEach((s, i) => {
      const parent = positioned.find(p => p.id === s.parentId);
      if (parent) {
        const siblingsBefore = dismissedSuggestions.filter(d => d.parentId === s.parentId && dismissedSuggestions.indexOf(d) < i).length;
        positioned.push({ ...s, x: COL_X + 280, y: parent.y + 140 + siblingsBefore * 90, faded: true });
      }
    });

    return { positioned, totalHeight: y + 100 };
  };

  const { positioned, totalHeight } = layoutNodes();
  const canvasHeight = Math.max(totalHeight, 600);

  const selected = selectedId ? [...positioned, ...nodes].find(n => n.id === selectedId) : null;

  return (
    <div className="w-full h-screen bg-[#0d0c0a] text-[#e8e4d8] overflow-hidden flex flex-col"
         style={{ fontFamily: "'Crimson Pro', 'Iowan Old Style', Georgia, serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;1,400&family=JetBrains+Mono:wght@400;500&display=swap');
        .mono { font-family: 'JetBrains Mono', monospace; }
        .grain {
          background-image:
            radial-gradient(circle at 20% 30%, rgba(201,169,74,0.025) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(122,139,153,0.025) 0%, transparent 50%);
        }
        .scrollbar-thin::-webkit-scrollbar { width: 4px; height: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: #1a1814; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #3a3530; border-radius: 2px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #c9a94a; }
        .ic-prose { color: #c8c0b0; }
        .ic-prose em, .ic-prose i { color: inherit; font-style: italic; }
        .ic-prose strong, .ic-prose b { color: #e8e4d8; font-weight: 600; }
        .ic-prose code { color: #c9a94a; background: #1a1814; padding: 0 4px; font-family: 'JetBrains Mono', monospace; font-size: 0.9em; }
        .ic-prose-card { color: #9b9080; }
        .ic-prose-card em, .ic-prose-card i, .ic-prose-card strong, .ic-prose-card b { color: inherit; font-weight: inherit; font-style: italic; }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 rgba(201,169,74,0); }
          50% { box-shadow: 0 0 20px rgba(201,169,74,0.5); }
        }
        .pulse { animation: pulse-glow 1.6s ease-in-out infinite; }
        @keyframes shimmer {
          0%, 100% { opacity: 0.65; }
          50% { opacity: 1; }
        }
        .shimmer { animation: shimmer 1.8s ease-in-out infinite; }
        .line-clamp-3 {
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        @keyframes thinking {
          0%, 80%, 100% { opacity: 0.3; }
          40% { opacity: 1; }
        }
        .dot1 { animation: thinking 1.4s infinite; }
        .dot2 { animation: thinking 1.4s 0.2s infinite; }
        .dot3 { animation: thinking 1.4s 0.4s infinite; }
      `}</style>

      <header className="border-b border-[#2a2620] px-6 py-3 flex items-center justify-between bg-[#0d0c0a]/95 backdrop-blur z-20">
        <div>
          <div className="mono text-[10px] tracking-[0.2em] text-[#7a6f5a] uppercase">Inquiry Canvas</div>
          <h1 className="text-lg italic text-[#e8e4d8]">Live — branching as it happens</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="mono text-[9px] tracking-[0.2em] text-[#5a5246] uppercase">Answer model</span>
            <div className="flex border border-[#2a2620]">
              {Object.entries(MODELS).map(([key, m]) => (
                <button key={key}
                        onClick={() => setAnswerModel(key)}
                        title={m.note}
                        className={`mono text-[10px] px-2 py-1 transition-colors ${
                          answerModel === key
                            ? "bg-[#c9a94a] text-[#0d0c0a]"
                            : "text-[#7a6f5a] hover:text-[#e8e4d8]"
                        }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mono text-[10px] text-[#7a6f5a]">
            {phase === "ghosting" && <span className="text-[#c9a94a]">framings…</span>}
            {phase === "answering" && <span className="text-[#9bb0c0]">answering…</span>}
            {phase === "idle" && nodes.length > 0 && <span>idle</span>}
          </div>
          {nodes.length > 0 && (
            <button onClick={reset}
                    className="mono text-[10px] tracking-wider uppercase text-[#7a6f5a] hover:text-[#c9a94a] transition-colors px-3 py-1 border border-[#2a2620]">
              Reset
            </button>
          )}
          <button onClick={() => { if (confirm("Clear your saved API key from this device?")) clearKey(); }}
                  className="mono text-[10px] tracking-wider uppercase text-[#7a6f5a] hover:text-[#c9a94a] transition-colors px-3 py-1 border border-[#2a2620]">
            Key
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-52 border-r border-[#2a2620] p-4 overflow-y-auto scrollbar-thin">
          <div className="mono text-[9px] tracking-[0.2em] text-[#7a6f5a] uppercase mb-3">
            Concepts
          </div>
          {concepts.length === 0 && (
            <div className="text-[10px] text-[#5a5246] italic leading-relaxed">
              Concepts will surface as your inquiry accumulates them.
            </div>
          )}
          <div className="space-y-1">
            <AnimatePresence>
              {concepts.map(c => (
                <motion.button
                  key={c.name}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{
                    opacity: 1, x: 0,
                    backgroundColor: c.justAdded ? "rgba(201,169,74,0.15)" : c.justUpdated ? "rgba(201,169,74,0.08)" : "transparent"
                  }}
                  transition={{ duration: 0.4 }}
                  onClick={() => {
                    const newVal = highlightedConcept === c.name ? null : c.name;
                    setHighlightedConcept(newVal);
                    setSelectedId(null);
                    if (newVal) {
                      setConceptDeepDive({ name: newVal, content: null });
                    } else {
                      setConceptDeepDive(null);
                    }
                  }}
                  className={`w-full text-left text-xs flex items-baseline justify-between py-1.5 px-2 transition-colors ${
                    highlightedConcept === c.name
                      ? "bg-[#1a1814] text-[#c9a94a]"
                      : "text-[#9b9080] hover:text-[#e8e4d8]"
                  }`}
                >
                  <span className="italic flex items-center gap-1.5">
                    {c.justAdded && <span className="text-[#c9a94a] mono text-[9px]">+</span>}
                    {c.name}
                  </span>
                  <span className="mono text-[9px] text-[#5a5246]">×{c.count}</span>
                </motion.button>
              ))}
            </AnimatePresence>
          </div>

          {tensions.length > 0 && (
            <>
              <div className="mono text-[9px] tracking-[0.2em] text-[#b87a3a] uppercase mt-6 mb-3">
                Tensions <span className="text-[#5a5246]">· {tensions.length}</span>
              </div>
              <div className="space-y-2">
                <AnimatePresence>
                  {tensions.map(t => (
                    <motion.button
                      key={t.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => setSelectedId(t.id)}
                      className="w-full text-left text-[10px] p-2 border border-[#b87a3a]/40 bg-[#1a1714]/40 italic text-[#d99a5a] hover:border-[#b87a3a]"
                    >
                      {t.title}
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </>
          )}
        </aside>

        <main ref={scrollRef} className="flex-1 relative overflow-y-auto grain scrollbar-thin">
          <div className="relative" style={{ minHeight: canvasHeight, width: "100%" }}>
            {nodes.length === 0 && phase === "idle" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="mono text-[10px] tracking-[0.2em] text-[#7a6f5a] uppercase mb-3">Begin</div>
                  <p className="text-sm italic text-[#9b9080] leading-relaxed">
                    Ask a substantive question. The canvas will surface the framings the model is choosing between, render the answer, and accumulate concepts and tensions as the inquiry develops.
                  </p>
                  <p className="mono text-[10px] text-[#5a5246] mt-4 italic">
                    Try: "What are the philosophical roots of liberalism?" or any question worth thinking about.
                  </p>
                </div>
              </div>
            )}

            <svg className="absolute top-0 left-0 pointer-events-none" width="900" height={canvasHeight}>
              {positioned.filter(n => n.parentId).map(node => {
                const parent = positioned.find(p => p.id === node.parentId);
                if (!parent) return null;
                const x1 = parent.x + 110, y1 = parent.y + (parent.type === "answer" ? 80 : 50);
                const x2 = node.x + 110, y2 = node.y;
                return (
                  <path
                    key={`e-${node.id}`}
                    d={`M ${x1} ${y1} C ${x1} ${y1 + 40}, ${x2} ${y2 - 30}, ${x2} ${y2}`}
                    stroke={node.type === "tension" ? "#b87a3a" : "#5a5246"}
                    strokeWidth={1}
                    strokeDasharray={node.type === "tension" ? "4 4" : "none"}
                    fill="none"
                    opacity={0.6}
                  />
                );
              })}
              {highlightedConcept && (() => {
                const linked = positioned.filter(n =>
                  concepts.find(c => c.name === highlightedConcept)?.nodes.includes(n.id)
                );
                return linked.flatMap((n, i) =>
                  linked.slice(i + 1).map(m => (
                    <path
                      key={`cl-${n.id}-${m.id}`}
                      d={`M ${n.x + 220} ${n.y + 30} Q ${n.x + 320} ${(n.y + m.y) / 2}, ${m.x + 220} ${m.y + 30}`}
                      stroke="#c9a94a"
                      strokeWidth="0.8"
                      strokeDasharray="2 5"
                      fill="none"
                      opacity={0.6}
                    />
                  ))
                );
              })()}
            </svg>

            <AnimatePresence>
              {positioned.map(node => {
                const style = TYPE_STYLES[node.type] || TYPE_STYLES.answer;
                const isSelected = selectedId === node.id;
                const isConceptMatch = highlightedConcept &&
                  concepts.find(c => c.name === highlightedConcept)?.nodes.includes(node.id);
                const isPending = pendingQuestion?.id === node.id && phase === "answering";
                const isFaded = node.faded;

                return (
                  <motion.div
                    key={node.id}
                    layout
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{
                      opacity: isFaded ? 0.45 : highlightedConcept && !isConceptMatch && node.type === "answer" ? 0.4 : 1,
                      y: 0, scale: 1
                    }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="absolute cursor-pointer group"
                    style={{ left: node.x, top: node.y, width: 220 }}
                    onClick={() => {
                      if (isFaded && node.type === "suggestion") {
                        setDismissedSuggestions(prev => prev.filter(s => s.id !== node.id));
                        submitQuestion(node.question);
                      } else {
                        setSelectedId(node.id);
                      }
                    }}
                  >
                    <div
                      className={`relative p-3 transition-all ${isPending ? "pulse" : ""}`}
                      style={{
                        background: style.bg,
                        border: `1px ${isFaded ? "dashed" : "solid"} ${isSelected ? style.accent : isFaded ? "#3a3530" : style.border}`,
                        borderLeftWidth: isSelected ? "3px" : "1px",
                        filter: isFaded ? "grayscale(0.6)" : "none",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="mono text-[8px] tracking-[0.15em]" style={{ color: isFaded ? "#5a5246" : style.accent }}>
                          {isFaded && node.type === "ghost" ? "NOT TAKEN" : isFaded && node.type === "suggestion" ? "NOT ASKED" : style.label}
                        </span>
                        {isPending && (
                          <span className="mono text-[8px] text-[#c9a94a]">
                            <span className="dot1">·</span><span className="dot2">·</span><span className="dot3">·</span>
                          </span>
                        )}
                        {isFaded && node.type === "suggestion" && (
                          <span className="mono text-[8px] text-[#5a5246] opacity-0 group-hover:opacity-100 transition-opacity">click to ask →</span>
                        )}
                      </div>
                      <div className="text-[12px] leading-tight italic mb-1" style={{ color: isFaded ? "#9b9080" : "#e8e4d8" }}>
                        {node.title}
                      </div>
                      {node.type === "answer" && node.content && (
                        <div className="text-[10px] leading-snug mt-1.5 line-clamp-3 ic-prose-card" style={{ color: "#9b9080" }}>
                          {node.content}
                        </div>
                      )}
                      {(node.type === "tension" || node.type === "ghost") && (node.content || node.sketch) && (
                        <div className="text-[10px] leading-snug mt-1.5" style={{ color: isFaded ? "#5a5246" : "#9b9080" }}>
                          {node.content || node.sketch}
                        </div>
                      )}
                      {node.type === "suggestion" && (
                        <div className="text-[10px] leading-snug mt-1.5" style={{ color: isFaded ? "#5a5246" : "#9b9080" }}>
                          {node.question}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <AnimatePresence>
              {phase === "ghosting" && ghosts.length > 0 && pendingQuestion && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="absolute"
                  style={{
                    left: 280,
                    top: positioned.find(n => n.id === pendingQuestion.id)?.y + 80 || 100,
                    width: 600
                  }}
                >
                  <div className="mono text-[9px] tracking-[0.2em] text-[#c9a94a] uppercase mb-2 shimmer">
                    Choose a framing
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {ghosts.map(g => (
                      <button
                        key={g.id}
                        onClick={() => generateAnswer(pendingQuestion, g)}
                        className="text-left p-3 border border-dashed border-[#5a5246] hover:border-[#c9a94a] bg-[#14130f] transition-colors group"
                      >
                        <div className="mono text-[8px] tracking-[0.15em] text-[#9b9080] mb-1">FRAMING</div>
                        <div className="text-[12px] italic text-[#d9c89a] group-hover:text-[#e8e4d8] mb-1.5">{g.title}</div>
                        <div className="text-[10px] text-[#7a6f5a] leading-snug">{g.sketch}</div>
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => generateAnswer(pendingQuestion, "all")}
                    className="mt-2 mono text-[10px] tracking-wider uppercase text-[#c9a94a] hover:text-[#e8e4d8] border border-[#c9a94a] px-3 py-1.5 hover:bg-[#c9a94a]/10 transition-colors"
                  >
                    Synthesize all →
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {phase === "idle" && suggestions.length > 0 && lastAnswer && !isTyping && userInput.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4 }}
                  className="absolute"
                  style={{
                    left: 280,
                    top: (positioned.find(n => n.id === lastAnswer.id)?.y || 0) + 200,
                    width: 700
                  }}
                >
                  <div className="mono text-[9px] tracking-[0.2em] text-[#7a6f5a] uppercase mb-2 italic">
                    Suggested next directions
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {suggestions.map(s => (
                      <button
                        key={s.id}
                        onClick={() => submitQuestion(s.question, s.id)}
                        className="text-left p-3 border border-[#2a2620] hover:border-[#c9a94a] bg-[#14130f]/50 transition-colors group"
                      >
                        <div className="mono text-[8px] tracking-[0.15em] text-[#7a6f5a] mb-1 group-hover:text-[#c9a94a]">NEXT?</div>
                        <div className="text-[12px] italic text-[#d9c89a] mb-1.5 leading-tight">{s.title}</div>
                        <div className="text-[10px] text-[#9b9080] leading-snug mb-2">{s.question}</div>
                        <div className="text-[9px] text-[#5a5246] italic leading-snug">— {s.rationale}</div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        <aside className="w-96 border-l border-[#2a2620] flex flex-col bg-[#0d0c0a]">
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {conceptDeepDive && !selectedId && (() => {
              const c = concepts.find(x => x.name === conceptDeepDive.name);
              if (!c) return null;
              const linkedNodes = nodes.filter(n => c.nodes.includes(n.id));
              return (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="mono text-[9px] tracking-[0.2em] text-[#c98ba4] uppercase">Concept</div>
                    <button onClick={() => { setConceptDeepDive(null); setHighlightedConcept(null); }}
                            className="mono text-[9px] text-[#5a5246] hover:text-[#c9a94a]">close ×</button>
                  </div>
                  <h3 className="text-base italic text-[#e8e4d8] mb-1 leading-snug">{c.name}</h3>
                  <div className="mono text-[9px] text-[#5a5246] mb-4">appears in {c.count} answer{c.count !== 1 ? "s" : ""}</div>

                  <div className="mb-4">
                    <div className="mono text-[9px] tracking-[0.2em] text-[#7a6f5a] uppercase mb-2">Where it appears</div>
                    <div className="space-y-2">
                      {linkedNodes.map(n => (
                        <button key={n.id}
                                onClick={() => { setSelectedId(n.id); }}
                                className="w-full text-left p-2 border border-[#2a2620] hover:border-[#c98ba4] transition-colors group">
                          <div className="text-[11px] italic text-[#d9c89a] group-hover:text-[#e8e4d8] mb-1">{n.title}</div>
                          <div className="text-[10px] text-[#7a6f5a] line-clamp-2 leading-snug">{n.content}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {!conceptDeepDive.content && !isDeepening && (
                    <button onClick={() => deepenConcept(c.name)}
                            className="w-full mono text-[10px] tracking-wider uppercase text-[#c98ba4] hover:text-[#e8e4d8] border border-[#a4607a] px-3 py-2 hover:bg-[#a4607a]/10 transition-colors">
                      Synthesize this thread →
                    </button>
                  )}

                  {isDeepening && (
                    <div className="mono text-[10px] text-[#c98ba4] italic flex items-center gap-2">
                      <span className="dot1">·</span><span className="dot2">·</span><span className="dot3">·</span>
                      <span>tracing the thread</span>
                    </div>
                  )}

                  {conceptDeepDive.content && (
                    <div className="mt-3 pt-3 border-t border-[#2a2620]">
                      <div className="mono text-[9px] tracking-[0.2em] text-[#7a6f5a] uppercase mb-2">Synthesis</div>
                      <div className="text-[12px] leading-relaxed whitespace-pre-wrap ic-prose">{conceptDeepDive.content}</div>
                      <button onClick={() => {
                                setForkFromId(linkedNodes[linkedNodes.length - 1]?.id);
                                submitQuestion(`Deepen the concept of ${c.name}: where does it lead, and what tensions does it raise?`);
                                setConceptDeepDive(null);
                                setHighlightedConcept(null);
                              }}
                              className="mt-3 w-full mono text-[10px] tracking-wider uppercase text-[#c9a94a] hover:text-[#e8e4d8] border border-[#c9a94a] px-3 py-1.5 hover:bg-[#c9a94a]/10 transition-colors">
                        Open as new branch →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

            {selected && selected.type === "answer" && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="mono text-[9px] tracking-[0.2em] text-[#9bb0c0] uppercase">Answer</div>
                  <button onClick={() => setSelectedId(null)} className="mono text-[9px] text-[#5a5246] hover:text-[#c9a94a]">close ×</button>
                </div>
                <h3 className="text-base italic text-[#e8e4d8] mb-3 leading-snug">{selected.title}</h3>
                <div className="space-y-3 ic-prose">
                  {selected.paragraphs?.map((p, i) => (
                    <p key={i} className="text-[12px] leading-relaxed">{p}</p>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-[#2a2620] mono text-[9px] text-[#5a5246] italic">
                  via: {selected.cameFrom}
                </div>
                <button
                  onClick={() => { setForkFromId(selected.id); inputRef.current?.focus(); }}
                  className="mt-3 w-full mono text-[10px] tracking-wider uppercase text-[#c9a94a] hover:text-[#e8e4d8] border border-[#c9a94a] px-3 py-1.5 hover:bg-[#c9a94a]/10 transition-colors"
                >
                  Fork from here →
                </button>
              </div>
            )}

            {selected && selected.type === "tension" && (
              <div className="p-4 bg-[#1a1714]/30">
                <div className="flex items-center justify-between mb-1">
                  <div className="mono text-[9px] tracking-[0.2em] text-[#d99a5a] uppercase">Tension</div>
                  <button onClick={() => setSelectedId(null)} className="mono text-[9px] text-[#5a5246] hover:text-[#c9a94a]">close ×</button>
                </div>
                <h3 className="text-base italic text-[#e8e4d8] mb-3 leading-snug">{selected.title}</h3>
                <p className="text-[12px] leading-relaxed ic-prose">{selected.content}</p>
                <button
                  onClick={() => { setForkFromId(selected.id); submitQuestion(`Address this tension: ${selected.title}. ${selected.content}`); }}
                  className="mt-4 mono text-[10px] tracking-wider uppercase text-[#d99a5a] hover:text-[#e8e4d8] border border-[#b87a3a] px-3 py-1.5 hover:bg-[#b87a3a]/10 transition-colors"
                >
                  Open as new branch →
                </button>
              </div>
            )}

            {selected && selected.type === "question" && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="mono text-[9px] tracking-[0.2em] text-[#c9a94a] uppercase">Question</div>
                  <button onClick={() => setSelectedId(null)} className="mono text-[9px] text-[#5a5246] hover:text-[#c9a94a]">close ×</button>
                </div>
                <p className="text-sm italic text-[#e8e4d8] leading-snug">{selected.content}</p>
              </div>
            )}

            {selected && selected.type === "ghost" && selected.faded && (() => {
              const parentQ = nodes.find(n => n.id === selected.parentId);
              return (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-1">
                    <div className="mono text-[9px] tracking-[0.2em] text-[#9b9080] uppercase">Path not taken</div>
                    <button onClick={() => setSelectedId(null)} className="mono text-[9px] text-[#5a5246] hover:text-[#c9a94a]">close ×</button>
                  </div>
                  <h3 className="text-base italic text-[#e8e4d8] mb-1 leading-snug">{selected.title}</h3>
                  <p className="text-[12px] leading-relaxed ic-prose mb-3">{selected.sketch}</p>
                  {parentQ && (
                    <div className="mb-4 p-2 border border-[#2a2620] bg-[#14130f]/50">
                      <div className="mono text-[9px] tracking-[0.2em] text-[#5a5246] uppercase mb-1">From question</div>
                      <p className="text-[11px] italic text-[#9b9080] leading-snug">{parentQ.content}</p>
                    </div>
                  )}
                  <button
                    onClick={() => branchFromGhost(selected)}
                    disabled={phase !== "idle"}
                    className="w-full mono text-[10px] tracking-wider uppercase text-[#c9a94a] hover:text-[#e8e4d8] border border-[#c9a94a] px-3 py-2 hover:bg-[#c9a94a]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Take this path now →
                  </button>
                  <div className="mono text-[9px] text-[#5a5246] italic mt-2 leading-relaxed">
                    Re-asks the original question with this framing chosen. The result branches off as a sibling of the answer you originally received.
                  </div>
                </div>
              );
            })()}

            {selected && selected.type === "suggestion" && selected.faded && (
              <div className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <div className="mono text-[9px] tracking-[0.2em] text-[#9b9080] uppercase">Question not asked</div>
                  <button onClick={() => setSelectedId(null)} className="mono text-[9px] text-[#5a5246] hover:text-[#c9a94a]">close ×</button>
                </div>
                <h3 className="text-base italic text-[#e8e4d8] mb-1 leading-snug">{selected.title}</h3>
                <p className="text-[12px] leading-relaxed ic-prose mb-2">{selected.question}</p>
                <p className="text-[11px] italic text-[#7a6f5a] leading-snug mb-4">— {selected.rationale}</p>
                <button
                  onClick={() => {
                    setDismissedSuggestions(prev => prev.filter(s => s.id !== selected.id));
                    setSelectedId(null);
                    submitQuestion(selected.question);
                  }}
                  disabled={phase !== "idle"}
                  className="w-full mono text-[10px] tracking-wider uppercase text-[#c9a94a] hover:text-[#e8e4d8] border border-[#c9a94a] px-3 py-2 hover:bg-[#c9a94a]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Ask this now →
                </button>
              </div>
            )}

            {!selected && nodes.length > 0 && phase === "idle" && (
              <div className="p-4">
                <div className="mono text-[9px] tracking-[0.2em] text-[#7a6f5a] uppercase mb-3">Inquiry state</div>
                <div className="space-y-1.5 mono text-[10px]">
                  <div className="flex justify-between text-[#9b9080]">
                    <span>questions</span>
                    <span>{nodes.filter(n => n.type === "question").length}</span>
                  </div>
                  <div className="flex justify-between text-[#9b9080]">
                    <span>answers</span>
                    <span>{nodes.filter(n => n.type === "answer").length}</span>
                  </div>
                  <div className="flex justify-between text-[#c9a94a]">
                    <span>concepts</span>
                    <span>{concepts.length}</span>
                  </div>
                  <div className="flex justify-between text-[#d99a5a]">
                    <span>tensions</span>
                    <span>{tensions.length}</span>
                  </div>
                </div>
                <div className="mt-4 mono text-[9px] text-[#5a5246] italic leading-relaxed">
                  Click any node to inspect. Suggestions appear when idle and disappear when you start typing.
                </div>
              </div>
            )}

            {!selected && nodes.length === 0 && (
              <div className="p-4">
                <div className="mono text-[9px] tracking-[0.2em] text-[#7a6f5a] uppercase mb-3">How it works</div>
                <div className="space-y-3 text-[11px] text-[#9b9080] leading-relaxed">
                  <p>Ask a question. The model surfaces 2-4 distinct framings before committing — pick one or synthesize across all.</p>
                  <p>Concepts accumulate live in the rail as answers reference them. Click a concept to see cross-links.</p>
                  <p>Tensions appear when an answer is in unresolved relation to something earlier. Open them as new branches.</p>
                  <p>When idle, the canvas suggests next directions. Start typing to dismiss them.</p>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[#2a2620] p-3">
            {forkFromId && (
              <div className="mono text-[9px] text-[#c9a94a] mb-2 flex items-center justify-between">
                <span>forking from selected node</span>
                <button onClick={() => setForkFromId(null)} className="text-[#5a5246] hover:text-[#c9a94a]">×</button>
              </div>
            )}
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={userInput}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                disabled={phase === "ghosting" || phase === "answering"}
                placeholder={
                  phase === "ghosting" ? "choosing a framing…" :
                  phase === "answering" ? "answering…" :
                  nodes.length === 0 ? "ask a substantive question…" :
                  "continue the inquiry…"
                }
                rows={2}
                className="flex-1 bg-[#14130f] border border-[#2a2620] focus:border-[#c9a94a] outline-none px-3 py-2 text-sm italic text-[#e8e4d8] placeholder-[#5a5246] resize-none disabled:opacity-50"
                style={{ fontFamily: "'Crimson Pro', serif" }}
              />
              <button
                onClick={() => submitQuestion(userInput)}
                disabled={!userInput.trim() || phase !== "idle"}
                className="mono text-[10px] tracking-wider uppercase text-[#c9a94a] hover:text-[#e8e4d8] border border-[#c9a94a] px-3 hover:bg-[#c9a94a]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Ask
              </button>
            </div>
            {error && <div className="mono text-[9px] text-[#b87a3a] mt-2">{error}</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
