import { useState, useRef, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Sparkles, ArrowRight } from "lucide-react";
import { askAutomotiveAI } from "@/lib/brand.functions";

type Msg = { role: "user" | "assistant"; content: string; relatedCar?: string | null };

const SUGGESTIONS = [
  { emoji: "🚗", text: "Compare BMW M3 vs Mercedes C63 AMG" },
  { emoji: "💰", text: "Best SUV under ₹20 lakh" },
  { emoji: "⚡", text: "Tell me about the Tesla Model 3" },
];

export function AiAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const askFn = useServerFn(askAutomotiveAI);
  const navigate = useNavigate();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await askFn({ data: { messages: next.map(m => ({ role: m.role, content: m.content })) } });
      setMessages([...next, { role: "assistant", content: res.reply, relatedCar: res.relatedCar }]);
    } catch (err) {
      setMessages([...next, { role: "assistant", content: `Sorry — ${(err as Error).message}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-strong rounded-3xl p-6 sm:p-10 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none"
           style={{ background: "radial-gradient(circle at 50% 0%, oklch(0.68 0.19 250 / 40%), transparent 60%)" }} />
      <div className="relative">
        <div className="text-center mb-6">
          <Sparkles className="h-8 w-8 mx-auto text-accent mb-3" />
          <h2 className="text-3xl sm:text-4xl font-bold">
            Ask AI about <span className="gradient-text">any car</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">Your automotive expert — powered by Gemini AI.</p>
        </div>

        {/* Search bar */}
        <form onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="glass rounded-2xl p-2 flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask anything about cars..."
            className="flex-1 bg-transparent outline-none px-3 py-3 text-sm placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-gradient-to-r from-primary to-accent px-4 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

        {/* Suggestion chips */}
        {messages.length === 0 && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.text}
                onClick={() => send(s.text)}
                disabled={loading}
                className="rounded-full glass px-3 py-1.5 text-xs hover:border-primary/50 transition"
              >
                {s.emoji} {s.text}
              </button>
            ))}
          </div>
        )}

        {/* Chat area */}
        {(messages.length > 0 || loading) && (
          <div className="mt-6 max-h-[60vh] overflow-y-auto space-y-4 pr-2">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={m.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-tr-sm bg-primary text-primary-foreground px-4 py-3 text-sm"
                  : "max-w-[92%] rounded-2xl rounded-tl-sm glass px-4 py-3 text-sm"}>
                  {m.role === "assistant" ? (
                    <>
                      <div className="prose prose-sm prose-invert max-w-none prose-headings:mt-3 prose-p:my-2 prose-ul:my-2 prose-table:my-3">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>
                      </div>
                      {m.relatedCar && (
                        <button
                          onClick={() => navigate({ to: "/car/$name", params: { name: encodeURIComponent(m.relatedCar!) } })}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-primary to-accent px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                        >
                          View Full Specifications <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-tl-sm glass px-4 py-3 text-sm inline-flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "120ms" }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: "240ms" }} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>
    </div>
  );
}
