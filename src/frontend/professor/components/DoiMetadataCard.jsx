import React, { useState } from "react";
import { ExternalLink } from "lucide-react";
import { useLanguage } from "../../i18n/LanguageContext";

function stripMarkup(value) {
  if (!value) return "";

  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const DoiMetadataCard = ({ metadata, actions = null }) => {
  const { t } = useLanguage();
  const [isAbstractExpanded, setIsAbstractExpanded] = useState(false);
  const [isCardActive, setIsCardActive] = useState(false);
  const cleanAbstract = stripMarkup(metadata.abstract);
  const doiUrl = metadata.doi ? `https://doi.org/${metadata.doi}` : "";
  const publishedDate = metadata.published_date || metadata.year || "";
  const quartile = Array.isArray(metadata.indexing)
    ? metadata.indexing.find((item) => item?.quartile)?.quartile
    : "";
  const canToggleAbstract = cleanAbstract.length > 280;

  const cardStyle = {
    marginTop: "12px",
    border: "1px solid #dbe4f0",
    borderRadius: "12px",
    padding: "18px",
    background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
    boxShadow: isCardActive
      ? "0 14px 34px rgba(15, 23, 42, 0.12)"
      : "0 8px 24px rgba(15, 23, 42, 0.07)",
    transform: isCardActive ? "translateY(-1px)" : "translateY(0)",
    transition: "box-shadow 160ms ease, transform 160ms ease, border-color 160ms ease",
    outline: isCardActive ? "2px solid rgba(37, 99, 235, 0.12)" : "none",
    borderColor: isCardActive ? "#b7cbea" : "#dbe4f0",
  };

  const gridStyle = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "10px 14px",
  };

  const fieldStyle = {
    display: "grid",
    gap: "4px",
    minWidth: 0,
  };

  const labelStyle = {
    fontWeight: 700,
    color: "#475569",
    fontSize: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  };

  const valueStyle = {
    color: "#0f172a",
    wordBreak: "break-word",
    lineHeight: 1.45,
    fontSize: "14px",
  };

  const linkStyle = {
    ...valueStyle,
    color: "#2563eb",
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontWeight: 700,
  };

  const sectionStyle = {
    borderTop: "1px solid #e5edf6",
    paddingTop: "12px",
    marginTop: "12px",
  };

  const abstractStyle = {
    ...valueStyle,
    display: isAbstractExpanded ? "block" : "-webkit-box",
    WebkitLineClamp: isAbstractExpanded ? "unset" : 5,
    WebkitBoxOrient: "vertical",
    overflow: isAbstractExpanded ? "visible" : "hidden",
  };

  const renderField = (label, value) => (
    <div style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={valueStyle}>{value || t("common.noData")}</span>
    </div>
  );

  const renderLinkField = (label, href, text) => (
    <div style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noreferrer" style={linkStyle}>
          <span>{text}</span>
          <ExternalLink size={14} aria-hidden="true" />
        </a>
      ) : (
        <span style={valueStyle}>{t("common.noData")}</span>
      )}
    </div>
  );

  const abstractToggleStyle = {
    border: "none",
    background: "transparent",
    color: "#2563eb",
    fontWeight: 700,
    padding: "4px 0 0",
    cursor: "pointer",
    width: "fit-content",
  };

  return (
    <div
      tabIndex={0}
      onMouseEnter={() => setIsCardActive(true)}
      onMouseLeave={() => setIsCardActive(false)}
      onFocus={() => setIsCardActive(true)}
      onBlur={() => setIsCardActive(false)}
      style={cardStyle}
    >
      <div style={{ marginBottom: "12px" }}>
        <div
          style={{
            display: "inline-block",
            marginBottom: "8px",
            padding: "3px 9px",
            borderRadius: "999px",
            background: "#dbeafe",
            color: "#1d4ed8",
            fontSize: "11px",
            fontWeight: 700,
            letterSpacing: "0.04em",
            textTransform: "uppercase"
          }}
        >
          {t("professor.doi.metadata")}
        </div>
        <h4 style={{ margin: 0, fontSize: "18px", lineHeight: 1.3, color: "#0f172a" }}>
          {metadata.title || t("common.noTitle")}
        </h4>
      </div>

      <div style={gridStyle}>
        {renderLinkField("DOI", doiUrl, metadata.doi)}
        {renderField(t("professor.doi.journalConference"), metadata.container_title)}
        {renderField(t("professor.doi.publisher"), metadata.publisher)}
        {renderField(t("professor.doi.publishedDate"), publishedDate)}
        {renderField(t("professor.doi.publicationType"), metadata.type || "-")}
        {renderField(t("professor.dashboard.publicationForm.quartile"), quartile)}
        {renderLinkField(t("professor.doi.link"), metadata.source_url, metadata.source_url)}
      </div>

      <div style={sectionStyle}>
        {renderField(
          t("professor.doi.authors"),
          Array.isArray(metadata.authors) && metadata.authors.length > 0
            ? metadata.authors.join(", ")
            : t("professor.doi.noAuthors")
        )}
      </div>

      <div style={sectionStyle}>
        <div style={fieldStyle}>
          <span style={labelStyle}>{t("professor.doi.abstract")}</span>
          <span style={abstractStyle}>{cleanAbstract || "-"}</span>
          {canToggleAbstract ? (
            <button
              type="button"
              onClick={() => setIsAbstractExpanded((current) => !current)}
              style={abstractToggleStyle}
            >
              {isAbstractExpanded ? "Shfaq më pak" : "Shfaq më shumë"}
            </button>
          ) : null}
        </div>
      </div>

      {actions ? (
        <div style={{ ...sectionStyle, display: "flex", justifyContent: "flex-end", gap: "10px", flexWrap: "wrap" }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
};

export default DoiMetadataCard;
