import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import logo from "@/assets/logo.png";
import "../styles/auth.css";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Connexion — DropDigital" },
      { name: "description", content: "Connectez-vous à votre espace formation DropDigital." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (err) {
      if (err.message.includes("Invalid login")) {
        setError("Email ou mot de passe incorrect.");
      } else if (err.message.includes("Email not confirmed")) {
        setError("Confirme ton email avant de te connecter.");
      } else {
        setError(err.message);
      }
      return;
    }
    navigate({ to: "/" });
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="DropDigital" />
          <div className="auth-logo-text">Drop<span>Digital</span></div>
        </div>
        <h1 className="auth-title">Connexion 🏴‍☠️</h1>
        <p className="auth-sub">Accède à ton espace pirate</p>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}
          <div>
            <label className="auth-label" htmlFor="email">Email</label>
            <input id="email" type="email" required className="auth-input"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pirate@dropdigital.com" />
          </div>
          <div>
            <label className="auth-label" htmlFor="password">Mot de passe</label>
            <input id="password" type="password" required className="auth-input"
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <button type="submit" className="auth-btn" disabled={submitting}>
            {submitting ? "Connexion..." : "Se connecter"}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password" className="auth-link">Mot de passe oublié ?</Link>
          <Link to="/signup" className="auth-link">Créer un compte</Link>
        </div>
      </div>
    </div>
  );
}
