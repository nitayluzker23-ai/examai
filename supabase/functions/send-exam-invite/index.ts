import { createClient } from "jsr:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
// Until the user verifies a custom domain in Resend, use the shared sandbox sender.
const FROM_ADDRESS = Deno.env.get("EMAIL_FROM") ?? "ExamAI <onboarding@resend.dev>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://examai-self.vercel.app";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function escapeHtml(s: string) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

function buildHtml(examTitle: string, examCode: string, senderName: string) {
  const link = `${APP_URL}/exam/${examCode}`;
  return `<!doctype html><html dir="rtl" lang="he"><body style="margin:0;background:#f8f7ff;font-family:Arial,'Segoe UI',sans-serif;">
  <div style="max-width:520px;margin:0 auto;padding:32px 20px;">
    <div style="background:#fff;border-radius:18px;overflow:hidden;border:1px solid #eee;">
      <div style="background:linear-gradient(135deg,#534AB7,#3C3489);padding:28px 24px;text-align:center;">
        <div style="font-size:24px;font-weight:800;color:#fff;">ExamAI</div>
      </div>
      <div style="padding:28px 24px;text-align:right;color:#1a1a2e;">
        <p style="font-size:16px;margin:0 0 14px;">הוזמנת למבחן${senderName ? ` מאת ${escapeHtml(senderName)}` : ""}:</p>
        <p style="font-size:20px;font-weight:700;color:#534AB7;margin:0 0 20px;">${escapeHtml(examTitle)}</p>
        <p style="font-size:14px;color:#6b7280;margin:0 0 8px;">קוד גישה:</p>
        <div style="font-size:28px;font-weight:800;letter-spacing:6px;color:#534AB7;background:#EEEDFE;border-radius:12px;padding:14px;text-align:center;margin-bottom:22px;font-family:monospace;">${escapeHtml(examCode)}</div>
        <a href="${link}" style="display:block;background:#534AB7;color:#fff;text-decoration:none;text-align:center;padding:14px;border-radius:12px;font-size:16px;font-weight:700;">התחל את המבחן ←</a>
        <p style="font-size:12px;color:#9ca3af;margin:18px 0 0;text-align:center;">או הזן את הקוד ידנית ב-${APP_URL}/exam</p>
      </div>
    </div>
    <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:16px;">נשלח באמצעות ExamAI</p>
  </div></body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    // Auth — only logged-in users can send
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: "שליחת מייל אינה מוגדרת עדיין. יש להוסיף RESEND_API_KEY בהגדרות הפרויקט." }),
        { status: 503, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const { to, examTitle, examCode, senderName } = await req.json();
    const recipients = (Array.isArray(to) ? to : [to])
      .map((e: string) => String(e).trim())
      .filter((e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));

    if (!recipients.length) {
      return new Response(JSON.stringify({ error: "כתובת אימייל לא תקינה" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }
    if (!examCode || !examTitle) {
      return new Response(JSON.stringify({ error: "חסרים פרטי מבחן" }), { status: 400, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const html = buildHtml(examTitle, examCode, senderName ?? "");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: recipients,
        subject: `הוזמנת למבחן: ${examTitle}`,
        html,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Resend error:", res.status, errText);
      return new Response(JSON.stringify({ error: `שליחת המייל נכשלה (${res.status})` }), { status: 502, headers: { ...CORS, "Content-Type": "application/json" } });
    }

    const data = await res.json();
    return new Response(JSON.stringify({ ok: true, id: data.id, sent: recipients.length }), { headers: { ...CORS, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("send-exam-invite error:", e);
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...CORS, "Content-Type": "application/json" } });
  }
});
