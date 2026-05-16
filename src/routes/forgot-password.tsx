import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo.png";
import "../styles/auth.css";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Mot de passe oublié — DropDigital" },
      { name: "description", content: "Réinitialise ton mot de passe DropDigital." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setInfo("");
    setSubmitting(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setSubmitting(false);
    if (err) { setError(err.message); return; }
    setInfo("Un email de réinitialisation t'a été envoyé. Vérifie ta boîte mail.");
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="DropDigital" />
          <div className="auth-logo-text">Drop<span>Digital</span></div>
        </div>
        <h1 className="auth-title">Mot de passe oublié ?</h1>
        <p className="auth-sub">On t'envoie un lien pour le réinitialiser</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          {info && <div className="auth-info">{info}</div>}
          <div>
            <label className="auth-label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="auth-input"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pirate@dropdigital.com" />
          </div>
          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? "Envoi..." : "Envoyer le lien"}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login" className="auth-link">← Retour à la connexion</Link>
        </div>
      </div>
    </div>
  );
}
