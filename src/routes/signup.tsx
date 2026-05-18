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

  useEffect(() => {
    if (!loading && user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <img src={logo} alt="DropDigital" />
          <div className="auth-logo-text">Drop<span>Digital</span></div>
        </div>
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>❌</div>
          <p style={{ fontSize: 16, color: "#ccc", lineHeight: 1.7 }}>
            Accès sur invitation uniquement.<br />
            Contacte l'administrateur pour obtenir un accès.
          </p>
        </div>
        <div className="auth-links">
          <Link to="/login" className="auth-link">Déjà un accès ? Se connecter</Link>
        </div>
      </div>
    </div>
  );
}
