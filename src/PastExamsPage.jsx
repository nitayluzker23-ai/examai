import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderOpen, Search, BarChart3, Lightbulb, Rocket, RotateCw } from "lucide-react";
import { supabase, useAuth } from "./App";
import GenerationProgress from "./GenerationProgress";
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
};

async function extractText(file) {
  if (file.name.toLowerCase().endsWith(".pdf")) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
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
  return await file.text();
}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const arr = new Uint8Array(8);
  crypto.getRandomValues(arr);
  return Array.from(arr, b => chars[b % chars.length]).join("").slice(0, 6);
}

const CONFIDENCE_COLOR = { "גבוה": C.teal, "בינוני": C.amber, "נמוך": C.muted };
const CONFIDENCE_BG    = { "גבוה": C.tealLight, "בינוני": C.amberLight, "נמוך": C.bg };

export default function PastExamsPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [files,      setFiles]      = useState([]); // [{name, label, text, loading}]
  const [subject,    setSubject]    = useState(profile?.subject || "");
  const [numQ,       setNumQ]       = useState(15);
  const [analyzing,  setAnalyzing]  = useState(false);
  const [analysis,   setAnalysis]   = useState(null);
  const [creating,   setCreating]   = useState(false);
  const [error,      setError]      = useState("");
  const [mobile,     setMobile]     = useState(window.innerWidth < 600);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 600);
    window.addEventListener("resize", fn); return () => window.removeEventListener("resize", fn);
  }, []);

  const addFiles = async (fileList) => {
    const newFiles = Array.from(fileList).filter(f =>
      f.name.match(/\.(pdf|txt|md)$/i) && !files.find(x => x.name === f.name)
    );
    if (!newFiles.length) return;

    // Add placeholders
    const placeholders = newFiles.map(f => ({ name: f.name, label: f.name.replace(/\.[^.]+$/, ""), text: "", loading: true }));
    setFiles(prev => [...prev, ...placeholders]);

    // Extract text
    for (const f of newFiles) {
      const text = await extractText(f).catch(() => "");
      setFiles(prev => prev.map(x => x.name === f.name ? { ...x, text, loading: false } : x));
    }
  };

  const removeFile = (name) => setFiles(prev => prev.filter(f => f.name !== name));

  const updateLabel = (name, label) => setFiles(prev => prev.map(f => f.name === name ? { ...f, label } : f));

  const analyze = async () => {
    const ready = files.filter(f => !f.loading && f.text.trim());
    if (ready.length < 1) return;
    setAnalyzing(true); setError(""); setAnalysis(null);

    try {
      const { data, error: fnErr } = await supabase.functions.invoke("past-exams-analyzer", {
        body: { exams: ready.map(f => ({ label: f.label, text: f.text })), num_questions: numQ, subject },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      setAnalysis(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const createExam = async () => {
    if (!analysis?.questions || !user) return;
    setCreating(true);
    try {
      const code = generateCode();
      const { data: exam, error: eErr } = await supabase.from("exams").insert({
        workspace_id: user.id,
        title: `מבחן בסגנון מבחני עבר${subject ? " — " + subject : ""}`,
        subject: subject || "כללי",
        config: { mode: "flexible", total_minutes: 60, can_go_back: true },
        status: "published",
        access_code: code,
        is_self_test: true,
      }).select().single();
      if (eErr) throw eErr;

      const qs = [];
      (analysis.questions.content_structure ?? []).forEach(topic => {
        topic.sub_topics?.forEach(sub => {
          sub.questions?.forEach(q => qs.push(q));
        });
      });

      if (qs.length) {
        await supabase.from("questions").insert(qs.slice(0, numQ).map((q, i) => ({
          exam_id: exam.id, sort_order: i, difficulty: "Medium",
          content: { question_text: q.question_text, question_type: q.question_type ?? "multiple_choice", options: q.options ?? [], correct_answer_index: q.correct_answer_index, ai_explanation: q.ai_explanation, model_answer: q.model_answer ?? null },
        })));
      }

      navigate(`/exam/${code}?selftest=1&name=${encodeURIComponent(profile?.full_name || "")}`);
    } catch (e) {
      setError(e.message); setCreating(false);
    }
  };

  const readyCount = files.filter(f => !f.loading && f.text.trim()).length;

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl" }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>

      {/* Header */}
      <div style={{ background: C.white, borderBottom: `1px solid ${C.border}`, padding: `14px ${mobile ? 16 : 28}px`, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => navigate(-1)}
          style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 20, padding: 0 }}>←</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: C.purple, display: "flex", alignItems: "center", gap: 7 }}><FolderOpen size={19} strokeWidth={1.75} /> מבחני עבר</div>
          <div style={{ fontSize: 11, color: C.muted }}>העלה מבחנים מכמה שנים — AI ינתח ויצור מבחן בסגנון</div>
        </div>
      </div>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: mobile ? "20px 16px" : "28px 20px" }}>

        {analyzing && !analysis && (
          <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}` }}>
            <GenerationProgress estSeconds={45} stages={[
              "קורא את מבחני העבר שהעלית",
              "מזהה נושאים חוזרים בין השנים",
              "מנתח את מבנה המבחן ורמות הקושי",
              "חוזה נושאים צפויים לשנה זו",
              "יוצר שאלות בסגנון המבחנים",
              "כמעט מוכן...",
            ]} />
          </div>
        )}

      {!analyzing && (<>

        {/* Upload zone */}
        <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, padding: mobile ? 20 : 28, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>שלב 1 — העלה מבחני עבר</div>

          {/* Drop zone */}
          <label style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: "28px 20px", border: `2px dashed ${C.purpleMid}`, borderRadius: 14, cursor: "pointer", background: C.purpleLight, marginBottom: 14 }}>
            <input type="file" accept=".pdf,.txt,.md" multiple style={{ display: "none" }}
              onChange={e => { addFiles(e.target.files); e.target.value = ""; }} />
            <FolderOpen size={36} color={C.purpleMid} strokeWidth={1.5} />
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: C.purple }}>גרור קבצים לכאן או לחץ לבחירה</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>PDF, TXT, MD — אפשר להעלות כמה קבצים ביחד</div>
            </div>
          </label>

          {/* File list */}
          {files.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {files.map(f => (
                <div key={f.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: C.bg, borderRadius: 10, border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: 18, flexShrink: 0 }}>{f.loading ? "⏳" : f.text ? "✅" : "⚠️"}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <input value={f.label} onChange={e => updateLabel(f.name, e.target.value)}
                      style={{ width: "100%", background: "transparent", border: "none", outline: "none", fontSize: 13, fontWeight: 600, color: C.text, fontFamily: "inherit" }}
                      placeholder="שם / שנה (לחץ לעריכה)" />
                    <div style={{ fontSize: 11, color: C.muted }}>
                      {f.loading ? "קורא..." : f.text ? `${f.text.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} מילים` : "לא הצלחנו לחלץ טקסט"}
                    </div>
                  </div>
                  <button onClick={() => removeFile(f.name)}
                    style={{ background: C.redLight, border: "none", color: C.red, width: 26, height: 26, borderRadius: "50%", cursor: "pointer", fontSize: 14, lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
              ))}
            </div>
          )}

          {files.length === 0 && (
            <div style={{ textAlign: "center", fontSize: 13, color: C.muted }}>טרם הועלו קבצים</div>
          )}
        </div>

        {/* Settings */}
        <div style={{ background: C.white, borderRadius: 18, border: `1px solid ${C.border}`, padding: mobile ? 20 : 28, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>שלב 2 — הגדרות</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 6 }}>מקצוע / נושא</div>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="למשל: כימיה אורגנית"
                style={{ width: "100%", padding: "9px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.bg, boxSizing: "border-box" }} />
            </div>
            <div style={{ minWidth: 140 }}>
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 6 }}>כמות שאלות</div>
              <div style={{ display: "flex", gap: 6 }}>
                {[10, 15, 20, 25].map(n => (
                  <button key={n} onClick={() => setNumQ(n)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: `2px solid ${numQ === n ? C.purple : C.border}`, background: numQ === n ? C.purpleLight : C.bg, color: numQ === n ? C.purple : C.muted, fontSize: 13, fontWeight: numQ === n ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error && <div style={{ background: C.redLight, color: C.red, borderRadius: 12, padding: "12px 16px", fontSize: 13, marginBottom: 16 }}>{error}</div>}

        {/* Analyze button */}
        {!analysis && (
          <button onClick={analyze} disabled={readyCount === 0 || analyzing}
            style={{ width: "100%", padding: "15px 0", background: readyCount > 0 && !analyzing ? C.purple : C.purpleMid, color: "white", border: "none", borderRadius: 14, fontSize: 16, fontWeight: 800, cursor: readyCount > 0 ? "pointer" : "not-allowed", fontFamily: "inherit", boxShadow: readyCount > 0 ? "0 4px 18px rgba(43,41,37,0.18)" : "none", marginBottom: 8 }}>
            {analyzing ? (
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <span style={{ width: 18, height: 18, border: "3px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                מנתח {readyCount} מבחנים...
              </span>
            ) : <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Search size={18} strokeWidth={1.75} /> נתח {readyCount > 0 ? readyCount : ""} מבחנים וצור שאלות</span>}
          </button>
        )}

      </>)}

        {/* Analysis results */}
        {analysis && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Recurring topics */}
            {analysis.analysis?.recurring_topics?.length > 0 && (
              <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ background: C.purpleLight, padding: "12px 18px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Search size={17} color={C.purple} strokeWidth={1.75} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.purple }}>נושאים חוזרים</div>
                </div>
                <div style={{ padding: "10px 0" }}>
                  {analysis.analysis.recurring_topics.map((t, i) => {
                    const pct = Math.round((t.count / (t.total || files.length)) * 100);
                    return (
                      <div key={i} style={{ padding: "10px 18px", borderBottom: `1px solid ${C.border}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{t.name}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: C.purple }}>{t.count}/{t.total || files.length} מבחנים</span>
                        </div>
                        <div style={{ height: 6, background: C.bg, borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: pct >= 70 ? C.teal : C.purple, borderRadius: 3, transition: "width 0.6s" }} />
                        </div>
                        {t.description && <div style={{ fontSize: 11, color: C.muted }}>{t.description}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Structure */}
            {analysis.analysis?.structure && (
              <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ background: C.tealLight, padding: "12px 18px", display: "flex", alignItems: "center", gap: 8 }}>
                  <BarChart3 size={17} color={C.teal} strokeWidth={1.75} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.teal }}>ניתוח מבנה</div>
                </div>
                <div style={{ padding: "14px 18px", display: "flex", gap: 16, flexWrap: "wrap" }}>
                  {analysis.analysis.structure.avg_questions && (
                    <div style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: C.purple }}>{analysis.analysis.structure.avg_questions}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>שאלות בממוצע</div>
                    </div>
                  )}
                  {analysis.analysis.structure.difficulty_split && (
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>פיזור רמות</div>
                      {Object.entries(analysis.analysis.structure.difficulty_split).map(([k, v]) => (
                        <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 11, color: C.muted, minWidth: 40 }}>{k === "easy" ? "קל" : k === "medium" ? "בינוני" : "קשה"}</span>
                          <div style={{ flex: 1, height: 6, background: C.bg, borderRadius: 3 }}>
                            <div style={{ height: "100%", width: `${v}%`, background: k === "easy" ? C.teal : k === "medium" ? C.purple : C.red, borderRadius: 3 }} />
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.text }}>{v}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {analysis.analysis.structure.common_formats?.length > 0 && (
                    <div>
                      <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>סוגי שאלות</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {analysis.analysis.structure.common_formats.map((f, i) => (
                          <span key={i} style={{ fontSize: 11, background: C.purpleLight, color: C.purple, padding: "3px 10px", borderRadius: 20, fontWeight: 600 }}>{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                {analysis.analysis.style_notes && (
                  <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.border}`, fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                    {analysis.analysis.style_notes}
                  </div>
                )}
              </div>
            )}

            {/* Predictions */}
            {analysis.analysis?.predictions?.length > 0 && (
              <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, overflow: "hidden" }}>
                <div style={{ background: C.amberLight, padding: "12px 18px", display: "flex", alignItems: "center", gap: 8 }}>
                  <Lightbulb size={17} color={C.amber} strokeWidth={1.75} />
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.amber }}>חיזוי נושאים לשנה זו</div>
                </div>
                <div style={{ padding: "8px 0" }}>
                  {analysis.analysis.predictions.map((p, i) => {
                    const cc = CONFIDENCE_COLOR[p.confidence] ?? C.muted;
                    const cb = CONFIDENCE_BG[p.confidence] ?? C.bg;
                    return (
                      <div key={i} style={{ padding: "10px 18px", borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "flex-start", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>{p.topic}</div>
                          <div style={{ fontSize: 11, color: C.muted }}>{p.reason}</div>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, background: cb, color: cc, padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>
                          {p.confidence}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Questions count */}
            {analysis.questions?.content_structure?.length > 0 && (
              <div style={{ background: C.tealLight, borderRadius: 12, padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontSize: 13, color: C.teal, fontWeight: 600 }}>
                  ✅ {analysis.questions.content_structure.reduce((a, t) => a + (t.sub_topics?.reduce((b, s) => b + (s.questions?.length || 0), 0) || 0), 0)} שאלות מוכנות בסגנון המבחנים
                </div>
              </div>
            )}

            {/* Actions */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={createExam} disabled={creating}
                style={{ flex: 2, padding: "13px 0", background: creating ? C.purpleMid : C.purple, color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", boxShadow: "0 4px 18px rgba(43,41,37,0.18)", minWidth: 180 }}>
                {creating ? "יוצר..." : <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}><Rocket size={17} strokeWidth={1.75} /> התחל מבחן בסגנון זה</span>}
              </button>
              <button onClick={() => { setAnalysis(null); setError(""); }}
                style={{ flex: 1, padding: "13px 0", background: C.white, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 12, fontSize: 14, cursor: "pointer", fontFamily: "inherit", minWidth: 120 }}>
<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><RotateCw size={15} /> נתח שוב</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
