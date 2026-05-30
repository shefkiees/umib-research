import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { RefreshCw } from "lucide-react";
import { useLanguage } from "../i18n/LanguageContext";
import { sendAccessResetRequest } from "../utils/supabaseAuth";
import "../professor/styles/ProfessorDashboard.css";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_COPY = {
  accessResetTitle: "Rivendosja e qasjes",
  accessResetSubtitle: "Shkruani emailin institucional. Kerkesa do te shqyrtohet nga administratori ose stafi pergjegjes i IT-se.",
  institutionalEmail: "Emaili institucional",
  sendRequest: "Dergo kerkesen",
  sendingRequest: "Duke derguar...",
  neutralSuccess: "Kerkesa juaj u pranua. Kontrolloni emailin tuaj.",
  requestError: "Kerkesa nuk u dergua. Provoni perseri.",
  emailRequired: "Shkruani emailin institucional.",
  emailInvalid: "Shkruani nje email valid.",
  goToLogin: "Kthehu te hyrja",
};

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const copy = { ...DEFAULT_COPY, ...t("auth.passwordReset") };
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    const trimmedEmail = email.trim();

    setMessage("");
    setError("");

    if (!trimmedEmail) {
      setError(copy.emailRequired);
      return;
    }

    if (!EMAIL_PATTERN.test(trimmedEmail)) {
      setError(copy.emailInvalid);
      return;
    }

    setIsSubmitting(true);

    try {
      await sendAccessResetRequest(trimmedEmail);
      setEmail("");
      setMessage(copy.neutralSuccess);
    } catch {
      setError(copy.requestError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="prof-reset-page">
      <section className="prof-modal prof-reset-card" aria-labelledby="reset-password-title">
        <div className="prof-modal-header">
          <div>
            <h1 className="prof-modal-title" id="reset-password-title">{copy.accessResetTitle}</h1>
            <p className="prof-modal-subtitle">{copy.accessResetSubtitle}</p>
          </div>
        </div>

        <form className="prof-modal-form" onSubmit={handleSubmit}>
          <label className="prof-form-field">
            <span>{copy.institutionalEmail}</span>
            <input
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              disabled={isSubmitting}
              required
            />
          </label>

          {error ? <p className="prof-modal-error" role="alert">{error}</p> : null}
          {message ? <p className="prof-modal-success" role="status">{message}</p> : null}

          <div className="prof-modal-actions">
            <button
              type="button"
              className="prof-btn-secondary"
              onClick={() => navigate("/login")}
              disabled={isSubmitting}
            >
              {copy.goToLogin}
            </button>
            <button
              type="submit"
              className="prof-btn-primary"
              disabled={isSubmitting || !email.trim()}
            >
              {isSubmitting ? (
                <>
                  <RefreshCw size={16} className="prof-stats-spin" />
                  {copy.sendingRequest}
                </>
              ) : copy.sendRequest}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
