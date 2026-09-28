
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./LoginForm.css";
import UMIBLogo from "../assets/umiblogo.jpg";
import { FcGoogle } from "react-icons/fc";
import { apiUrl } from "./utils/api";
import { useLanguage } from "./i18n/LanguageContext";

const AUTH_ERROR_CODES = new Set([
  "oauth_not_configured",
  "unauthorized_domain",
  "oauth_callback_failed",
  "db_user_sync_failed",
  "session_login_failed",
  "google_login_failed",
]);

const DASHBOARD_BY_ROLE = {
  admin: "/admin/dashboard",
  committee: "/committee/dashboard",
  professor: "/professor/dashboard",
  prorector: "/prorector/dashboard",
};

const LoginForm = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const authError = new URLSearchParams(window.location.search).get("authError");
  const authErrorKey = AUTH_ERROR_CODES.has(authError) ? authError : "google_login_failed";
  const authErrorMessage = authError
    ? t(`auth.login.errors.${authErrorKey}`)
    : "";

  useEffect(() => {
    let isMounted = true;

    const redirectAuthenticatedUser = async () => {
      try {
        const response = await fetch(apiUrl("/auth/me"), {
          credentials: "include",
          cache: "no-store",
        });

        if (!response.ok) return;

        const data = await response.json().catch(() => ({}));
        const role = String(data.user?.role || "").toLowerCase();
        const dashboardRoute = DASHBOARD_BY_ROLE[role];

        if (isMounted && dashboardRoute) {
          navigate(dashboardRoute, { replace: true });
        }
      } catch {
        // Keep the login form available when the session check cannot be completed.
      }
    };

    redirectAuthenticatedUser();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleGoogleLogin = () => {
    setLoading(true);
    window.location.href = apiUrl("/auth/google");
    console.log("Duke u ridrejtuar te Google...");
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
              <span>{loading ? t("auth.login.connecting") : t("auth.login.googleButton")}</span>
            </button>

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
