import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Timer, Layers, ChevronLeft, ChevronRight, Plus, Check, Copy } from "lucide-react";
import { supabase, useAuth } from "./App";
import * as pdfjsLib from "pdfjs-dist";
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

async function extractTextFromPDF(arrayBuffer) {
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const pages = [];
  let textPages = 0;
  for (let i = 1; i <= totalPages; i++) {
    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      let pageText = "";
      let prev = null;
      for (const item of content.items) {
        if (!item.str) continue;
        if (prev) {
          const sameY = Math.abs(item.transform[5] - prev.transform[5]) < 3;
          const gap   = item.transform[4] - (prev.transform[4] + (prev.width || 0));
          if (!sameY) { pageText += "\n"; }
          else if (gap > 1.5) { pageText += " "; }
        }
        pageText += item.str;
        prev = item;
      }
      if (pageText.trim()) { pages.push(pageText.trim()); textPages++; }
    } catch (e) {
      console.warn(`PDF page ${i} extraction error:`, e);
    }
  }
  return { text: pages.join("\n\n").trim(), totalPages, textPages };
}

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleMid: "#AFA9EC",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  amber: "#854F0B", amberLight: "#FAEEDA",
  red: "#A32D2D", redLight: "#FCEBEB",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.1)", bg: "#f8f7ff", white: "#ffffff",
};

const STEPS = ["פרטים", "מבנה", "שאלות", "שליחה"];

function generateCode() {
  return Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6).padEnd(6, "0");
}

