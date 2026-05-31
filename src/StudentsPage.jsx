import { useState, useEffect } from "react";
import { supabase, useAuth } from "./App";
import { charsToPages } from "./planConfig";

const C = {
  purple: "#37352F", purpleLight: "#F4F2EC", purpleMid: "#9B958A",
  teal: "#4F6F52", tealLight: "#E8EDE6",
  amber: "#9A7B3F", amberLight: "#F3EBD9",
  red: "#A6493B", redLight: "#F3E2DD",
  text: "#2B2925", muted: "#6B655C",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#fff",
};

// ── helpers ────────────────────────────────────────────────
const btn = (extra = {}) => ({
  border: "none", borderRadius: 10, fontFamily: "inherit",
  cursor: "pointer", fontSize: 13, fontWeight: 600, padding: "8px 14px",
  ...extra,
});

export default function StudentsPage() {
  const { user, canUse, planLimit } = useAuth();

  const [classes,     setClasses]     = useState([]);
  const [students,    setStudents]    = useState([]);
  const [assignments, setAssignments] = useState([]); // [{class_id, student_id}]

  const [selectedClass, setSelectedClass] = useState(null); // null = "all"
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState("");

  // modals
  const [showAddStudent,  setShowAddStudent]  = useState(false);
  const [showAddClass,    setShowAddClass]    = useState(false);
  const [showPromote,     setShowPromote]     = useState(false);
  const [editStudent,     setEditStudent]     = useState(null); // student obj or null
  const [editClass,       setEditClass]       = useState(null);
  const [search,          setSearch]          = useState("");
  const [mobile,          setMobile]          = useState(typeof window !== "undefined" && window.innerWidth < 640);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  useEffect(() => { if (user) load(); }, [user]);

  async function load() {
    setLoading(true);
    const [{ data: cls }, { data: stu }, { data: asgn }] = await Promise.all([
      supabase.from("classes").select("*").eq("workspace_id", user.id).order("name"),
      supabase.from("students").select("*").eq("workspace_id", user.id).order("name"),
      supabase.from("class_students").select("class_id, student_id"),
    ]);
    setClasses(cls ?? []);
    setStudents(stu ?? []);
    setAssignments(asgn ?? []);
    setLoading(false);
  }

  // derived
  const visibleStudents = students.filter(s => {
    const matchesSearch = !search || s.name.includes(search);
    if (!matchesSearch) return false;
    if (!selectedClass) return true;
    return assignments.some(a => a.class_id === selectedClass && a.student_id === s.id);
  });

  const studentClasses = (studentId) =>
    assignments.filter(a => a.student_id === studentId).map(a => classes.find(c => c.id === a.class_id)).filter(Boolean);

  const classCount = (classId) => assignments.filter(a => a.class_id === classId).length;

  // ── CRUD ──────────────────────────────────────────────────
  async function saveStudent({ id, name, notes, phone, address, classIds }) {
    setError("");
    try {
      if (id) {
        await supabase.from("students").update({ name, notes, phone: phone || null, address: address || null }).eq("id", id);
        // sync assignments
        await supabase.from("class_students").delete().eq("student_id", id);
      } else {
        // ── Plan limit check ──────────────────────────────────
        if (!canUse("student_management")) {
          setError("ניהול תלמידים זמין מתוכנית מורה ומעלה. שדרג כדי להוסיף תלמידים.");
          return;
        }
        const maxStudents = planLimit("max_students");
        if (maxStudents !== Infinity && students.length >= maxStudents) {
          setError(`הגעת למגבלת ${maxStudents} תלמידים בתוכנית שלך. שדרג תוכנית כדי להוסיף עוד.`);
          return;
        }
        const { data, error: e } = await supabase.from("students")
          .insert({ workspace_id: user.id, name, notes, phone: phone || null, address: address || null }).select().single();
        if (e) throw e;
        id = data.id;
      }
      if (classIds.length > 0) {
        await supabase.from("class_students").insert(classIds.map(cid => ({ class_id: cid, student_id: id })));
      }
      await load();
      setShowAddStudent(false);
      setEditStudent(null);
    } catch (e) { setError(e.message); }
  }

  async function deleteStudent(id) {
    if (!confirm("למחוק את התלמיד?")) return;
    await supabase.from("students").delete().eq("id", id);
    await load();
  }

  async function saveClass({ id, name, year }) {
    setError("");
    try {
      if (id) {
        await supabase.from("classes").update({ name, year: year || null }).eq("id", id);
      } else {
        const { error: e } = await supabase.from("classes")
          .insert({ workspace_id: user.id, name, year: year || null });
        if (e) throw e;
      }
      await load();
      setShowAddClass(false);
      setEditClass(null);
    } catch (e) { setError(e.message); }
  }

  async function deleteClass(id) {
    if (!confirm("למחוק את הכיתה? התלמידים לא יימחקו.")) return;
    await supabase.from("classes").delete().eq("id", id);
    if (selectedClass === id) setSelectedClass(null);
    await load();
  }

  async function promoteClass({ fromId, toName, toYear }) {
    setError("");
    try {
      // create new class
      const { data: newCls, error: e1 } = await supabase.from("classes")
        .insert({ workspace_id: user.id, name: toName, year: toYear || null }).select().single();
      if (e1) throw e1;
      // find students in source class
      const memberIds = assignments.filter(a => a.class_id === fromId).map(a => a.student_id);
      if (memberIds.length > 0) {
        // add them to new class (keep old class too — teacher can delete manually)
        await supabase.from("class_students").insert(
          memberIds.map(sid => ({ class_id: newCls.id, student_id: sid }))
        );
      }
      await load();
      setShowPromote(false);
      setSelectedClass(newCls.id);
    } catch (e) { setError(e.message); }
  }

  if (loading) return <Spinner />;

  return (
    <div style={{ padding: "20px 16px", direction: "rtl", fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.purple }}>תלמידים</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 2 }}>{students.length} תלמידים · {classes.length} כיתות/מגמות</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button style={btn({ background: C.purpleLight, color: C.purple })} onClick={() => setShowAddClass(true)}>+ כיתה/מגמה</button>
          <button style={btn({ background: C.purple, color: C.white })} onClick={() => setShowAddStudent(true)}>+ תלמיד</button>
        </div>
      </div>

      {error && <div style={{ background: C.redLight, color: C.red, borderRadius: 10, padding: "10px 14px", fontSize: 12, marginBottom: 12 }}>{error}</div>}

      {/* Plan limit banner */}
      {(() => {
        const max = planLimit("max_students");
        if (max === Infinity) return null;
        const pct = Math.round((students.length / max) * 100);
        const full = students.length >= max;
        return (
          <div style={{ background: full ? C.redLight : C.amberLight, border: `1px solid ${full ? "#D2A39A" : "#E8C878"}`, borderRadius: 10, padding: "8px 14px", fontSize: 12, color: full ? C.red : C.amber, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{full ? "⚠ הגעת למגבלת התלמידים בתוכנית שלך." : `תלמידים: ${students.length} / ${max}`}</span>
            <span style={{ fontWeight: 700 }}>{pct}%</span>
          </div>
        );
      })()}

      <div style={{ display: "flex", gap: 14, flexDirection: mobile ? "column" : "row" }}>

        {/* ── Classes sidebar ── */}
        <div style={{ width: mobile ? "100%" : 200, flexShrink: 0 }}>
          <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            <ClassItem
              label="כל התלמידים"
              count={students.length}
              active={!selectedClass}
              onClick={() => setSelectedClass(null)}
            />
            {classes.map(cls => (
              <ClassItem
                key={cls.id}
                label={cls.name}
                sub={cls.year ? `${cls.year}` : ""}
                count={classCount(cls.id)}
                active={selectedClass === cls.id}
                onClick={() => setSelectedClass(cls.id)}
                onEdit={() => setEditClass(cls)}
                onDelete={() => deleteClass(cls.id)}
                onPromote={() => { setSelectedClass(cls.id); setShowPromote(true); }}
              />
            ))}
            {classes.length === 0 && (
              <div style={{ padding: "14px 12px", fontSize: 12, color: C.muted, textAlign: "center" }}>אין כיתות עדיין</div>
            )}
          </div>
        </div>

        {/* ── Students list ── */}
        <div style={{ flex: 1 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="חיפוש תלמיד..."
            style={{ width: "100%", padding: "9px 13px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, background: C.white, color: C.text, fontFamily: "inherit", direction: "rtl", outline: "none", marginBottom: 10 }}
          />

          {selectedClass && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
              <button style={btn({ background: C.amberLight, color: C.amber })}
                onClick={() => setShowPromote(true)}>
                ⬆ קידום כיתה
              </button>
            </div>
          )}

          <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden" }}>
            {visibleStudents.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: C.muted, fontSize: 13 }}>
                {search ? "לא נמצאו תלמידים" : "אין תלמידים עדיין — לחץ + תלמיד להוספה"}
              </div>
            ) : visibleStudents.map((s, i) => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderBottom: i < visibleStudents.length - 1 ? `1px solid ${C.border}` : "none" }}>
                <div style={{ width: 36, height: 36, borderRadius: "50%", background: C.purpleLight, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 15, fontWeight: 700, color: C.purple }}>
                  {s.name[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{s.name}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 3 }}>
                    {studentClasses(s.id).map(c => (
                      <span key={c.id} style={{ fontSize: 10, background: C.purpleLight, color: C.purple, borderRadius: 6, padding: "2px 7px", fontWeight: 500 }}>{c.name}</span>
                    ))}
                    {s.notes && <span style={{ fontSize: 11, color: C.muted }}>{s.notes}</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button style={btn({ background: C.purpleLight, color: C.purple, padding: "5px 10px" })}
                    onClick={() => setEditStudent(s)}>עריכה</button>
                  <button style={btn({ background: C.redLight, color: C.red, padding: "5px 10px" })}
                    onClick={() => deleteStudent(s.id)}>מחיקה</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      {(showAddStudent || editStudent) && (
        <StudentModal
          student={editStudent}
          classes={classes}
          assignments={assignments}
          onSave={saveStudent}
          onClose={() => { setShowAddStudent(false); setEditStudent(null); }}
          error={error}
        />
      )}
      {(showAddClass || editClass) && (
        <ClassModal
          cls={editClass}
          onSave={saveClass}
          onClose={() => { setShowAddClass(false); setEditClass(null); }}
          error={error}
        />
      )}
      {showPromote && selectedClass && (
        <PromoteModal
          sourceClass={classes.find(c => c.id === selectedClass)}
          onPromote={promoteClass}
          onClose={() => setShowPromote(false)}
          error={error}
        />
      )}
    </div>
  );
}

// ── ClassItem ─────────────────────────────────────────────
function ClassItem({ label, sub, count, active, onClick, onEdit, onDelete, onPromote }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ padding: "10px 12px", cursor: "pointer", background: active ? C.purpleLight : hover ? "#F4F2EC" : C.white, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", gap: 6, transition: "background 0.15s" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? C.purple : C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        {sub && <div style={{ fontSize: 10, color: C.muted }}>{sub}</div>}
      </div>
      <span style={{ fontSize: 11, color: C.muted, flexShrink: 0 }}>{count}</span>
      {onEdit && (
        <div style={{ display: "flex", gap: 3 }}>
          <ActionBtn onClick={e => { e.stopPropagation(); onPromote(); }} title="קידום כיתה">⬆</ActionBtn>
          <ActionBtn onClick={e => { e.stopPropagation(); onEdit(); }} title="עריכה">✏</ActionBtn>
          <ActionBtn onClick={e => { e.stopPropagation(); onDelete(); }} title="מחיקה" danger>✕</ActionBtn>
        </div>
      )}
    </div>
  );
}

