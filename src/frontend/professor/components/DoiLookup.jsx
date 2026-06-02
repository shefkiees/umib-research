import React, { useState } from "react";
import { Loader2, Search } from "lucide-react";
import DoiMetadataCard from "./DoiMetadataCard";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";

const DoiLookup = ({ onPublicationSaved }) => {
  const { t } = useLanguage();
  const [doi, setDoi] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [savedPublication, setSavedPublication] = useState(null);

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
  };

  const normalizeDoiInput = (value) =>
    String(value || "")
      .trim()
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "")
      .replace(/^doi:\s*/i, "")
      .split(/[?#]/)[0]
      .replace(/[.,;:]+$/g, "")
      .trim();

  const handleFetch = async () => {
    const trimmedDoi = normalizeDoiInput(doi);

    if (!trimmedDoi) {
      setError(t("professor.doi.required"));
      setMetadata(null);
      setSavedPublication(null);
      return;
    }

    try {
      setLoading(true);
      resetMessages();
      setMetadata(null);
      setSavedPublication(null);
      setDoi(trimmedDoi);

      const res = await fetch(apiUrl(`/doi/${encodeURIComponent(trimmedDoi)}`));
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(getDoiMessage(result, "professor.doi.fetchError"));
      }

      if (!result.data) {
        throw new Error(t("professor.doi.notFound"));
      }

      const nextMetadata = result.data;
      setMetadata(nextMetadata);

      const saveRes = await fetch(apiUrl("/publications/from-doi"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          doi: nextMetadata.doi || trimmedDoi,
          metadata: nextMetadata,
        }),
      });
      const saveResult = await saveRes.json().catch(() => ({}));

      if (!saveRes.ok) {
        throw new Error(getDoiMessage(saveResult, "professor.doi.saveError"));
      }

      setDoi("");
      setSavedPublication(saveResult.data || null);
      await onPublicationSaved?.(saveResult.data || null);
    } catch (err) {
      setError(err.message || t("professor.doi.genericError"));
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      handleFetch();
    }
  };

  return (
    <div style={{ background: "#fff", padding: "20px", borderRadius: "10px" }}>
      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <input
          type="text"
          placeholder={t("professor.doi.placeholder")}
          value={doi}
          onChange={(e) => {
            setDoi(e.target.value);
            setMetadata(null);
            setSavedPublication(null);
          }}
          onKeyDown={handleKeyDown}
          disabled={loading}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #ccc"
          }}
        />
        <button
          type="button"
          onClick={handleFetch}
          disabled={loading}
          className={`publication-doi-action ${loading ? "is-loading" : ""}`.trim()}
        >
          {loading ? <Loader2 size={16} className="publication-doi-action-spinner" /> : <Search size={16} />}
          {loading ? t("professor.doi.fetching") : t("professor.doi.fetch")}
        </button>
      </div>

      {loading && <p>{t("professor.doi.loading")}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {savedPublication && (
        <p style={{ color: "#475569", marginTop: "-6px" }}>
          Publikimi: {savedPublication.title || savedPublication.doi}
        </p>
      )}
      {metadata && <DoiMetadataCard metadata={metadata} />}
    </div>
  );
};

export default DoiLookup;
