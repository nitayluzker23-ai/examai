import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase, useAuth } from "./App";

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleMid: "#AFA9EC",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  red: "#A32D2D", redLight: "#FCEBEB",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.1)", bg: "#f8f7ff", white: "#fff",
};

const PAGE_LABELS = {
  "/dashboard":          "לוח בקרה",
  "/dashboard/new":      "בניית מבחן",
  "/dashboard/exams":    "רשימת מבחנים",
  "/dashboard/students": "ניהול תלמידים",
  "/dashboard/settings": "הגדרות",
  "/self-test":          "בחן את עצמי",
};

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 4, padding: "10px 14px", alignItems: "center" }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: C.purpleMid,
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
    </div>
  );
}

export default function AssistantWidget() {
  const { user, profile, planConfig } = useAuth();
  const location  = useLocation();
  const navigate  = useNavigate();

  const [open,       setOpen]       = useState(false);
  const [messages,   setMessages]   = useState([]);
  const [input,      setInput]      = useState("");
  const [loading,    setLoading]    = useState(false);
  const [lang,       setLang]       = useState("he");
  const [escalated,  setEscalated]  = useState(false);
  const bottomRef = useRef(null);
  const inputRef  = useRef(null);

  // All hooks MUST come before any conditional return
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150);
  }, [open]);

  // Only for paid users (or admin) — AFTER all hooks
  const isPaid = profile?.is_admin || (profile?.plan && profile.plan !== "free");
  if (!user || !isPaid) return null;

  // Greeting on first open
  const handleOpen = () => {
    setOpen(true);
    if (messages.length === 0) {
      const greeting = lang === "he"
        ? `שלום! אני העוזר של ExamAI 🤖\nכיצד אוכל לסייע לך ב${PAGE_LABELS[location.pathname] ?? "האפליקציה"}?`
        : `Hello! I'm ExamAI's assistant 🤖\nHow can I help you with ${PAGE_LABELS[location.pathname] ?? "the app"}?`;
      setMessages([{ role: "assistant", text: greeting, action: null }]);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg = { role: "user", text };
    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.text }));
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("ai-assistant", {
        body: {
          messages:    history,
          currentPage: PAGE_LABELS[location.pathname] ?? location.pathname,
          userRole:    profile?.school_type ?? "unknown",
          userSubject: profile?.subject ?? "",
          lang,
        },
      });

      if (error) throw new Error(error.message);

      const { message, action } = data;
      setMessages(prev => [...prev, { role: "assistant", text: message, action }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: "assistant", text: lang === "he" ? "מצטער, אירעה שגיאה. נסה שוב." : "Sorry, an error occurred. Please try again.", action: null }]);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalate = async (requestText) => {
    try {
      await supabase.functions.invoke("ai-assistant", {
        body: { escalate: true, escalateText: requestText, userRole: profile?.school_type ?? "" },
      });
      setEscalated(true);
      setMessages(prev => [...prev, {
        role: "assistant",
        text: lang === "he"
          ? "✅ הבקשה שלך נשלחה לצוות הפיתוח. נחזור אליך בהקדם!"
          : "✅ Your request was sent to the development team. We'll get back to you soon!",
        action: null,
      }]);
    } catch (_) {}
  };

  const currentPageLabel = PAGE_LABELS[location.pathname] ?? "";

  return (
    <>
      <style>{`
        @keyframes bounce { 0%,80%,100% { transform: scale(0.7); opacity:0.5 } 40% { transform: scale(1); opacity:1 } }
        @keyframes slideIn { from { opacity:0; transform:translateX(-20px) } to { opacity:1; transform:translateX(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes pulse   { 0%,100% { box-shadow: 2px 0 20px rgba(83,74,183,0.4) } 50% { box-shadow: 2px 0 32px rgba(83,74,183,0.7) } }
        .ai-btn:hover { transform: translateY(-50%) translateX(4px) !important; }
      `}</style>

      {/* ── Floating tab button ── */}
      {!open && (
        <button className="ai-btn" onClick={handleOpen}
          style={{
            position: "fixed", left: 0, top: "50%", transform: "translateY(-50%)",
            width: 64, height: 120,
            background: `linear-gradient(160deg, ${C.purple} 0%, #3C3489 100%)`,
            border: "none", borderRadius: "0 20px 20px 0",
            cursor: "pointer", zIndex: 999,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: "3px 0 24px rgba(83,74,183,0.45)",
            animation: "pulse 3s ease-in-out infinite",
            transition: "transform 0.2s",
          }}>
          <span style={{ fontSize: 28 }}>🤖</span>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: "white",
            fontFamily: "'Noto Sans Hebrew',sans-serif",
            writingMode: "vertical-rl",
            textOrientation: "mixed",
            letterSpacing: 2,
            opacity: 0.95,
          }}>עוזר AI</span>
        </button>
      )}

      {/* ── Chat panel ── */}
      {open && (
        <div style={{
          position: "fixed", left: 0, top: 0, bottom: 0,
          width: 340, maxWidth: "90vw",
          background: C.white,
          boxShadow: "4px 0 32px rgba(83,74,183,0.18)",
          zIndex: 1000, display: "flex", flexDirection: "column",
          fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif",
          direction: "rtl",
          animation: "slideUp 0.22s ease",
        }}>

          {/* Header */}
          <div style={{ background: `linear-gradient(135deg, ${C.purple} 0%, #3C3489 100%)`, padding: "14px 16px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "white" }}>עוזר ExamAI</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>{currentPageLabel || "מוכן לעזור"}</div>
            </div>
            {/* Lang toggle */}
            <button onClick={() => setLang(l => l === "he" ? "en" : "he")}
              style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", borderRadius: 8, padding: "4px 9px", fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              {lang === "he" ? "EN" : "עב"}
            </button>
            <button onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 0 }}>
              ×
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 6px", display: "flex", flexDirection: "column", gap: 8 }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ animation: "fadeIn 0.2s ease" }}>
                <div style={{
                  maxWidth: "85%",
                  marginRight: msg.role === "user" ? "auto" : 0,
                  marginLeft:  msg.role === "user" ? 0 : "auto",
                  background:  msg.role === "user" ? C.purple : C.bg,
                  color:       msg.role === "user" ? "white" : C.text,
                  borderRadius: msg.role === "user" ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
                  padding: "9px 13px",
                  fontSize: 13,
                  lineHeight: 1.55,
                  border: msg.role === "assistant" ? `1px solid ${C.border}` : "none",
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.text}
                </div>

                {/* Action button */}
                {msg.action && msg.role === "assistant" && (
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {msg.action.type === "navigate" && (
                      <button onClick={() => { navigate(msg.action.url); setOpen(false); }}
                        style={{ padding: "7px 14px", background: C.purple, color: "white", border: "none", borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        {msg.action.label} ←
                      </button>
                    )}
                    {msg.action.type === "escalate" && !escalated && (
                      <button onClick={() => handleEscalate(msg.action.label)}
                        style={{ padding: "7px 14px", background: C.tealLight, color: C.teal, border: `1px solid ${C.teal}`, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        📩 שלח בקשה לצוות
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: "4px 16px 16px 16px", display: "inline-block" }}>
                <TypingDots />
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick suggestions */}
          {messages.length <= 1 && (
            <div style={{ padding: "4px 14px 8px", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(lang === "he"
                ? ["איך יוצרים מבחן?", "איך מוסיפים שאלה?", "איך שולחים לתלמידים?"]
                : ["How to create an exam?", "How to add a question?", "How to share with students?"]
              ).map(q => (
                <button key={q} onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                  style={{ padding: "5px 10px", background: C.purpleLight, color: C.purple, border: `1px solid ${C.purpleMid}`, borderRadius: 20, fontSize: 11, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ padding: "10px 14px 14px", borderTop: `1px solid ${C.border}`, display: "flex", gap: 8 }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage()}
              placeholder={lang === "he" ? "שאל אותי משהו..." : "Ask me anything..."}
              style={{ flex: 1, padding: "9px 12px", border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.bg, color: C.text, direction: "rtl" }}
            />
            <button onClick={sendMessage} disabled={!input.trim() || loading}
              style={{ width: 38, height: 38, borderRadius: 10, background: input.trim() && !loading ? C.purple : C.purpleMid, border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "background 0.2s" }}>
              <span style={{ color: "white", fontSize: 16 }}>↑</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