function ActionBtn({ onClick, title, children, danger }) {
  return (
    <button onClick={onClick} title={title} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, padding: "1px 3px", color: danger ? C.red : C.muted, lineHeight: 1 }}>
      {children}
    </button>
  );
}

// ── StudentModal ──────────────────────────────────────────
function StudentModal({ student, classes, assignments, onSave, onClose, error }) {
  const initClassIds = student
    ? assignments.filter(a => a.student_id === student.id).map(a => a.class_id)
    : [];
  const [name,     setName]     = useState(student?.name    ?? "");
  const [notes,    setNotes]    = useState(student?.notes   ?? "");
  const [phone,    setPhone]    = useState(student?.phone   ?? "");
  const [address,  setAddress]  = useState(student?.address ?? "");
  const [classIds, setClassIds] = useState(initClassIds);
  const [saving,   setSaving]   = useState(false);

  const toggleClass = (id) =>
    setClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handle = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ id: student?.id, name: name.trim(), notes: notes.trim() || null, phone: phone.trim() || null, address: address.trim() || null, classIds });
    setSaving(false);
  };

  return (
    <Modal title={student ? "עריכת תלמיד" : "הוספת תלמיד"} onClose={onClose}>
      <Label>שם מלא</Label>
      <Input value={name} onChange={setName} placeholder="שם פרטי ושם משפחה" autoFocus />

      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>טלפון</span>
            <span style={{ fontSize: 10, color: C.muted, background: "#f3f4f6", borderRadius: 20, padding: "1px 7px" }}>לא חובה</span>
          </div>
          <Input value={phone} onChange={setPhone} placeholder="050-0000000" type="tel" />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
            <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>כתובת</span>
            <span style={{ fontSize: 10, color: C.muted, background: "#f3f4f6", borderRadius: 20, padding: "1px 7px" }}>לא חובה</span>
          </div>
          <Input value={address} onChange={setAddress} placeholder="עיר, רחוב..." />
        </div>
      </div>

      <Label>הערות (אופציונלי)</Label>
      <Input value={notes} onChange={setNotes} placeholder="למשל: לקות למידה, צרכים מיוחדים..." />

      <Label>כיתות / מגמות</Label>
      {classes.length === 0 ? (
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>אין כיתות — צור כיתה קודם</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
          {classes.map(c => {
            const sel = classIds.includes(c.id);
            return (
              <div key={c.id} onClick={() => toggleClass(c.id)}
                style={{ fontSize: 12, padding: "5px 11px", borderRadius: 20, cursor: "pointer", border: `1.5px solid ${sel ? C.purple : C.border}`, background: sel ? C.purpleLight : C.white, color: sel ? C.purple : C.muted, fontWeight: sel ? 600 : 400, transition: "all 0.15s" }}>
                {c.name}{c.year ? ` · ${c.year}` : ""}
              </div>
            );
          })}
        </div>
      )}

      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}
      <button onClick={handle} disabled={!name.trim() || saving}
        style={{ width: "100%", padding: 12, background: name.trim() ? C.purple : C.purpleMid, color: C.white, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
        {saving ? "שומר..." : student ? "שמור שינויים" : "הוסף תלמיד"}
      </button>
    </Modal>
  );
}

