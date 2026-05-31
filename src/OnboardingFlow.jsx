import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, useAuth } from "./App";

const C = {
  purple: "#37352F", purpleLight: "#F4F2EC", purpleMid: "#9B958A",
  teal: "#4F6F52", tealLight: "#E8EDE6",
  text: "#2B2925", muted: "#6B655C",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#ffffff",
};

const USER_TYPES = [
  { id: "school_teacher",   icon: "🏫", label: "מורה בבית ספר",     desc: "מלמד כיתה קבועה" },
  { id: "private_tutor",    icon: "👤", label: "מורה פרטי",          desc: "שיעורים פרטיים לתלמידים" },
  { id: "company",          icon: "🏢", label: "חברה / ארגון",        desc: "מבחנים לעובדים / הכשרות" },
  { id: "parent",           icon: "👨‍👧", label: "הורה",                desc: "עוזר לילד שלי ללמוד" },
  { id: "student",          icon: "🎓", label: "סטודנט / תלמיד",     desc: "בוחן את עצמי לפני מבחן" },
  { id: "other",            icon: "✨", label: "אחר",                 desc: "" },
];

// Questions adapted per user type
const CONTEXT_QUESTIONS = {
  school_teacher: {
    q2: {
      title: "מה אתה מלמד?",
      sub:   "נתאים את שפת השאלות למקצוע",
      options: ["מתמטיקה","אנגלית","עברית","מדעים","ביולוגיה","פיזיקה","כימיה","היסטוריה","גיאוגרפיה","תנ״ך","אזרחות","ספרות","אחר"],
      field: "subject",
      grid: true,
    },
    q3: {
      title: "באיזה שלב לימודי?",
      sub:   "כיתות א׳–ו׳, חטיבה, תיכון...",
      options: [
        { id: "elementary", label: "יסודי",        sub: "כיתות א׳–ו׳" },
        { id: "middle",     label: "חטיבת ביניים", sub: "כיתות ז׳–ט׳" },
        { id: "high",       label: "תיכון",         sub: "כיתות י׳–י״ב" },
      ],
      field: "grade_level",
      grid: false,
    },
  },
  private_tutor: {
    q2: {
      title: "באיזה מקצוע אתה מתמחה?",
      sub:   "ניצור שאלות ברמה המתאימה",
      options: ["מתמטיקה","אנגלית","עברית","פיזיקה","כימיה","ביולוגיה","היסטוריה","תנ״ך","הכנה לפסיכומטרי","אחר"],
      field: "subject",
      grid: true,
    },
    q3: {
      title: "עם איזה גיל עובדים?",
      sub:   "",
      options: [
        { id: "elementary", label: "ילדים",       sub: "עד כיתה ו׳" },
        { id: "middle",     label: "נוער",         sub: "חטיבה–תיכון" },
        { id: "higher",     label: "מבוגרים",      sub: "סטודנטים / בגרויות" },
      ],
      field: "grade_level",
      grid: false,
    },
  },
  company: {
    q2: {
      title: "באיזה תחום החברה?",
      sub:   "נתאים את טון השאלות",
      options: ["הייטק / טכנולוגיה","בריאות / רפואה","משפטים","כספים / פיננסים","מכירות","לוגיסטיקה","בנייה","חינוך","אחר"],
      field: "subject",
      grid: true,
    },
    q3: {
      title: "כמה עובדים בודקים בממוצע?",
      sub:   "",
      options: [
        { id: "few",    label: "עד 20",       sub: "צוות קטן" },
        { id: "medium", label: "20–100",       sub: "חברה בינונית" },
        { id: "many",   label: "100+",         sub: "ארגון גדול" },
      ],
      field: "grade_level",
      grid: false,
    },
  },
  parent: {
    q2: {
      title: "באיזה מקצוע אתה עוזר?",
      sub:   "",
      options: ["מתמטיקה","אנגלית","עברית","מדעים","היסטוריה","תנ״ך","גיאוגרפיה","אחר"],
      field: "subject",
      grid: true,
    },
    q3: {
      title: "באיזו כיתה הילד שלך?",
      sub:   "",
      options: [
        { id: "elementary", label: "יסודי",        sub: "כיתות א׳–ו׳" },
        { id: "middle",     label: "חטיבת ביניים", sub: "כיתות ז׳–ט׳" },
        { id: "high",       label: "תיכון",         sub: "כיתות י׳–י״ב" },
      ],
      field: "grade_level",
      grid: false,
    },
  },
  student: {
    q2: {
      title: "מה אתה לומד?",
      sub:   "נבנה שאלות שיעזרו לך להתכונן",
      options: ["מתמטיקה","אנגלית","עברית","פיזיקה","כימיה","ביולוגיה","היסטוריה","כלכלה","מדעי המחשב","פסיכומטרי","אחר"],
      field: "subject",
      grid: true,
    },
    q3: {
      title: "לאיזה מבחן אתה מתכונן?",
      sub:   "",
      options: [
        { id: "bagrut",  label: "בגרות",           sub: "מבחני בגרות תיכון" },
        { id: "psycho",  label: "פסיכומטרי",        sub: "מבחן קבלה לאקדמיה" },
        { id: "uni",     label: "מבחן אוניברסיטה",  sub: "סמסטר / שנתי" },
        { id: "other",   label: "אחר",              sub: "" },
      ],
      field: "grade_level",
      grid: false,
    },
  },
  other: {
    q2: {
      title: "על איזה נושא?",
      sub:   "תאר בקצרה",
      options: [],
      field: "subject",
      grid: false,
      freeText: true,
    },
    q3: null, // skip step 3
  },
};

