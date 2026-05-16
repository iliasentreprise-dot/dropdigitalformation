import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import "../styles/auth.css";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — DropDigital" },
      { name: "description", content: "Choisis un nouveau mot de passe DropDigital." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    if (password.length < 6) { setError("Le mot de passe doit faire au moins 6 caractères."); return; }
    if (password !== confirm) { setError("Les mots de passe ne correspondent pas."); return; }
    setSubmitting(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    setInfo("Mot de passe mis à jour ! Redirection...");
    setTimeout(() => navigate({ to: "/" }), 1500);
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="DropDigital" />
          <div className="auth-logo-text">Drop<span>Digital</span></div>
        </div>
        <h1 className="auth-title">Nouveau mot de passe</h1>
        <p className="auth-sub">Choisis un mot de passe sécurisé</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info">{info}</div>}
          <div>
            <label className="auth-label" htmlFor="password">Nouveau mot de passe</label>
            <input id="password" type="password" required minLength={6} className="auth-input"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6 caractères minimum" />
          </div>
          <div>
            <label className="auth-label" htmlFor="confirm">Confirmer</label>
            <input id="confirm" type="password" required className="auth-input"
              value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Répète le mot de passe" />
          </div>
          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? "Mise à jour..." : "Mettre à jour"}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login" className="auth-link">← Retour à la connexion</Link>
        </div>
      </div>
    </div>
  );
}
