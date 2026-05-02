import React, { useState } from "react";
import "./LoginForm.css";
import UMIBLogo from "../assets/umiblogo.jpg";
import { FcGoogle } from "react-icons/fc";
import { apiUrl } from "./utils/api";

const loginLogoSrc = import.meta.env.VITE_LOGIN_LOGO_URL || UMIBLogo;
const loginLogoAlt = import.meta.env.VITE_LOGIN_LOGO_ALT || "University logo";

const AUTH_ERROR_MESSAGES = {
  oauth_not_configured: "Google sign-in is not configured on the server. Check the production environment variables.",
  unauthorized_domain: "Only @umib.net email addresses are allowed.",
  oauth_callback_failed: "Google sign-in reached the server, but the login could not be completed.",
  db_user_sync_failed: "Google sign-in succeeded, but your account could not be synced with the database.",
  session_login_failed: "Google sign-in succeeded, but the session could not be created.",
  google_login_failed: "Google sign-in failed. Please try again."
};

const LoginForm = () => {
  const [loading, setLoading] = useState(false);
  const authError = new URLSearchParams(window.location.search).get("authError");
  const authErrorMessage = authError
    ? AUTH_ERROR_MESSAGES[authError] || AUTH_ERROR_MESSAGES.google_login_failed
    : "";

  const handleGoogleLogin = () => {
    setLoading(true);
    window.location.href = apiUrl("/auth/google");
    console.log("Duke u ridrejtuar te Google...");
  };

  return (
    <div className="login-wrapper">
      <div className="login-container google-only">
        <div className="brand-side">
          <p className="state-title">Republika e Kosoves</p>
          <div className="logo-placeholder">
            <img src={loginLogoSrc} alt={loginLogoAlt} className="university-logo-img" />
          </div>
          <div className="brand-text">
            <h1>UMIB</h1>
            <p className="smu-tag">
              Sistemi i Menaxhimit Universitar te Kerkimeve Shkencore
            </p>
          </div>
        </div>

        <div className="form-side oauth-center">
          <div className="form-header">
            <h2>Sign in to your account</h2>
          </div>

          <div className="oauth-content">
            {authErrorMessage ? (
              <p className="domain-restriction" role="alert">
                {authErrorMessage}
              </p>
            ) : null}

            <button
              className="google-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <FcGoogle className="google-icon" />
              <span>{loading ? "Duke u lidhur..." : "Sign in with Google"}</span>
            </button>

            <p className="domain-restriction">
              Only <strong>@umib.net</strong> emails are accepted.
            </p>
          </div>
        </div>
      </div>

      <div className="footer-text">
        (c) 2026 Universiteti i Mitrovices "Isa Boletini" - Te gjitha te drejtat e rezervuara.
      </div>
    </div>
  );
};

export default LoginForm;
