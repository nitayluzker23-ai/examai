import { useState, useEffect, useRef } from "react";
import { supabase } from "./App";
import QRCode from "qrcode";

const C = {
  purple: "#37352F", purpleLight: "#F4F2EC",
  teal: "#4F6F52", tealLight: "#E8EDE6",
  amber: "#9A7B3F", amberLight: "#F3EBD9",
  red: "#A6493B", redLight: "#F3E2DD",
  text: "#2B2925", muted: "#6B655C",
  border: "rgba(55,53,47,0.10)", bg: "#FAF9F6", white: "#fff",
};

export default function ExamsList() {
  const [exams,   setExams]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied,  setCopied]  = useState(null);
  const [qrExam,  setQrExam]  = useState(null); // exam for QR modal
  const [emailExam, setEmailExam] = useState(null); // exam for email modal

  useEffect(() => { fetchExams(); }, []);

  const fetchExams = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("exams")
      .select("*, questions(count)")
      .order("created_at", { ascending: false });
    if (!error) setExams(data ?? []);
    setLoading(false);
  };

  const examUrl = (code) => `${window.location.origin}/exam/${code}`;

  const copyLink = (code) => {
    navigator.clipboard?.writeText(examUrl(code));
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  const shareWhatsApp = (exam) => {
    const url = examUrl(exam.access_code);
    const msg = `שלום! הנה לינק למבחן "${exam.title}" 📝\n${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const toggleStatus = async (exam) => {
    const newStatus = exam.status === "published" ? "draft" : "published";
    await supabase.from("exams").update({ status: newStatus }).eq("id", exam.id);
    fetchExams();
  };

  const deleteExam = async (id) => {
    if (!confirm("למחוק את המבחן?")) return;
    await supabase.from("exams").delete().eq("id", id);
    fetchExams();
  };

  const modeLabel = (config) => {
    if (!config) return "";
    if (config.mode === "flexible") return `גמיש · ${config.total_minutes} דק׳`;
    if (config.mode === "timed")    return `מתוזמן · ${config.seconds_per_question} שנ׳/שאלה`;
    if (config.mode === "sessions") return `סשנים · ${config.sessions?.length} פרקים`;
    return "";
  };

  return (
    <div style={{ padding: 20, fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl", maxWidth: 640, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.text }}>המבחנים שלי</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{exams.length} מבחנים</div>
        </div>
        <a href="/dashboard/new" style={{ padding: "9px 16px", background: C.purple, color: "white", borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
          + מבחן חדש
        </a>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ width: 36, height: 36, border: `3px solid ${C.purpleLight}`, borderTopColor: C.purple, borderRadius: "50%", margin: "0 auto", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}

      {!loading && exams.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px", background: C.white, borderRadius: 16, border: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📝</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 6 }}>אין מבחנים עדיין</div>
          <div style={{ fontSize: 13, color: C.muted }}>לחץ על "מבחן חדש" כדי להתחיל</div>
        </div>
      )}

      {exams.map(exam => {
        const qCount = exam.questions?.[0]?.count ?? 0;
        const isPublished = exam.status === "published";
        return (
          <div key={exam.id} style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 18, marginBottom: 10, boxShadow: "0 1px 6px rgba(83,74,183,0.05)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: C.text, marginBottom: 3 }}>{exam.title}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{exam.subject} · {modeLabel(exam.config)}</div>
              </div>
              <span style={{ background: isPublished ? C.tealLight : C.amberLight, color: isPublished ? C.teal : C.amber, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, flexShrink: 0 }}>
                {isPublished ? "פעיל" : "טיוטה"}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <span style={{ background: C.bg, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.muted }}>{qCount} שאלות</span>
              {exam.access_code && (
                <span style={{ background: C.purpleLight, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.purple, fontFamily: "monospace", fontWeight: 600 }}>
                  {exam.access_code}
                </span>
              )}
              <span style={{ background: C.bg, borderRadius: 8, padding: "4px 10px", fontSize: 11, color: C.muted }}>
                {new Date(exam.created_at).toLocaleDateString("he-IL")}
              </span>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {exam.access_code && (
                <>
                  <button onClick={() => copyLink(exam.access_code)}
                    style={{ padding: "7px 14px", background: copied === exam.access_code ? C.tealLight : C.purpleLight, color: copied === exam.access_code ? C.teal : C.purple, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    {copied === exam.access_code ? "✓ הועתק!" : "🔗 העתק לינק"}
                  </button>
                  <button onClick={() => shareWhatsApp(exam)}
                    style={{ padding: "7px 14px", background: "#E7F9EF", color: "#128C7E", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    📲 שלח בוואטסאפ
                  </button>
                  <button onClick={() => setEmailExam(exam)}
                    style={{ padding: "7px 14px", background: "#FEF3E2", color: "#9A7B3F", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    ✉️ שלח במייל
                  </button>
                  <button onClick={() => setQrExam(exam)}
                    style={{ padding: "7px 14px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                    📱 QR
                  </button>
                </>
              )}
              <button onClick={() => toggleStatus(exam)}
                style={{ padding: "7px 14px", background: isPublished ? C.amberLight : C.tealLight, color: isPublished ? C.amber : C.teal, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                {isPublished ? "העבר לטיוטה" : "פרסם"}
              </button>
              <button onClick={() => window.location.href=`/dashboard/exam/${exam.id}/questions`}
                style={{ padding: "7px 14px", background: C.purpleLight, color: C.purple, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" }}>
                ✏️ עריכת שאלות
              </button>
              <button onClick={() => window.open(`/exam/${exam.access_code}`, "_blank")}
                style={{ padding: "7px 14px", background: C.bg, color: C.muted, border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                תצוגת תלמיד
              </button>
              <button onClick={() => deleteExam(exam.id)}
                style={{ padding: "7px 14px", background: C.redLight, color: C.red, border: "none", borderRadius: 8, fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginRight: "auto" }}>
                מחק
              </button>
            </div>
          </div>
        );
      })}

      {qrExam && <QRModal exam={qrExam} onClose={() => setQrExam(null)} examUrl={examUrl} />}
      {emailExam && <EmailModal exam={emailExam} onClose={() => setEmailExam(null)} />}
    </div>
  );
}

// ── Email Invite Modal ─────────────────────────────────────
function EmailModal({ exam, onClose }) {
  const [emails,  setEmails]  = useState("");
  const [sending, setSending] = useState(false);
  const [result,  setResult]  = useState(null); // {ok, msg}

  const send = async () => {
    const list = emails.split(/[,\n;\s]+/).map(e => e.trim()).filter(Boolean);
    if (!list.length) { setResult({ ok: false, msg: "הזן לפחות כתובת אימייל אחת" }); return; }
    setSending(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("send-exam-invite", {
        body: { to: list, examTitle: exam.title, examCode: exam.access_code },
      });
      if (error) {
        // Supabase wraps non-2xx; try to read the function's JSON error
        let msg = error.message;
        try { const b = await error.context?.json?.(); if (b?.error) msg = b.error; } catch (_) {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      setResult({ ok: true, msg: `נשלח ל-${data?.sent ?? list.length} נמענים ✓` });
      setEmails("");
    } catch (e) {
      setResult({ ok: false, msg: e.message });
    } finally {
      setSending(false);
    }
  };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 18, padding: 24, width: "100%", maxWidth: 420, fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>✉️ שליחת המבחן במייל</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.muted }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: C.muted, marginBottom: 16 }}>{exam.title} · קוד {exam.access_code}</div>

        <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>כתובות אימייל (מופרדות בפסיק או שורה)</div>
        <textarea value={emails} onChange={e => setEmails(e.target.value)}
          placeholder="student1@example.com, student2@example.com"
          rows={4}
          style={{ width: "100%", padding: "10px 12px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, fontFamily: "inherit", outline: "none", background: C.bg, color: C.text, boxSizing: "border-box", resize: "vertical", direction: "ltr", textAlign: "left" }} />

        {result && (
          <div style={{ marginTop: 12, fontSize: 13, padding: "9px 12px", borderRadius: 9, background: result.ok ? C.tealLight : C.redLight, color: result.ok ? C.teal : C.red }}>
            {result.msg}
          </div>
        )}

        <button onClick={send} disabled={sending || !emails.trim()}
          style={{ width: "100%", marginTop: 16, padding: 12, background: emails.trim() && !sending ? C.purple : "#9B958A", color: "white", border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: emails.trim() && !sending ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          {sending ? "שולח..." : "שלח הזמנות"}
        </button>
      </div>
    </div>
  );
}

// ── QR Code Modal ──────────────────────────────────────────
function QRModal({ exam, onClose, examUrl }) {
  const canvasRef = useRef(null);
  const url = examUrl(exam.access_code);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 220, margin: 2,
      color: { dark: "#37352F", light: "#FFFFFF" },
    });
  }, [url]);

  const download = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = `qr-${exam.access_code}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  const print = () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL();
    const win = window.open("", "_blank");
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>
      body{font-family:'Segoe UI',sans-serif;direction:rtl;text-align:center;padding:40px;background:#fff}
      h2{color:#37352F;margin-bottom:4px}
      p{color:#6B655C;font-size:14px;margin-bottom:20px}
      img{border-radius:12px;border:2px solid #F4F2EC}
      .code{font-family:monospace;font-size:22px;font-weight:700;color:#37352F;background:#F4F2EC;padding:6px 18px;border-radius:8px;display:inline-block;margin-top:16px}
      @media print{body{padding:20px}}
    </style></head><body>
      <h2>${exam.title}</h2>
      <p>סרקו את הקוד כדי להיכנס למבחן</p>
      <img src="${dataUrl}" width="220" height="220">
      <div class="code">${exam.access_code}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 20, padding: 28, maxWidth: 320, width: "100%", textAlign: "center", fontFamily: "'Assistant',system-ui,'Segoe UI',sans-serif", direction: "rtl" }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.purple, marginBottom: 4 }}>{exam.title}</div>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>סרקו כדי להיכנס למבחן</div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <canvas ref={canvasRef} style={{ borderRadius: 12, border: `2px solid ${C.purpleLight}` }} />
        </div>
        <div style={{ fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: C.purple, background: C.purpleLight, borderRadius: 8, padding: "6px 16px", display: "inline-block", marginBottom: 20 }}>
          {exam.access_code}
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={print} style={{ padding: "8px 16px", background: C.purpleLight, color: C.purple, border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>🖨 הדפס</button>
          <button onClick={download} style={{ padding: "8px 16px", background: C.purple, color: "white", border: "none", borderRadius: 9, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>⬇ הורד PNG</button>
          <button onClick={onClose} style={{ padding: "8px 14px", background: "transparent", color: C.muted, border: `1px solid ${C.border}`, borderRadius: 9, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>סגור</button>
        </div>
      </div>
    </div>
  );
}
