import { useState, useRef } from "react";
import { supabase, useAuth } from "./App";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa3NzY29jaWpqbWd6Z3JvbG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTI1NjgsImV4cCI6MjA5MzAyODU2OH0.0tHABuRUriHiwA42DHM7S_MmgJ54NaqrcefPP5YorMk";

// Defensive helper: ensures the apikey header is always present on
// Edge Function calls, even if the SDK's auto-attach misbehaves.
const fnHeaders = { apikey: SUPABASE_ANON_KEY };

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleMid: "#AFA9EC",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  amber: "#854F0B", amberLight: "#FAEEDA",
  red: "#A32D2D", redLight: "#FCEBEB",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.09)", bg: "#f8f7ff", white: "#fff",
};

// ── extract text from PDF (page by page via pdfjs-dist) ──
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => ("str" in item ? item.str : "")).join(" ");
    if (text.trim()) pageTexts.push(text);
  }
  return { text: pageTexts.join("\n\n"), numPages: pdf.numPages };
}

// ── convert image to base64 ──────────────────────────────
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── split text into overlapping chunks ──────────────────
function splitIntoChunks(text, chunkSize = 10000, overlap = 1000) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    if (end === text.length) break;
    start += chunkSize - overlap;
  }
  return chunks;
}

// ── merge multiple JSON results ──────────────────────────
function mergeResults(results) {
  if (results.length === 0) return null;
  if (results.length === 1) return results[0];
  const merged = { course_metadata: results[0].course_metadata, content_structure: [] };
  const topicMap = {};
  results.forEach((result, chunkIdx) => {
    if (!result.content_structure) return;
    result.content_structure.forEach(topic => {
      const key = topic.topic_name;
      if (!topicMap[key]) {
        topicMap[key] = { topic_id: `t${Object.keys(topicMap).length + 1}`, topic_name: topic.topic_name, sub_topics: [] };
        merged.content_structure.push(topicMap[key]);
      }
      const existingTopic = topicMap[key];
      topic.sub_topics.forEach(sub => {
        let existingSub = existingTopic.sub_topics.find(s => s.name === sub.name);
        if (!existingSub) {
          existingSub = { sub_topic_id: `st${existingTopic.sub_topics.length + 1}`, name: sub.name, summary: sub.summary, questions: [] };
          existingTopic.sub_topics.push(existingSub);
        }
        sub.questions.forEach(q => {
          existingSub.questions.push({
            ...q,
            question_id: `${existingSub.sub_topic_id}_q${existingSub.questions.length + 1}_c${chunkIdx}`,
            source_topic_id: existingTopic.topic_id,
            source_sub_topic_id: existingSub.sub_topic_id,
          });
        });
      });
    });
  });
  return merged;
}