// ── ClassModal ────────────────────────────────────────────
function ClassModal({ cls, onSave, onClose, error }) {
  const [name,  setName]  = useState(cls?.name ?? "");
  const [year,  setYear]  = useState(cls?.year ?? "");
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ id: cls?.id, name: name.trim(), year: year ? parseInt(year) : null });
    setSaving(false);
  };

  return (
    <Modal title={cls ? "עריכת כיתה/מגמה" : "כיתה / מגמה חדשה"} onClose={onClose}>
      <Label>שם הכיתה / מגמה</Label>
      <Input value={name} onChange={setName} placeholder='למשל: כיתה ה׳2 או מתמטיקה 4 יח׳' autoFocus />
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: C.muted, fontWeight: 500 }}>שנת לימודים</span>
        <span style={{ fontSize: 11, color: C.muted, background: "#f3f4f6", borderRadius: 20, padding: "1px 8px" }}>לא חובה</span>
      </div>
      <Input value={year} onChange={setYear} placeholder="למשל: 2025 — אפשר להשאיר ריק" type="number" />
      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}
      <button onClick={handle} disabled={!name.trim() || saving}
        style={{ width: "100%", padding: 12, background: name.trim() ? C.purple : C.purpleMid, color: C.white, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
        {saving ? "שומר..." : cls ? "שמור שינויים" : "צור כיתה/מגמה"}
      </button>
    </Modal>
  );
}

