import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./App";
import { printStudentReport } from "./printUtils";
import { useAuth } from "./App";

// ── Demo data (כשאין Supabase אמיתי) ────────────────────
const DEMO_EXAMS = {
  "AB3K7P": {
    id: "exam-001", title: "מבחן סוף שנה — ביולוגיה", subject: "ביולוגיה",
    status: "published",
    config: { mode: "flexible", total_minutes: 20, can_go_back: true },
  },
  "X9QM2R": {
    id: "exam-002", title: "חזרה לפרק 3 — גנטיקה", subject: "ביולוגיה",
    status: "published",
    config: { mode: "timed", seconds_per_question: 45, can_go_back: false },
  },
  "SESS01": {
    id: "exam-003", title: "מבחן מקיף — כימיה", subject: "כימיה",
    status: "published",
    config: { mode: "sessions", break_minutes: 3, sessions: [{ mins: 5, questions: 2 }, { mins: 5, questions: 2 }] },
  },
};

const DEMO_QUESTIONS = [
  { id: "q1", sort_order: 0, difficulty: "Medium", source_topic_id: "t1", content: { question_text: "מהי הפונקציה העיקרית של המיטוכונדריה בתא?", options: ["ייצור אנרגיה (ATP)", "עיבוד חלבונים", "אחסון DNA", "פירוק פסולת"], correct_answer_index: 0, ai_explanation: "המיטוכונדריה מייצרת ATP דרך נשימה תאית. ייצור האנרגיה הוא תפקידה המרכזי — לכן היא נקראת 'תחנת הכוח' של התא. עיבוד חלבונים הוא תפקיד הריבוזום, ופירוק פסולת — הליזוזום." }},
  { id: "q2", sort_order: 1, difficulty: "Easy",   source_topic_id: "t2", content: { question_text: "מהו עיקרון הדומיננטיות של מנדל?", options: ["אלל דומיננטי מסתיר רצסיבי", "כל האללים שווים בחוזקם", "גנים תמיד מועברים ביחד", "מוטציה היא תוצר של סביבה"], correct_answer_index: 0, ai_explanation: "עיקרון הדומיננטיות קובע שכאשר יש שני אללים שונים, הדומיננטי מסתיר את הרצסיבי. האלל הרצסיבי לא נעלם — הוא פשוט לא מתבטא בפנוטיפ." }},
  { id: "q3", sort_order: 2, difficulty: "Hard",   source_topic_id: "t3", content: { question_text: "מה מניע את תהליך הברירה הטבעית?", options: ["שינוי סביבתי בלבד", "הבדלים בהישרדות ורבייה", "מוטציות מכוונות לסביבה", "רצון הפרט להסתגל"], correct_answer_index: 1, ai_explanation: "ברירה טבעית פועלת על הבדלים תורשתיים בין פרטים. פרטים עם תכונות שמשפרות הישרדות ורבייה מעבירים אותן לדור הבא בסיכוי גבוה יותר. מוטציות אינן 'מכוונות' — הן אקראיות." }},
  { id: "q4", sort_order: 3, difficulty: "Medium", source_topic_id: "t1", content: { question_text: "איזה אברון תאי מכיל את המידע הגנטי (DNA) של התא?", options: ["המיטוכונדריה", "הגרעין", "הריבוזום", "ממברנת התא"], correct_answer_index: 1, ai_explanation: "הגרעין מכיל את ה-DNA הגנומי של התא האוקריוטי. מעניין לציין שגם למיטוכונדריה יש DNA משלה (מיטוכונדריאלי), אך המידע הגנטי הראשי נמצא בגרעין." }},
];

// ── Colors ───────────────────────────────────────────────
const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleDark: "#3C3489",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  amber: "#854F0B", amberLight: "#FAEEDA",
  red: "#A32D2D", redLight: "#FCEBEB",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.09)", bg: "#f8f7ff", white: "#fff",
};

// ── shuffle array ─────────────────────────────────────────
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ── shuffle answer options while tracking correct index ───
function shuffleAnswers(questions) {
  return questions.map(q => {
    const opts = q.content.options;
    const correctIdx = q.content.correct_answer_index;
    const indexed = opts.map((opt, i) => ({ opt, isCorrect: i === correctIdx }));
    const shuffled = shuffle(indexed);
    return {
      ...q,
      content: {
        ...q.content,
        options: shuffled.map(item => item.opt),
        correct_answer_index: shuffled.findIndex(item => item.isCorrect),
      },
    };
  });
}

