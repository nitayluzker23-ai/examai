import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Image as ImageIcon, FileText, X, Rocket, Lock } from "lucide-react";
import { supabase, useAuth } from "./App";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url
).toString();

const C = {
  purple: "#37352F", purpleLight: "#F4F2EC", purpleMid: "#9B958A",
  teal: "#4F6F52", tealLight: "#E8EDE6",
  amber: "#9A7B3F", amberLight: "#F3EBD9",
  red: "#A6493B", redLight: "#F3E2DD",
  text: "#2B2925", muted: "#6B655C",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#fff",
  accent: "#C2683D",
};

async function pdfToText(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let t = ""; let prev = null;
      for (const item of content.items) {
        if (!item.str) continue;
        if (prev) {
          const sameY = Math.abs(item.transform[5] - prev.transform[5]) < 3;
          const gap = item.transform[4] - (prev.transform[4] + (prev.width || 0));
          if (!sameY) t += "\n"; else if (gap > 1.5) t += " ";
        }
        t += item.str; prev = item;
      }
      if (t.trim()) pages.push(t.trim());
    } catch (_) {}
  }
  return pages.join("\n\n");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]); // strip data: prefix
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

function generateCode() {
  return Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6).padEnd(6, "0");
}

export default function PrepPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [access,   setAccess]   = useState(null); // null=checking, true, false
  const [items,    setItems]    = useState([]);   // {id,name,kind:'text'|'image',text?,base64?,type?,loading}
  const [subject,  setSubject]  = useState("");
  const [numQ,     setNumQ]     = useState(10);
  const [busy,     setBusy]     = useState(false);
  const [error,    setError]    = useState("");
  const [mobile,   setMobile]   = useState(window.innerWidth < 600);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 600);
    window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn);
  }, []);

  // ── Access check ──
  useEffect(() => {
    if (!user) return;
    (async () => {
      if (profile?.is_admin) { setAccess(true); return; }
      const email = (user.email ?? "").toLowerCase();
      const { data } = await supabase.from("prep_allowlist").select("id").ilike("email", email).maybeSingle();
      setAccess(!!data);
    })();
  }, [user, profile]);

  const addFiles = async (fileList) => {
    const files = Array.from(fileList);
    for (const f of files) {
      const id = `${f.name}-${Date.now()}-${Math.random()}`;
      const isImg = /\.(png|jpe?g|webp|gif)$/i.test(f.name);
      const isDoc = /\.(pdf|txt|md)$/i.test(f.name);
      if (!isImg && !isDoc) continue;
      if (f.size > 15 * 1024 * 1024) { setError(`${f.name} גדול מדי (מקס' 15MB)`); continue; }
      setItems(prev => [...prev, { id, name: f.name, kind: isImg ? "image" : "text", loading: true }]);
      try {
        if (isImg) {
          const base64 = await fileToBase64(f);
          setItems(prev => prev.map(x => x.id === id ? { ...x, base64, type: f.type || "image/jpeg", loading: false } : x));
        } else if (f.name.toLowerCase().endsWith(".pdf")) {
          const text = await pdfToText(await f.arrayBuffer());
          setItems(prev => prev.map(x => x.id === id ? { ...x, text, loading: false } : x));
        } else {
          const text = await f.text();
          setItems(prev => prev.map(x => x.id === id ? { ...x, text, loading: false } : x));
        }
      } catch (e) {
        setItems(prev => prev.filter(x => x.id !== id));
        setError("שגיאה בקריאת " + f.name);
      }
    }
  };

  const removeItem = (id) => setItems(prev => prev.filter(x => x.id !== id));

  const ready = items.filter(x => !x.loading).length > 0 && !items.some(x => x.loading);

  const start = async () => {
    if (!ready || !user) return;
    setBusy(true); setError("");
    try {
      const texts  = items.filter(x => x.kind === "text" && x.text?.trim()).map(x => x.text);
      const images = items.filter(x => x.kind === "image" && x.base64).map(x => ({ base64: x.base64, type: x.type }));

      const { data, error: fnErr } = await supabase.functions.invoke("prep-handler", {
        body: { texts, images, num_questions: numQ, subject },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);

      const qs = [];
      (data?.content_structure ?? []).forEach(t => t.sub_topics?.forEach(s => s.questions?.forEach(q => qs.push(q))));
      if (!qs.length) throw new Error("לא הצלחנו לייצר שאלות מהחומר. נסה חומר ברור יותר.");

      const code = generateCode();
      const { data: exam, error: eErr } = await supabase.from("exams").insert({
        workspace_id: user.id,
        title: `הכנה למבחן${subject ? " — " + subject : ""}`,
        subject: subject || "כללי",
        config: { mode: "flexible", total_minutes: 60, can_go_back: true },
        status: "published",
        access_code: code,
        is_self_test: true,
      }).select().single();
      if (eErr) throw eErr;

      await supabase.from("questions").insert(qs.slice(0, numQ).map((q, i) => ({
        exam_id: exam.id, sort_order: i, difficulty: "Medium",
        content: { question_text: q.question_text, question_type: "multiple_choice", options: q.options ?? [], correct_answer_index: q.correct_answer_index, ai_explanation: q.ai_explanation, model_answer: null },
      })));

      navigate(`/exam/${code}?selftest=1&name=${encodeURIComponent(profile?.full_name || user.email || "")}`);
    } catch (e) {
      setError(e.message); setBusy(false);
    }
  };

  // ── Access states ──
  if (access === null) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: 32, height: 32, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if (access === false) return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Assistant',sans-serif", direction: "rtl" }}>
      <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, padding: "40px 32px", textAlign: "center", maxWidth: 420 }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}><Lock size={40} color={C.muted} strokeWidth={1.5} /></div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.text, marginBottom: 8 }}>הגישה מוגבלת</div>
        <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7, marginBottom: 20 }}>
          תכונת ההכנה למבחן זמינה רק למשתמשים מאושרים. אם קיבלת הזמנה — ודא שהתחברת עם אותו אימייל.
        </div>
        <button onClick={() => navigate("/dashboard")}
          style={{ padding: "10px 24px", background: C.purple, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          חזרה ללוח הבקרה
        </button>
      </div>
    </div>
  );

  // ── Main ──
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Assistant',system-ui,sans-serif", direction: "rtl" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: `14px ${mobile ? 16 : 28}px`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/dashboard")} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20, padding: 0 }}>←</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.accent }}>הכנה אישית למבחן</div>
          <div style={{ fontSize: 11, color: C.muted }}>העלה כמה תמונות וקבצים שתרצה — וקבל מבחן תרגול</div>
        </div>
      </div>

      <div style={{ maxWidth: 620, margin: "0 auto", padding: mobile ? "20px 16px" : "28px 20px" }}>
        {busy ? (
          <div style={{ textAlign: "center", padding: 50 }}>
            <div style={{ width: 48, height: 48, border: `4px solid ${C.purpleLight}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 18px" }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>בונה מבחן תרגול...</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 6 }}>ה-AI קורא את כל החומר שהעלית</div>
          </div>
        ) : (
          <>
            <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, padding: mobile ? 20 : 26, marginBottom: 16 }}>
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "28px 20px", border: `2px dashed ${C.purpleMid}`, borderRadius: 14, cursor: "pointer", background: C.purpleLight, marginBottom: items.length ? 14 : 0 }}>
                <input type="file" accept=".pdf,.txt,.md,image/*" multiple style={{ display: "none" }}
                  onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
                <FolderOpen size={34} color={C.accent} strokeWidth={1.5} />
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>גרור או לחץ להעלאה</div>
                  <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>תמונות (צילומי מחברת/דף), PDF, TXT — כמה שתרצה</div>
                </div>
              </label>

              {items.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map(it => (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                      {it.kind === "image" ? <ImageIcon size={18} color={C.muted} /> : <FileText size={18} color={C.muted} />}
                      <div style={{ flex: 1, minWidth: 0, fontSize: 13, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                      {it.loading
                        ? <div style={{ width: 14, height: 14, border: `2px solid ${C.purpleMid}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                        : <button onClick={() => removeItem(it.id)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", display: "flex" }}><X size={16} /></button>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, padding: mobile ? 20 : 26, marginBottom: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 150 }}>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 6 }}>נושא (אופציונלי)</div>
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="למשל: היסטוריה — מלחמת העצמאות"
                  style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.bg, boxSizing: "border-box" }} />
              </div>
              <div style={{ minWidth: 150 }}>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 6 }}>כמות שאלות</div>
                <div style={{ display: "flex", gap: 6 }}>
                  {[5, 10, 15, 20].map(n => (
                    <button key={n} onClick={() => setNumQ(n)}
                      style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: `2px solid ${numQ === n ? C.accent : C.border}`, background: numQ === n ? "#F3E5DB" : C.bg, color: numQ === n ? C.accent : C.muted, fontSize: 13, fontWeight: numQ === n ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>{n}</button>
                  ))}
                </div>
              </div>
            </div>

            {error && <div style={{ background: C.redLight, color: C.red, borderRadius: 12, padding: "12px 16px", fontSize: 13, marginBottom: 16 }}>{error}</div>}

            <button onClick={start} disabled={!ready}
              style={{ width: "100%", padding: "15px 0", background: ready ? C.accent : C.purpleMid, color: "white", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: ready ? "pointer" : "not-allowed", fontFamily: "inherit", boxShadow: ready ? "0 6px 20px rgba(194,104,61,0.30)" : "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              <Rocket size={18} strokeWidth={1.75} /> צור מבחן תרגול ({numQ} שאלות)
            </button>
          </>
        )}
      </div>
    </div>
  );
}
