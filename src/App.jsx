import { createContext, useContext, useEffect, useState } from "react";
import {
  BrowserRouter, Routes, Route, Navigate,
  useNavigate, useLocation, useParams, Link,
} from "react-router-dom";
import { createClient } from "@supabase/supabase-js";
import ExamBuilder from "./ExamBuilder";
import StudentExamView from "./StudentExamView";
import InsightsView from "./InsightsView";
import ExamsList from "./ExamsList";
import ContentUploader from "./ContentUploader";
import ExamQuestionsPage from "./ExamQuestionsPage";
import StudentsPage from "./StudentsPage";
import AdminPage from "./AdminPage";

const SUPABASE_URL      = "https://npksscocijjmgzgrolnq.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5wa3NzY29jaWpqbWd6Z3JvbG5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0NTI1NjgsImV4cCI6MjA5MzAyODU2OH0.0tHABuRUriHiwA42DHM7S_MmgJ54NaqrcefPP5YorMk";
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const C = {
  purple: "#534AB7", purpleLight: "#EEEDFE", purpleDark: "#3C3489",
  teal: "#0F6E56", tealLight: "#E1F5EE",
  text: "#1a1a2e", muted: "#6b7280",
  border: "rgba(0,0,0,0.09)", bg: "#f8f7ff", white: "#fff",
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(undefined);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (uid) => {
    const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
    setProfile(data);
  };

  const signIn  = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signUp  = async (email, password, fullName) => {
    const res = await supabase.auth.signUp({ email, password, options: { data: { full_name: fullName } } });
    if (!res.error && res.data?.user) {
      // store email in profiles (upsert so it works even if profile already exists)
      await supabase.from("profiles").upsert({ id: res.data.user.id, full_name: fullName, email });
    }
    return res;
  };
  const signOut = () => supabase.auth.signOut();

  return (
    <AuthContext.Provider value={{ user, profile, signIn, signUp, signOut, loading: user === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

const NAV_ITEMS = [
  { path: "/dashboard",            label: "לוח בקרה",    icon: <GridIcon /> },
  { path: "/dashboard/exams",      label: "המבחנים שלי", icon: <ListIcon /> },
  { path: "/dashboard/new",        label: "מבחן חדש",    icon: <PlusIcon /> },
  { path: "/dashboard/bank",       label: "בנק שאלות",   icon: <BankIcon /> },
  { path: "/dashboard/students",   label: "תלמידים",     icon: <StudentsIcon /> },
  { path: "/dashboard/settings",   label: "הגדרות",      icon: <GearIcon /> },
];

function TeacherLayout({ children }) {
  const { signOut, profile } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobile, setMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 640);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg, direction: "rtl", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif" }}>
      {!mobile && (
        <aside style={{ width: 220, background: C.white, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={{ padding: "20px 20px 16px", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.purple }}>ExamAI</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{profile?.full_name ?? "מורה"}</div>
          </div>
          <nav style={{ flex: 1, padding: "12px 10px" }}>
            {NAV_ITEMS.map(item => {
              const active = location.pathname === item.path;
              return (
                <Link key={item.path} to={item.path} style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 2, background: active ? C.purpleLight : "transparent", color: active ? C.purple : C.muted, fontWeight: active ? 600 : 400, fontSize: 13, transition: "all 0.15s" }}>
                    <span style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                    {item.label}
                  </div>
                </Link>
              );
            })}
          </nav>
          <div style={{ padding: 12, borderTop: `1px solid ${C.border}` }}>
            {profile?.is_admin && (
              <Link to="/admin" style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 10, marginBottom: 6, background: location.pathname === "/admin" ? "#3C348922" : "transparent", color: "#534AB7", fontSize: 13, fontWeight: 600 }}>
                  🛡 לוח ניהול
                </div>
              </Link>
            )}
            <button onClick={handleSignOut} style={{ width: "100%", padding: "9px 12px", background: "transparent", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 13, color: C.muted, cursor: "pointer", fontFamily: "inherit", textAlign: "right" }}>
              יציאה
            </button>
          </div>
        </aside>
      )}
      <main style={{ flex: 1, overflow: "auto", paddingBottom: mobile ? 72 : 0 }}>
        {mobile && (
          <div style={{ background: C.purple, padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#EEEDFE" }}>ExamAI</span>
            <span style={{ fontSize: 12, color: "#CECBF6" }}>{profile?.full_name ?? ""}</span>
          </div>
        )}
        {children}
      </main>
      {mobile && (
        <nav style={{ position: "fixed", bottom: 0, right: 0, left: 0, background: C.white, borderTop: `1px solid ${C.border}`, display: "flex", zIndex: 50, height: 60 }}>
          {NAV_ITEMS.slice(0, 4).map(item => {
            const active = location.pathname === item.path;
            return (
              <Link key={item.path} to={item.path} style={{ flex: 1, textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, color: active ? C.purple : C.muted }}>
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span style={{ fontSize: 9, fontWeight: active ? 600 : 400 }}>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function LoginPage() {
  const { signIn, signUp, user } = useAuth();
  const navigate = useNavigate();
  const [mode,     setMode]     = useState("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [name,     setName]     = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  useEffect(() => { if (user) navigate("/dashboard"); }, [user]);

  const handle = async () => {
    setLoading(true); setError("");
    try {
      const { error: e } = mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password, name);
      if (e) throw e;
      if (mode === "register") setError("נשלח אימות לאימייל שלך. אשר ואז התחבר.");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: C.purple }}>ExamAI</div>
          <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>מערכת מבחנים חכמה</div>
        </div>
        <div style={{ background: C.white, borderRadius: 20, border: `1px solid ${C.border}`, padding: 28, boxShadow: "0 4px 24px rgba(83,74,183,0.08)" }}>
          <div style={{ display: "flex", background: C.bg, borderRadius: 10, padding: 3, marginBottom: 22, gap: 3 }}>
            {[["login","כניסה"],["register","הרשמה"]].map(([m, l]) => (
              <button key={m} onClick={() => { setMode(m); setError(""); }}
                style={{ flex: 1, padding: "8px", borderRadius: 8, border: "none", background: mode === m ? C.white : "transparent", color: mode === m ? C.purple : C.muted, fontWeight: mode === m ? 600 : 400, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
                {l}
              </button>
            ))}
          </div>
          {mode === "register" && <AuthField label="שם מלא" value={name} onChange={setName} placeholder="ישראל ישראלי" />}
          <AuthField label="אימייל" value={email} onChange={setEmail} placeholder="teacher@school.com" type="email" />
          <AuthField label="סיסמה" value={password} onChange={setPassword} placeholder="לפחות 8 תווים" type="password" />
          {error && (
            <div style={{ fontSize: 12, color: error.includes("נשלח") ? C.teal : "#A32D2D", background: error.includes("נשלח") ? C.tealLight : "#FCEBEB", borderRadius: 8, padding: "9px 12px", marginBottom: 14 }}>
              {error}
            </div>
          )}
          <button onClick={handle} disabled={loading || !email || !password}
            style={{ width: "100%", padding: 13, background: (email && password) ? C.purple : "#AFA9EC", color: "white", border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700, cursor: (email && password) ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {loading ? "מתחבר..." : mode === "login" ? "כניסה ←" : "יצירת חשבון ←"}
          </button>
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: C.muted }}>
            תלמיד? <Link to="/exam" style={{ color: C.purple, fontWeight: 600, textDecoration: "none" }}>כניסה עם קוד מבחן ←</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function DashboardHome()    { return <InsightsView />; }
function NewExamPage()      { return <ExamBuilder />; }
function ExamsPage()        { return <ExamsList />; }
function QuestionBankPage() { return <ContentUploader />; }
function StudentsManagePage() { return <StudentsPage />; }
function AdminDashboardPage() { return <AdminPage />; }

function StudentEntryPage() {
  const { accessCode } = useParams();
  return <StudentExamView initialCode={accessCode} />;
}

function SettingsPage() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div style={{ padding: 20, fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl" }}>
      <div style={{ fontSize: 20, fontWeight: 700, color: C.text, marginBottom: 20 }}>הגדרות</div>
      <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: 20, maxWidth: 400 }}>
        <Row label="שם" value={profile?.full_name ?? "—"} />
        <Row label="תפקיד" value="מורה / מדריך" />
        <div style={{ marginTop: 16 }}>
          <button onClick={async () => { await signOut(); navigate("/login"); }}
            style={{ padding: "10px 20px", background: "#FCEBEB", color: "#A32D2D", border: "1px solid #F09595", borderRadius: 10, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>
            יציאה מהמערכת
          </button>
        </div>
      </div>
    </div>
  );
}

function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans Hebrew','Segoe UI',sans-serif", direction: "rtl", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 48, fontWeight: 800, color: C.purple }}>404</div>
      <div style={{ fontSize: 15, color: C.muted }}>הדף לא נמצא</div>
      <Link to="/" style={{ color: C.purple, fontSize: 13 }}>חזרה לדף הבית</Link>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/"     element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/exam"             element={<StudentEntryPage />} />
          <Route path="/exam/:accessCode" element={<StudentEntryPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute><TeacherLayout><DashboardHome /></TeacherLayout></ProtectedRoute>
          } />
          <Route path="/dashboard/exams" element={
            <ProtectedRoute><TeacherLayout><ExamsPage /></TeacherLayout></ProtectedRoute>
          } />
          <Route path="/dashboard/new" element={
            <ProtectedRoute><TeacherLayout><NewExamPage /></TeacherLayout></ProtectedRoute>
          } />
          <Route path="/dashboard/bank" element={
            <ProtectedRoute><TeacherLayout><QuestionBankPage /></TeacherLayout></ProtectedRoute>
          } />
          <Route path="/admin" element={
            <ProtectedRoute><TeacherLayout><AdminDashboardPage /></TeacherLayout></ProtectedRoute>
          } />
          <Route path="/dashboard/students" element={
            <ProtectedRoute><TeacherLayout><StudentsManagePage /></TeacherLayout></ProtectedRoute>
          } />
          <Route path="/dashboard/settings" element={
            <ProtectedRoute><TeacherLayout><SettingsPage /></TeacherLayout></ProtectedRoute>
          } />
          <Route path="/dashboard/exam/:examId/questions" element={
            <ProtectedRoute><TeacherLayout><ExamQuestionsPage /></TeacherLayout></ProtectedRoute>
          } />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function AuthField({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: C.muted, marginBottom: 5, fontWeight: 500 }}>{label}</div>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: "100%", padding: "11px 13px", border: `1px solid ${C.border}`, borderRadius: 10, fontSize: 14, background: C.bg, color: C.text, fontFamily: "inherit", direction: "rtl", outline: "none" }} />
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ color: C.text, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

function FullPageSpinner() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg }}>
      <div style={{ width: 36, height: 36, border: `3px solid #EEEDFE`, borderTopColor: C.purple, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function GridIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="1" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="1" y="9" width="6" height="6" rx="1.5" fill="currentColor"/><rect x="9" y="9" width="6" height="6" rx="1.5" fill="currentColor"/></svg>; }
function ListIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M5 4h8M5 8h8M5 12h8M2 4h.5M2 8h.5M2 12h.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function PlusIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2v12M2 8h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>; }
function BankIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5V4a3 3 0 016 0v1" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="9.5" r="1.5" fill="currentColor"/></svg>; }
function GearIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function StudentsIcon() { return <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="6" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 13c0-2.761 2.239-4 5-4s5 1.239 5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M12 7l1.5 1.5L16 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
