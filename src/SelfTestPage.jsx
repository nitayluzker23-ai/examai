import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, useAuth } from "./App";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

const C = {
  purple: "#37352F", purpleLight: "#F4F2EC", purpleMid: "#9B958A",
  teal: "#4F6F52", tealLight: "#E8EDE6",
  amber: "#9A7B3F", amberLight: "#F3EBD9",
  red: "#A6493B", redLight: "#F3E2DD",
  text: "#2B2925", muted: "#6B655C",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#fff",
};

async function extractTextFromPDF_or_text(file) {
  if (file.name.toLowerCase().endsWith(".pdf")) {
    const buf = await file.arrayBuffer();
    const { text } = await extractTextFromPDF(buf);
    return text;
  }
  return await file.text();
}

async function extractTextFromPDF(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let pageText = ""; let prev = null;
      for (const item of content.items) {
        if (!item.str) continue;
        if (prev) {
          const sameY = Math.abs(item.transform[5] - prev.transform[5]) < 3;
          const gap = item.transform[4] - (prev.transform[4] + (prev.width || 0));
          if (!sameY) pageText += "\n"; else if (gap > 1.5) pageText += " ";
        }
        pageText += item.str; prev = item;
      }
      if (pageText.trim()) pages.push(pageText.trim());
    } catch (e) { console.warn(`Page ${i}:`, e); }
  }
  return { text: pages.join("\n\n").trim(), totalPages: pdf.numPages, textPages: pages.length };
}

function generateCode() {
  return Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6).padEnd(6, "0");
}

const HISTORY_KEY = "selftest_history";