// ── PromoteModal ──────────────────────────────────────────
function PromoteModal({ sourceClass, onPromote, onClose, error }) {
  const nextYear = sourceClass?.year ? sourceClass.year + 1 : "";
  const [toName, setToName] = useState(sourceClass?.name ?? "");
  const [toYear, setToYear] = useState(nextYear);
  const [saving, setSaving] = useState(false);

  const handle = async () => {
    if (!toName.trim()) return;
    setSaving(true);
    await onPromote({ fromId: sourceClass.id, toName: toName.trim(), toYear: toYear ? parseInt(toYear) : null });
    setSaving(false);
  };

  return (
    <Modal title="קידום כיתה" onClose={onClose}>
      <div style={{ background: C.amberLight, borderRadius: 10, padding: "10px 12px", fontSize: 12, color: C.amber, marginBottom: 14 }}>
        כל תלמידי <strong>{sourceClass?.name}</strong> יתווספו לכיתה החדשה. הכיתה הישנה נשמרת ויש למחוק ידנית אם לא צריך.
      </div>
      <Label>שם הכיתה החדשה</Label>
      <Input value={toName} onChange={setToName} placeholder="שם הכיתה לשנה הבאה" autoFocus />
      <Label>שנת לימודים חדשה</Label>
      <Input value={toYear} onChange={setToYear} placeholder="2026" type="number" />
      {error && <div style={{ fontSize: 12, color: C.red, marginBottom: 10 }}>{error}</div>}
      <button onClick={handle} disabled={!toName.trim() || saving}
        style={{ width: "100%", padding: 12, background: C.amber, color: C.white, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
        {saving ? "מקדם..." : "⬆ קדם כיתה"}
      </button>
    </Modal>
  );
}

// ── Shared components ─────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: C.white, borderRadius: 18, padding: 24, width: "100%", maxWidth: 400, direction: "rtl", fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: C.text }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: C.muted, lineHeight: 1 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Label({ children }) {
  return <div style={{ fontSize: 12, color: C.muted, fontWeight: 500, marginBottom: 5 }}>{children}</div>;
}

function Input({ value, onChange, placeholder, type = "text", autoFocus }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus}
      style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, background: C.bg, color: C.text, fontFamily: "inherit", direction: "rtl", outline: "none", marginBottom: 14 }} />
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
      <div style={{ width: 32, height: 32, border: `3px solid #F4F2EC`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
