import React, { useState } from "react";
import DoiMetadataCard from "./DoiMetadataCard";
import { apiUrl } from "../../utils/api";

const DoiLookup = () => {
  const [doi, setDoi] = useState("");
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

 const handleFetch = async () => {
  if (!doi.trim()) {
    setError("Ju lutem shkruani DOI.");
    setMetadata(null);
    return;
  }

  try {
    setLoading(true);
    setError("");
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

    setMetadata(result.data);
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
      {metadata && <DoiMetadataCard metadata={metadata} />}
    </div>
  );
};

export default DoiLookup;
