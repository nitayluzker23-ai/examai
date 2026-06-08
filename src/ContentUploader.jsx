import { useState, useRef } from "react";
import { supabase, useAuth } from "./App";
import { charsToPages } from "./planConfig";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const fnHeaders = { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY };

const C = {
  purple: "#37352F", purpleLight: "#F4F2EC", purpleMid: "#9B958A",
  teal: "#4F6F52", tealLight: "#E8EDE6",
  amber: "#9A7B3F", amberLight: "#F3EBD9",
  red: "#A6493B", redLight: "#F3E2DD",
  text: "#2B2925", muted: "#6B655C",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#fff",
};

// ── extract text from PPTX (jszip parses the ZIP, grabs <a:t> tags) ──
async function extractTextFromPPTX(file) {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideFiles = Object.keys(zip.files)
    .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => {
      const num = s => parseInt(s.match(/\d+/)[0]);
      return num(a) - num(b);
    });
  const texts = [];
  for (const path of slideFiles) {
    const xml = await zip.files[path].async("string");
    const matches = xml.match(/<a:t[^>]*>([^<]*)<\/a:t>/g) ?? [];
    const slideText = matches.map(m => m.replace(/<[^>]+>/g, "")).join(" ");
    if (slideText.trim()) texts.push(slideText);
  }
  return cleanText(texts.join("\n\n"));
}

// ── extract text from DOCX (mammoth does the heavy lifting) ──
async function extractTextFromDOCX(file) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return cleanText(result.value);
}

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
  return { text: cleanText(pageTexts.join("\n\n")), numPages: pdf.numPages };
}

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB hard limit

const ALLOWED_TEXT_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/markdown",
]);

// Strip the most common prompt-injection openers before sending to the AI.
// This is a client-side best-effort layer; the Edge Function system prompt
// is the authoritative defense.
function stripInjectionPatterns(text) {
  return text.replace(
    /\b(ignore\s+(all\s+)?(previous|prior)\s+instructions?|disregard\s+.{0,40}instructions?|you\s+are\s+now\s+an?\s+|act\s+as\s+an?\s+(?:ai|assistant|expert|gpt)|new\s+system\s+prompt:?|<\/?system>|\[system\])/gi,
    "[removed]"
  );
}

// ── clean noisy PDF text before sending ─────────────────
function cleanText(raw) {
  return raw
    .replace(/[ \t]+/g, " ")           // collapse whitespace runs
    .replace(/^\s*\d{1,4}\s*$/gm, "")  // lone page numbers on their own line
    .replace(/[^\S\n]+\n/g, "\n")       // trailing spaces before newline
    .replace(/\n{3,}/g, "\n\n")         // max 2 consecutive blank lines
    .trim();
}

// ── resize + compress image before base64 (saves 70-90%) ─
async function fileToBase64(file, maxPx = 1024) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
      resolve(dataUrl.split(",")[1]);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ── split text into overlapping chunks ──────────────────