// ═══════════════════════════════════════════════════════════
export default function StudentExamView() {
  const { user } = useAuth() ?? {};
  const [phase, setPhase]         = useState("lobby");    // lobby | briefing | exam | break | done
  const [code, setCode]           = useState("");
  const [name, setName]           = useState("");
  const [exam, setExam]           = useState(null);
  const [questions, setQuestions] = useState([]);
  const [qIndex, setQIndex]       = useState(0);
  const [answers, setAnswers]     = useState([]);         // [{question_id, selected_index, time_spent_seconds}]
  const [selected, setSelected]   = useState(null);
  const [timeLeft, setTimeLeft]   = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [tabWarning, setTabWarning] = useState(false);
  const [tabCount, setTabCount]   = useState(0);
  const [sessionIdx, setSessionIdx] = useState(0);       // for sessions mode
  const [onBreak, setOnBreak]     = useState(false);
  const [breakLeft, setBreakLeft] = useState(0);
  const qStartRef = useRef(Date.now());
  const timerRef  = useRef(null);

  // ── Tab switch detection ────────────────────────────────
  useEffect(() => {
    if (phase !== "exam") return;
    const onBlur = () => {
      setTabCount(n => n + 1);
      setTabWarning(true);
      setTimeout(() => setTabWarning(false), 3500);
    };
    window.addEventListener("blur", onBlur);
    return () => window.removeEventListener("blur", onBlur);
  }, [phase]);

  // ── Timer ───────────────────────────────────────────────
  const startTimer = useCallback((seconds) => {
    clearInterval(timerRef.current);
    setTimeLeft(seconds);
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); return 0; }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    if (phase !== "exam" || !exam) return;
    const cfg = exam.config;
    if (cfg.mode === "timed") startTimer(cfg.seconds_per_question);
    else if (cfg.mode === "flexible") startTimer(cfg.total_minutes * 60);
    else if (cfg.mode === "sessions") startTimer(cfg.sessions[sessionIdx]?.mins * 60 ?? 300);
    return () => clearInterval(timerRef.current);
  }, [phase, qIndex, sessionIdx, exam, startTimer]);

  // auto-advance when timed runs out
  useEffect(() => {
    if (timeLeft !== 0 || !exam) return;
    if (exam.config?.mode === "timed") advanceQuestion(true);
  }, [timeLeft]); // advanceQuestion intentionally omitted — recreated each render with fresh state

  // ── Fetch exam by code ──────────────────────────────────
  const fetchExam = async () => {
    const upper = code.trim().toUpperCase();
    setLoading(true); setError("");
    try {
      // Demo mode
      if (DEMO_EXAMS[upper]) {
        await new Promise(r => setTimeout(r, 600));
        const e = DEMO_EXAMS[upper];
        setExam(e);
        setPhase("briefing");
        setLoading(false);
        return;
      }
      // Real Supabase
      const { data, error: e } = await supabase
        .from("exams")
        .select("*")
        .eq("access_code", upper)
        .eq("status", "published")
        .single();
      if (e || !data) throw new Error("קוד לא נמצא או המבחן לא פורסם");

      // Check schedule window
      const now = new Date();
      if (data.opens_at && new Date(data.opens_at) > now) {
        const when = new Date(data.opens_at).toLocaleString("he-IL");
        throw new Error(`המבחן ייפתח ב-${when}`);
      }
      if (data.closes_at && new Date(data.closes_at) < now) {
        const when = new Date(data.closes_at).toLocaleString("he-IL");
        throw new Error(`המבחן נסגר ב-${when}`);
      }

      setExam(data);
      setPhase("briefing");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Start exam ──────────────────────────────────────────
  const startExam = async () => {
    setLoading(true);
    try {
      let qs;
      if (DEMO_EXAMS[exam.access_code ?? Object.keys(DEMO_EXAMS).find(k => DEMO_EXAMS[k].id === exam.id)]) {
        await new Promise(r => setTimeout(r, 400));
        qs = shuffleAnswers(shuffle(DEMO_QUESTIONS));
      } else {
        const { data, error: e } = await supabase
          .from("questions")
          .select("*")
          .eq("exam_id", exam.id)
          .order("sort_order");
        if (e) throw e;
        qs = shuffleAnswers(shuffle(data));
      }
      setQuestions(qs);
      setQIndex(0);
      setAnswers([]);
      setSelected(null);
      qStartRef.current = Date.now();
      setPhase("exam");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Advance question ────────────────────────────────────
  const advanceQuestion = (timeout = false) => {
    clearInterval(timerRef.current);
    const spent = Math.round((Date.now() - qStartRef.current) / 1000);
    const q = questions[qIndex];
    const newAnswers = [...answers, {
      question_id: q.id,
      selected_index: timeout ? -1 : selected,
      time_spent_seconds: spent,
    }];
    setAnswers(newAnswers);
    setSelected(null);
    qStartRef.current = Date.now();

    // sessions: check if session is done
    if (exam.config.mode === "sessions") {
      const cfg = exam.config;
      const sessionQCounts = cfg.sessions.map(s => s.questions);
      let cumulative = 0;
      for (let i = 0; i <= sessionIdx; i++) cumulative += sessionQCounts[i];
      if (qIndex + 1 === cumulative && sessionIdx < cfg.sessions.length - 1) {
        if (cfg.break_minutes > 0) {
          setBreakLeft(cfg.break_minutes * 60);
          setOnBreak(true);
          setPhase("break");
          const bTimer = setInterval(() => {
            setBreakLeft(t => {
              if (t <= 1) {
                clearInterval(bTimer);
                setOnBreak(false);
                setSessionIdx(i => i + 1);
                setQIndex(qIndex + 1);
                setPhase("exam");
                return 0;
              }
              return t - 1;
            });
          }, 1000);
          return;
        } else {
          setSessionIdx(i => i + 1);
        }
      }
    }

    if (qIndex + 1 >= questions.length) {
      finishExam(newAnswers);
    } else {
      setQIndex(qIndex + 1);
    }
  };

  // ── Finish exam ─────────────────────────────────────────
  const finishExam = async (finalAnswers) => {
    clearInterval(timerRef.current);
    const score = finalAnswers.reduce((acc, a) => {
      const q = questions.find(q => q.id === a.question_id);
      return acc + (q && a.selected_index === q.content.correct_answer_index ? 1 : 0);
    }, 0);
    const scorePct = Math.round((score / questions.length) * 100);

    try {
      await supabase.from("submissions").insert({
        exam_id: exam.id,
        student_name: name,
        answers: finalAnswers,
        score: scorePct,
        completed_at: new Date().toISOString(),
        ...(user?.id ? { user_id: user.id } : {}),
      });
    } catch (_) { /* silent — demo mode */ }

    setAnswers(finalAnswers);
    setPhase("done");
  };

  // ── Format time ─────────────────────────────────────────
  const fmt = (s) => {
    if (s === null) return "";
    const m = Math.floor(s / 60), sec = s % 60;
    return `${m.toString().padStart(2,"0")}:${sec.toString().padStart(2,"0")}`;
  };

  const timerPct = () => {
    if (!exam || timeLeft === null) return 100;
    const cfg = exam.config;
    const total = cfg.mode === "timed" ? cfg.seconds_per_question
      : cfg.mode === "flexible" ? cfg.total_minutes * 60
      : cfg.sessions?.[sessionIdx]?.mins * 60 ?? 300;
    return Math.round((timeLeft / total) * 100);
  };

  const timerColor = () => {
    const p = timerPct();
    if (p > 50) return C.purple;
    if (p > 20) return C.amber;
    return C.red;
  };

  // ══════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "24px 16px", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>

        {/* Tab warning banner */}
        {tabWarning && (
          <div style={{ background: C.red, color: "white", borderRadius: 12, padding: "10px 16px", marginBottom: 12, fontSize: 13, fontWeight: 500, display: "flex", justifyContent: "space-between", alignItems: "center", animation: "slideDown 0.3s ease" }}>
            <span>יציאה מהמסך זוהתה ודווחה למורה ({tabCount}×)</span>
            <span style={{ cursor: "pointer", opacity: 0.8 }} onClick={() => setTabWarning(false)}>✕</span>
          </div>
        )}

        {/* ── LOBBY ── */}
        {phase === "lobby" && (
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: "0 2px 20px rgba(83,74,183,0.08)", overflow: "hidden" }}>
            <div style={{ background: C.purple, padding: "28px 24px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: "#CECBF6", marginBottom: 6 }}>ברוך הבא</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: "#EEEDFE" }}>כניסה למבחן</div>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 5, fontWeight: 500 }}>קוד המבחן</div>
              <input
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase().slice(0,6)); setError(""); }}
                onKeyDown={e => e.key === "Enter" && code.length === 6 && name.trim() && fetchExam()}
                placeholder="למשל: AB3K7P"
                maxLength={6}
                style={{ width: "100%", padding: "12px 14px", border: `1.5px solid ${error ? C.red : code.length === 6 ? C.purple : C.border}`, borderRadius: 12, fontSize: 20, fontWeight: 700, letterSpacing: 6, textAlign: "center", background: C.bg, color: C.text, fontFamily: "monospace", outline: "none", marginBottom: 14, transition: "border-color 0.2s" }}
              />
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 5, fontWeight: 500 }}>שם מלא</div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="שם פרטי ושם משפחה"
                style={{ width: "100%", padding: "11px 14px", border: `1.5px solid ${C.border}`, borderRadius: 12, fontSize: 14, background: C.bg, color: C.text, fontFamily: "inherit", direction: "rtl", outline: "none", marginBottom: 6 }}
              />
              {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10, marginTop: 4 }}>{error}</div>}

              <div style={{ fontSize: 11, color: C.muted, marginBottom: 16, marginTop: 6 }}>
                לדמו: נסה קוד <strong style={{ fontFamily: "monospace", color: C.purple }}>AB3K7P</strong> (גמיש) · <strong style={{ fontFamily: "monospace", color: C.purple }}>X9QM2R</strong> (מתוזמן) · <strong style={{ fontFamily: "monospace", color: C.purple }}>SESS01</strong> (סשנים)
              </div>

              <button
                onClick={fetchExam}
                disabled={loading || code.length < 6 || !name.trim()}
                style={{ width: "100%", padding: 13, background: (code.length === 6 && name.trim()) ? C.purple : "#AFA9EC", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 600, cursor: (code.length === 6 && name.trim()) ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "background 0.2s" }}>
                {loading ? "מחפש..." : "כניסה ←"}
              </button>
            </div>
          </div>
        )}

        {/* ── BRIEFING ── */}
        {phase === "briefing" && exam && (
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, boxShadow: "0 2px 20px rgba(83,74,183,0.08)", overflow: "hidden" }}>
            <div style={{ background: C.purple, padding: "24px 24px 20px" }}>
              <div style={{ fontSize: 12, color: "#CECBF6", marginBottom: 4 }}>שלום, {name}! הוזמנת למבחן:</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "#EEEDFE", marginBottom: 2 }}>{exam.title}</div>
              <div style={{ fontSize: 13, color: "#AFA9EC" }}>{exam.subject}</div>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 14 }}>חוקי המבחן</div>
              <BriefingRules exam={exam} />
              {error && <div style={{ fontSize: 12, color: C.red, margin: "10px 0" }}>{error}</div>}
              <button onClick={startExam} disabled={loading}
                style={{ width: "100%", padding: 14, background: C.purple, color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>
                {loading ? "טוען שאלות..." : "אני מוכן — התחל מבחן ←"}
              </button>
            </div>
          </div>
        )}

        {/* ── BREAK ── */}
        {phase === "break" && (
          <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, padding: 32, textAlign: "center", boxShadow: "0 2px 20px rgba(83,74,183,0.08)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>☕</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 6 }}>הפסקה</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>הפרק הבא מתחיל בעוד</div>
            <div style={{ fontSize: 52, fontWeight: 700, color: C.purple, fontFamily: "monospace", marginBottom: 20 }}>{fmt(breakLeft)}</div>
            <div style={{ height: 6, background: C.purpleLight, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ height: "100%", background: C.purple, borderRadius: 3, width: `${Math.round((breakLeft / (exam.config.break_minutes * 60)) * 100)}%`, transition: "width 1s linear" }} />
            </div>
          </div>
        )}

        {/* ── EXAM ── */}
        {phase === "exam" && questions.length > 0 && (
          <div>
            {/* Header */}
            <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "14px 16px", marginBottom: 10, boxShadow: "0 1px 8px rgba(83,74,183,0.06)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontSize: 13, color: C.muted }}>שאלה {qIndex + 1} מתוך {questions.length}</span>
                {timeLeft !== null && (
                  <span style={{ fontSize: 14, fontWeight: 700, color: timerColor(), fontFamily: "monospace", background: timerPct() <= 20 ? C.redLight : C.purpleLight, padding: "3px 10px", borderRadius: 20, transition: "all 0.3s" }}>
                    {fmt(timeLeft)}
                  </span>
                )}
              </div>
              {/* Progress bar */}
              <div style={{ height: 5, background: C.purpleLight, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                <div style={{ height: "100%", background: C.purple, borderRadius: 3, width: `${Math.round(((qIndex + 1) / questions.length) * 100)}%`, transition: "width 0.4s" }} />
              </div>
              {/* Timer bar */}
              {timeLeft !== null && (
                <div style={{ height: 3, background: "#f0f0f8", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: timerColor(), borderRadius: 2, width: `${timerPct()}%`, transition: "width 1s linear" }} />
                </div>
              )}
            </div>

            {/* Question card */}
            <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, boxShadow: "0 1px 8px rgba(83,74,183,0.06)" }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, lineHeight: 1.6, marginBottom: 20 }}>
                {questions[qIndex].content.question_text}
              </div>
              {questions[qIndex].content.options.map((opt, i) => (
                <OptionRow key={i} letter={"אבגד"[i]} text={opt} index={i} selected={selected} onSelect={setSelected} />
              ))}
              <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
                {exam.config.can_go_back && qIndex > 0 && (
                  <button onClick={() => { clearInterval(timerRef.current); setQIndex(q => q - 1); setSelected(answers[qIndex - 1]?.selected_index ?? null); }}
                    style={{ flex: 1, padding: 10, background: "transparent", color: C.purple, border: `1px solid ${C.purple}`, borderRadius: 12, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                    → חזרה
                  </button>
                )}
                <button
                  onClick={() => advanceQuestion()}
                  disabled={selected === null}
                  style={{ flex: exam.config.can_go_back && qIndex > 0 ? 2 : 1, padding: 12, background: selected !== null ? C.purple : "#AFA9EC", color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: selected !== null ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "background 0.2s" }}>
                  {qIndex + 1 === questions.length ? "סיום המבחן ←" : "שאלה הבאה ←"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {phase === "done" && (
          <div>
            <ResultHeader answers={answers} questions={questions} name={name} />
            <div style={{ textAlign: "center", marginTop: 10 }}>
              <button onClick={() => printStudentReport(exam, questions, answers, name)}
                style={{ fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 10, border: "none", background: "#534AB7", color: "white", cursor: "pointer", fontFamily: "inherit" }}>
                🖨 הורד דוח אישי PDF
              </button>
            </div>
            <TopicBreakdown answers={answers} questions={questions} />
            <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, boxShadow: "0 1px 8px rgba(83,74,183,0.06)", marginTop: 12 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 14 }}>סקירת שאלות</div>
              {questions.map((q, i) => {
                const a = answers[i];
                const isCorrect = a?.selected_index === q.content.correct_answer_index;
                const isSkip    = a?.selected_index === -1 || a === undefined;
                return <ReviewItem key={i} q={q} a={a} isCorrect={isCorrect} isSkip={isSkip} index={i} />;
              })}
            </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
      `}</style>
    </div>
  );
}

// ── BriefingRules ─────────────────────────────────────────
function BriefingRules({ exam }) {
  const cfg = exam.config;
  const rules = [];
  if (cfg.mode === "flexible") {
    rules.push({ icon: "⏱", text: `זמן כולל: ${cfg.total_minutes} דקות` });
    rules.push({ icon: cfg.can_go_back ? "✓" : "✗", text: `חזרה אחורה: ${cfg.can_go_back ? "מותרת" : "לא מותרת"}`, ok: cfg.can_go_back });
  }
  if (cfg.mode === "timed") {
    rules.push({ icon: "⏱", text: `${cfg.seconds_per_question} שניות לכל שאלה` });
    rules.push({ icon: "✗", text: "עובר אוטומטית כשהזמן נגמר", ok: false });
    rules.push({ icon: cfg.can_go_back ? "✓" : "✗", text: `חזרה אחורה: ${cfg.can_go_back ? "מותרת" : "לא מותרת"}`, ok: cfg.can_go_back });
  }
  if (cfg.mode === "sessions") {
    rules.push({ icon: "📋", text: `${cfg.sessions.length} פרקים עם הפסקות` });
    rules.push({ icon: "☕", text: `הפסקה בין פרקים: ${cfg.break_minutes} דקות` });
    cfg.sessions.forEach((s, i) => rules.push({ icon: `${i+1}.`, text: `פרק ${i+1}: ${s.questions} שאלות · ${s.mins} דקות` }));
  }
  if (exam.closes_at) {
    const when = new Date(exam.closes_at).toLocaleString("he-IL");
    rules.push({ icon: "⏰", text: `המבחן נסגר אוטומטית ב-${when}`, ok: false });
  }
  rules.push({ icon: "👁", text: "יציאה מהמסך נרשמת ומדווחת למורה", ok: false });

  return (
    <div style={{ background: C.bg, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
      {rules.map((r, i) => (
        <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: i < rules.length - 1 ? 10 : 0 }}>
          <span style={{ fontSize: 14, flexShrink: 0, minWidth: 20 }}>{r.icon}</span>
          <span style={{ fontSize: 13, color: r.ok === false ? C.red : r.ok === true ? C.teal : C.text, lineHeight: 1.5 }}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}

// ── OptionRow ─────────────────────────────────────────────
function OptionRow({ letter, text, index, selected, onSelect }) {
  const isSel = selected === index;
  return (
    <div onClick={() => onSelect(index)} style={{
      display: "flex", alignItems: "center", gap: 12, padding: "11px 14px",
      border: `${isSel ? 2 : 1}px solid ${isSel ? C.purple : C.border}`,
      borderRadius: 12, marginBottom: 8, cursor: "pointer",
      background: isSel ? C.purpleLight : C.white, transition: "all 0.15s",
    }}>
      <div style={{ width: 26, height: 26, borderRadius: "50%", border: `1.5px solid ${isSel ? C.purple : C.border}`, background: isSel ? C.purple : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: isSel ? "white" : C.muted, flexShrink: 0 }}>
        {letter}
      </div>
      <span style={{ fontSize: 14, color: C.text, lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

// ── TopicBreakdown ────────────────────────────────────────
function TopicBreakdown({ answers, questions }) {
  // Build per-topic stats
  const statsMap = {};
  questions.forEach((q, i) => {
    const a = answers[i];
    const topicId   = q.content?.source_topic_id ?? q.source_topic_id ?? "כללי";
    const topicName = q.content?.topic_name ?? topicId;
    if (!statsMap[topicId]) statsMap[topicId] = { name: topicName, total: 0, correct: 0 };
    statsMap[topicId].total++;
    if (a?.selected_index === q.content.correct_answer_index) statsMap[topicId].correct++;
  });

  const topics = Object.values(statsMap).sort((a, b) => (a.correct / a.total) - (b.correct / b.total));
  if (topics.length <= 1) return null; // no breakdown if only one topic

  const topWeak   = topics[0];
  const topStrong = topics[topics.length - 1];

  return (
    <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, boxShadow: "0 1px 8px rgba(83,74,183,0.06)", marginTop: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: C.text, marginBottom: 4 }}>ביצועים לפי נושא</div>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>סדר מהחלש לחזק</div>

      {topics.map(t => {
        const pct   = Math.round((t.correct / t.total) * 100);
        const color = pct >= 80 ? C.teal : pct >= 50 ? C.amber : C.red;
        const bg    = pct >= 80 ? C.tealLight : pct >= 50 ? C.amberLight : C.redLight;
        return (
          <div key={t.name} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{t.name}</span>
              <span style={{ fontSize: 12, color, fontWeight: 600 }}>{t.correct}/{t.total} ({pct}%)</span>
            </div>
            <div style={{ height: 7, background: "#f0f0f8", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 4, transition: "width 0.6s ease" }} />
            </div>
          </div>
        );
      })}

      {/* Summary tip */}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        {topWeak.correct / topWeak.total < 0.8 && (
          <div style={{ flex: 1, background: C.redLight, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: C.red, fontWeight: 600, marginBottom: 2 }}>📌 לחזור על</div>
            <div style={{ fontSize: 12, color: C.red }}>{topWeak.name}</div>
          </div>
        )}
        {topStrong.correct / topStrong.total >= 0.8 && (
          <div style={{ flex: 1, background: C.tealLight, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 11, color: C.teal, fontWeight: 600, marginBottom: 2 }}>⭐ חזק ב</div>
            <div style={{ fontSize: 12, color: C.teal }}>{topStrong.name}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ResultHeader ──────────────────────────────────────────
function ResultHeader({ answers, questions, name }) {
  const correct = answers.filter((a, i) => a?.selected_index === questions[i]?.content.correct_answer_index).length;
  const pct = Math.round((correct / questions.length) * 100);
  const color = pct >= 80 ? C.teal : pct >= 60 ? C.amber : C.red;
  const bg    = pct >= 80 ? C.tealLight : pct >= 60 ? C.amberLight : C.redLight;
  return (
    <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 24, textAlign: "center", boxShadow: "0 1px 8px rgba(83,74,183,0.06)" }}>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 4 }}>כל הכבוד, {name}!</div>
      <div style={{ fontSize: 52, fontWeight: 800, color, lineHeight: 1 }}>{pct}%</div>
      <div style={{ fontSize: 13, color: C.muted, marginTop: 4, marginBottom: 16 }}>{correct} מתוך {questions.length} נכון</div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {[["נכון", correct, C.teal, C.tealLight], ["שגוי", questions.length - correct, C.red, C.redLight]].map(([l, v, c, b]) => (
          <div key={l} style={{ background: b, borderRadius: 12, padding: "10px 20px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
            <div style={{ fontSize: 11, color: c }}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ReviewItem ────────────────────────────────────────────
function ReviewItem({ q, a, isCorrect, isSkip, index }) {
  const [open, setOpen] = useState(false);
  const border = isSkip ? C.border : isCorrect ? "#5DCAA5" : "#F09595";
  const bg     = isSkip ? C.white  : isCorrect ? "#E1F5EE22" : "#FCEBEB22";
  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, background: bg }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: C.text, lineHeight: 1.5, marginBottom: 4 }}>{q.content.question_text}</div>
          <div style={{ fontSize: 12, color: isSkip ? C.muted : isCorrect ? C.teal : C.red }}>
            {isSkip ? "לא נענה" : isCorrect ? "תשובה נכונה" : `ענית: ${q.content.options[a?.selected_index]} · נכון: ${q.content.options[q.content.correct_answer_index]}`}
          </div>
        </div>
        <span style={{ fontSize: 20, flexShrink: 0 }}>{isSkip ? "—" : isCorrect ? "✓" : "✗"}</span>
      </div>
      {!isSkip && !isCorrect && (
        <button onClick={() => setOpen(o => !o)} style={{ marginTop: 10, background: "none", border: `1px solid #AFA9EC`, borderRadius: 8, padding: "5px 12px", fontSize: 12, color: C.purple, cursor: "pointer", fontFamily: "inherit" }}>
          {open ? "סגור הסבר ↑" : "ניתוח תשובה ↓"}
        </button>
      )}
      {open && (
        <div style={{ background: C.redLight, border: `1px solid #F09595`, borderRadius: 10, padding: "10px 12px", marginTop: 10, fontSize: 12, color: "#791F1F", lineHeight: 1.7, animation: "fadeIn 0.2s ease" }}>
          {q.content.ai_explanation}
        </div>
      )}
    </div>
  );
}

const C_GLOBAL = { purple: "#534AB7", purpleLight: "#EEEDFE", teal: "#0F6E56", tealLight: "#E1F5EE", amber: "#854F0B", amberLight: "#FAEEDA", red: "#A32D2D", redLight: "#FCEBEB", text: "#1a1a2e", muted: "#6b7280", border: "rgba(0,0,0,0.09)", bg: "#f8f7ff", white: "#fff" };
