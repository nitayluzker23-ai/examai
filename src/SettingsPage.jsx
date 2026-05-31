import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase, useAuth } from "./App";

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleMid: "#AFA9EC",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  red: "#A32D2D", redLight: "#FCEBEB",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.09)", bg: "#f8f7ff", white: "#fff",
};

const USER_TYPES = [
  { id: "school_teacher",  icon: "🏫", label: "מורה בבית ספר" },
  { id: "private_tutor",   icon: "👤", label: "מורה פרטי" },
  { id: "company",         icon: "🏢", label: "חברה / ארגון" },
  { id: "parent",          icon: "👨‍👧", label: "הורה" },
  { id: "student",         icon: "🎓", label: "סטודנט / תלמיד" },
  { id: "other",           icon: "✨", label: "אחר" },
];

const DEFAULT_SUBJECTS = [
  "מתמטיקה","אנגלית","עברית","מדעים","ביולוגיה","פיזיקה","כימיה",
  "היסטוריה","גיאוגרפיה","תנ״ך","אזרחות","ספרות","פסיכומטרי",
];

const GRADE_LEVELS = [
  { id: "elementary", label: "יסודי",          sub: "כיתות א׳–ו׳" },
  { id: "middle",     label: "חטיבת ביניים",   sub: "כיתות ז׳–ט׳" },
  { id: "high",       label: "תיכון",           sub: "כיתות י׳–י״ב" },
  { id: "higher",     label: "השכלה גבוהה",    sub: "אקדמיה / מכללה" },
  { id: "adult",      label: "מבוגרים / ארגון", sub: "הכשרות מקצועיות" },
];