// overlap=200 is enough to avoid mid-sentence cuts (was 1000 — wasteful)
function splitIntoChunks(text, chunkSize = 10000, overlap = 200) {
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

// ── extract real error message from Supabase edge function ──
async function extractFnError(fnErr) {
  try {
    const body = await fnErr.context?.json?.();
    return body?.error ?? body?.message ?? fnErr.message;
  } catch (_) {
    try {
      const text = await fnErr.context?.text?.();
      return text || fnErr.message;
    } catch (_) {
      return fnErr.message;
    }
  }
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
  const { user, canUse, planLimit } = useAuth();
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
    if (file.size > MAX_FILE_BYTES) {
      setError("הקובץ גדול מ-20MB. אנא קצר את החומר ונסה שוב.");
      return;
    }
    setFileName(file.name);
    const isPPTX = file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || file.name.endsWith(".pptx");
    const isPPT  = file.name.endsWith(".ppt") && !isPPTX;
    const isDOCX = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith(".docx");

    if (isPPT) {
      setError("קובץ PPT (פורמט ישן) אינו נתמך בדפדפן. פתח ב-PowerPoint ושמור כ-PPTX, ואז העלה שוב.");
      return;
    }

    try {
      if (file.type === "application/pdf") {
        const { text: extracted, numPages } = await extractTextFromPDF(file);
        setText(stripInjectionPatterns(extracted));
        setPageCount(numPages);
      } else if (isPPTX) {
        const extracted = await extractTextFromPPTX(file);
        setText(stripInjectionPatterns(extracted));
      } else if (isDOCX) {
        const extracted = await extractTextFromDOCX(file);
        setText(stripInjectionPatterns(extracted));
      } else {
        setText(stripInjectionPatterns(cleanText(await file.text())));
      }
      setInputMode("text");
    } catch (e) {
      setError(`לא ניתן לקרוא את הקובץ: ${e.message}`);
    }
  };

  const handleImage = async (file) => {
    if (!file) return;
    setError("");
    if (file.size > MAX_FILE_BYTES) {
      setError("הקובץ גדול מ-20MB. אנא הקטן את התמונה ונסה שוב.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("סוג קובץ לא נתמך. אנא העלה קובץ תמונה.");
      return;
    }
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
      if (file.size > MAX_FILE_BYTES) continue;
      try {
        let t;
        const isPPTX = file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || file.name.endsWith(".pptx");
        const isDOCX = file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith(".docx");
        if (file.type === "application/pdf") {
          const { text: extracted } = await extractTextFromPDF(file);
          t = extracted;
        } else if (isPPTX) {
          t = await extractTextFromPPTX(file);
        } else if (isDOCX) {
          t = await extractTextFromDOCX(file);
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
    // Truncate each past exam: style patterns are clear from the first ~4000 chars
    const PAST_EXAM_LIMIT = 4000;
    const pastSection = pastExams
      .map((e, i) => `=== מבחן קודם ${i + 1}: ${e.name} ===\n${e.text.slice(0, PAST_EXAM_LIMIT)}`)
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
    setError("");

    // ── Plan checks ──────────────────────────────────────────
    if (inputMode === "image" && !canUse("ai_image")) {
      setError("ניתוח תמונות זמין בתוכנית פרו בלבד. שדרג כדי להשתמש בפיצ'ר זה.");
      return;
    }
    if (inputMode === "text") {
      const maxChars = planLimit("text_chars");
      const combined = buildCombinedText();
      if (combined.length > maxChars) {
        setError(`הטקסט ארוך מדי לתוכנית שלך (${charsToPages(maxChars)} מקסימום). קצר את התוכן או שדרג תוכנית.`);
        return;
      }
    }
    // Exams per month check
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const { count } = await supabase
      .from("exams")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", user.id)
      .gte("created_at", monthStart);
    const maxPerMonth = planLimit("exams_per_month");
    if (maxPerMonth !== Infinity && (count ?? 0) >= maxPerMonth) {
      setError(`הגעת למגבלת ${maxPerMonth} מבחנים החודש בתוכנית שלך. שדרג תוכנית או נסה שוב בחודש הבא.`);
      return;
    }

    setPhase("analyzing");
    try {
      let finalResult;

      if (inputMode === "image" && imageData) {
        // single call with image
        setProgress({ current: 1, total: 1 });
        const { data, error: fnErr } = await supabase.functions.invoke("smart-handler", {
          body: { image: imageData.base64, image_type: imageData.type },
          headers: fnHeaders,
        });
        if (fnErr) throw new Error(await extractFnError(fnErr));
        if (data?.error) throw new Error(data.error);
        finalResult = data;
      } else {
        // text mode with chunks (combined with past exams if provided)
        const combined = buildCombinedText();
        if (!combined.trim()) throw new Error("הטקסט ריק — לא ניתן לנתח");
        const chunks = splitIntoChunks(combined, 10000, 200);
        setProgress({ current: 0, total: chunks.length });
        if (chunks.length === 1) {
          const { data, error: fnErr } = await supabase.functions.invoke("smart-handler", {
            body: { text: chunks[0] },
            headers: fnHeaders,
          });
          if (fnErr) throw new Error(await extractFnError(fnErr));
          if (data?.error) throw new Error(data.error);
          finalResult = data;
        } else {
          const results = [];
          for (let i = 0; i < chunks.length; i++) {
            setProgress({ current: i + 1, total: chunks.length });
            const { data, error: fnErr } = await supabase.functions.invoke("smart-handler", {
              body: { text: chunks[i], chunk_index: i },
              headers: fnHeaders,
            });
            if (fnErr) throw new Error(await extractFnError(fnErr));
            if (data?.error) throw new Error(data.error);
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

      // Track feature usage (fire-and-forget)
      const featureUsed = inputMode === "image" ? "ai_image"
        : pastExams.length > 0 ? "past_exams" : "ai_text";
      supabase.from("feature_events").insert({ workspace_id: user.id, feature: featureUsed }).then(() => {});
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
    <div style={{ minHeight: "100vh", background: C.bg, padding: "24px 16px", fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ maxWidth: 560, margin: "0 auto" }}>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.purple, marginBottom: 3 }}>העלאת חומר לימוד</div>
          <div style={{ fontSize: 13, color: C.muted }}>טקסט, PDF, PPTX, PPT, DOCX או תמונה — ה-AI יבנה שאלות אוטומטית</div>
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
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.purple, marginBottom: 2 }}>{fileName || "לחץ או גרור קובץ"}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>PDF · PPTX · PPT · DOCX · TXT · או הדבק טקסט למטה</div>
                  <input ref={fileRef} type="file" accept=".pdf,.txt,.doc,.docx,.pptx,.ppt" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
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
                      <div style={{ fontSize: 10, color: "#9a8060", marginTop: 2 }}>PDF · PPTX · PPT · DOCX · TXT</div>
                    </div>
                    <button onClick={() => pastRef.current.click()} disabled={pastLoading}
                      style={{ fontSize: 12, fontWeight: 600, color: C.amber, background: C.white, border: `1px solid ${C.amber}`, borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontFamily: "inherit", flexShrink: 0 }}>
                      {pastLoading ? "טוען..." : "+ הוסף"}
                    </button>
                    <input ref={pastRef} type="file" accept=".pdf,.txt,.doc,.docx,.pptx,.ppt" multiple style={{ display: "none" }}
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