export default function SelfTestPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [text,        setText]        = useState("");
  const [qCount,      setQCount]      = useState(10);
  const [fileName,    setFileName]    = useState("");
  const [fileLoading,    setFileLoading]    = useState(false);
  const [pdfInfo,        setPdfInfo]        = useState(null);
  const [generating,     setGenerating]     = useState(false);
  const [error,          setError]          = useState("");
  const [phase,          setPhase]          = useState("create");
  const [history,        setHistory]        = useState([]);
  const [mobile,         setMobile]         = useState(window.innerWidth < 600);
  // Advanced options
  const [showAdvanced,   setShowAdvanced]   = useState(false);
  const [topicTags,      setTopicTags]      = useState([]); // important topics
  const [topicInput,     setTopicInput]     = useState("");
  const [lecturerHint,   setLecturerHint]   = useState(""); // "המרצה אמר..."
  const [hwText,         setHwText]         = useState(""); // homework text
  const [hwFileName,     setHwFileName]     = useState("");
  const [hwLoading,      setHwLoading]      = useState(false);
  const [qTypes,         setQTypes]         = useState(["multiple_choice"]); // question types

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 600);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Load self-test history
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: exams } = await supabase
        .from("exams")
        .select("id,title,access_code,created_at")
        .eq("workspace_id", user.id)
        .eq("is_self_test", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!exams?.length) return;

      const { data: subs } = await supabase
        .from("submissions")
        .select("exam_id,score,completed_at")
        .in("exam_id", exams.map(e => e.id))
        .order("completed_at", { ascending: false });

      setHistory(exams.map(e => ({
        ...e,
        submission: (subs ?? []).find(s => s.exam_id === e.id) ?? null,
      })));
    })();
  }, [user]);

  const handleFile = async (file) => {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { setError("הקובץ גדול מדי (מקסימום 20MB)"); return; }
    setFileLoading(true); setFileName(file.name); setError(""); setPdfInfo(null);
    try {
      if (file.name.toLowerCase().endsWith(".pdf")) {
        const buf = await file.arrayBuffer();
        const { text: extracted, totalPages, textPages } = await extractTextFromPDF(buf);
        setPdfInfo({ totalPages, textPages });
        if (!extracted) throw new Error(`הקובץ מכיל ${totalPages} עמודים ללא טקסט (PDF סרוק?)`);
        setText(extracted);
      } else {
        setText(await file.text());
      }
    } catch (e) {
      setError(e.message); setFileName("");
    } finally {
      setFileLoading(false);
    }
  };

  const createAndStart = async () => {
    if (!text.trim() || !user) return;
    setGenerating(true); setError(""); setPhase("generating");

    try {
      // 1. Create exam
      const code = generateCode();
      const title = fileName ? fileName.replace(/\.[^.]+$/, "") : text.trim().slice(0, 40);
      const { data: exam, error: eErr } = await supabase.from("exams").insert({
        workspace_id: user.id,
        title,
        subject: profile?.subject || "כללי",
        config: { mode: "flexible", total_minutes: 60, can_go_back: true },
        status: "published",
        access_code: code,
        is_self_test: true,
      }).select().single();
      if (eErr) throw eErr;

      // 2. Generate questions
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      // Build enriched text with advanced options
      let enrichedText = text.trim();
      if (topicTags.length > 0) {
        enrichedText = `נושאים חשובים שיש להתמקד בהם: ${topicTags.join(", ")}.\n\n${enrichedText}`;
      }
      if (lecturerHint.trim()) {
        enrichedText = `הנחיית המרצה/המורה: ${lecturerHint.trim()}\n\n${enrichedText}`;
      }
      if (hwText.trim()) {
        enrichedText = `${enrichedText}\n\n--- שיעורי בית ---\n${hwText.trim()}`;
      }

      const { data, error: fnErr } = await supabase.functions.invoke("smart-handler", {
        body: { text: enrichedText, num_questions: qCount, question_types: qTypes },
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);

      const newQs = [];
      (data?.content_structure ?? []).forEach(topic => {
        topic.sub_topics?.forEach(sub => {
          sub.questions?.forEach(q => newQs.push(q));
        });
      });
      if (!newQs.length) throw new Error("ה-AI לא החזיר שאלות — נסה טקסט ארוך יותר");

      const rows = newQs.slice(0, qCount).map((q, i) => ({
        exam_id: exam.id,
        sort_order: i,
        difficulty: "Medium",
        content: {
          question_text: q.question_text,
          question_type: q.question_type ?? "multiple_choice",
          options: q.options ?? [],
          correct_answer_index: q.correct_answer_index,
          ai_explanation: q.ai_explanation,
          model_answer: q.model_answer ?? null,
        },
      }));
      const { error: insErr } = await supabase.from("questions").insert(rows);
      if (insErr) throw insErr;

      // 3. Navigate to exam with self-test flag
      const name = profile?.full_name || "אנונימי";
      navigate(`/exam/${code}?selftest=1&name=${encodeURIComponent(name)}`);
    } catch (e) {
      setError(e.message);
      setGenerating(false);
      setPhase("create");
    }
  };

  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;

  // ── GENERATING SCREEN ──────────────────────────────────────
  if (phase === "generating") return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans Hebrew',sans-serif", direction: "rtl" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ width: 56, height: 56, border: `4px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 20px" }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 8 }}>מייצר שאלות...</div>
        <div style={{ fontSize: 14, color: C.muted, animation: "pulse 2s ease-in-out infinite" }}>
          AI קורא את החומר ובונה {qCount} שאלות בשבילך
        </div>
      </div>
    </div>
  );

  // ── CREATE SCREEN ──────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: `14px ${mobile ? 16 : 28}px`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate("/dashboard")}
          style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20, padding: 0, lineHeight: 1 }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.purple }}>🎓 בחן את עצמי</div>
          <div style={{ fontSize: 11, color: C.muted }}>העלה חומר לימוד וקבל בחינה מיד</div>
        </div>
        <button onClick={() => navigate("/past-exams")}
          style={{ padding: "7px 14px", background: C.amberLight, color: C.amber, border: `1px solid ${C.amber}`, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
          📂 מבחני עבר
        </button>
      </div>

      <div style={{ maxWidth: 560, margin: "0 auto", padding: mobile ? "20px 16px" : "28px 20px" }}>

        {/* Main card */}
        <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: "0 2px 16px rgba(43,41,37,0.06)", padding: mobile ? 20 : 28, marginBottom: 20 }}>

          {/* File upload */}
          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", border: `2px dashed ${fileLoading ? C.purpleMid : fileName ? C.teal : C.purpleMid}`, borderRadius: 14, cursor: fileLoading ? "wait" : "pointer", background: fileName ? C.tealLight : C.purpleLight, marginBottom: 14, transition: "all 0.2s" }}>
            <input type="file" accept=".txt,.md,.pdf" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
            <span style={{ fontSize: 22, flexShrink: 0 }}>{fileLoading ? "⏳" : fileName ? "✅" : "📎"}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: fileName ? C.teal : C.purple }}>
                {fileLoading ? "קורא קובץ..." : fileName || "העלה קובץ לימוד"}
              </div>
              {pdfInfo && (
                <div style={{ fontSize: 11, color: pdfInfo.textPages < pdfInfo.totalPages ? C.amber : C.teal, marginTop: 2 }}>
                  {pdfInfo.textPages}/{pdfInfo.totalPages} עמודים עם טקסט
                </div>
              )}
              {!fileName && <div style={{ fontSize: 11, color: C.muted }}>PDF, TXT, MD — או הדבק טקסט למטה</div>}
            </div>
            {fileName && <button onClick={e => { e.preventDefault(); e.stopPropagation(); setText(""); setFileName(""); setPdfInfo(null); }}
              style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 18, flexShrink: 0 }}>×</button>}
          </label>

          {/* Text area */}
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="או הדבק כאן טקסט מהסיכום / הספר / האתר..."
            rows={mobile ? 5 : 7}
            style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${text ? C.purple : C.border}`, borderRadius: 12, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", background: C.bg, color: C.text, boxSizing: "border-box", lineHeight: 1.6, transition: "border-color 0.2s" }}
          />
          {text.trim() && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{wordCount.toLocaleString()} מילים</div>
          )}

          {/* Q count */}
          <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 13, color: C.text, fontWeight: 600, whiteSpace: "nowrap" }}>כמה שאלות?</span>
            <div style={{ display: "flex", gap: 6, flex: 1 }}>
              {[5, 10, 15, 20].map(n => (
                <button key={n} onClick={() => setQCount(n)}
                  style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: `2px solid ${qCount === n ? C.purple : C.border}`, background: qCount === n ? C.purpleLight : "transparent", color: qCount === n ? C.purple : C.muted, fontSize: 14, fontWeight: qCount === n ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ marginTop: 12, background: C.redLight, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 13 }}>{error}</div>
          )}

          {/* Advanced options toggle */}
          <button onClick={() => setShowAdvanced(v => !v)}
            style={{ width: "100%", marginTop: 14, padding: "9px 0", background: "transparent", border: `1px dashed ${C.purpleMid}`, borderRadius: 10, fontSize: 13, color: C.purple, cursor: "pointer", fontFamily: "inherit", fontWeight: 500 }}>
            {showAdvanced ? "▲ הסתר הגדרות מתקדמות" : "▼ הגדרות מתקדמות (נושאים / רמז מרצה / שיעורי בית)"}
          </button>

          {showAdvanced && (
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12, padding: 14, background: C.bg, borderRadius: 12, border: `1px solid ${C.border}` }}>

              {/* Important topics */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>🎯 נושאים חשובים</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 7 }}>
                  {topicTags.map(t => (
                    <div key={t} style={{ display: "flex", alignItems: "center", gap: 4, background: C.purpleLight, border: `1px solid ${C.purpleMid}`, borderRadius: 20, padding: "4px 8px 4px 12px" }}>
                      <span style={{ fontSize: 12, color: C.purple, fontWeight: 600 }}>{t}</span>
                      <button onClick={() => setTopicTags(prev => prev.filter(x => x !== t))}
                        style={{ background: "none", border: "none", color: C.purple, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 7 }}>
                  <input value={topicInput} onChange={e => setTopicInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && topicInput.trim()) { setTopicTags(p => [...p, topicInput.trim()]); setTopicInput(""); } }}
                    placeholder='הוסף נושא + Enter (למשל: "פוטוסינתזה")'
                    style={{ flex: 1, padding: "8px 11px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.white }} />
                  <button onClick={() => { if (topicInput.trim()) { setTopicTags(p => [...p, topicInput.trim()]); setTopicInput(""); } }}
                    style={{ padding: "8px 14px", background: C.purple, color: "white", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+</button>
                </div>
              </div>

              {/* Lecturer hint */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>🗣️ המרצה / המורה אמר...</div>
                <textarea value={lecturerHint} onChange={e => setLecturerHint(e.target.value)}
                  placeholder='למשל: "הבחינה תתמקד בפרקים 3-5, עם דגש על חישובים"'
                  rows={2}
                  style={{ width: "100%", padding: "9px 11px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.white, resize: "vertical", boxSizing: "border-box" }} />
              </div>

              {/* Homework upload */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>📝 שיעורי בית (אופציונלי)</div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: `1px dashed ${C.purpleMid}`, borderRadius: 9, cursor: hwLoading ? "wait" : "pointer", background: hwFileName ? C.tealLight : C.purpleLight }}>
                  <input type="file" accept=".txt,.md,.pdf" style={{ display: "none" }}
                    onChange={async e => {
                      const f = e.target.files?.[0]; if (!f) return;
                      setHwLoading(true); setHwFileName(f.name);
                      const t = await extractTextFromPDF_or_text(f).catch(() => "");
                      setHwText(t); setHwLoading(false); e.target.value = "";
                    }} />
                  <span style={{ fontSize: 16 }}>{hwLoading ? "⏳" : hwFileName ? "✅" : "📎"}</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: hwFileName ? C.teal : C.purple }}>
                    {hwLoading ? "קורא..." : hwFileName || "העלה קובץ שיעורי בית"}
                  </span>
                  {hwFileName && <button onClick={e => { e.preventDefault(); e.stopPropagation(); setHwText(""); setHwFileName(""); }}
                    style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 16, marginRight: "auto" }}>×</button>}
                </label>
              </div>

              {/* Question types */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: C.text, marginBottom: 6 }}>🧩 סוגי שאלות</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[["multiple_choice","רב-ברירה"],["true_false","נכון / לא נכון"],["open","שאלה פתוחה"]].map(([k, label]) => {
                    const active = qTypes.includes(k);
                    return (
                      <button key={k}
                        onClick={() => setQTypes(prev => {
                          if (prev.includes(k)) {
                            const next = prev.filter(x => x !== k);
                            return next.length ? next : ["multiple_choice"]; // never empty
                          }
                          return [...prev, k];
                        })}
                        style={{ padding: "7px 13px", borderRadius: 20, border: `2px solid ${active ? C.purple : C.border}`, background: active ? C.purpleLight : C.white, color: active ? C.purple : C.muted, fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer", fontFamily: "inherit" }}>
                        {active ? "✓ " : ""}{label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 5 }}>שאלות פתוחות אינן מקבלות ציון אוטומטי — תוצג תשובה לדוגמה</div>
              </div>
            </div>
          )}

          {/* CTA */}
          <button onClick={createAndStart} disabled={!text.trim() || generating}
            style={{ width: "100%", marginTop: 14, padding: "14px 0", background: text.trim() && !generating ? C.purple : C.purpleMid, color: "white", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: text.trim() ? "pointer" : "not-allowed", fontFamily: "inherit", boxShadow: text.trim() ? "0 4px 18px rgba(43,41,37,0.18)" : "none", transition: "all 0.2s" }}>
            {generating ? "מייצר..." : `🚀 צור ובחן עכשיו (${qCount} שאלות)`}
          </button>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <div style={{ padding: "12px 18px", borderBottom: `1px solid ${C.border}`, fontSize: 13, fontWeight: 700, color: C.text }}>
              📚 בחינות קודמות
            </div>
            {history.map(h => {
              const sub = h.submission;
              return (
                <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 18px", borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.title}</div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 1 }}>
                      {new Date(h.created_at).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                  {sub ? (
                    <div style={{ background: sub.score >= 70 ? C.tealLight : C.redLight, color: sub.score >= 70 ? C.teal : C.red, borderRadius: 20, padding: "3px 12px", fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
                      {sub.score}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: C.amber, background: C.amberLight, borderRadius: 20, padding: "3px 10px" }}>לא הושלם</div>
                  )}
                  <button onClick={() => navigate(`/exam/${h.access_code}?selftest=1&name=${encodeURIComponent(profile?.full_name || "")}`)}
                    style={{ padding: "6px 12px", background: C.purpleLight, color: C.purple, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                    {sub ? "🔁 שוב" : "▶ המשך"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
