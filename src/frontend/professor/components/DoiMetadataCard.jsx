import React from "react";
import { useLanguage } from "../../i18n/LanguageContext";

function stripMarkup(value) {
  if (!value) return "";

  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DoiMetadataCard = ({ metadata }) => {
  const { t } = useLanguage();
  const cleanAbstract = stripMarkup(metadata.abstract);
  const doiUrl = metadata.doi ? `https://doi.org/${metadata.doi}` : "";
  const publishedDate = metadata.published_date || metadata.year || "";

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
          {t("professor.doi.metadata")}
        </div>
        <h4 style={{ margin: 0, fontSize: "22px", color: "#0f172a" }}>
          {metadata.title || t("common.noTitle")}
        </h4>
      </div>

      <div style={{ display: "grid", gap: "12px" }}>
        <div style={fieldStyle}>
          <span style={labelStyle}>{t("professor.doi.publicationTitle")}</span>
          <span style={valueStyle}>{metadata.title || t("common.noTitle")}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>DOI</span>
          {doiUrl ? (
            <a
              href={doiUrl}
              target="_blank"
              rel="noreferrer"
              style={{ ...valueStyle, color: "#2563eb", textDecoration: "none" }}
            >
              {metadata.doi}
            </a>
          ) : (
            <span style={valueStyle}>{t("common.noData")}</span>
          )}
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>{t("professor.doi.authors")}</span>
          <span style={valueStyle}>
            {Array.isArray(metadata.authors) && metadata.authors.length > 0
              ? metadata.authors.join(", ")
              : t("professor.doi.noAuthors")}
          </span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>{t("professor.doi.journalConference")}</span>
          <span style={valueStyle}>{metadata.container_title || t("common.noData")}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>{t("professor.doi.publisher")}</span>
          <span style={valueStyle}>{metadata.publisher || t("common.noData")}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>{t("professor.doi.publishedDate")}</span>
          <span style={valueStyle}>{publishedDate || t("common.noData")}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>{t("professor.doi.publicationType")}</span>
          <span style={valueStyle}>{metadata.type || "-"}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>{t("professor.doi.abstract")}</span>
          <span style={valueStyle}>{cleanAbstract || "-"}</span>
        </div>

        <div style={fieldStyle}>
          <span style={labelStyle}>{t("professor.doi.link")}</span>
          {metadata.source_url ? (
            <a
              href={metadata.source_url}
              target="_blank"
              rel="noreferrer"
              style={{ ...valueStyle, color: "#2563eb", textDecoration: "none" }}
            >
              {metadata.source_url}
            </a>
          ) : (
            <span style={valueStyle}>{t("common.noData")}</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default DoiMetadataCard;
