import React, { useState } from "react";
import DoiMetadataCard from "./DoiMetadataCard";
import { apiUrl } from "../../utils/api";

const DoiLookup = () => {
  const [doi, setDoi] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [savedPublication, setSavedPublication] = useState(null);

 const handleFetch = async () => {
  if (!doi.trim()) {
    setError("Ju lutem shkruani DOI.");
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
      throw new Error(result.message || "Gabim gjatë marrjes së metadata.");
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
      throw new Error(saveResult.message || "Metadata u mor, por publikimi nuk u ruajt ne Supabase.");
    }

    setSavedPublication(saveResult.data || null);
    setSaveStatus("Publikimi u ruajt ne Supabase. DOI do te mbushet automatikisht te Rimbursimet.");
  } catch (err) {
    console.error("Fetch error:", err);
    setError(err.message || "Ndodhi një gabim.");
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
      <h3>Kërko publikimin me DOI</h3>

      <div style={{ display: "flex", gap: "10px", marginBottom: "15px" }}>
        <input
          type="text"
          placeholder="Shkruani DOI p.sh. 10.1000/xyz123"
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
          {loading ? "Duke marrë..." : "Merr metadata"}
        </button>
      </div>

      {loading && <p>Duke ngarkuar të dhënat...</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}
      {saveStatus && <p style={{ color: "#16803f", fontWeight: 700 }}>{saveStatus}</p>}
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
