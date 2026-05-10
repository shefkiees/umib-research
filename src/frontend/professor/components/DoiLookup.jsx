import React, { useState } from "react";
import DoiMetadataCard from "./DoiMetadataCard";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";

const DoiLookup = ({ onPublicationSaved }) => {
  const { t } = useLanguage();
  const [doi, setDoi] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");

  const getDoiMessage = (result = {}, fallbackKey = "professor.doi.genericError") => {
    if (result.error === "invalid_doi") {
      return t("professor.doi.invalid");
    }

    if (result.error === "doi_not_found") {
      return t("professor.doi.notFound");
    }

    if (result.error === "duplicate_publication") {
      return t("professor.doi.duplicate");
    }

    if (result.error === "rate_limited") {
      return t("professor.doi.rateLimited");
    }

    return result.message || t(fallbackKey);
  };

  const resetMessages = () => {
    setError("");
    setSaveStatus("");
  };

  const handleFetch = async () => {
    const trimmedDoi = doi.trim();

    if (!trimmedDoi) {
      setError(t("professor.doi.required"));
      setMetadata(null);
      setSaveStatus("");
      return;
    }

    try {
      setLoading(true);
      resetMessages();
      setMetadata(null);

      const res = await fetch(apiUrl(`/doi/${encodeURIComponent(trimmedDoi)}`));
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(getDoiMessage(result, "professor.doi.fetchError"));
      }

      if (!result.data) {
        throw new Error(t("professor.doi.notFound"));
      }

      setMetadata(result.data);
      setSaveStatus(t("professor.doi.previewReady"));
    } catch (err) {
      setError(err.message || t("professor.doi.genericError"));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!metadata) {
      setError(t("professor.doi.previewMissing"));
      return;
    }

    try {
      setSaving(true);
      resetMessages();

      const saveRes = await fetch(apiUrl("/publications/from-doi"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doi: metadata.doi || doi.trim(),
          metadata,
        }),
      });
      const saveResult = await saveRes.json().catch(() => ({}));

      if (!saveRes.ok) {
        throw new Error(getDoiMessage(saveResult, "professor.doi.saveError"));
      }

      setMetadata(null);
      setDoi("");
      setSaveStatus(t("professor.doi.saved"));
      await onPublicationSaved?.(saveResult.data || null);
    } catch (err) {
      setError(err.message || t("professor.doi.genericError"));
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading && !saving) {
      handleFetch();
    }
  };

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "10px" }}>
      <h3>{t("professor.doi.title")}</h3>

      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <input
          type="text"
          placeholder={t("professor.doi.placeholder")}
          value={doi}
          onChange={(e) => {
            setDoi(e.target.value);
            setMetadata(null);
            setSaveStatus("");
          }}
          onKeyDown={handleKeyDown}
          disabled={loading || saving}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #ccc"
          }}
        />
        <button
          onClick={handleFetch}
          disabled={loading || saving}
          style={{
            padding: "10px 16px",
            border: "none",
            borderRadius: "6px",
            background: "#2563eb",
            color: "#fff",
            cursor: loading || saving ? "not-allowed" : "pointer",
            opacity: loading || saving ? 0.7 : 1
          }}
        >
          {loading ? t("professor.doi.fetching") : t("professor.doi.fetch")}
        </button>
      </div>

      {loading && <p>{t("professor.doi.loading")}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {saveStatus && <p style={{ color: "#16803f", fontWeight: 700 }}>{saveStatus}</p>}
      {metadata && (
        <>
          <DoiMetadataCard metadata={metadata} />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "14px" }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                padding: "10px 16px",
                border: "none",
                borderRadius: "6px",
                background: "#153a63",
                color: "#fff",
                cursor: saving || loading ? "not-allowed" : "pointer",
                fontWeight: 700,
                opacity: saving || loading ? 0.7 : 1
              }}
            >
              {saving ? t("professor.doi.saving") : t("professor.doi.savePublication")}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default DoiLookup;
