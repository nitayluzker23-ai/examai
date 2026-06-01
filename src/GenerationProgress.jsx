import { useState, useEffect } from "react";

const C = {
  ink: "#37352F", inkSoft: "#F4F2EC", muted: "#6B655C", text: "#2B2925",
  border: "rgba(55,53,47,0.10)", white: "#fff", accent: "#C2683D", accentSoft: "#F3E5DB",
};

/**
 * Animated staged progress while an AI generation runs.
 * We can't know real progress (single model call), so we ease toward ~92%
 * across the given stages, then the parent unmounts us when done.
 *
 * props:
 *   stages: string[]  — stage labels shown in sequence
 *   estSeconds: number — rough total estimate (controls pacing)
 */
export default function GenerationProgress({ stages, estSeconds = 40 }) {
  const [pct, setPct]     = useState(4);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const target = 92;
    const tickMs = 250;
    const steps = (estSeconds * 1000) / tickMs;
    const inc = target / steps;
    const id = setInterval(() => {
      setPct(p => {
        const next = Math.min(target, p + inc * (p < 60 ? 1 : 0.5)); // slow down near the end
        return next;
      });
    }, tickMs);
    return () => clearInterval(id);
  }, [estSeconds]);

  // advance stage label based on pct
  useEffect(() => {
    const idx = Math.min(stages.length - 1, Math.floor((pct / 92) * stages.length));
    setStage(idx);
  }, [pct, stages.length]);

  return (
    <div style={{ textAlign: "center", padding: "40px 24px", fontFamily: "'Assistant',system-ui,sans-serif", direction: "rtl" }}>
      <div style={{ width: 48, height: 48, border: `4px solid ${C.inkSoft}`, borderTopColor: C.accent, borderRadius: "50%", animation: "spin 0.9s linear infinite", margin: "0 auto 20px" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ fontSize: 17, fontWeight: 800, color: C.text, marginBottom: 18 }}>{stages[stage]}</div>

      {/* Progress bar */}
      <div style={{ maxWidth: 360, margin: "0 auto" }}>
        <div style={{ height: 10, background: C.inkSoft, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${C.accent}, #d98a5f)`, borderRadius: 6, transition: "width 0.25s ease" }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
          <span style={{ fontSize: 12, color: C.muted }}>שלב {stage + 1} מתוך {stages.length}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.accent }}>{Math.round(pct)}%</span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: C.muted, marginTop: 16 }}>זה עשוי לקחת מספר שניות — אל תסגור את החלון</div>
    </div>
  );
}