export default function SettingsPage() {
  const { user, profile, fetchProfile, signOut } = useAuth();
  const navigate = useNavigate();

  const [role,      setRole]      = useState(profile?.school_type ?? "school_teacher");
  const [subject,   setSubject]   = useState(profile?.subject ?? "");
  const [grade,     setGrade]     = useState(profile?.grade_level ?? "");
  const [fullName,  setFullName]  = useState(profile?.full_name ?? "");
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [error,     setError]     = useState("");

  // Subject editing
  const [hiddenSubjects, setHiddenSubjects] = useState([]); // subjects removed from list
  const [customSubject,  setCustomSubject]  = useState("");  // new subject being typed
  const [extraSubjects,  setExtraSubjects]  = useState([]); // user-added subjects

  const visibleDefaults = DEFAULT_SUBJECTS.filter(s => !hiddenSubjects.includes(s));
  const allSubjects = [...visibleDefaults, ...extraSubjects];

  const addCustomSubject = () => {
    const v = customSubject.trim();
    if (!v || allSubjects.includes(v)) return;
    setExtraSubjects(prev => [...prev, v]);
    setSubject(v);
    setCustomSubject("");
  };

  const removeSubject = (s) => {
    if (DEFAULT_SUBJECTS.includes(s)) {
      setHiddenSubjects(prev => [...prev, s]);
    } else {
      setExtraSubjects(prev => prev.filter(x => x !== s));
    }
    if (subject === s) setSubject("");
  };

  const save = async () => {
    setSaving(true); setSaved(false); setError("");
    const { error: e } = await supabase.from("profiles").update({
      school_type: role,
      subject:     subject || null,
      grade_level: grade || null,
      full_name:   fullName.trim() || null,
    }).eq("id", user.id);
    if (e) { setError(e.message); setSaving(false); return; }
    await fetchProfile(user.id);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div style={{ padding: "28px 20px", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl", maxWidth: 520, margin: "0 auto" }}>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.text, margin: 0 }}>⚙️ הגדרות</h1>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>עדכן את הפרופיל שלך</div>
      </div>

      {/* Name */}
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>פרטים אישיים</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6, fontWeight: 600 }}>שם מלא</div>
        <input value={fullName} onChange={e => setFullName(e.target.value)}
          placeholder="שם פרטי ושם משפחה"
          style={{ width: "100%", padding: "10px 14px", border: `1.5px solid ${C.border}`, borderRadius: 10, fontSize: 14, fontFamily: "inherit", outline: "none", background: C.bg, color: C.text, boxSizing: "border-box", direction: "rtl" }} />
        <div style={{ fontSize: 12, color: C.muted, marginTop: 10 }}>אימייל: <strong>{profile?.email || user?.email}</strong></div>
      </div>

      {/* Role */}
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>תפקיד / סוג שימוש</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {USER_TYPES.map(u => (
            <button key={u.id} onClick={() => setRole(u.id)}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: `2px solid ${role === u.id ? C.purple : C.border}`, background: role === u.id ? C.purpleLight : C.bg, cursor: "pointer", fontFamily: "inherit", textAlign: "right", transition: "all 0.15s" }}>
              <span style={{ fontSize: 18 }}>{u.icon}</span>
              <span style={{ fontSize: 13, fontWeight: role === u.id ? 700 : 400, color: role === u.id ? C.purple : C.text }}>{u.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Subject */}
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 6 }}>
          {role === "company" ? "תחום עיסוק" : role === "student" ? "מה לומד?" : "מקצוע"}
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>לחץ לבחירה · X להסרה · הוסף מקצוע משלך למטה</div>

        {/* Subject chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
          {allSubjects.map(s => {
            const isSelected = subject === s;
            return (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 0, borderRadius: 20, border: `2px solid ${isSelected ? C.purple : C.border}`, background: isSelected ? C.purpleLight : C.bg, overflow: "hidden", transition: "all 0.15s" }}>
                <button onClick={() => setSubject(s)}
                  style={{ padding: "6px 10px 6px 12px", background: "transparent", border: "none", color: isSelected ? C.purple : C.text, fontSize: 13, fontWeight: isSelected ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                  {s}
                </button>
                <button onClick={() => removeSubject(s)}
                  style={{ padding: "6px 8px 6px 4px", background: "transparent", border: "none", color: isSelected ? C.purple : C.muted, fontSize: 14, cursor: "pointer", lineHeight: 1, fontFamily: "inherit" }}>
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {/* Add custom subject */}
        <div style={{ display: "flex", gap: 7 }}>
          <input
            value={customSubject}
            onChange={e => setCustomSubject(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addCustomSubject()}
            placeholder="הוסף מקצוע חדש..."
            style={{ flex: 1, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.bg, boxSizing: "border-box" }}
          />
          <button onClick={addCustomSubject} disabled={!customSubject.trim()}
            style={{ padding: "8px 14px", background: customSubject.trim() ? C.purple : C.purpleMid, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: customSubject.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            + הוסף
          </button>
        </div>

        {/* Show current selection */}
        {subject && (
          <div style={{ marginTop: 10, fontSize: 12, color: C.teal, fontWeight: 600 }}>
            ✓ נבחר: {subject}
          </div>
        )}
      </div>

      {/* Grade level */}
      {role !== "company" && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 14 }}>
            {role === "student" ? "שלב הלימודים" : role === "parent" ? "כיתת הילד" : "שלב לימודי"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {GRADE_LEVELS.map(g => (
              <button key={g.id} onClick={() => setGrade(g.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderRadius: 12, border: `2px solid ${grade === g.id ? C.purple : C.border}`, background: grade === g.id ? C.purpleLight : C.bg, cursor: "pointer", fontFamily: "inherit", textAlign: "right", transition: "all 0.15s" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: grade === g.id ? C.purple : C.text }}>{g.label}</div>
                  <div style={{ fontSize: 11, color: C.muted }}>{g.sub}</div>
                </div>
                <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${grade === g.id ? C.purple : C.border}`, background: grade === g.id ? C.purple : "transparent", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {grade === g.id && <div style={{ width: 7, height: 7, borderRadius: "50%", background: "white" }} />}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 14 }}>{error}</div>}

      {/* Save */}
      <button onClick={save} disabled={saving}
        style={{ width: "100%", padding: "13px 0", background: saved ? C.teal : saving ? C.purpleMid : C.purple, color: "white", border: "none", borderRadius: 14, fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", fontFamily: "inherit", transition: "background 0.2s", marginBottom: 12 }}>
        {saved ? "✓ נשמר!" : saving ? "שומר..." : "שמור שינויים"}
      </button>

      {/* Branding link */}
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>🎨 מיתוג</div>
          <div style={{ fontSize: 11, color: C.muted }}>לוגו, שם וצבע ראשי למבחנים</div>
        </div>
        <button onClick={() => navigate("/dashboard/branding")}
          style={{ padding: "7px 16px", background: C.purpleLight, color: C.purple, border: `1px solid ${C.purpleMid}`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          עריכה →
        </button>
      </div>

      {/* Sign out */}
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.text }}>יציאה מהמערכת</div>
          <div style={{ fontSize: 11, color: C.muted }}>מתנתק מהחשבון</div>
        </div>
        <button onClick={signOut}
          style={{ padding: "7px 16px", background: C.redLight, color: C.red, border: `1px solid #F09595`, borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
          התנתק
        </button>
      </div>
    </div>
  );
}
