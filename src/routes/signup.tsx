import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import logo from "@/assets/logo.png";
import "../styles/auth.css";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Inscription — DropDigital" },
      { name: "description", content: "Crée ton compte pirate DropDigital." },
    ],
  }),
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setSubmitting(true);
    const redirectUrl = `${window.location.origin}/`;
    const { error: err } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { username },
      },
    });
    setSubmitting(false);
    if (err) {
      if (err.message.includes("already registered")) {
        setError("Un compte existe déjà avec cet email.");
      } else {
        setError(err.message);
      }
      return;
    }
    setInfo("Compte créé ! Vérifie ta boîte mail pour confirmer ton adresse.");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="DropDigital" />
          <div className="auth-logo-text">Drop<span>Digital</span></div>
        </div>
        <h1 className="auth-title">Rejoins les pirates 🏴‍☠️</h1>
        <p className="auth-sub">Crée ton compte en 30 secondes</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info">{info}</div>}
          <div>
            <label className="auth-label" htmlFor="username">Pseudo de pirate</label>
            <input id="username" type="text" required className="auth-input"
              value={username} onChange={(e) => setUsername(e.target.value)} placeholder="CapitaineNoir" />
          </div>
          <div>
            <label className="auth-label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="auth-input"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pirate@dropdigital.com" />
          </div>
          <div>
            <label className="auth-label" htmlFor="password">Mot de passe</label>
            <input id="password" type="password" required minLength={6} className="auth-input"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères minimum" />
          </div>
          <div>
            <label className="auth-label" htmlFor="confirm">Confirmer le mot de passe</label>
            <input id="confirm" type="password" required className="auth-input"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Répète le mot de passe" />
          </div>
          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? "Création..." : "Créer mon compte"}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login" className="auth-link">Déjà un compte ? Se connecter</Link>
        </div>
      </div>
    </div>
  );
}
