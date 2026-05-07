import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, useAuth } from "./App";

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleMid: "#AFA9EC",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.1)", bg: "#f8f7ff", white: "#ffffff",
};

const SUBJECTS = [
  "מתמטיקה", "אנגלית", "עברית", "מדעים", "ביולוגיה",
  "פיזיקה", "כימיה", "היסטוריה", "גיאוגרפיה", "תנ״ך",
  "אזרחות", "ספרות", "אחר",
];

const GRADES = [
  { id: "elementary", label: "יסודי",          sub: "כיתות א׳–ו׳" },
  { id: "middle",     label: "חטיבת ביניים",   sub: "כיתות ז׳–ט׳" },
  { id: "high",       label: "תיכון",           sub: "כיתות י׳–י״ב" },
  { id: "higher",     label: "השכלה גבוהה",    sub: "אקדמיה / מכללה" },
];

const EXAMS_PER_YEAR = [
  { id: "few",    label: "1–5 בחינות",   icon: "📝" },
  { id: "medium", label: "6–20 בחינות",  icon: "📚" },
  { id: "many",   label: "20+ בחינות",   icon: "🏆" },
];

const STEPS = ["ברוכים הבאים", "מה מלמדים?", "איזה שלב?", "כמה בחינות?"];

export default function OnboardingFlow() {
  const { user, profile, fetchProfile } = useAuth();
  const navigate = useNavigate();

  const [step,          setStep]          = useState(0);
  const [subject,       setSubject]       = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [gradeLevel,    setGradeLevel]    = useState("");
  const [examsPerYear,  setExamsPerYear]  = useState("");
  const [saving,        setSaving]        = useState(false);

  const firstName = profile?.full_name?.split(" ")[0] || "מורה";

  const canNext = () => {
    if (step === 0) return true;
    if (step === 1) return subject !== "" && (subject !== "אחר" || customSubject.trim());
    if (step === 2) return gradeLevel !== "";
    if (step === 3) return examsPerYear !== "";
    return false;
  };

  const finish = async () => {
    setSaving(true);
    const finalSubject = subject === "אחר" ? customSubject.trim() : subject;
    await supabase.from("profiles").update({
      subject:        finalSubject,
      grade_level:    gradeLevel,
      exams_per_year: examsPerYear,
      onboarding_done: true,
    }).eq("id", user.id);
    await fetchProfile(user.id);
    navigate("/dashboard");
  };

  const next = () => {
    if (step < 3) setStep(s => s + 1);
    else finish();
  };

  const skip = async () => {
    setSaving(true);
    await supabase.from("profiles").update({ onboarding_done: true }).eq("id", user.id);
    await fetchProfile(user.id);
    navigate("/dashboard");
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #f0efff 0%, ${C.bg} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Progress dots */}
        <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 32 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{ width: i === step ? 24 : 8, height: 8, borderRadius: 4, background: i <= step ? C.purple : C.purpleMid, transition: "all 0.3s" }} />
          ))}
        </div>

        <div style={{ background: C.white, borderRadius: 24, boxShadow: "0 8px 48px rgba(83,74,183,0.12)", overflow: "hidden" }}>

          {/* ── STEP 0: Welcome ── */}
          {step === 0 && (
            <div style={{ padding: "40px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>👋</div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "0 0 12px" }}>
                שלום, {firstName}!
              </h1>
              <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.7, margin: "0 0 8px" }}>
                ברוך הבא ל-ExamAI.
              </p>
              <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, margin: "0 0 32px" }}>
                שלוש שאלות קצרות כדי שנתאים את המערכת בדיוק בשבילך.
                זה ייקח פחות מדקה 🚀
              </p>
              <div style={{ background: C.purpleLight, borderRadius: 14, padding: "16px 20px", textAlign: "right", marginBottom: 8 }}>
                {["יוצרים בחינות מהחומר שלך בשניות", "מנתחים שגיאות של כל תלמיד", "שולחים ישירות, ללא הרשמה"].map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 14, color: C.purple, fontWeight: 500 }}>
                    <span style={{ color: C.teal, fontWeight: 800 }}>✓</span> {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 1: Subject ── */}
          {step === 1 && (
            <div style={{ padding: "36px 32px" }}>
              <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>📚</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 6px", textAlign: "center" }}>מה אתה מלמד?</h2>
              <p style={{ fontSize: 14, color: C.muted, textAlign: "center", margin: "0 0 24px" }}>בחר מקצוע — נוכל להתאים את שפת השאלות</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
                {SUBJECTS.filter(s => s !== "אחר").map(s => (
                  <button key={s} onClick={() => setSubject(s)}
                    style={{ padding: "10px 6px", borderRadius: 10, border: `2px solid ${subject === s ? C.purple : C.border}`, background: subject === s ? C.purpleLight : C.bg, color: subject === s ? C.purple : C.text, fontSize: 13, fontWeight: subject === s ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                    {s}
                  </button>
                ))}
                <button onClick={() => setSubject("אחר")}
                  style={{ padding: "10px 6px", borderRadius: 10, border: `2px solid ${subject === "אחר" ? C.purple : C.border}`, background: subject === "אחר" ? C.purpleLight : C.bg, color: subject === "אחר" ? C.purple : C.text, fontSize: 13, fontWeight: subject === "אחר" ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                  אחר
                </button>
              </div>
              {subject === "אחר" && (
                <input
                  value={customSubject}
                  onChange={e => setCustomSubject(e.target.value)}
                  placeholder="הקלד מקצוע..."
                  autoFocus
                  style={{ width: "100%", padding: "10px 14px", border: `2px solid ${C.purple}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, color: C.text, boxSizing: "border-box", marginTop: 4 }}
                />
              )}
            </div>
          )}

          {/* ── STEP 2: Grade level ── */}
          {step === 2 && (
            <div style={{ padding: "36px 32px" }}>
              <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>🏫</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 6px", textAlign: "center" }}>באיזה שלב לימודי?</h2>
              <p style={{ fontSize: 14, color: C.muted, textAlign: "center", margin: "0 0 24px" }}>נתאים את מורכבות השאלות בהתאם</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {GRADES.map(g => (
                  <button key={g.id} onClick={() => setGradeLevel(g.id)}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 14, border: `2px solid ${gradeLevel === g.id ? C.purple : C.border}`, background: gradeLevel === g.id ? C.purpleLight : C.bg, cursor: "pointer", fontFamily: "inherit", textAlign: "right", transition: "all 0.15s" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: gradeLevel === g.id ? C.purple : C.text }}>{g.label}</div>
                      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{g.sub}</div>
                    </div>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", border: `2px solid ${gradeLevel === g.id ? C.purple : C.border}`, background: gradeLevel === g.id ? C.purple : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {gradeLevel === g.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 3: Exams per year ── */}
          {step === 3 && (
            <div style={{ padding: "36px 32px" }}>
              <div style={{ fontSize: 32, marginBottom: 12, textAlign: "center" }}>📊</div>
              <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: "0 0 6px", textAlign: "center" }}>כמה בחינות בשנה?</h2>
              <p style={{ fontSize: 14, color: C.muted, textAlign: "center", margin: "0 0 24px" }}>בקירוב — עוזר לנו להבין את הצרכים שלך</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {EXAMS_PER_YEAR.map(e => (
                  <button key={e.id} onClick={() => setExamsPerYear(e.id)}
                    style={{ display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", borderRadius: 14, border: `2px solid ${examsPerYear === e.id ? C.purple : C.border}`, background: examsPerYear === e.id ? C.purpleLight : C.bg, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                    <span style={{ fontSize: 26 }}>{e.icon}</span>
                    <span style={{ fontSize: 16, fontWeight: examsPerYear === e.id ? 700 : 500, color: examsPerYear === e.id ? C.purple : C.text }}>{e.label}</span>
                    <div style={{ marginRight: "auto", width: 20, height: 20, borderRadius: "50%", border: `2px solid ${examsPerYear === e.id ? C.purple : C.border}`, background: examsPerYear === e.id ? C.purple : "transparent", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {examsPerYear === e.id && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white" }} />}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer buttons ── */}
          <div style={{ padding: "0 32px 28px", display: "flex", gap: 10 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ padding: "11px 20px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                ← חזרה
              </button>
            )}
            <button onClick={next} disabled={!canNext() || saving}
              style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "none", background: canNext() && !saving ? C.purple : C.purpleMid, color: "white", fontSize: 15, fontWeight: 700, cursor: canNext() && !saving ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "background 0.2s" }}>
              {saving ? "שמירה..." : step === 3 ? "🚀 בואו נתחיל!" : "המשך →"}
            </button>
          </div>

          {/* Skip */}
          {step < 3 && (
            <div style={{ textAlign: "center", paddingBottom: 20 }}>
              <button onClick={skip} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                דלג, אתחיל ישר
              </button>
            </div>
          )}
        </div>

        {/* Step name */}
        <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: C.muted }}>
          שלב {step + 1} מתוך {STEPS.length} · {STEPS[step]}
        </div>
      </div>
    </div>
  );
}
