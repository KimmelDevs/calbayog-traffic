// pages/auth.jsx
import { useRouter } from "next/router";
import Head from "next/head";
import { supabase } from "../lib/supabase";
import { useState, useEffect } from "react";
export const dynamic = 'force-dynamic';
export const ssr = false;

export default function Auth() {
  const router  = useRouter();
  const [mode,     setMode]     = useState("login");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState("");

  useEffect(() => {
    if (router.query.mode === "signup") setMode("signup");
  }, [router.query]);

  const handleSubmit = async () => {
    setError(""); setSuccess("");
    if (!email || !password) { setError("Email and password are required."); return; }
    if (mode === "signup" && password !== confirm) { setError("Passwords do not match."); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace("/dashboard");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Don't auto-redirect — show success message
        setSuccess("Account created! You can now sign in.");
        setMode("login");
        setEmail(""); setPassword(""); setConfirm("");
      }
    } catch (err) {
      const msgs = {
        "Invalid login credentials": "Incorrect email or password.",
        "User already registered":   "An account with this email already exists.",
        "Email not confirmed":        "Please confirm your email before logging in.",
      };
      setError(msgs[err.message] || err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: "100%", padding: "13px 16px",
    background: "rgba(15,23,42,0.8)",
    border: "1px solid #1e3a5f", borderRadius: 6,
    color: "#e2e8f0", fontSize: 13, outline: "none",
    fontFamily: "'Space Mono', monospace",
    transition: "border-color 0.2s", boxSizing: "border-box",
  };

  return (
    <>
      <Head>
        <title>{mode === "login" ? "Login" : "Sign Up"} — LSTM Traffic System</title>
        <link href="https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@600;700;800&display=swap" rel="stylesheet" />
      </Head>
      <style>{`
        * { margin:0; padding:0; box-sizing:border-box; }
        body { background:#030712; }
        @keyframes gridScroll { 0%{transform:translateY(0)} 100%{transform:translateY(60px)} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .card { animation: fadeUp 0.6s ease forwards; }
        input:focus { border-color: #3b82f6 !important; }
        .submit-btn {
          width:100%; padding:13px;
          background:linear-gradient(90deg,#3b82f6,#06b6d4);
          border:none; border-radius:6px; color:#fff;
          font-size:11px; font-weight:700; letter-spacing:0.18em;
          cursor:pointer; font-family:'Space Mono',monospace; transition:all 0.2s;
        }
        .submit-btn:hover:not(:disabled){opacity:0.9;transform:translateY(-1px);box-shadow:0 0 20px #3b82f640;}
        .submit-btn:disabled{opacity:0.5;cursor:not-allowed;}
        .toggle-btn{background:none;border:none;cursor:pointer;color:#38bdf8;font-size:12px;font-family:'Space Mono',monospace;text-decoration:underline;text-underline-offset:3px;transition:color 0.2s;}
        .toggle-btn:hover{color:#7dd3fc;}
        .back-btn{background:none;border:none;cursor:pointer;color:#334155;font-size:10px;font-family:'Space Mono',monospace;letter-spacing:0.12em;transition:color 0.2s;display:flex;align-items:center;gap:6px;}
        .back-btn:hover{color:#64748b;}
      `}</style>

      <div style={{ width:"100vw", height:"100vh", background:"#030712", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Syne',sans-serif", position:"relative", overflow:"hidden" }}>
        <div style={{ position:"absolute", inset:0, backgroundImage:`linear-gradient(rgba(59,130,246,0.03) 1px,transparent 1px),linear-gradient(90deg,rgba(59,130,246,0.03) 1px,transparent 1px)`, backgroundSize:"60px 60px", animation:"gridScroll 4s linear infinite" }} />
        <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle,rgba(59,130,246,0.06) 0%,transparent 70%)" }} />

        <div className="card" style={{ position:"relative", zIndex:10, width:"100%", maxWidth:420, background:"rgba(9,15,29,0.95)", border:"1px solid #1e3a5f", borderRadius:12, padding:40, backdropFilter:"blur(20px)" }}>
          <button className="back-btn" onClick={() => router.push("/")} style={{ marginBottom:28 }}>← BACK TO HOME</button>

          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:32 }}>
            <div style={{ width:40, height:40, borderRadius:8, background:"linear-gradient(135deg,#3b82f6,#06b6d4)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, boxShadow:"0 0 16px #3b82f640" }}>🚦</div>
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:"#38bdf8", letterSpacing:"0.1em" }}>CALBAYOG CITY</div>
              <div style={{ fontSize:9, color:"#334155", letterSpacing:"0.15em", fontFamily:"'Space Mono',monospace" }}>LSTM TRAFFIC SYSTEM</div>
            </div>
          </div>

          <h2 style={{ fontSize:22, fontWeight:800, color:"#e2e8f0", marginBottom:6 }}>
            {mode === "login" ? "Welcome back" : "Create account"}
          </h2>
          <p style={{ fontSize:12, color:"#334155", marginBottom:28, fontFamily:"'Space Mono',monospace", letterSpacing:"0.05em" }}>
            {mode === "login" ? "Sign in to access the dashboard" : "Register a new account"}
          </p>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div>
              <label style={{ fontSize:9, color:"#475569", letterSpacing:"0.15em", fontFamily:"'Space Mono',monospace", display:"block", marginBottom:6 }}>EMAIL ADDRESS</label>
              <input type="email" value={email} placeholder="you@example.com" onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==="Enter" && handleSubmit()} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize:9, color:"#475569", letterSpacing:"0.15em", fontFamily:"'Space Mono',monospace", display:"block", marginBottom:6 }}>PASSWORD</label>
              <input type="password" value={password} placeholder="••••••••" onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==="Enter" && handleSubmit()} style={inputStyle} />
            </div>
            {mode === "signup" && (
              <div>
                <label style={{ fontSize:9, color:"#475569", letterSpacing:"0.15em", fontFamily:"'Space Mono',monospace", display:"block", marginBottom:6 }}>CONFIRM PASSWORD</label>
                <input type="password" value={confirm} placeholder="••••••••" onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key==="Enter" && handleSubmit()} style={inputStyle} />
              </div>
            )}
          </div>

          {error && (
            <div style={{ marginTop:14, padding:"10px 14px", borderRadius:6, background:"rgba(239,68,68,0.08)", border:"1px solid #ef444430", fontSize:11, color:"#f87171", fontFamily:"'Space Mono',monospace" }}>
              ❌ {error}
            </div>
          )}
          {success && (
            <div style={{ marginTop:14, padding:"10px 14px", borderRadius:6, background:"rgba(34,197,94,0.08)", border:"1px solid #22c55e30", fontSize:11, color:"#4ade80", fontFamily:"'Space Mono',monospace" }}>
              ✅ {success}
            </div>
          )}

          <button className="submit-btn" onClick={handleSubmit} disabled={loading} style={{ marginTop:24 }}>
            {loading ? "PLEASE WAIT..." : mode === "login" ? "SIGN IN →" : "CREATE ACCOUNT →"}
          </button>

          <div style={{ marginTop:20, textAlign:"center", fontSize:12, color:"#334155" }}>
            {mode === "login" ? "No account? " : "Already registered? "}
            <button className="toggle-btn" onClick={() => { setMode(mode==="login"?"signup":"login"); setError(""); setSuccess(""); }}>
              {mode === "login" ? "Sign up" : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