// ════════════════════════════════════════════════════════
export default function ContentUploader({ onDone }) {
  const { user } = useAuth();
  const [phase,      setPhase]      = useState("upload");
  const [inputMode,  setInputMode]  = useState("text");   // text | image
  const [text,       setText]       = useState("");
  const [fileName,   setFileName]   = useState("");
  const [imageData,  setImageData]  = useState(null);     // { base64, type, preview }
  const [result,     setResult]     = useState(null);
  const [error,      setError]      = useState("");
  const [selTopics,  setSelTopics]  = useState({});
  const [examTitle,  setExamTitle]  = useState("");
  const [progress,   setProgress]   = useState({ current: 0, total: 0 });
  const [pageCount,  setPageCount]  = useState(0);
  const [pastExams,  setPastExams]  = useState([]);       // [{ name, text }]
  const [pastLoading, setPastLoading] = useState(false);
  const fileRef    = useRef();
  const imageRef   = useRef();
  const pastRef    = useRef();

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    setFileName(file.name);
    if (file.type === "application/pdf") {
      try {
        const { text: extracted, numPages } = await extractTextFromPDF(file);
        setText(extracted);
        setPageCount(numPages);
        setInputMode("text");
      } catch (e) {
        setError("לא ניתן לקרוא את ה-PDF. נסה להדביק טקסט או להעלות תמונה.");
      }
    } else {
      const raw = await file.text();
      setText(raw);
      setInputMode("text");
    }
  };

  const handleImage = async (file) => {
    if (!file) return;
    setError("");
    setFileName(file.name);
    const base64 = await fileToBase64(file);
    const preview = URL.createObjectURL(file);
    setImageData({ base64, type: file.type, preview });
    setInputMode("image");
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type.startsWith("image/")) handleImage(file);
    else handleFile(file);
  };

  const handlePastExams = async (files) => {
    if (!files?.length) return;
    setPastLoading(true);
    const loaded = [];
    for (const file of Array.from(files)) {
      try {
        let t;
        if (file.type === "application/pdf") {
          const { text: extracted } = await extractTextFromPDF(file);
          t = extracted;
        } else {
          t = await file.text();
        }
        if (t.trim()) loaded.push({ name: file.name, text: t });
      } catch (_) { /* skip unreadable file */ }
    }
    setPastExams(prev => [...prev, ...loaded]);
    setPastLoading(false);
  };

  const buildCombinedText = () => {
    if (pastExams.length === 0) return text;
    const pastSection = pastExams
      .map((e, i) => `=== מבחן קודם ${i + 1}: ${e.name} ===\n${e.text}`)
      .join("\n\n");
    return (
      `[PAST EXAMS — ניתוח סגנון המרצה]\n` +
      `השתמש במבחנים הבאים כדי להבין את סגנון השאלות, רמת הקושי וקו המחשבה של המרצה.\n` +
      `בנה שאלות חדשות שמתאימות לסגנון זה על בסיס חומר הלימוד שיגיע אחר כך.\n\n` +
      pastSection +
      `\n\n[STUDY MATERIAL — חומר לימוד לבניית שאלות חדשות]\n` +
      text
    );
  };

  const analyze = async () => {
    setPhase("analyzing");
    setError("");
    try {
      let finalResult;

      if (inputMode === "image" && imageData) {
        // single call with image
        setProgress({ current: 1, total: 1 });
        const { data, error: fnErr } = await supabase.functions.invoke("smart-handler", {
          body: { image: imageData.base64, image_type: imageData.type },
          headers: fnHeaders,
        });
        if (fnErr) throw new Error(fnErr.message);
        if (data.error) throw new Error(data.error);
        finalResult = data;
      } else {
        // text mode with chunks (combined with past exams if provided)
        const combined = buildCombinedText();
        const chunks = splitIntoChunks(combined, 10000, 1000);
        setProgress({ current: 0, total: chunks.length });
        if (chunks.length === 1) {
          const { data, error: fnErr } = await supabase.functions.invoke("smart-handler", {
            body: { text: chunks[0] },
            headers: fnHeaders,
          });
          if (fnErr) throw new Error(fnErr.message);
          if (data.error) throw new Error(data.error);
          finalResult = data;
        } else {
          const results = [];
          for (let i = 0; i < chunks.length; i++) {
            setProgress({ current: i + 1, total: chunks.length });
            const { data, error: fnErr } = await supabase.functions.invoke("smart-handler", {
              body: { text: chunks[i], chunk_index: i },
              headers: fnHeaders,
            });
            if (fnErr) throw new Error(fnErr.message);
            if (data.error) throw new Error(data.error);
            results.push(data);
            if (i < chunks.length - 1) await new Promise(r => setTimeout(r, 500));
          }
          finalResult = mergeResults(results);
        }
      }

      const sel = {};
      finalResult.content_structure.forEach(t => { sel[t.topic_id] = true; });
      setSelTopics(sel);
      setExamTitle(finalResult.course_metadata.title);
      setResult(finalResult);
      setPhase("review");
    } catch (e) {
      setError(e.message);
      setPhase("upload");
    }
  };

  const saveExam = async () => {
    setPhase("saving");
    try {
      const { data: exam, error: examErr } = await supabase
        .from("exams")
        .insert({
          workspace_id: user.id,
          title: examTitle,
          subject: examTitle,
          config: { mode: "flexible", total_minutes: 60, can_go_back: true },
          status: "draft",
        })
        .select()
        .single();
      if (examErr) throw examErr;

      const questions = [];
      result.content_structure.forEach(topic => {
        if (!selTopics[topic.topic_id]) return;
        topic.sub_topics.forEach(sub => {
          sub.questions.forEach(q => {
            questions.push({
              exam_id: exam.id,
              source_topic_id: q.source_topic_id,
              source_sub_topic_id: q.source_sub_topic_id,
              difficulty: q.difficulty,
              sort_order: questions.length,
              content: {
                question_text: q.question_text,
                options: q.options,
                correct_answer_index: q.correct_answer_index,
                ai_explanation: q.ai_explanation,
                topic_name: topic.topic_name,
                sub_topic_name: sub.name,
                sub_topic_summary: sub.summary,
              },
            });
          });
        });
      });

      const { error: qErr } = await supabase.from("questions").insert(questions);
      if (qErr) throw qErr;
      setPhase("done");
      if (onDone) onDone(exam);
    } catch (e) {
      setError(e.message);
      setPhase("review");
    }
  };

  const totalQ = result
    ? result.content_structure.filter(t => selTopics[t.topic_id]).reduce((a, t) => a + t.sub_topics.reduce((b, s) => b + s.questions.length, 0), 0)
    : 0;

  const canAnalyze = inputMode === "image" ? !!imageData : !!text.trim();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, padding: "24px 16px", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.purple, marginBottom: 3 }}>העלאת חומר לימוד</div>
          <div style={{ fontSize: 13, color: C.muted }}>טקסט, PDF או תמונה — ה-AI יבנה שאלות אוטומטית</div>
        </div>

        {/* UPLOAD */}
        {phase === "upload" && (
          <div>
            {/* Mode toggle */}
            <div style={{ display: "flex", background: C.white, border: `1px solid ${C.border}`, borderRadius: 12, padding: 4, gap: 3, marginBottom: 16 }}>
              {[["text","📝 טקסט / PDF"],["image","🖼️ תמונה"]].map(([m, l]) => (
                <button key={m} onClick={() => setInputMode(m)}
                  style={{ flex: 1, padding: "9px", borderRadius: 9, border: "none", background: inputMode === m ? C.purple : "transparent", color: inputMode === m ? "white" : C.muted, fontWeight: inputMode === m ? 600 : 400, fontSize: 13, cursor: "pointer", fontFamily: "inherit", transition: "all 0.2s" }}>
                  {l}
                </button>
              ))}
            </div>

            {/* TEXT mode */}
            {inputMode === "text" && (
              <div>
                <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => fileRef.current.click()}
                  style={{ border: `2px dashed ${C.purpleMid}`, borderRadius: 16, padding: "24px 20px", textAlign: "center", cursor: "pointer", background: C.white, marginBottom: 12 }}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, marginBottom: 2 }}>{fileName || "לחץ או גרור קובץ PDF/TXT"}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>או הדבק טקסט למטה</div>
                  <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)}
                  placeholder="הדבק את החומר הלימודי כאן..."
                  style={{ width: "100%", minHeight: 160, padding: "14px", border: `1px solid ${C.border}`, borderRadius: 14, fontSize: 13, background: C.white, color: C.text, fontFamily: "inherit", direction: "rtl", resize: "vertical", outline: "none", lineHeight: 1.7 }} />
                {text && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
                    {text.length.toLocaleString()} תווים
                    {pageCount > 0 && ` · ${pageCount} עמודים`}
                    {` · ${Math.ceil(text.length / 10000)} נתחים`}
                  </div>
                )}

                {/* Past exams section */}
                <div style={{ marginTop: 16, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "hidden" }}>
                  <div style={{ padding: "10px 14px", background: C.amberLight, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.amber }}>📚 מבחנים משנים קודמות</div>
                      <div style={{ fontSize: 11, color: "#6b5a2e", marginTop: 1 }}>אופציונלי — ה-AI ילמד את סגנון המרצה ויתאים את השאלות</div>
                    </div>
                    <button onClick={() => pastRef.current.click()} disabled={pastLoading}
                      style={{ fontSize: 12, fontWeight: 600, color: C.amber, background: C.white, border: `1px solid ${C.amber}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                      {pastLoading ? "טוען..." : "+ הוסף"}
                    </button>
                    <input ref={pastRef} type="file" accept=".pdf,.txt" multiple style={{ display: "none" }}
                      onChange={e => handlePastExams(e.target.files)} />
                  </div>
                  {pastExams.length > 0 && (
                    <div style={{ padding: "8px 14px", background: C.white }}>
                      {pastExams.map((e, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0", borderBottom: i < pastExams.length - 1 ? `1px solid ${C.border}` : "none" }}>
                          <span style={{ fontSize: 12, color: C.text }}>📄 {e.name}</span>
                          <button onClick={() => setPastExams(prev => prev.filter((_, j) => j !== i))}
                            style={{ fontSize: 11, color: C.red, background: "none", border: "none", cursor: "pointer" }}>הסר</button>
                        </div>
                      ))}
                    </div>
                  )}
                  {pastExams.length === 0 && !pastLoading && (
                    <div style={{ padding: "10px 14px", background: C.white, fontSize: 12, color: C.muted, textAlign: "center" }}>
                      לא הועלו מבחנים — השאלות יבנו על בסיס החומר בלבד
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* IMAGE mode */}
            {inputMode === "image" && (
              <div>
                <div onDrop={handleDrop} onDragOver={e => e.preventDefault()} onClick={() => imageRef.current.click()}
                  style={{ border: `2px dashed ${C.purpleMid}`, borderRadius: 16, padding: "24px 20px", textAlign: "center", cursor: "pointer", background: C.white, marginBottom: 12, minHeight: 160, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  {imageData ? (
                    <div>
                      <img src={imageData.preview} alt="תצוגה מקדימה" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 10, marginBottom: 8 }} />
                      <div style={{ fontSize: 12, color: C.teal, fontWeight: 600 }}>✓ {fileName}</div>
                      <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>לחץ להחלפה</div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>🖼️</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, marginBottom: 2 }}>לחץ או גרור תמונה</div>
                      <div style={{ fontSize: 11, color: C.muted }}>JPG, PNG, WEBP — תמונה של דף, שאלון או לוח</div>
                    </div>
                  )}
                  <input ref={imageRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleImage(e.target.files[0])} />
                </div>
                <div style={{ background: C.purpleLight, borderRadius: 10, padding: "10px 14px", fontSize: 12, color: C.purple }}>
                  Claude Vision קורא כתב יד, טבלאות, נוסחאות מתמטיות ותרשימים.
                </div>
              </div>
            )}

            {error && <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 12, marginTop: 10 }}>{error}</div>}

            <button onClick={analyze} disabled={!canAnalyze}
              style={{ width: "100%", padding: 14, background: canAnalyze ? C.purple : C.purpleMid, color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: canAnalyze ? "pointer" : "not-allowed", fontFamily: "inherit", marginTop: 14 }}>
              ניתוח עם AI ←
            </button>
          </div>
        )}

        {/* ANALYZING */}
        {phase === "analyzing" && (
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, padding: 40, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.9s linear infinite" }} />
            <div style={{ fontSize: 16, fontWeight: 600, color: C.text, marginBottom: 6 }}>
              {inputMode === "image" ? "Claude Vision קורא את התמונה..." : pastExams.length > 0 ? "ה-AI מנתח חומר + סגנון מרצה..." : "ה-AI מנתח את החומר..."}
            </div>
            {pastExams.length > 0 && (
              <div style={{ fontSize: 12, color: C.amber, background: C.amberLight, borderRadius: 8, padding: "6px 12px", marginBottom: 10 }}>
                לומד מ-{pastExams.length} מבחן{pastExams.length > 1 ? "ות" : ""} קודמ{pastExams.length > 1 ? "ות" : ""} של המרצה
              </div>
            )}
            {progress.total > 1 && (
              <div>
                <div style={{ fontSize: 13, color: C.muted, marginBottom: 12 }}>מעבד חלק {progress.current} מתוך {progress.total}</div>
                <div style={{ height: 6, background: C.purpleLight, borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: C.purple, borderRadius: 3, width: `${Math.round((progress.current / progress.total) * 100)}%`, transition: "width 0.4s" }} />
                </div>
              </div>
            )}
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* REVIEW */}
        {phase === "review" && result && (
          <div>
            <div style={{ background: C.tealLight, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.teal }}>
              ה-AI מצא {result.content_structure.length} נושאים ו-{result.content_structure.reduce((a,t)=>a+t.sub_topics.reduce((b,s)=>b+s.questions.length,0),0)} שאלות.
            </div>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 5, fontWeight: 500 }}>שם המבחן</div>
              <input value={examTitle} onChange={e => setExamTitle(e.target.value)}
                style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, background: C.white, color: C.text, fontFamily: "inherit", direction: "rtl", outline: "none" }} />
            </div>
            {result.content_structure.map(topic => (
              <div key={topic.topic_id} style={{ background: C.white, borderRadius: 16, border: `1px solid ${selTopics[topic.topic_id] ? C.purple : C.border}`, padding: 16, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: selTopics[topic.topic_id] ? 12 : 0 }}>
                  <div onClick={() => setSelTopics(s => ({ ...s, [topic.topic_id]: !s[topic.topic_id] }))}
                    style={{ width: 20, height: 20, borderRadius: 5, border: `2px solid ${selTopics[topic.topic_id] ? C.purple : C.border}`, background: selTopics[topic.topic_id] ? C.purple : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {selTopics[topic.topic_id] && <span style={{ color: "white", fontSize: 12 }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{topic.topic_name}</div>
                    <div style={{ fontSize: 11, color: C.muted }}>{topic.sub_topics.length} תתי-נושאים · {topic.sub_topics.reduce((a,s)=>a+s.questions.length,0)} שאלות</div>
                  </div>
                </div>
                {selTopics[topic.topic_id] && (
                  <div style={{ paddingRight: 30 }}>
                    {topic.sub_topics.map(sub => (
                      <div key={sub.sub_topic_id} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: C.purple, marginBottom: 4 }}>{sub.name}</div>
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, lineHeight: 1.5 }}>{sub.summary}</div>
                        {sub.questions.map(q => (
                          <div key={q.question_id} style={{ background: C.bg, borderRadius: 8, padding: "8px 10px", marginBottom: 4 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                              <span style={{ fontSize: 12, color: C.text, flex: 1, lineHeight: 1.5 }}>{q.question_text}</span>
                              <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 20, flexShrink: 0, background: q.difficulty === "Easy" ? C.tealLight : q.difficulty === "Hard" ? C.amberLight : C.purpleLight, color: q.difficulty === "Easy" ? C.teal : q.difficulty === "Hard" ? C.amber : C.purple }}>
                                {q.difficulty === "Easy" ? "קל" : q.difficulty === "Hard" ? "קשה" : "בינוני"}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {error && <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 12, marginBottom: 10 }}>{error}</div>}
            <div style={{ background: C.purpleLight, borderRadius: 12, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: C.purple }}>{totalQ} שאלות נבחרו לשמירה</div>
            <button onClick={saveExam} disabled={totalQ === 0}
              style={{ width: "100%", padding: 14, background: totalQ > 0 ? C.purple : C.purpleMid, color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: totalQ > 0 ? "pointer" : "not-allowed", fontFamily: "inherit", marginBottom: 8 }}>
              שמור מבחן ({totalQ} שאלות) ←
            </button>
            <button onClick={() => { setPhase("upload"); setText(""); setFileName(""); setResult(null); setImageData(null); }}
              style={{ width: "100%", padding: 10, background: "transparent", color: C.purple, border: `1px solid ${C.purple}`, borderRadius: 12, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
              חזרה
            </button>
          </div>
        )}

        {/* SAVING */}
        {phase === "saving" && (
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, padding: 40, textAlign: "center" }}>
            <div style={{ width: 48, height: 48, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", margin: "0 auto 16px", animation: "spin 0.9s linear infinite" }} />
            <div style={{ fontSize: 15, fontWeight: 600, color: C.text }}>שומר ב-Supabase...</div>
          </div>
        )}

        {/* DONE */}
        {phase === "done" && (
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, padding: 40, textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 6 }}>המבחן נשמר בהצלחה!</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>{totalQ} שאלות נשמרו</div>
            <button onClick={() => { setPhase("upload"); setText(""); setFileName(""); setResult(null); setImageData(null); }}
              style={{ padding: "12px 24px", background: C.purple, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              העלה חומר נוסף
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
