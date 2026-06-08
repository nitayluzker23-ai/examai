const FONT = "'Noto Sans Hebrew','Segoe UI',Arial,sans-serif";

const BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${FONT}; direction: rtl; color: #1a1a2e; background: white; padding: 28px 32px; font-size: 13px; line-height: 1.6; }
  h1 { font-size: 20px; font-weight: 800; color: #534AB7; margin-bottom: 4px; }
  h2 { font-size: 14px; font-weight: 700; margin-bottom: 10px; color: #1a1a2e; }
  .meta { font-size: 12px; color: #6b7280; margin-bottom: 20px; }
  .divider { border: none; border-top: 1.5px solid #e5e7eb; margin: 18px 0; }
  .question { margin-bottom: 18px; page-break-inside: avoid; }
  .question-num { font-size: 11px; color: #6b7280; margin-bottom: 3px; }
  .question-text { font-size: 14px; font-weight: 600; margin-bottom: 8px; }
  .question-img { max-width: 100%; max-height: 260px; border-radius: 8px; border: 1px solid #e5e7eb; display: block; margin: 8px 0 12px; }
  .option { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; font-size: 13px; }
  .letter { width: 22px; height: 22px; border-radius: 50%; border: 1.5px solid #d1d5db; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 600; flex-shrink: 0; }
  .correct .letter { background: #0F6E56; border-color: #0F6E56; color: white; }
  .correct-text { color: #0F6E56; font-weight: 500; }
  .wrong-text { color: #A32D2D; }
  .badge { display: inline-block; font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 20px; margin-right: 6px; }
  .badge-easy   { background: #E1F5EE; color: #0F6E56; }
  .badge-medium { background: #EEEDFE; color: #534AB7; }
  .badge-hard   { background: #FAEEDA; color: #854F0B; }
  .topic-row { margin-bottom: 10px; }
  .topic-label { display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 3px; }
  .bar-bg { height: 7px; background: #f0f0f8; border-radius: 4px; }
  .bar-fill { height: 100%; border-radius: 4px; }
  .score-big { font-size: 48px; font-weight: 800; line-height: 1; }
  .score-sub { font-size: 13px; color: #6b7280; margin-top: 4px; }
  .tip-box { border-radius: 10px; padding: 10px 14px; margin: 6px 0; font-size: 12px; }
  .explanation { background: #FCEBEB; border-radius: 8px; padding: 10px 12px; font-size: 12px; color: #791F1F; margin-top: 8px; }
  /* Answer sheet */
  .as-fields { display: flex; gap: 24px; flex-wrap: wrap; font-size: 13px; margin: 14px 0 4px; }
  .as-fill { display: inline-block; min-width: 140px; border-bottom: 1px solid #9ca3af; height: 16px; }
  .as-instr { font-size: 11px; color: #6b7280; margin-bottom: 14px; }
  .as-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 32px; }
  .as-row { display: flex; align-items: center; gap: 10px; padding: 4px 0; page-break-inside: avoid; }
  .as-num { font-size: 13px; font-weight: 700; min-width: 26px; text-align: left; flex-shrink: 0; }
  .as-opts { display: flex; align-items: center; gap: 12px; flex: 1; }
  .as-bubble { display: flex; align-items: center; gap: 4px; font-size: 12px; color: #374151; }
  .as-circle { width: 18px; height: 18px; border-radius: 50%; border: 1.5px solid #6b7280; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 600; color: #6b7280; flex-shrink: 0; }
  .as-write { flex: 1; border-bottom: 1px solid #d1d5db; height: 18px; min-width: 120px; }
  @media print { body { padding: 10px 18px; } .as-grid { gap: 5px 28px; } }
`;

function openPrint(html) {
  const win = window.open("", "_blank");
  if (!win) { alert("נא לאפשר חלונות קופצים בדפדפן"); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${BASE_CSS}</style></head><body>${html}</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 400);
}

// ── Export exam questions (no correct answer shown) ────────
export function printExam(exam, questions) {
  const LETTERS = "אבגד";
  const DIFF_HE = { Easy: "קל", Medium: "בינוני", Hard: "קשה" };
  const DIFF_CLS = { Easy: "easy", Medium: "medium", Hard: "hard" };

  const now = new Date().toLocaleDateString("he-IL");

  const qs = questions.map((q, idx) => {
    const c = q.content ?? {};
    const diff = q.difficulty ?? "Medium";
    const opts = (c.options ?? []).map((opt, i) =>
      `<div class="option">
        <div class="letter">${LETTERS[i]}</div>
        <span>${opt}</span>
      </div>`
    ).join("");
    return `
      <div class="question">
        <div class="question-num">
          שאלה ${idx + 1}
          <span class="badge badge-${DIFF_CLS[diff]}">${DIFF_HE[diff] ?? diff}</span>
          ${c.topic_name ? `<span style="font-size:11px;color:#6b7280">${c.topic_name}</span>` : ""}
        </div>
        <div class="question-text">${c.question_text ?? ""}</div>
        ${c.image_url ? `<img class="question-img" src="${c.image_url}" alt="תמונת שאלה">` : ""}
        ${opts}
      </div>`;
  }).join('<hr class="divider">');

  const html = `
    <h1>${exam.title ?? "מבחן"}</h1>
    <div class="meta">
      ${exam.subject ?? ""} · ${questions.length} שאלות · הודפס ${now}
      ${exam.access_code ? ` · קוד: <strong>${exam.access_code}</strong>` : ""}
    </div>
    <hr class="divider">
    ${qs}
    <hr class="divider">
    <div style="font-size:11px;color:#9ca3af;text-align:center;margin-top:12px">הופק על ידי ExamAI</div>
  `;
  openPrint(html);
}

// ── Export blank answer sheet (student fills in) ───────────
export function printAnswerSheet(exam, questions) {
  const LETTERS = "אבגדהו";
  const now = new Date().toLocaleDateString("he-IL");

  const rows = questions.map((q, idx) => {
    const c = q.content ?? {};
    const type = c.question_type ?? (c.options?.length ? "multiple_choice" : "open");
    const num = idx + 1;

    let bubbles;
    if (type === "open" || !(c.options?.length)) {
      // Open question → write line
      bubbles = `<span class="as-write"></span>`;
    } else if (type === "true_false") {
      bubbles = `
        <span class="as-bubble"><span class="as-circle"></span>נכון</span>
        <span class="as-bubble"><span class="as-circle"></span>לא נכון</span>`;
    } else {
      bubbles = (c.options ?? []).map((_, i) =>
        `<span class="as-bubble"><span class="as-circle">${LETTERS[i] ?? ""}</span></span>`
      ).join("");
    }

    return `
      <div class="as-row">
        <span class="as-num">${num}.</span>
        <span class="as-opts">${bubbles}</span>
      </div>`;
  }).join("");

  const html = `
    <h1>${exam.title ?? "מבחן"} — דף תשובות</h1>
    <div class="meta">${exam.subject ?? ""}${exam.access_code ? ` · קוד: ${exam.access_code}` : ""}</div>
    <div class="as-fields">
      <span>שם: <span class="as-fill"></span></span>
      <span>כיתה: <span class="as-fill" style="min-width:90px"></span></span>
      <span>תאריך: <span class="as-fill" style="min-width:90px"></span></span>
    </div>
    <hr class="divider">
    <div class="as-instr">סמן/י תשובה אחת לכל שאלה ע"י מילוי העיגול. בשאלות פתוחות — כתוב/כתבי על השורה.</div>
    <div class="as-grid">${rows}</div>
    <hr class="divider">
    <div style="font-size:11px;color:#9ca3af;text-align:center;margin-top:12px">הופק על ידי ExamAI · הודפס ${now}</div>
  `;
  openPrint(html);
}

// ── Export exam with answer key (for teacher) ──────────────
export function printAnswerKey(exam, questions) {
  const LETTERS = "אבגד";
  const DIFF_HE = { Easy: "קל", Medium: "בינוני", Hard: "קשה" };
  const DIFF_CLS = { Easy: "easy", Medium: "medium", Hard: "hard" };

  const qs = questions.map((q, idx) => {
    const c = q.content ?? {};
    const diff = q.difficulty ?? "Medium";
    const opts = (c.options ?? []).map((opt, i) => {
      const isCorrect = i === c.correct_answer_index;
      return `<div class="option ${isCorrect ? "correct" : ""}">
        <div class="letter">${LETTERS[i]}</div>
        <span class="${isCorrect ? "correct-text" : ""}">${opt}</span>
      </div>`;
    }).join("");
    return `
      <div class="question">
        <div class="question-num">
          שאלה ${idx + 1}
          <span class="badge badge-${DIFF_CLS[diff]}">${DIFF_HE[diff] ?? diff}</span>
        </div>
        <div class="question-text">${c.question_text ?? ""}</div>
        ${c.image_url ? `<img class="question-img" src="${c.image_url}" alt="תמונת שאלה">` : ""}
        ${opts}
        ${c.ai_explanation ? `<div class="explanation">${c.ai_explanation}</div>` : ""}
      </div>`;
  }).join('<hr class="divider">');

  const html = `
    <h1>${exam.title ?? "מבחן"} — מפתח תשובות</h1>
    <div class="meta">${exam.subject ?? ""} · ${questions.length} שאלות</div>
    <hr class="divider">
    ${qs}
  `;
  openPrint(html);
}

// ── Export class report (teacher view) ────────────────────
export function printClassReport(exam, questions, submissions) {
  const now = new Date().toLocaleDateString("he-IL");
  const total = questions.length;

  // Calc score per submission
  const rows = submissions.map(sub => {
    const answers = sub.answers ?? [];
    const correct = answers.filter(a => {
      const q = questions.find(q => q.id === a.question_id);
      return q && a.selected_index === q.content?.correct_answer_index;
    }).length;
    const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { name: sub.student_name ?? "—", correct, pct, date: sub.completed_at, answers };
  }).sort((a, b) => b.pct - a.pct);

  const avg = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.pct, 0) / rows.length) : 0;
  const avgColor = avg >= 80 ? "#0F6E56" : avg >= 60 ? "#854F0B" : "#A32D2D";
  const passing  = rows.filter(r => r.pct >= 60).length;

  // Score distribution buckets: 0-59, 60-74, 75-89, 90-100
  const buckets = [
    { label: "0–59",  min: 0,  max: 59,  color: "#A32D2D", bg: "#FCEBEB" },
    { label: "60–74", min: 60, max: 74,  color: "#854F0B", bg: "#FAEEDA" },
    { label: "75–89", min: 75, max: 89,  color: "#0F6E56", bg: "#E1F5EE" },
    { label: "90–100",min: 90, max: 100, color: "#534AB7", bg: "#EEEDFE" },
  ];
  const bucketCounts = buckets.map(b => ({
    ...b,
    count: rows.filter(r => r.pct >= b.min && r.pct <= b.max).length,
  }));
  const maxBucket = Math.max(...bucketCounts.map(b => b.count), 1);

  const distHtml = bucketCounts.map(b => {
    const barW = Math.round((b.count / maxBucket) * 100);
    return `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:7px">
        <div style="width:48px;font-size:11px;color:#6b7280;flex-shrink:0;text-align:left">${b.label}</div>
        <div style="flex:1;height:18px;background:#f3f4f6;border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${barW}%;background:${b.color};border-radius:4px;transition:width 0.4s"></div>
        </div>
        <div style="width:28px;font-size:11px;font-weight:700;color:${b.color};text-align:right">${b.count}</div>
      </div>`;
  }).join("");

  // Topic weakness across class
  const topicStats = {};
  questions.forEach(q => {
    const tid = q.source_topic_id ?? "כללי";
    const name = q.content?.topic_name ?? tid;
    if (!topicStats[tid]) topicStats[tid] = { name, total: 0, wrong: 0 };
  });
  rows.forEach(row => {
    row.answers.forEach(a => {
      const q = questions.find(q => q.id === a.question_id);
      if (!q) return;
      const tid = q.source_topic_id ?? "כללי";
      if (!topicStats[tid]) topicStats[tid] = { name: q.content?.topic_name ?? tid, total: 0, wrong: 0 };
      topicStats[tid].total++;
      if (a.selected_index !== q.content?.correct_answer_index) topicStats[tid].wrong++;
    });
  });
  const topicList = Object.values(topicStats)
    .filter(t => t.total > 0)
    .map(t => ({ ...t, errPct: Math.round((t.wrong / t.total) * 100) }))
    .sort((a, b) => b.errPct - a.errPct);

  const topicsHtml = topicList.length > 1 ? `
    <h2>נושאים חלשים ברמת הכיתה</h2>
    ${topicList.map(t => {
      const col = t.errPct >= 60 ? "#A32D2D" : t.errPct >= 40 ? "#854F0B" : "#0F6E56";
      return `<div class="topic-row">
        <div class="topic-label">
          <span>${t.name}</span>
          <span style="color:${col};font-weight:700">${t.errPct}% שגיאות</span>
        </div>
        <div class="bar-bg"><div class="bar-fill" style="width:${t.errPct}%;background:${col}"></div></div>
      </div>`;
    }).join("")}
    <hr class="divider">
  ` : "";

  // Student table
  const tableRows = rows.map((r, i) => {
    const col = r.pct >= 80 ? "#0F6E56" : r.pct >= 60 ? "#854F0B" : "#A32D2D";
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
    return `<tr style="border-bottom:1px solid #f3f4f6">
      <td style="padding:7px 10px;font-size:12px">${medal}</td>
      <td style="padding:7px 10px;font-size:13px;font-weight:500">${r.name}</td>
      <td style="padding:7px 10px;text-align:center;font-size:13px;font-weight:700;color:${col}">${r.pct}%</td>
      <td style="padding:7px 10px;text-align:center;font-size:12px;color:#6b7280">${r.correct}/${total}</td>
      <td style="padding:7px 10px;text-align:center;font-size:11px;color:#9ca3af">${r.date ? new Date(r.date).toLocaleDateString("he-IL") : "—"}</td>
    </tr>`;
  }).join("");

  const html = `
    <h1>${exam.title ?? "מבחן"} — דוח כיתתי</h1>
    <div class="meta">${exam.subject ?? ""} · ${rows.length} תלמידים · הודפס ${now}</div>
    <hr class="divider">

    <!-- Summary cards -->
    <div style="display:flex;gap:16px;margin-bottom:20px;flex-wrap:wrap">
      <div style="flex:1;min-width:100px;border-radius:12px;padding:14px 16px;background:#EEEDFE;text-align:center">
        <div style="font-size:32px;font-weight:800;color:${avgColor}">${avg}%</div>
        <div style="font-size:11px;color:#534AB7;margin-top:2px">ממוצע כיתה</div>
      </div>
      <div style="flex:1;min-width:100px;border-radius:12px;padding:14px 16px;background:#E1F5EE;text-align:center">
        <div style="font-size:32px;font-weight:800;color:#0F6E56">${passing}</div>
        <div style="font-size:11px;color:#0F6E56;margin-top:2px">עוברים (60+)</div>
      </div>
      <div style="flex:1;min-width:100px;border-radius:12px;padding:14px 16px;background:#FCEBEB;text-align:center">
        <div style="font-size:32px;font-weight:800;color:#A32D2D">${rows.length - passing}</div>
        <div style="font-size:11px;color:#A32D2D;margin-top:2px">נכשלים</div>
      </div>
      <div style="flex:1;min-width:100px;border-radius:12px;padding:14px 16px;background:#f8f7ff;text-align:center">
        <div style="font-size:32px;font-weight:800;color:#1a1a2e">${rows.length}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:2px">הגשות</div>
      </div>
    </div>

    <!-- Distribution -->
    <h2>התפלגות ציונים</h2>
    <div style="margin-bottom:18px">${distHtml}</div>
    <hr class="divider">

    ${topicsHtml}

    <!-- Student table -->
    <h2>תוצאות תלמידים</h2>
    <table style="width:100%;border-collapse:collapse;font-family:inherit">
      <thead>
        <tr style="background:#f8f7ff">
          <th style="padding:7px 10px;text-align:right;font-size:11px;color:#6b7280;font-weight:600">#</th>
          <th style="padding:7px 10px;text-align:right;font-size:11px;color:#6b7280;font-weight:600">שם תלמיד</th>
          <th style="padding:7px 10px;text-align:center;font-size:11px;color:#6b7280;font-weight:600">ציון</th>
          <th style="padding:7px 10px;text-align:center;font-size:11px;color:#6b7280;font-weight:600">נכון</th>
          <th style="padding:7px 10px;text-align:center;font-size:11px;color:#6b7280;font-weight:600">תאריך</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>

    <hr class="divider">
    <div style="font-size:11px;color:#9ca3af;text-align:center;margin-top:12px">הופק על ידי ExamAI</div>
  `;
  openPrint(html);
}

// ── Export student personal report ────────────────────────
export function printStudentReport(exam, questions, answers, studentName) {
  const LETTERS = "אבגד";
  const correct = answers.filter((a, i) => a?.selected_index === questions[i]?.content?.correct_answer_index).length;
  const pct = Math.round((correct / questions.length) * 100);
  const scoreColor = pct >= 80 ? "#0F6E56" : pct >= 60 ? "#854F0B" : "#A32D2D";

  // Topic breakdown
  const statsMap = {};
  questions.forEach((q, i) => {
    const a = answers[i];
    const tid  = q.content?.source_topic_id ?? q.source_topic_id ?? "כללי";
    const name = q.content?.topic_name ?? tid;
    if (!statsMap[tid]) statsMap[tid] = { name, total: 0, correct: 0 };
    statsMap[tid].total++;
    if (a?.selected_index === q.content?.correct_answer_index) statsMap[tid].correct++;
  });
  const topics = Object.values(statsMap).sort((a, b) => (a.correct / a.total) - (b.correct / b.total));

  const topicsHtml = topics.length > 1 ? `
    <h2>ביצועים לפי נושא</h2>
    ${topics.map(t => {
      const p = Math.round((t.correct / t.total) * 100);
      const col = p >= 80 ? "#0F6E56" : p >= 50 ? "#854F0B" : "#A32D2D";
      return `<div class="topic-row">
        <div class="topic-label"><span>${t.name}</span><span style="color:${col};font-weight:600">${t.correct}/${t.total} (${p}%)</span></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${p}%;background:${col}"></div></div>
      </div>`;
    }).join("")}
    <hr class="divider">
  ` : "";

  // Questions review
  const reviewHtml = questions.map((q, i) => {
    const a = answers[i];
    const c = q.content ?? {};
    const isSkip    = !a || a.selected_index === -1;
    const isCorrect = !isSkip && a.selected_index === c.correct_answer_index;
    const icon = isSkip ? "—" : isCorrect ? "✓" : "✗";
    const borderColor = isSkip ? "#e5e7eb" : isCorrect ? "#5DCAA5" : "#F09595";
    return `
      <div style="border:1px solid ${borderColor};border-radius:10px;padding:10px 12px;margin-bottom:8px;page-break-inside:avoid">
        <div style="display:flex;justify-content:space-between;gap:8px">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;margin-bottom:4px">${i + 1}. ${c.question_text ?? ""}</div>
            ${c.image_url ? `<img class="question-img" src="${c.image_url}" alt="תמונת שאלה">` : ""}
            ${isSkip
              ? `<div style="font-size:12px;color:#6b7280">לא נענה</div>`
              : isCorrect
                ? `<div style="font-size:12px;color:#0F6E56">תשובה נכונה ✓</div>`
                : `<div style="font-size:12px;color:#A32D2D">
                    ענית: ${c.options?.[a.selected_index] ?? "—"}<br>
                    נכון: ${c.options?.[c.correct_answer_index] ?? "—"}
                  </div>`
            }
            ${!isSkip && !isCorrect && c.ai_explanation
              ? `<div class="explanation">${c.ai_explanation}</div>`
              : ""}
          </div>
          <div style="font-size:18px;flex-shrink:0">${icon}</div>
        </div>
      </div>`;
  }).join("");

  const now = new Date().toLocaleDateString("he-IL");
  const html = `
    <h1>${exam?.title ?? "מבחן"}</h1>
    <div class="meta">${studentName} · ${exam?.subject ?? ""} · ${now}</div>
    <hr class="divider">

    <div style="text-align:center;margin-bottom:20px">
      <div class="score-big" style="color:${scoreColor}">${pct}%</div>
      <div class="score-sub">${correct} מתוך ${questions.length} נכון</div>
    </div>
    <hr class="divider">

    ${topicsHtml}

    <h2>סקירת שאלות</h2>
    ${reviewHtml}
    <hr class="divider">
    <div style="font-size:11px;color:#9ca3af;text-align:center">הופק על ידי ExamAI</div>
  `;
  openPrint(html);
}