export default function ExamBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: "", subject: "", group: "" });
  const [mode, setMode] = useState(null);
  const [flexTime, setFlexTime] = useState(60);
  const [canGoBack, setCanGoBack] = useState(true);
  const [perQSecs, setPerQSecs] = useState(60);
  const [timedBack, setTimedBack] = useState(false);
  const [sessions, setSessions] = useState([{ mins: 20, questions: 10 }, { mins: 20, questions: 10 }]);
  const [breakMins, setBreakMins] = useState(5);
  const [opensAt,   setOpensAt]   = useState({ day: "", month: "", year: "", hour: 8,  min: 0 });
  const [closesAt,  setClosesAt]  = useState({ day: "", month: "", year: "", hour: 17, min: 0 });
  const [saving, setSaving]         = useState(false);
  const [saveError, setSaveError]   = useState("");
  const [savedExam, setSavedExam]   = useState(null);
  const [copied, setCopied]         = useState(false);
  // Step 2 — inline question builder
  const [inlineTab,    setInlineTab]    = useState("ai");   // "ai" | "manual"
  const [inlineText,   setInlineText]   = useState("");
  const [inlineQCount, setInlineQCount] = useState(5);
  const [generatingQ,  setGeneratingQ]  = useState(false);
  const [addedQs,      setAddedQs]      = useState([]);     // questions added so far
  const [inlineError,  setInlineError]  = useState("");
  const [fileLoading,  setFileLoading]  = useState(false);  // reading file
  const [fileName,     setFileName]     = useState("");
  const [pdfInfo,      setPdfInfo]      = useState(null);   // { totalPages, textPages }
  // Question list management
  const [expanded,     setExpanded]     = useState(null);
  const [deleting,     setDeleting]     = useState(null);
  const [uploading,    setUploading]    = useState(null);
  const [uploadError,  setUploadError]  = useState("");
  const savedExamRef = useRef(null);  // stable ref for useEffect

  const fmtSec = (s) => s < 60 ? `${s} שנ׳` : s % 60 ? `${Math.floor(s / 60)}′${s % 60}″` : `${Math.floor(s / 60)} דק׳`;
  const totalTime = sessions.reduce((a, s) => a + s.mins, 0) + breakMins * (sessions.length - 1);
  const canNext = step === 0 ? (form.name.trim() && form.subject.trim()) : step === 1 ? mode !== null : true;

  // Auto-save exam when user reaches step 2
  useEffect(() => {
    if (step !== 2 || savedExamRef.current) return;
    (async () => {
      setSaving(true); setSaveError("");
      try {
        const code = generateCode();
        const { data, error } = await supabase.from("exams").insert({
          workspace_id: user.id,
          title:        form.name,
          subject:      form.subject,
          group_name:   form.group || null,
          config:       buildConfig(),
          status:       "draft",
          access_code:  code,
          opens_at:     dtToISO(opensAt),
          closes_at:    dtToISO(closesAt),
        }).select().single();
        if (error) throw error;
        savedExamRef.current = data;
        setSavedExam(data);
      } catch (e) {
        setSaveError(e.message);
      } finally {
        setSaving(false);
      }
    })();
  }, [step]); // eslint-disable-line

  const buildConfig = () => {
    if (mode === "flexible") return { mode: "flexible", total_minutes: flexTime, can_go_back: canGoBack };
    if (mode === "timed")    return { mode: "timed", seconds_per_question: perQSecs, can_go_back: timedBack };
    return { mode: "sessions", break_minutes: breakMins, sessions };
  };

  // Generate questions inline via AI
  const generateInline = async () => {
    if (!savedExam || !inlineText.trim()) return;
    setGeneratingQ(true); setInlineError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("smart-handler", {
        body: { text: inlineText.trim(), num_questions: inlineQCount },
        headers: { Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}` },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);

      const newQs = [];
      (data?.content_structure ?? []).forEach(topic => {
        topic.sub_topics?.forEach(sub => {
          sub.questions?.forEach(q => newQs.push(q));
        });
      });
      if (!newQs.length) throw new Error("ה-AI לא החזיר שאלות, נסה טקסט ארוך יותר");

      const rows = newQs.map((q, i) => ({
        exam_id:    savedExam.id,
        sort_order: addedQs.length + i,
        difficulty: "Medium",
        content: {
          question_text:       q.question_text,
          options:             q.options,
          correct_answer_index: q.correct_answer_index,
          ai_explanation:      q.ai_explanation,
        },
      }));
      const { data: inserted, error: insErr } = await supabase.from("questions").insert(rows).select();
      if (insErr) throw insErr;
      setAddedQs(prev => [...prev, ...(inserted ?? [])]);
      setInlineText("");
    } catch (e) {
      setInlineError(e.message);
      setTimeout(() => setInlineError(""), 7000);
    } finally {
      setGeneratingQ(false);
    }
  };

  // Add a single manual question
  const addManualQ = async ({ questionText, options, correctIndex, difficulty }) => {
    if (!savedExam) return;
    const { data, error } = await supabase.from("questions").insert({
      exam_id:    savedExam.id,
      sort_order: addedQs.length,
      difficulty: difficulty ?? "Medium",
      content: { question_text: questionText, options, correct_answer_index: correctIndex },
    }).select().single();
    if (error) { setInlineError(error.message); return; }
    setAddedQs(prev => [...prev, data]);
  };

  const deleteQuestion = async (id) => {
    if (!confirm("למחוק שאלה זו?")) return;
    setDeleting(id);
    const { error: e } = await supabase.from("questions").delete().eq("id", id);
    if (e) { alert(e.message); setDeleting(null); return; }
    setAddedQs(qs => qs.filter(q => q.id !== id));
    setExpanded(null);
    setDeleting(null);
  };

  const uploadImage = async (question, file) => {
    if (!savedExam) return;
    setUploading(question.id); setUploadError("");
    try {
      const ext = file.name.split(".").pop();
      const path = `${savedExam.id}/${question.id}.${ext}`;
      const { error: upErr } = await supabase.storage.from("question-images").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from("question-images").getPublicUrl(path);
      const newContent = { ...question.content, image_url: publicUrl };
      const { error: updateErr } = await supabase.from("questions").update({ content: newContent }).eq("id", question.id);
      if (updateErr) throw updateErr;
      setAddedQs(qs => qs.map(q => q.id === question.id ? { ...q, content: newContent } : q));
    } catch (e) {
      setUploadError(e.message);
    } finally {
      setUploading(null);
    }
  };

  const removeImage = async (question) => {
    if (!confirm("להסיר את התמונה מהשאלה?")) return;
    const newContent = { ...question.content };
    delete newContent.image_url;
    const { error } = await supabase.from("questions").update({ content: newContent }).eq("id", question.id);
    if (error) { alert(error.message); return; }
    setAddedQs(qs => qs.map(q => q.id === question.id ? { ...q, content: newContent } : q));
  };

  const copyLink = () => {
    if (!savedExam) return;
    navigator.clipboard?.writeText(`${window.location.origin}/exam/${savedExam.access_code}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", justifyContent: "center", padding: "24px 16px", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.purple, marginBottom: 3 }}>בניית מבחן</div>
          <div style={{ fontSize: 13, color: C.muted }}>{form.subject || "מבחן חדש"}</div>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: 28 }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : "none" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  background: i <= step ? C.purple : C.white, border: `2px solid ${i <= step ? C.purple : C.border}`,
                  fontSize: 11, fontWeight: 600, color: i <= step ? "white" : C.muted, transition: "all 0.3s",
                }}>
                  {i < step ? <Check size={13} /> : i + 1}
                </div>
                <span style={{ fontSize: 10, color: i === step ? C.purple : C.muted, fontWeight: i === step ? 600 : 400, whiteSpace: "nowrap" }}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: i < step ? C.purple : C.border, margin: "0 4px", marginBottom: 20, transition: "background 0.3s" }} />
              )}
            </div>
          ))}
        </div>

        <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: "0 2px 16px rgba(83,74,183,0.07)", overflow: "hidden" }}>

          {/* Step 0: Details */}
          {step === 0 && (
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 20 }}>פרטי המבחן</div>
              <Field label="שם המבחן" placeholder="למשל: מבחן סוף שנה, חזרה לפרק 3..." value={form.name} onChange={v => setForm({ ...form, name: v })} />
              <Field label="מקצוע / נושא" placeholder="ביולוגיה, בטיחות, שיווק..." value={form.subject} onChange={v => setForm({ ...form, subject: v })} />
              <Field label="כיתה / קבוצה (אופציונלי)" placeholder="י׳2, מחזור 2025, קבוצת מתקדמים..." value={form.group} onChange={v => setForm({ ...form, group: v })} />

              {/* Schedule */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 16, marginTop: 4 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 12 }}>
                  🗓 חלון זמן (אופציונלי)
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <DateTimePicker label="פתיחה" value={opensAt} onChange={setOpensAt} />
                  <DateTimePicker label="סגירה" value={closesAt} onChange={setClosesAt} />
                </div>
                {(dtToISO(opensAt) || dtToISO(closesAt)) && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 8, background: C.purpleLight, borderRadius: 8, padding: "7px 10px" }}>
                    {(() => {
                      const o = fmtDT(opensAt), cl = fmtDT(closesAt);
                      if (o && !cl)  return `המבחן נפתח ${o}`;
                      if (!o && cl)  return `המבחן נסגר ${cl}`;
                      if (o && cl)   return `פתוח ${o} — ${cl}`;
                    })()}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 1: Structure */}
          {step === 1 && (
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 4 }}>מבנה המבחן</div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 18 }}>בחר את אופן ניהול הזמן</div>

              <ModeCard id="flexible" mode={mode} onSelect={setMode}
                icon={<Clock size={20} color={C.teal} />} iconBg={C.tealLight}
                title="מבחן גמיש" badgeLabel="זמן כולל" badgeColor={C.teal} badgeBg={C.tealLight}
                desc="זמן כולל לכל המבחן. אפשר לחזור לשאלות קודמות." />
              <ModeCard id="timed" mode={mode} onSelect={setMode}
                icon={<Timer size={20} color={C.purple} />} iconBg={C.purpleLight}
                title="מבחן מתוזמן" badgeLabel="לכל שאלה" badgeColor={C.purple} badgeBg={C.purpleLight}
                desc="זמן קצוב לכל שאלה. כשהזמן נגמר — עובר אוטומטית." />
              <ModeCard id="sessions" mode={mode} onSelect={setMode}
                icon={<Layers size={20} color={C.amber} />} iconBg={C.amberLight}
                title="מבחן סשנים" badgeLabel="פרקים + הפסקות" badgeColor={C.amber} badgeBg={C.amberLight}
                desc="חלוקה לפרקים עם הפסקות מתוזמנות ביניהם." />

              {mode === "flexible" && (
                <div style={{ marginTop: 16, padding: 14, background: C.bg, borderRadius: 14 }}>
                  <SliderRow label="זמן כולל" display={`${flexTime} דק׳`} value={flexTime} min={10} max={180} step={5} onChange={setFlexTime} />
                  <ToggleRow label="חזרה אחורה בין שאלות" value={canGoBack} onChange={setCanGoBack} />
                  <Summary lines={[`${flexTime} דקות לכל המבחן`, `חזרה אחורה: ${canGoBack ? "מותרת" : "לא מותרת"}`]} />
                </div>
              )}
              {mode === "timed" && (
                <div style={{ marginTop: 16, padding: 14, background: C.bg, borderRadius: 14 }}>
                  <SliderRow label="זמן לכל שאלה" display={fmtSec(perQSecs)} value={perQSecs} min={15} max={300} step={15} onChange={setPerQSecs} />
                  <ToggleRow label="חזרה אחורה בין שאלות" value={timedBack} onChange={setTimedBack} />
                  <Summary lines={[`${fmtSec(perQSecs)} לכל שאלה`, `חזרה אחורה: ${timedBack ? "מותרת" : "לא מותרת"}`]} />
                </div>
              )}
              {mode === "sessions" && (
                <div style={{ marginTop: 16, padding: 14, background: C.bg, borderRadius: 14 }}>
                  <SliderRow label="הפסקה בין פרקים" display={breakMins === 0 ? "ללא" : `${breakMins} דק׳`} value={breakMins} min={0} max={20} step={5} onChange={setBreakMins} />
                  <div style={{ marginTop: 12 }}>
                    {sessions.map((s, i) => (
                      <div key={i}>
                        <div style={{ background: C.white, borderRadius: 12, padding: "12px 14px", marginBottom: 6, border: `1px solid ${C.border}` }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: C.purple }}>פרק {i + 1}</span>
                            {sessions.length > 1 && (
                              <button onClick={() => setSessions(sessions.filter((_, j) => j !== i))}
                                style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20, lineHeight: 1 }}>×</button>
                            )}
                          </div>
                          <SliderRow label="זמן הפרק" display={`${s.mins} דק׳`} value={s.mins} min={5} max={60} step={5}
                            onChange={v => setSessions(sessions.map((ss, j) => j === i ? { ...ss, mins: v } : ss))} compact />
                          <SliderRow label="כמות שאלות" display={`${s.questions}`} value={s.questions} min={1} max={40} step={1}
                            onChange={v => setSessions(sessions.map((ss, j) => j === i ? { ...ss, questions: v } : ss))} compact />
                        </div>
                        {i < sessions.length - 1 && breakMins > 0 && (
                          <div style={{ textAlign: "center", fontSize: 11, color: C.muted, padding: "3px 0 5px" }}>הפסקה · {breakMins} דקות</div>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setSessions([...sessions, { mins: 20, questions: 10 }])}
                      style={{ width: "100%", padding: 10, background: "none", border: `1.5px dashed ${C.purpleMid}`, borderRadius: 12, cursor: "pointer", color: C.purple, fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontFamily: "inherit" }}>
                      <Plus size={14} /> הוסף פרק
                    </button>
                  </div>
                  <Summary lines={[`${sessions.length} פרקים · ${sessions.reduce((a, s) => a + s.questions, 0)} שאלות`, `סה״כ זמן: ${totalTime} דקות`]} />
                </div>
              )}
            </div>
          )}

          {/* Step 2: Questions — full management */}
          {step === 2 && (
            <div style={{ padding: 24 }}>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

              {/* Auto-save status */}
              {saving && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.muted, marginBottom: 12 }}>
                  <div style={{ width: 14, height: 14, border: `2px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  יוצר את המבחן...
                </div>
              )}
              {saveError && (
                <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 12, marginBottom: 12 }}>{saveError}</div>
              )}
              {savedExam && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, background: C.tealLight, borderRadius: 10, padding: "8px 12px" }}>
                  <Check size={14} color={C.teal} />
                  <span style={{ fontSize: 12, color: C.teal, fontWeight: 600 }}>מבחן נוצר — קוד: <code style={{ letterSpacing: 2 }}>{savedExam.access_code}</code></span>
                </div>
              )}

              {/* Section title */}
              <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 10 }}>
                הוסף שאלות {addedQs.length > 0 && <span style={{ fontSize: 12, color: C.purple, fontWeight: 600 }}>({addedQs.length} נוספו)</span>}
              </div>

              {/* Tabs */}
              <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
                {[["ai","🤖 AI מטקסט"],["manual","✍️ ידנית"]].map(([k, label]) => (
                  <button key={k} onClick={() => setInlineTab(k)}
                    style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: `1.5px solid ${inlineTab===k ? C.purple : C.border}`, background: inlineTab===k ? C.purpleLight : C.white, color: inlineTab===k ? C.purple : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* AI Tab */}
              {inlineTab === "ai" && (
                <div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: `1.5px dashed ${C.purpleMid}`, borderRadius: 10, cursor: fileLoading ? "wait" : "pointer", marginBottom: 8, background: C.purpleLight }}>
                    <input type="file" accept=".txt,.md,.pdf" style={{ display: "none" }}
                      onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 20 * 1024 * 1024) { setInlineError("הקובץ גדול מדי (מקסימום 20MB)"); return; }
                        setFileLoading(true); setFileName(file.name); setInlineError(""); setPdfInfo(null);
                        try {
                          if (file.name.toLowerCase().endsWith(".pdf")) {
                            const buf = await file.arrayBuffer();
                            const { text, totalPages, textPages } = await extractTextFromPDF(buf);
                            setPdfInfo({ totalPages, textPages });
                            if (!text) throw new Error(`הקובץ מכיל ${totalPages} עמודים אך ללא טקסט ניתן לחילוץ — ייתכן שמדובר ב-PDF סרוק (תמונות בלבד)`);
                            setInlineText(text);
                          } else {
                            const text = await file.text();
                            setInlineText(text);
                          }
                        } catch (err) {
                          setInlineError("שגיאה בקריאת הקובץ: " + err.message);
                          setFileName("");
                        } finally {
                          setFileLoading(false);
                        }
                        e.target.value = "";
                      }}
                    />
                    <span style={{ fontSize: 18 }}>{fileLoading ? "⏳" : "📎"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.purple }}>
                        {fileLoading ? "קורא קובץ..." : fileName ? `✅ ${fileName}` : "העלה קובץ (PDF, TXT, MD)"}
                      </div>
                      {pdfInfo && (
                        <div style={{ fontSize: 10, color: pdfInfo.textPages < pdfInfo.totalPages ? C.amber : C.teal, marginTop: 2 }}>
                          {pdfInfo.textPages}/{pdfInfo.totalPages} עמודים עם טקסט
                          {pdfInfo.textPages < pdfInfo.totalPages && " — חלק מהעמודים סרוקים"}
                        </div>
                      )}
                      {!fileName && <div style={{ fontSize: 10, color: C.muted }}>הטקסט יועתק אוטומטית לתיבה למטה</div>}
                    </div>
                  </label>

                  <textarea
                    value={inlineText}
                    onChange={e => setInlineText(e.target.value)}
                    placeholder="הדבק טקסט מהספר / סיכום, או העלה קובץ למעלה"
                    rows={6}
                    style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: "inherit", resize: "vertical", outline: "none", background: C.bg, color: C.text, boxSizing: "border-box", lineHeight: 1.6 }}
                  />

                  {inlineText.trim() && (
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                      {inlineText.trim().split(/\s+/).filter(Boolean).length.toLocaleString()} מילים
                    </div>
                  )}

                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: C.muted }}>מספר שאלות:</span>
                    <select value={inlineQCount} onChange={e => setInlineQCount(Number(e.target.value))}
                      style={{ fontSize: 12, padding: "5px 8px", borderRadius: 8, border: `1px solid ${C.border}`, fontFamily: "inherit", background: C.white }}>
                      {[3,5,8,10,15].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  {inlineError && <div style={{ fontSize: 12, color: C.red, marginBottom: 8 }}>{inlineError}</div>}
                  <button onClick={generateInline} disabled={!savedExam || !inlineText.trim() || generatingQ}
                    style={{ width: "100%", padding: 11, background: savedExam && inlineText.trim() && !generatingQ ? C.purple : C.purpleMid, color: "white", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    {generatingQ ? (
                      <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
                        <span style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                        מייצר שאלות...
                      </span>
                    ) : "🤖 צור שאלות"}
                  </button>
                </div>
              )}

              {/* Manual Tab */}
              {inlineTab === "manual" && (
                savedExam
                  ? <InlineManualForm onSave={addManualQ} />
                  : <div style={{ fontSize: 12, color: C.muted, textAlign: "center", padding: 20 }}>ממתין ליצירת המבחן...</div>
              )}

              {/* ── Question List ── */}
              {addedQs.length > 0 && (
                <div style={{ marginTop: 22 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 10, borderTop: `1px solid ${C.border}`, paddingTop: 16 }}>
                    שאלות במבחן ({addedQs.length})
                  </div>
                  {uploadError && (
                    <div style={{ fontSize: 11, color: C.red, marginBottom: 8 }}>{uploadError}</div>
                  )}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {addedQs.map((q, idx) => {
                      const c = q.content ?? {};
                      const isOpen = expanded === q.id;
                      return (
                        <div key={q.id} style={{ background: C.bg, border: `1px solid ${isOpen ? C.purple : C.border}`, borderRadius: 12, overflow: "hidden", transition: "border-color 0.15s" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", cursor: "pointer" }}
                            onClick={() => setExpanded(isOpen ? null : q.id)}>
                            <span style={{ fontSize: 11, color: C.muted, minWidth: 20, flexShrink: 0 }}>{idx + 1}</span>
                            <span style={{ flex: 1, fontSize: 13, color: C.text, lineHeight: 1.4 }}>{c.question_text}</span>
                            <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                          </div>
                          {isOpen && (
                            <div style={{ borderTop: `1px solid ${C.border}`, padding: "10px 14px" }}>
                              {/* Image section */}
                              {c.image_url ? (
                                <div style={{ marginBottom: 10 }}>
                                  <img src={c.image_url} alt="תמונת שאלה" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 8, border: `1px solid ${C.border}`, display: "block" }} />
                                  <button onClick={() => removeImage(q)} style={{ marginTop: 5, fontSize: 11, padding: "3px 10px", border: `1px solid #F09595`, background: C.redLight, color: C.red, borderRadius: 6, cursor: "pointer", fontFamily: "inherit" }}>
                                    🗑 הסר תמונה
                                  </button>
                                </div>
                              ) : (
                                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, padding: "5px 12px", border: `1px dashed ${C.purpleMid}`, borderRadius: 8, cursor: "pointer", color: C.purple, background: C.purpleLight, marginBottom: 10 }}>
                                  {uploading === q.id ? (
                                    <><span style={{ width: 11, height: 11, border: `2px solid ${C.purpleMid}`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} /> מעלה...</>
                                  ) : "🖼 הוסף תמונה"}
                                  <input type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }} disabled={!!uploading}
                                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(q, f); e.target.value = ""; }} />
                                </label>
                              )}
                              {/* Options */}
                              {c.options?.map((opt, i) => (
                                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 8px", borderRadius: 7, marginBottom: 4, background: i === c.correct_answer_index ? C.tealLight : "transparent", border: `1px solid ${i === c.correct_answer_index ? "#9FD9C7" : "transparent"}` }}>
                                  <span style={{ fontSize: 12, fontWeight: 700, color: i === c.correct_answer_index ? C.teal : C.muted, flexShrink: 0, minWidth: 16 }}>{i === c.correct_answer_index ? "✓" : `${i+1}.`}</span>
                                  <span style={{ fontSize: 13, color: C.text }}>{opt}</span>
                                </div>
                              ))}
                              {c.ai_explanation && (
                                <div style={{ marginTop: 8, padding: "7px 10px", background: C.purpleLight, borderRadius: 7, fontSize: 12, color: C.purple }}>
                                  <strong>הסבר: </strong>{c.ai_explanation}
                                </div>
                              )}
                              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                                <button onClick={() => deleteQuestion(q.id)} disabled={deleting === q.id}
                                  style={{ padding: "5px 14px", background: C.redLight, color: C.red, border: `1px solid #F09595`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                                  {deleting === q.id ? "מוחק..." : "🗑 מחק"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Share */}
          {step === 3 && savedExam && (
            <div style={{ padding: 24 }}>
              <div style={{ textAlign: "center", padding: "16px 0 20px" }}>
                <div style={{ width: 56, height: 56, background: C.tealLight, borderRadius: "50%", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={26} color={C.teal} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 3 }}>{savedExam.title}</div>
                <div style={{ fontSize: 13, color: C.muted }}>{savedExam.subject} · נשמר בהצלחה</div>
              </div>
              <div style={{ height: 1, background: C.border, marginBottom: 16 }} />

              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 500 }}>קוד גישה למבחן</div>
              <div style={{ background: C.purpleLight, borderRadius: 12, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, border: `1px solid ${C.purpleMid}` }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: C.purple, letterSpacing: 3, fontFamily: "monospace" }}>{savedExam.access_code}</span>
                <button onClick={copyLink}
                  style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: copied ? C.teal : C.purple, fontWeight: 600, cursor: "pointer", background: "none", border: "none", fontFamily: "inherit" }}>
                  <Copy size={13} />{copied ? "הועתק!" : "העתק קישור"}
                </button>
              </div>

              <button onClick={() => navigate(`/dashboard/exam/${savedExam.id}/questions`)}
                style={{ width: "100%", padding: 12, background: C.purple, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>
                ✏️ עבור לשאלות ←
              </button>
              <button onClick={() => navigate("/dashboard/exams")}
                style={{ width: "100%", padding: 10, background: "transparent", color: C.purple, border: `1px solid ${C.purple}`, borderRadius: 12, fontSize: 13, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>
                למבחנים שלי
              </button>
            </div>
          )}

          {/* Navigation buttons */}
          {step < 3 && (
            <div style={{ padding: "0 24px 24px", display: "flex", gap: 10 }}>
              {step > 0 && step < 2 && (
                <button onClick={() => setStep(step - 1)} disabled={saving}
                  style={{ flex: 1, padding: 10, background: "transparent", color: C.purple, border: `1px solid ${C.purple}`, borderRadius: 12, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <ChevronRight size={15} /> חזרה
                </button>
              )}
              {step < 2 && (
                <button
                  onClick={() => canNext && setStep(step + 1)}
                  disabled={!canNext}
                  style={{ flex: step > 0 ? 2 : 1, padding: 12, background: canNext ? C.purple : C.purpleMid, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: canNext ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "background 0.2s" }}>
                  המשך <ChevronLeft size={15} />
                </button>
              )}
              {step === 2 && (
                <button
                  onClick={() => setStep(3)}
                  disabled={!savedExam}
                  style={{ flex: 1, padding: 12, background: savedExam ? C.purple : C.purpleMid, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: savedExam ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  {addedQs.length > 0 ? `סיום ושליחה (${addedQs.length} שאלות)` : "דלג →"}
                  <ChevronLeft size={15} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder, value, onChange }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 5, fontWeight: 500 }}>{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "10px 12px", border: "1px solid rgba(0,0,0,0.12)", borderRadius: 10, fontSize: 14, background: "#f8f7ff", color: "#1a1a2e", fontFamily: "inherit", direction: "rtl", outline: "none" }} />
    </div>
  );
}

function ModeCard({ id, mode, onSelect, icon, iconBg, title, badgeLabel, badgeColor, badgeBg, desc }) {
  const sel = mode === id;
  return (
    <div onClick={() => onSelect(id)} style={{ border: `${sel ? 2 : 1}px solid ${sel ? "#534AB7" : "rgba(0,0,0,0.1)"}`, borderRadius: 14, padding: "12px 14px", marginBottom: 8, cursor: "pointer", background: sel ? "#EEEDFE20" : "white", transition: "all 0.2s", display: "flex", gap: 12, alignItems: "flex-start" }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e" }}>{title}</span>
          <span style={{ background: badgeBg, color: badgeColor, fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20 }}>{badgeLabel}</span>
        </div>
        <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{desc}</div>
      </div>
      {sel && <Check size={16} color="#534AB7" style={{ flexShrink: 0, marginTop: 2 }} />}
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange, display, compact }) {
  return (
    <div style={{ marginBottom: compact ? 8 : 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#534AB7" }}>{display}</span>
      </div>
      <input type="range" min={min} max={max} value={value} step={step} onChange={e => onChange(parseInt(e.target.value))} style={{ width: "100%", accentColor: "#534AB7" }} />
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0" }}>
      <span style={{ fontSize: 13, color: "#1a1a2e" }}>{label}</span>
      <div onClick={() => onChange(!value)} style={{ width: 40, height: 22, borderRadius: 11, background: value ? "#534AB7" : "rgba(0,0,0,0.15)", cursor: "pointer", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 3, right: value ? 3 : 21, transition: "right 0.2s" }} />
      </div>
    </div>
  );
}

function InlineManualForm({ onSave }) {
  const [qText,   setQText]   = useState("");
  const [opts,    setOpts]    = useState(["","","",""]);
  const [correct, setCorrect] = useState(null);
  const [saving,  setSaving]  = useState(false);
  const LETTERS = ["א","ב","ג","ד"];
  const ready = qText.trim() && opts.every(o => o.trim()) && correct !== null;

  const handleSave = async () => {
    if (!ready) return;
    setSaving(true);
    await onSave({ questionText: qText.trim(), options: opts.map(o=>o.trim()), correctIndex: correct, difficulty: "Medium" });
    setQText(""); setOpts(["","","",""]); setCorrect(null);
    setSaving(false);
  };

  return (
    <div>
      <textarea value={qText} onChange={e=>setQText(e.target.value)} placeholder="טקסט השאלה" rows={2}
        style={{ width:"100%", padding:"9px 12px", border:`1px solid rgba(0,0,0,0.1)`, borderRadius:10, fontSize:13, fontFamily:"inherit", resize:"vertical", outline:"none", background:"#f8f7ff", boxSizing:"border-box", marginBottom:8 }} />
      {opts.map((o, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:7, marginBottom:6 }}>
          <div onClick={()=>setCorrect(i)} style={{ width:26, height:26, borderRadius:"50%", background: correct===i ? "#534AB7" : "#EEEDFE", color: correct===i ? "white" : "#534AB7", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:700, fontSize:12, cursor:"pointer", flexShrink:0 }}>{LETTERS[i]}</div>
          <input value={o} onChange={e=>setOpts(opts.map((v,j)=>j===i?e.target.value:v))} placeholder={`תשובה ${LETTERS[i]}`}
            style={{ flex:1, padding:"7px 10px", border:`1px solid rgba(0,0,0,0.1)`, borderRadius:8, fontSize:13, fontFamily:"inherit", outline:"none", background:"#f8f7ff" }} />
        </div>
      ))}
      {correct === null && <div style={{fontSize:11,color:"#6b7280",marginBottom:8}}>לחץ על אות לסמן תשובה נכונה</div>}
      <button onClick={handleSave} disabled={!ready||saving}
        style={{ width:"100%", padding:10, background: ready&&!saving ? "#534AB7":"#AFA9EC", color:"white", border:"none", borderRadius:10, fontSize:13, fontWeight:600, cursor: ready&&!saving?"pointer":"not-allowed", fontFamily:"inherit", marginTop:4 }}>
        {saving ? "שומר..." : "+ הוסף שאלה"}
      </button>
    </div>
  );
}

function Summary({ lines }) {
  return (
    <div style={{ background: "#EEEDFE", borderRadius: 10, padding: "10px 12px", marginTop: 12 }}>
      {lines.map((l, i) => <div key={i} style={{ fontSize: 12, color: "#3C3489", lineHeight: 1.8 }}>{l}</div>)}
    </div>
  );
}

// ── DateTime helpers ─────────────────────────────────────────
const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];
const DAYS    = Array.from({ length: 31 }, (_, i) => i + 1);
const MONTHS  = [
  [1,"ינואר"],[2,"פברואר"],[3,"מרץ"],[4,"אפריל"],[5,"מאי"],[6,"יוני"],
  [7,"יולי"],[8,"אוגוסט"],[9,"ספטמבר"],[10,"אוקטובר"],[11,"נובמבר"],[12,"דצמבר"],
];
const THIS_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => THIS_YEAR + i);

function dtToISO(dt) {
  if (!dt.day || !dt.month || !dt.year) return null;
  const y = String(dt.year);
  const m = String(dt.month).padStart(2, "0");
  const d = String(dt.day).padStart(2, "0");
  const h = String(dt.hour).padStart(2, "0");
  const mn = String(dt.min).padStart(2, "0");
  return new Date(`${y}-${m}-${d}T${h}:${mn}:00`).toISOString();
}

function fmtDT(dt) {
  if (!dt.day || !dt.month || !dt.year) return null;
  return `${String(dt.day).padStart(2,"0")}/${String(dt.month).padStart(2,"0")}/${dt.year} ${String(dt.hour).padStart(2,"0")}:${String(dt.min).padStart(2,"0")}`;
}

const selSt = {
  padding: "7px 4px", border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8,
  fontSize: 12, background: "#f8f7ff", color: "#1a1a2e", fontFamily: "inherit",
  outline: "none", cursor: "pointer", width: "100%", textAlign: "center",
};

function DateTimePicker({ label, value, onChange }) {
  const { day, month, year, hour, min } = value;
  const set = (key, val) => onChange({ ...value, [key]: val });
  return (
    <div>
      <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 4 }}>{label}</div>

      {/* Date row — DD / MM / YYYY (LTR order) */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 3fr 3fr", gap: 4, marginBottom: 5, direction: "ltr" }}>
        <select value={day}   onChange={e => set("day",   Number(e.target.value))} style={selSt}>
          <option value="">יום</option>
          {DAYS.map(d => <option key={d} value={d}>{String(d).padStart(2,"0")}</option>)}
        </select>
        <select value={month} onChange={e => set("month", Number(e.target.value))} style={selSt}>
          <option value="">חודש</option>
          {MONTHS.map(([n, name]) => <option key={n} value={n}>{name}</option>)}
        </select>
        <select value={year}  onChange={e => set("year",  Number(e.target.value))} style={selSt}>
          <option value="">שנה</option>
          {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>

      {/* Time row — HH : MM (LTR order) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 4, alignItems: "center", direction: "ltr" }}>
        <select value={hour} onChange={e => set("hour", Number(e.target.value))} style={selSt}>
          {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2,"0")}</option>)}
        </select>
        <span style={{ fontSize: 14, fontWeight: 700, color: "#6b7280" }}>:</span>
        <select value={min}  onChange={e => set("min",  Number(e.target.value))} style={selSt}>
          {MINUTES.map(m => <option key={m} value={m}>{String(m).padStart(2,"0")}</option>)}
        </select>
      </div>
    </div>
  );
}
