import React, { useState } from "react";
import DoiMetadataCard from "./DoiMetadataCard";
import { apiUrl } from "../../utils/api";
import { useLanguage } from "../../i18n/LanguageContext";

const DoiLookup = ({ onPublicationSaved }) => {
  const { t } = useLanguage();
  const [doi, setDoi] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [savedPublication, setSavedPublication] = useState(null);

 const handleFetch = async () => {
  if (!doi.trim()) {
    setError(t("professor.doi.required"));
    setMetadata(null);
    setSaveStatus("");
    setSavedPublication(null);
    return;
  }

  try {
    setLoading(true);
    setError("");
    setSaveStatus("");
    setSavedPublication(null);
    setMetadata(null);

    console.log("Po dergohet kerkesa per DOI:", doi);

    const res = await fetch(
      apiUrl(`/doi/${encodeURIComponent(doi.trim())}`)
    );

    console.log("Response status:", res.status);

    const result = await res.json();
    console.log("Response data:", result);

    if (!res.ok) {
      throw new Error(result.message || t("professor.doi.fetchError"));
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
        doi: nextMetadata.doi || doi.trim(),
        metadata: nextMetadata,
      }),
    });
    const saveResult = await saveRes.json().catch(() => ({}));

    if (!saveRes.ok) {
      throw new Error(saveResult.message || t("professor.doi.saveError"));
    }

    setSavedPublication(saveResult.data || null);
    setSaveStatus(t("professor.doi.saved"));
    onPublicationSaved?.(saveResult.data || null);
  } catch (err) {
    console.error("Fetch error:", err);
    setError(err.message || t("professor.doi.genericError"));
  } finally {
    setLoading(false);
  }
};

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
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
          onChange={(e) => setDoi(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{
            flex: 1,
            padding: "10px",
            borderRadius: "6px",
            border: "1px solid #ccc"
          }}
        />
        <button
          onClick={handleFetch}
          disabled={loading}
          style={{
            padding: "10px 16px",
            border: "none",
            borderRadius: "6px",
            background: "#2563eb",
            color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1
          }}
        >
          {loading ? t("professor.doi.fetching") : t("professor.doi.fetch")}
        </button>
      </div>

      {loading && <p>{t("professor.doi.loading")}</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {saveStatus && <p style={{ color: "#16803f", fontWeight: 700 }}>{saveStatus}</p>}
      {savedPublication && (
        <p style={{ color: "#475569", marginTop: "-6px" }}>
          {t("professor.doi.publication")}: {savedPublication.title || savedPublication.doi}
        </p>
      )}
      {metadata && <DoiMetadataCard metadata={metadata} />}
    </div>
  );
};

export default DoiLookup;
