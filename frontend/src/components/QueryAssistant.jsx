import { useState } from "react";
import { api } from "../lib/api.js";

const SUGGESTIONS = [
  "What is our highest financial cyber risk today?",
  "What is our total risk exposure?",
  "Which vulnerabilities contribute most to our losses?",
  "What should we prioritise with a ₹1 crore budget?",
  "How compliant are we with NIST CSF?",
  "What's our risk trend?",
];

export default function QueryAssistant({ onClose }) {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const ask = async (question) => {
    if (!question.trim() || busy) return;
    setInput("");
    setHistory((h) => [...h, { role: "user", text: question }]);
    setBusy(true);
    try {
      const res = await api.query(question);
      setHistory((h) => [...h, { role: "assistant", text: res.answer, data: res.data }]);
    } catch (e) {
      setHistory((h) => [...h, { role: "assistant", text: `Error: ${e.message}` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={onClose}>
      <div className="bg-panel border border-slate-800 rounded-t-xl sm:rounded-xl w-full sm:max-w-xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-semibold">Ask CyberRiskIQ</h3>
            <p className="text-[11px] text-slate-500">Natural-language query over live risk data — no external API, fully local</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[200px]">
          {history.length === 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-slate-500 mb-2">Try asking:</p>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="block w-full text-left text-xs bg-panel2 hover:bg-slate-700 rounded-lg px-3 py-2 text-slate-300">
                  {s}
                </button>
              ))}
            </div>
          )}
          {history.map((m, i) => (
            <div key={i} className={`text-xs rounded-lg px-3 py-2 max-w-[90%] ${m.role === "user" ? "bg-accent/20 ml-auto text-right" : "bg-panel2"}`}>
              {m.text}
            </div>
          ))}
          {busy && <div className="text-xs text-slate-500">Thinking…</div>}
        </div>

        <div className="p-3 border-t border-slate-800 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && ask(input)}
            placeholder="Ask about risk, budget, compliance…"
            className="flex-1 bg-panel2 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-accent"
          />
          <button onClick={() => ask(input)} className="bg-accent hover:bg-blue-600 text-xs px-3 py-2 rounded-lg font-medium">
            Ask
          </button>
        </div>
      </div>
    </div>
  );
}
