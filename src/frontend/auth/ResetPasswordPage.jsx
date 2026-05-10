import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import {
  establishPasswordResetSession,
  isSupabaseAuthConfigured,
  updateRecoveredPassword,
} from "../utils/supabaseAuth";
import "../professor/styles/ProfessorDashboard.css";

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const copy = t("auth.passwordReset");
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isSessionValid, setIsSessionValid] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const validationError = useMemo(() => {
    if (!password || !confirmPassword) {
      return "";
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return copy.passwordTooShort;
    }

    if (password !== confirmPassword) {
      return copy.passwordsDoNotMatch;
    }

    return "";
  }, [confirmPassword, copy.passwordsDoNotMatch, copy.passwordTooShort, password]);

  useEffect(() => {
    let isMounted = true;

    const loadRecoverySession = async () => {
      setIsSessionLoading(true);
      setError("");

      try {
        const session = await establishPasswordResetSession();

        if (!session) {
          throw new Error("invalid_or_expired_reset_link");
        }

        if (isMounted) {
          setIsSessionValid(true);
        }
      } catch {
        if (isMounted) {
          setIsSessionValid(false);
          setError(copy.invalidOrExpiredLink);
        }
      } finally {
        if (isMounted) {
          setIsSessionLoading(false);
        }
      }
    };

    if (!isSupabaseAuthConfigured) {
      setError(copy.supabaseNotConfigured);
      setIsSessionLoading(false);
      return undefined;
    }

    loadRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [copy.invalidOrExpiredLink, copy.supabaseNotConfigured]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!password || !confirmPassword) {
      setError(copy.completeRequiredFields);
      return;
    }

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      await updateRecoveredPassword(password);
      setPassword("");
      setConfirmPassword("");
      setMessage(copy.passwordChanged);
    } catch {
      setError(copy.passwordChangeError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="prof-reset-page">
      <section className="prof-modal prof-reset-card" aria-labelledby="reset-password-title">
        <div className="prof-modal-header">
          <div>
            <h1 className="prof-modal-title" id="reset-password-title">{copy.changePassword}</h1>
            <p className="prof-modal-subtitle">{copy.resetPasswordSubtitle}</p>
          </div>
        </div>

        {isSessionLoading ? (
          <div className="prof-stats-empty">
            <RefreshCw size={18} className="prof-stats-spin" />
            {t("common.loading")}
          </div>
        ) : isSessionValid ? (
          <form className="prof-modal-form" onSubmit={handleSubmit}>
            <div className="prof-form-grid single">
              <label className="prof-form-field">
                <span>{copy.newPassword}</span>
                <input
                  type="password"
                  value={password}
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={isSaving}
                  required
                />
              </label>
              <label className="prof-form-field">
                <span>{copy.confirmPassword}</span>
                <input
                  type="password"
                  value={confirmPassword}
                  minLength={MIN_PASSWORD_LENGTH}
                  autoComplete="new-password"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={isSaving}
                  required
                />
              </label>
            </div>

            {validationError ? <p className="prof-modal-error" role="alert">{validationError}</p> : null}
            {error ? <p className="prof-modal-error" role="alert">{error}</p> : null}
            {message ? <p className="prof-modal-success" role="status">{message}</p> : null}

            <div className="prof-modal-actions">
              <button
                type="button"
                className="prof-btn-secondary"
                onClick={() => navigate("/login")}
                disabled={isSaving}
              >
                {copy.goToLogin}
              </button>
              <button
                type="submit"
                className="prof-btn-primary"
                disabled={isSaving || Boolean(validationError)}
              >
                {isSaving ? copy.saving : copy.savePassword}
              </button>
            </div>
          </form>
        ) : (
          <>
            {error ? <p className="prof-modal-error" role="alert">{error}</p> : null}
            <div className="prof-modal-actions">
              <button type="button" className="prof-btn-primary" onClick={() => navigate("/login")}>
                {copy.goToLogin}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
