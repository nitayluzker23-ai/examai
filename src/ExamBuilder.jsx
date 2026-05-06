import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Timer, Layers, ChevronLeft, ChevronRight, Plus, Check, Copy } from "lucide-react";
import { supabase, useAuth } from "./App";

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
  const [opensAt,   setOpensAt]   = useState("");   // datetime-local string
  const [closesAt,  setClosesAt]  = useState("");   // datetime-local string
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedExam, setSavedExam] = useState(null);
  const [copied, setCopied] = useState(false);

  const fmtSec = (s) => s < 60 ? `${s} שנ׳` : s % 60 ? `${Math.floor(s / 60)}′${s % 60}″` : `${Math.floor(s / 60)} דק׳`;
  const totalTime = sessions.reduce((a, s) => a + s.mins, 0) + breakMins * (sessions.length - 1);
  const canNext = step === 0 ? (form.name.trim() && form.subject.trim()) : step === 1 ? mode !== null : true;

  const buildConfig = () => {
    if (mode === "flexible") return { mode: "flexible", total_minutes: flexTime, can_go_back: canGoBack };
    if (mode === "timed")    return { mode: "timed", seconds_per_question: perQSecs, can_go_back: timedBack };
    return { mode: "sessions", break_minutes: breakMins, sessions };
  };

  const saveExam = async () => {
    setSaving(true); setSaveError("");
    try {
      const code = generateCode();
      const { data, error } = await supabase.from("exams").insert({
        workspace_id: user.id,
        title: form.name,
        subject: form.subject,
        group_name: form.group || null,
        config: buildConfig(),
        status: "draft",
        access_code: code,
        opens_at:  opensAt  ? new Date(opensAt).toISOString()  : null,
        closes_at: closesAt ? new Date(closesAt).toISOString() : null,
      }).select().single();
      if (error) throw error;
      setSavedExam(data);
      setStep(3);
    } catch (e) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
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
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>פתיחה</div>
                    <input type="datetime-local" value={opensAt} onChange={e => setOpensAt(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, background: C.bg, color: C.text, fontFamily: "inherit", outline: "none" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>סגירה</div>
                    <input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)}
                      style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 12, background: C.bg, color: C.text, fontFamily: "inherit", outline: "none" }} />
                  </div>
                </div>
                {(opensAt || closesAt) && (
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 8, background: C.purpleLight, borderRadius: 8, padding: "7px 10px" }}>
                    {opensAt && !closesAt && `המבחן נפתח ${new Date(opensAt).toLocaleString("he-IL")}`}
                    {!opensAt && closesAt && `המבחן נסגר ${new Date(closesAt).toLocaleString("he-IL")}`}
                    {opensAt && closesAt && `פתוח ${new Date(opensAt).toLocaleString("he-IL")} — ${new Date(closesAt).toLocaleString("he-IL")}`}
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

          {/* Step 2: Questions (redirect to ContentUploader) */}
          {step === 2 && (
            <div style={{ padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>שאלות המבחן</div>
              <div style={{ background: C.purpleLight, borderRadius: 12, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: C.purple }}>
                שמור את המבחן ואז העלה חומר לימוד ליצירת שאלות אוטומטית, או הוסף שאלות ידנית לאחר השמירה.
              </div>
              <div style={{ background: C.bg, borderRadius: 12, padding: "12px 14px", fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
                <div style={{ fontWeight: 600, color: C.text, marginBottom: 4 }}>לאחר שמירת המבחן תוכל:</div>
                <div>• להעלות PDF / טקסט — AI יבנה שאלות אוטומטית</div>
                <div>• להוסיף מבחנים ישנים לניתוח סגנון המרצה</div>
                <div>• לערוך, למחוק ולהוסיף שאלות ידנית</div>
              </div>
              {saveError && (
                <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 12, marginTop: 12 }}>{saveError}</div>
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

              <button onClick={() => navigate("/dashboard/bank")}
                style={{ width: "100%", padding: 12, background: C.purple, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginTop: 8 }}>
                העלה חומר לימוד ←
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
              {step > 0 && (
                <button onClick={() => setStep(step - 1)} disabled={saving}
                  style={{ flex: 1, padding: 10, background: "transparent", color: C.purple, border: `1px solid ${C.purple}`, borderRadius: 12, fontSize: 13, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <ChevronRight size={15} /> חזרה
                </button>
              )}
              <button
                onClick={step === 2 ? saveExam : () => canNext && setStep(step + 1)}
                disabled={!canNext || saving}
                style={{ flex: step > 0 ? 2 : 1, padding: 12, background: canNext && !saving ? C.purple : C.purpleMid, color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 600, cursor: canNext && !saving ? "pointer" : "not-allowed", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "background 0.2s" }}>
                {saving ? "שומר..." : step === 2 ? "שמור מבחן ←" : <>המשך <ChevronLeft size={15} /></>}
              </button>
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

function Summary({ lines }) {
  return (
    <div style={{ background: "#EEEDFE", borderRadius: 10, padding: "10px 12px", marginTop: 12 }}>
      {lines.map((l, i) => <div key={i} style={{ fontSize: 12, color: "#3C3489", lineHeight: 1.8 }}>{l}</div>)}
    </div>
  );
}
