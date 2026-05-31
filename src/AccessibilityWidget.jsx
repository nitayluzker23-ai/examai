import { useState, useEffect } from "react";

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.1)", white: "#fff",
};

const STORAGE_KEY = "a11y_settings";

const DEFAULTS = {
  fontScale: 0,       // -2 .. +4 (steps of 12.5%)
  contrast: false,    // high contrast
  grayscale: false,
  links: false,       // highlight links
  readable: false,    // readable font
  bigCursor: false,
  stopAnim: false,
};

function applySettings(s) {
  const root = document.documentElement;
  const body = document.body;

  // Font scale
  root.style.fontSize = s.fontScale ? `${100 + s.fontScale * 12.5}%` : "";

  // Toggle helper classes on body
  body.classList.toggle("a11y-contrast", s.contrast);
  body.classList.toggle("a11y-grayscale", s.grayscale);
  body.classList.toggle("a11y-links", s.links);
  body.classList.toggle("a11y-readable", s.readable);
  body.classList.toggle("a11y-cursor", s.bigCursor);
  body.classList.toggle("a11y-stopanim", s.stopAnim);
}

export default function AccessibilityWidget() {
  const [open, setOpen]         = useState(false);
  const [settings, setSettings] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return { ...DEFAULTS, ...(saved || {}) };
    } catch { return DEFAULTS; }
  });

  useEffect(() => {
    applySettings(settings);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch {}
  }, [settings]);

  const set = (key, val) => setSettings(s => ({ ...s, [key]: val }));
  const toggle = (key) => setSettings(s => ({ ...s, [key]: !s[key] }));
  const reset = () => setSettings(DEFAULTS);

  const ToggleBtn = ({ label, active, onClick, icon }) => (
    <button onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5,
        padding: "12px 6px", borderRadius: 12,
        border: `2px solid ${active ? C.purple : C.border}`,
        background: active ? C.purpleLight : C.white,
        color: active ? C.purple : C.text,
        fontSize: 12, fontWeight: active ? 700 : 500, cursor: "pointer", fontFamily: "inherit",
        textAlign: "center", lineHeight: 1.3, minHeight: 64,
      }}>
      <span style={{ fontSize: 20 }} aria-hidden="true">{icon}</span>
      {label}
    </button>
  );

  return (
    <>
      {/* Injected global CSS for a11y modes */}
      <style>{`
        body.a11y-contrast { filter: contrast(1.4) !important; }
        body.a11y-contrast, body.a11y-contrast * { background-color: #000 !important; color: #fff !important; border-color: #fff !important; }
        body.a11y-contrast a, body.a11y-contrast button { color: #ffff00 !important; }
        body.a11y-grayscale { filter: grayscale(1) !important; }
        body.a11y-links a { text-decoration: underline !important; font-weight: 700 !important; outline: 2px dashed currentColor; outline-offset: 2px; }
        body.a11y-readable, body.a11y-readable * { font-family: Arial, 'Noto Sans Hebrew', sans-serif !important; letter-spacing: 0.5px !important; line-height: 1.7 !important; }
        body.a11y-cursor, body.a11y-cursor * { cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' viewBox='0 0 48 48'%3E%3Cpath d='M6 6l14 36 5-15 15-5z' fill='%23000' stroke='%23fff' stroke-width='2'/%3E%3C/svg%3E") 4 4, auto !important; }
        body.a11y-stopanim, body.a11y-stopanim * { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
        .a11y-fab:focus-visible { outline: 3px solid #ffbf00; outline-offset: 2px; }
      `}</style>

      {/* Floating button — bottom right */}
      <button
        className="a11y-fab"
        onClick={() => setOpen(o => !o)}
        aria-label="תפריט נגישות"
        title="נגישות"
        style={{
          position: "fixed", bottom: 18, right: 18, zIndex: 2147483000,
          width: 52, height: 52, borderRadius: "50%",
          background: "#2557d6", border: "3px solid white",
          cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 26, color: "white",
        }}>
        <span aria-hidden="true">♿</span>
      </button>

      {/* Panel */}
      {open && (
        <>
          {/* backdrop */}
          <div onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 2147483000, background: "rgba(0,0,0,0.2)" }} />
          <div role="dialog" aria-label="הגדרות נגישות"
            style={{
              position: "fixed", bottom: 80, right: 18, zIndex: 2147483001,
              width: 320, maxWidth: "92vw", maxHeight: "80vh", overflowY: "auto",
              background: C.white, borderRadius: 18, boxShadow: "0 8px 40px rgba(0,0,0,0.25)",
              fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl",
              padding: 18, border: `1px solid ${C.border}`,
            }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.text }}>♿ נגישות</div>
              <button onClick={() => setOpen(false)} aria-label="סגור"
                style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.muted, lineHeight: 1 }}>×</button>
            </div>

            {/* Font size controls */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.muted, marginBottom: 6 }}>גודל טקסט</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => set("fontScale", Math.max(-2, settings.fontScale - 1))}
                  aria-label="הקטן טקסט"
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 18, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: C.text }}>A−</button>
                <span style={{ fontSize: 13, color: C.muted, minWidth: 48, textAlign: "center" }}>
                  {100 + settings.fontScale * 12.5}%
                </span>
                <button onClick={() => set("fontScale", Math.min(4, settings.fontScale + 1))}
                  aria-label="הגדל טקסט"
                  style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, fontSize: 18, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", color: C.text }}>A+</button>
              </div>
            </div>

            {/* Toggles grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
              <ToggleBtn label="ניגודיות גבוהה" icon="◑" active={settings.contrast} onClick={() => toggle("contrast")} />
              <ToggleBtn label="גווני אפור"     icon="🌫" active={settings.grayscale} onClick={() => toggle("grayscale")} />
              <ToggleBtn label="הדגשת קישורים"  icon="🔗" active={settings.links} onClick={() => toggle("links")} />
              <ToggleBtn label="גופן קריא"       icon="🔤" active={settings.readable} onClick={() => toggle("readable")} />
              <ToggleBtn label="סמן גדול"        icon="🖱" active={settings.bigCursor} onClick={() => toggle("bigCursor")} />
              <ToggleBtn label="עצירת אנימציות" icon="⏸" active={settings.stopAnim} onClick={() => toggle("stopAnim")} />
            </div>

            {/* Reset */}
            <button onClick={reset}
              style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${C.border}`, background: C.white, color: C.text, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", marginBottom: 10 }}>
              ↺ איפוס הגדרות
            </button>

            <a href="/accessibility-statement" target="_blank" rel="noreferrer"
              style={{ display: "block", textAlign: "center", fontSize: 12, color: C.purple, textDecoration: "underline" }}>
              הצהרת נגישות
            </a>
          </div>
        </>
      )}
    </>
  );
}
