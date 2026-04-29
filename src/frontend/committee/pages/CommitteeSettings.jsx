import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Save, ShieldCheck, Bell, Globe, Cog, History } from "lucide-react";
import "../styles/CommitteeDashboard.css";

const SETTINGS_STORAGE_KEY = "committeeSettings";

const defaultSettings = {
  emailNotifications: true,
  autoArchiveReports: false,
  showOnlyAssigned: true,
  reportFrequency: "Mujore",
  language: "Shqip",
};

export default function CommitteeSettings({ onBack }) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(defaultSettings);
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const persisted = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!persisted) {
      return;
    }

    try {
      const parsed = JSON.parse(persisted);
      setSettings({ ...defaultSettings, ...parsed });
    } catch {
      setSettings(defaultSettings);
    }
  }, []);

  const setBoolean = (field) => (event) => {
    setSettings((prev) => ({ ...prev, [field]: event.target.checked }));
  };

  const setValue = (field) => (event) => {
    setSettings((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSave = (event) => {
    event.preventDefault();
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    setSavedMessage("Settings u ruajtën me sukses.");
    setTimeout(() => setSavedMessage(""), 3000);
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(defaultSettings));
    setSavedMessage("Settings u rikthyen në vlerat fillestare.");
    setTimeout(() => setSavedMessage(""), 3000);
  };

  return (
    <div className="prorector-table-section">
      <div className="committee-settings-top-header">
        <div>
          <h2>Settings</h2>
          <p>Konfigurimet kryesore për panelin e komisionit dhe njoftimet operative.</p>
        </div>
        <button
          className="prorector-btn-outline"
          type="button"
          onClick={() => (onBack ? onBack() : navigate(-1))}
          style={{ width: "auto" }}
        >
          ← Kthehu
        </button>
      </div>

      <div className="prorector-settings-grid">
        {/* Card: Preferencat e Njoftimeve */}
        <article className="prorector-settings-card">
          <div className="prorector-settings-card-header">
            <div className="prorector-settings-icon">
              <Bell size={20} />
            </div>
            <h3>Preferencat e Njoftimeve</h3>
          </div>
          <div className="prorector-settings-options">
            <div className="prorector-settings-option-item">
              <div className="prorector-settings-option-info">
                <span className="prorector-settings-label">Njoftime me email</span>
                <p className="prorector-settings-subtext">Merr njoftime për çdo raport të ri</p>
              </div>
              <label className="prorector-switch">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={setBoolean("emailNotifications")}
                />
                <span className="prorector-slider"></span>
              </label>
            </div>

            <div className="prorector-settings-option-item">
              <div className="prorector-settings-option-info">
                <span className="prorector-settings-label">Arkivo automatikisht</span>
                <p className="prorector-settings-subtext">Arkivo raportet pas finalizimit</p>
              </div>
              <label className="prorector-switch">
                <input
                  type="checkbox"
                  checked={settings.autoArchiveReports}
                  onChange={setBoolean("autoArchiveReports")}
                />
                <span className="prorector-slider"></span>
              </label>
            </div>
          </div>
        </article>

        {/* Card: Parametrat e Panelit */}
        <article className="prorector-settings-card">
          <div className="prorector-settings-card-header">
            <div className="prorector-settings-icon">
              <Globe size={20} />
            </div>
            <h3>Gjuha & Parametrat</h3>
          </div>
          <div className="prorector-settings-options">
            <div className="prorector-settings-option-item">
              <div className="prorector-settings-option-info">
                <span className="prorector-settings-label">Gjuha e Ndërfaqes</span>
              </div>
              <select
                className="prorector-settings-select"
                value={settings.language}
                onChange={setValue("language")}
              >
                <option value="Shqip">Shqip</option>
                <option value="English">English</option>
              </select>
            </div>

            <div className="prorector-settings-option-item">
              <div className="prorector-settings-option-info">
                <span className="prorector-settings-label">Frekuenca e Raporteve</span>
              </div>
              <select
                className="prorector-settings-select"
                value={settings.reportFrequency}
                onChange={setValue("reportFrequency")}
              >
                <option value="Javore">Javore</option>
                <option value="Mujore">Mujore</option>
                <option value="Tremujore">Tremujore</option>
              </select>
            </div>
          </div>
        </article>

        {/* Card: Pamja e Punës */}
        <article className="prorector-settings-card">
          <div className="prorector-settings-card-header">
            <div className="prorector-settings-icon">
              <Cog size={20} />
            </div>
            <h3>Pamja e Punës</h3>
          </div>
          <div className="prorector-settings-options">
            <div className="prorector-settings-option-item">
              <div className="prorector-settings-option-info">
                <span className="prorector-settings-label">Vetëm rastet e mia</span>
                <p className="prorector-settings-subtext">Filtro rastet që ju janë caktuar juve</p>
              </div>
              <label className="prorector-switch">
                <input
                  type="checkbox"
                  checked={settings.showOnlyAssigned}
                  onChange={setBoolean("showOnlyAssigned")}
                />
                <span className="prorector-slider"></span>
              </label>
            </div>
          </div>
        </article>

        {/* Card: Ruajtja e Veprimeve */}
        <article className="prorector-settings-card">
          <div className="prorector-settings-card-header">
            <div className="prorector-settings-icon">
              <Save size={20} />
            </div>
            <h3>Veprimet</h3>
          </div>
          <div className="prorector-settings-list">
            <p className="prorector-settings-subtext">Ruaj ose rikthe ndryshimet e bëra në panel.</p>
            <button className="prorector-settings-edit-btn" onClick={handleSave}>
              Ruaj Settings
            </button>
            <button className="prorector-settings-action-btn" onClick={handleReset}>
              Rikthe Default
            </button>
            {savedMessage && (
              <p className="prorector-settings-subtext" style={{ color: "green", marginTop: "8px" }}>
                {savedMessage}
              </p>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
