
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginForm.css";
import UMIBLogo from "../assets/umiblogo.jpg";
import { FcGoogle } from "react-icons/fc";
import { apiUrl } from "./utils/api";
import { useLanguage } from "./i18n/LanguageContext";
import { authClient } from "./auth/authClient.js";
import { RefreshCw } from "lucide-react";

const AUTH_ERROR_CODES = new Set([
  "oauth_not_configured",
  "unauthorized_domain",
  "oauth_callback_failed",
  "db_user_sync_failed",
  "session_login_failed",
  "google_login_failed",
]);

const LoginForm = () => {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const english = language === "en";
  const [sessionStatus, setSessionStatus] = useState("checking");
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const loginPending = useRef(false);
  const authError = new URLSearchParams(window.location.search).get("authError");
  const loggedOut = new URLSearchParams(window.location.search).get("loggedOut") === "1";
  const authErrorKey = AUTH_ERROR_CODES.has(authError) ? authError : "google_login_failed";
  const authErrorMessage = authError
    ? t(`auth.login.errors.${authErrorKey}`)
    : "";

  useEffect(() => {
    const controller = new AbortController();
    authClient.checkSession(controller.signal).then((route) => {
      if (controller.signal.aborted) return;
      if (route) navigate(route, { replace: true });
      else setSessionStatus("anonymous");
    }).catch((error) => {
      if (!controller.signal.aborted && error.name !== "AbortError") setSessionStatus("error");
    });
    return () => controller.abort();
  }, [navigate, attempt]);

  const handleGoogleLogin = () => {
    if (loginPending.current || sessionStatus !== "anonymous") return;
    loginPending.current = true;
    setLoading(true);
    // The backend rechecks the session before starting OAuth.
    window.location.href = apiUrl("/auth/google");
  };

  return (
    <div className="login-wrapper">
      <div className="login-container google-only">
        <div className="brand-side">
          <p className="state-title">{t("auth.login.stateTitle")}</p>
          <div className="logo-placeholder">
            <img src={UMIBLogo} alt={t("auth.login.logoAlt")} className="university-logo-img" />
          </div>
          <div className="brand-text">
            <h1>UMIB</h1>
            <p className="smu-tag">
              {t("auth.login.systemName")}
            </p>
          </div>
        </div>

        <div className="form-side oauth-center">
          <div className="form-header">
            <h2>{t("auth.login.title")}</h2>
          </div>

          <div className="oauth-content">
            {loggedOut && <p className="domain-restriction" role="status">{english ? "You have signed out successfully." : "Keni dalë me sukses nga platforma."}</p>}
            {sessionStatus === "checking" && <p role="status">{english ? "Checking your session..." : "Duke kontrolluar sesionin..."}</p>}
            {sessionStatus === "error" && (
              <>
                <p className="domain-restriction" role="alert">{english ? "Your session could not be checked. Please try again." : "Sesioni nuk mund të kontrollohej. Ju lutemi provoni përsëri."}</p>
                <button className="google-btn" type="button" onClick={() => { setSessionStatus("checking"); setAttempt((value) => value + 1); }}><RefreshCw size={20} />{english ? "Try again" : "Provo përsëri"}</button>
              </>
            )}
            {authErrorMessage ? (
              <p className="domain-restriction" role="alert">
                {authErrorMessage}
              </p>
            ) : null}

            {sessionStatus === "anonymous" && <button
              className="google-btn"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <FcGoogle className="google-icon" />
              <span>{loading ? t("auth.login.connecting") : t("auth.login.googleButton")}</span>
            </button>}

            <p className="domain-restriction">
              {t("auth.login.domainPrefix")} <strong>@umib.net</strong> {t("auth.login.domainSuffix")}
            </p>

          </div>
        </div>
      </div>

      <div className="footer-text">
        {t("auth.login.footer")}
      </div>
    </div>
  );
};

export default LoginForm;
