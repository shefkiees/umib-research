import React from "react";

function stripMarkup(value) {
  if (!value) return "";

  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DoiMetadataCard = ({ metadata }) => {
  const cleanAbstract = stripMarkup(metadata.abstract);
  const doiUrl = metadata.doi
    ? `https://doi.org/${metadata.doi}`
    : metadata.source_url;

  const fieldStyle = {
    display: "grid",
    gridTemplateColumns: "160px 1fr",
    gap: "8px",
    alignItems: "start"
  };

  const labelStyle = {
    fontWeight: 700,
    color: "#334155"
  };

  const valueStyle = {
    color: "#0f172a",
    wordBreak: "break-word",
    lineHeight: 1.6
  };

  return (
    <div
      style={{
        marginTop: "20px",
        border: "1px solid #dbe4f0",
        borderRadius: "16px",
        padding: "24px",
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)"
      }}
    >
      <div style={{ marginBottom: "18px" }}>
        <div
          style={{
            display: "inline-block",
            marginBottom: "10px",
            padding: "4px 10px",
            borderRadius: "999px",
            background: "#dbeafe",
            color: "#1d4ed8",
            fontSize: "12px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase"
          }}
        >
          Metadata
        </div>
        <h4 style={{ margin: 0, fontSize: "22px", color: "#0f172a" }}>
          {metadata.title || "Pa titull"}
        </h4>
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        <div style={fieldStyle}>
          <span style={labelStyle}>DOI</span>
          <a
            href={doiUrl}
            target="_blank"
            rel="noreferrer"
            style={{ ...valueStyle, color: "#2563eb", textDecoration: "none" }}
          >
            {metadata.doi || "Nuk ka të dhëna"}
          </a>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Autorët</span>
          <span style={valueStyle}>
            {Array.isArray(metadata.authors) && metadata.authors.length > 0
              ? metadata.authors.join(", ")
              : "Nuk ka autorë"}
          </span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Journal / Conference</span>
          <span style={valueStyle}>
            {metadata.container_title || "Nuk ka të dhëna"}
          </span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Publisher</span>
          <span style={valueStyle}>
            {metadata.publisher || "Nuk ka të dhëna"}
          </span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Viti</span>
          <span style={valueStyle}>{metadata.year || "Nuk ka të dhëna"}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Volume</span>
          <span style={valueStyle}>{metadata.volume || "-"}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Issue</span>
          <span style={valueStyle}>{metadata.issue || "-"}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Faqet</span>
          <span style={valueStyle}>{metadata.pages || "-"}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Tipi</span>
          <span style={valueStyle}>{metadata.type || "-"}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Abstract</span>
          <span style={valueStyle}>{cleanAbstract || "-"}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>Link</span>
          <a
            href={metadata.source_url}
            target="_blank"
            rel="noreferrer"
            style={{ ...valueStyle, color: "#2563eb", textDecoration: "none" }}
          >
            Hape publikimin
          </a>
        </div>
      </div>
    </div>
  );
};

export default DoiMetadataCard;
