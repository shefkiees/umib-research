import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Globe } from "lucide-react";
import "../styles/CommitteeDashboard.css";
import { useLanguage } from "../../i18n/LanguageContext";
import { apiUrl } from "../../utils/api";

const defaultSettings = {
  emailNotifications: true,
};

export default function CommitteeSettings({ onBack }) {
  const navigate = useNavigate();
  const { language, setLanguage, t } = useLanguage();
  const [settings, setSettings] = useState(defaultSettings);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    const loadPreferences = async () => {
      try {
        const response = await fetch(apiUrl("/notifications/preferences"), {
          credentials: "include",
        });

        if (!response.ok) {
          throw new Error("preferences_load_failed");
        }

        const data = await response.json();

        if (isMounted) {
          setSettings((prev) => ({
            ...prev,
            emailNotifications: Boolean(data.emailNotifications),
          }));
        }
      } catch (error) {
        console.error("Preferences load failed:", error);
      }
    };

    loadPreferences();

    return () => {
      isMounted = false;
    };
  }, []);

  const updateEmailNotificationsPreference = async (value) => {
    const previousValue = settings.emailNotifications;

    setSettings((prev) => ({ ...prev, emailNotifications: value }));

    try {
      const response = await fetch(apiUrl("/notifications/preferences"), {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ emailNotifications: value }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error("preferences_update_failed");
      }

      const nextValue = Boolean(data.emailNotifications);
      setSettings((prev) => ({ ...prev, emailNotifications: nextValue }));
      setSavedMessage("Preferencat e emailit u ruajtën me sukses.");
      setTimeout(() => setSavedMessage(""), 3000);
    } catch (error) {
      console.error("Preferences save failed:", error);
      setSettings((prev) => ({ ...prev, emailNotifications: previousValue }));
      setSavedMessage("Preferencat e emailit nuk u ruajtën. Provoni përsëri.");
      setTimeout(() => setSavedMessage(""), 3000);
    }
  };

  const updateLanguage = (event) => {
    setLanguage(event.target.value);
  };

  return (
    <div className="prorector-table-section">
      <div className="committee-settings-top-header">
        <div>
          <h2>{t("committee.settings.title")}</h2>
          <p>{t("committee.settings.description")}</p>
        </div>
        <button
          className="committee-settings-back"
          type="button"
          onClick={() => (onBack ? onBack() : navigate(-1))}
        >
          {t("committee.settings.back")}
        </button>
      </div>

      <div className="prorector-settings-grid">
        <article className="prorector-settings-card">
          <div className="prorector-settings-card-header">
            <div className="prorector-settings-icon">
              <Bell size={20} />
            </div>
            <h3>{t("committee.settings.notificationPreferences")}</h3>
          </div>
          <div className="prorector-settings-options">
            <div className="prorector-settings-option-item">
              <div className="prorector-settings-option-info">
                <span className="prorector-settings-label">{t("committee.settings.emailNotifications")}</span>
                <p className="prorector-settings-subtext">
                  {t("committee.settings.emailNotificationsDescription")}
                </p>
              </div>
              <label className="prorector-switch">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(event) => updateEmailNotificationsPreference(event.target.checked)}
                />
                <span className="prorector-slider"></span>
              </label>
            </div>
            {savedMessage ? (
              <p className="prorector-settings-subtext" style={{ color: "green", marginTop: "8px" }}>
                {savedMessage}
              </p>
            ) : null}
          </div>
        </article>

        <article className="prorector-settings-card">
          <div className="prorector-settings-card-header">
            <div className="prorector-settings-icon">
              <Globe size={20} />
            </div>
            <h3>{t("committee.settings.interfaceLanguage")}</h3>
          </div>
          <div className="prorector-settings-options">
            <div className="prorector-settings-option-item">
              <div className="prorector-settings-option-info">
                <span className="prorector-settings-label">{t("committee.settings.interfaceLanguage")}</span>
              </div>
              <select
                className="prorector-settings-select"
                value={language}
                onChange={updateLanguage}
              >
                <option value="sq">{t("committee.settings.albanian")}</option>
                <option value="en">{t("committee.settings.english")}</option>
              </select>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