function SelectCard({ selected, onClick, icon, label, desc }) {
  return (
    <button onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 16px", borderRadius: 14, border: `2px solid ${selected ? C.purple : C.border}`, background: selected ? C.purpleLight : C.bg, cursor: "pointer", fontFamily: "inherit", textAlign: "right", transition: "all 0.15s", width: "100%" }}>
      <span style={{ fontSize: 24, flexShrink: 0 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: selected ? C.purple : C.text }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{desc}</div>}
      </div>
      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${selected ? C.purple : C.border}`, background: selected ? C.purple : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {selected && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "white" }} />}
      </div>
    </button>
  );
}

export default function OnboardingFlow() {
  const { user, profile, fetchProfile } = useAuth();
  const navigate = useNavigate();

  const [step,        setStep]        = useState(0); // 0=welcome, 1=who, 2=context, 3=context2
  const [userType,    setUserType]    = useState("");
  const [answer2,     setAnswer2]     = useState(""); // subject / field
  const [answer2free, setAnswer2free] = useState("");
  const [answer3,     setAnswer3]     = useState(""); // grade / size / exam type
  const [saving,      setSaving]      = useState(false);

  const [mobile, setMobile] = useState(window.innerWidth < 600);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 600);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const firstName = profile?.full_name?.split(" ")[0] || "שלום";
  const ctx = userType ? CONTEXT_QUESTIONS[userType] : null;
  const hasStep3 = ctx?.q3 !== null && ctx?.q3 !== undefined;
  const totalSteps = hasStep3 ? 4 : 3;

  const canNext = () => {
    if (step === 0) return true;
    if (step === 1) return userType !== "";
    if (step === 2) {
      if (ctx?.q2?.freeText) return answer2free.trim().length > 0;
      return answer2 !== "" && (answer2 !== "אחר" || answer2free.trim());
    }
    if (step === 3) return answer3 !== "";
    return false;
  };

  const finish = async () => {
    setSaving(true);
    const finalSubject = answer2 === "אחר" || !answer2 ? answer2free.trim() : answer2;
    await supabase.from("profiles").update({
      school_type:     userType,
      subject:         finalSubject || null,
      grade_level:     answer3 || null,
      onboarding_done: true,
    }).eq("id", user.id);
    await fetchProfile(user.id);
    navigate("/dashboard");
  };

  const next = () => {
    if (step === 1 && userType === "other") {
      // skip to free-text step (step 2) then finish
      setStep(2);
    } else if (step === 2 && !hasStep3) {
      finish();
    } else if (step < 3) {
      setStep(s => s + 1);
    } else {
      finish();
    }
  };

  const skip = async () => {
    setSaving(true);
    await supabase.from("profiles").update({ onboarding_done: true }).eq("id", user.id);
    await fetchProfile(user.id);
    navigate("/dashboard");
  };

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, #f0efff 0%, ${C.bg} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", padding: mobile ? "16px 12px" : "24px 16px", fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ width: "100%", maxWidth: 500 }}>

        {/* Progress bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 28, justifyContent: "center" }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ height: 6, width: i === step ? 32 : 12, borderRadius: 3, background: i <= step ? C.purple : C.purpleMid, transition: "all 0.3s" }} />
          ))}
        </div>

        <div style={{ background: C.white, borderRadius: 24, boxShadow: "0 8px 48px rgba(43,41,37,0.08)", overflow: "hidden" }}>

          {/* ── STEP 0: Welcome ── */}
          {step === 0 && (
            <div style={{ padding: mobile ? "28px 20px" : "40px 32px", textAlign: "center" }}>
              <div style={{ fontSize: 52, marginBottom: 16 }}>👋</div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: C.text, margin: "0 0 10px" }}>שלום, {firstName}!</h1>
              <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7, margin: "0 0 28px" }}>
                ברוך הבא ל-ExamAI. שתי שאלות קצרות<br />ואתה מוכן ליצור את הבחינה הראשונה שלך 🚀
              </p>
              <div style={{ background: C.purpleLight, borderRadius: 14, padding: "16px 20px", textAlign: "right" }}>
                {[
                  "מעלה חומר לימוד — מקבל שאלות תוך שניות",
                  "עורך, מוחק, מוסיף — הבחינה שלך",
                  "תלמיד מזין קוד קצר ומתחיל מיד",
                ].map((t, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0", fontSize: 14, color: C.purple }}>
                    <span style={{ color: C.teal, fontWeight: 800 }}>✓</span> {t}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 1: Who are you? ── */}
          {step === 1 && (
            <div style={{ padding: mobile ? "22px 16px" : "32px 28px" }}>
              <div style={{ fontSize: 30, marginBottom: 10, textAlign: "center" }}>🙋</div>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: C.text, margin: "0 0 4px", textAlign: "center" }}>מי אתה?</h2>
              <p style={{ fontSize: 13, color: C.muted, textAlign: "center", margin: "0 0 20px" }}>נתאים את המערכת בדיוק בשבילך</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {USER_TYPES.map(u => (
                  <SelectCard key={u.id} selected={userType === u.id} onClick={() => setUserType(u.id)}
                    icon={u.icon} label={u.label} desc={u.desc} />
                ))}
              </div>
            </div>
          )}

          {/* ── STEP 2: Context Q2 ── */}
          {step === 2 && ctx?.q2 && (
            <div style={{ padding: mobile ? "22px 16px" : "32px 28px" }}>
              <div style={{ fontSize: 30, marginBottom: 10, textAlign: "center" }}>📚</div>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: C.text, margin: "0 0 4px", textAlign: "center" }}>{ctx.q2.title}</h2>
              {ctx.q2.sub && <p style={{ fontSize: 13, color: C.muted, textAlign: "center", margin: "0 0 20px" }}>{ctx.q2.sub}</p>}

              {ctx.q2.freeText ? (
                <textarea value={answer2free} onChange={e => setAnswer2free(e.target.value)}
                  placeholder="תאר בקצרה את הנושא..."
                  rows={3} autoFocus
                  style={{ width: "100%", padding: "12px 14px", border: `2px solid ${C.purple}`, borderRadius: 12, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, color: C.text, boxSizing: "border-box", resize: "none" }} />
              ) : ctx.q2.grid ? (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: mobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8, marginBottom: answer2 === "אחר" ? 10 : 0 }}>
                    {ctx.q2.options.map(s => (
                      <button key={s} onClick={() => { setAnswer2(s); if (s !== "אחר") setAnswer2free(""); }}
                        style={{ padding: "10px 6px", borderRadius: 10, border: `2px solid ${answer2 === s ? C.purple : C.border}`, background: answer2 === s ? C.purpleLight : C.bg, color: answer2 === s ? C.purple : C.text, fontSize: 13, fontWeight: answer2 === s ? 700 : 400, cursor: "pointer", fontFamily: "inherit", transition: "all 0.15s" }}>
                        {s}
                      </button>
                    ))}
                  </div>
                  {answer2 === "אחר" && (
                    <input value={answer2free} onChange={e => setAnswer2free(e.target.value)}
                      placeholder="הקלד..." autoFocus
                      style={{ width: "100%", padding: "10px 14px", border: `2px solid ${C.purple}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, color: C.text, boxSizing: "border-box" }} />
                  )}
                </>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {ctx.q2.options.map(o => {
                    const id = typeof o === "string" ? o : o.id;
                    const label = typeof o === "string" ? o : o.label;
                    const sub   = typeof o === "object" ? o.sub : "";
                    return (
                      <SelectCard key={id} selected={answer2 === id} onClick={() => setAnswer2(id)}
                        icon="" label={label} desc={sub} />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── STEP 3: Context Q3 ── */}
          {step === 3 && ctx?.q3 && (
            <div style={{ padding: mobile ? "22px 16px" : "32px 28px" }}>
              <div style={{ fontSize: 30, marginBottom: 10, textAlign: "center" }}>🎯</div>
              <h2 style={{ fontSize: 21, fontWeight: 800, color: C.text, margin: "0 0 4px", textAlign: "center" }}>{ctx.q3.title}</h2>
              {ctx.q3.sub && <p style={{ fontSize: 13, color: C.muted, textAlign: "center", margin: "0 0 20px" }}>{ctx.q3.sub}</p>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {ctx.q3.options.map(o => (
                  <SelectCard key={o.id} selected={answer3 === o.id} onClick={() => setAnswer3(o.id)}
                    icon="" label={o.label} desc={o.sub} />
                ))}
              </div>
            </div>
          )}

          {/* ── Footer buttons ── */}
          <div style={{ padding: mobile ? "0 16px 20px" : "0 28px 24px", display: "flex", gap: 10 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)}
                style={{ padding: "11px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
                ← חזרה
              </button>
            )}
            <button onClick={next} disabled={!canNext() || saving}
              style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "none", background: canNext() && !saving ? C.purple : C.purpleMid, color: "white", fontSize: 15, fontWeight: 700, cursor: canNext() && !saving ? "pointer" : "not-allowed", fontFamily: "inherit", transition: "background 0.2s" }}>
              {saving ? "שמירה..." : step === totalSteps - 1 ? "🚀 בואו נתחיל!" : "המשך →"}
            </button>
          </div>

          {step < totalSteps - 1 && (
            <div style={{ textAlign: "center", paddingBottom: 20 }}>
              <button onClick={skip} style={{ background: "none", border: "none", color: C.muted, fontSize: 13, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>
                דלג, אתחיל ישר
              </button>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: C.muted }}>
          שלב {step + 1} מתוך {totalSteps}
        </div>
      </div>
    </div>
  );
}
