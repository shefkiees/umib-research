import express from "express";
import db from "../config/db.js";

const router = express.Router();

// Funksion për të pastruar DOI
function normalizeDoi(input) {
  if (!input) return "";

  return decodeURIComponent(input)
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim();
}

// Funksion për të map-uar metadata
function mapMetadata(data, doi) {
  const title = Array.isArray(data.title) ? data.title[0] || "" : data.title || "";
  const containerTitle = Array.isArray(data["container-title"])
    ? data["container-title"][0] || ""
    : data["container-title"] || "";
  const authors = Array.isArray(data.author)
    ? data.author.map((a) =>
        [a.given, a.family].filter(Boolean).join(" ").trim()
      )
    : [];

  const dateParts = data.issued?.["date-parts"]?.[0] || [];

  return {
    doi,
    title,
    authors,
    container_title: containerTitle,
    publisher: data.publisher || "",
    published_date: dateParts.length ? dateParts.join("-") : "",
    year: dateParts[0] || null,
    volume: data.volume || "",
    issue: data.issue || "",
    pages: data.page || "",
    type: data.type || "",
    abstract: data.abstract || "",
    source_url: data.URL || `https://doi.org/${doi}`,
    raw_json: data
  };
}

// GET metadata by DOI
router.get("/:doi", async (req, res) => {
  try {
    console.log("1. Route u thirr");

    const doi = normalizeDoi(req.params.doi);
    console.log("2. DOI:", doi);

    if (!doi) {
      return res.status(400).json({ message: "DOI nuk është valid." });
    }

    console.log("3. Para query ne DB");
    const { rows } = await db.query(
      `select doi, title, authors, container_title, publisher, published_date, year,
              volume, issue, pages, type, abstract, source_url, raw_json, created_at, updated_at
       from publication_metadata
       where doi = $1`,
      [doi]
    );
    console.log("4. Pas query ne DB");

    if (rows.length > 0) {
      console.log("5. U gjet ne cache");

      const row = rows[0];

      return res.json({
        source: "cache",
        data: {
          ...row,
          authors: row.authors,
          raw_json: row.raw_json
        }
      });
    }

    console.log("6. Para kerkese te DOI");
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`https://doi.org/${encodeURIComponent(doi)}`, {
      headers: {
        Accept: "application/vnd.citationstyles.csl+json",
        "User-Agent": "UMIBres/1.0 (mailto:admin@umibres.com)"
      },
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));
    console.log("7. Pas kerkese te DOI");

    if (!response.ok) {
      throw new Error(`DOI lookup failed with status ${response.status}`);
    }

    const metadata = mapMetadata(await response.json(), doi);

    console.log("8. Para insert ne DB");
    await db.query(
      `insert into publication_metadata
      (doi, title, authors, container_title, publisher, published_date, year, volume, issue, pages, type, abstract, source_url, raw_json)
      values ($1, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
      on conflict (doi) do update set
        title = excluded.title,
        authors = excluded.authors,
        container_title = excluded.container_title,
        publisher = excluded.publisher,
        published_date = excluded.published_date,
        year = excluded.year,
        volume = excluded.volume,
        issue = excluded.issue,
        pages = excluded.pages,
        type = excluded.type,
        abstract = excluded.abstract,
        source_url = excluded.source_url,
        raw_json = excluded.raw_json`,
      [
        metadata.doi,
        metadata.title,
        JSON.stringify(metadata.authors),
        metadata.container_title,
        metadata.publisher,
        metadata.published_date,
        metadata.year,
        metadata.volume,
        metadata.issue,
        metadata.pages,
        metadata.type,
        metadata.abstract,
        metadata.source_url,
        JSON.stringify(metadata.raw_json)
      ]
    );
    console.log("9. Pas insert ne DB");

    return res.json({
      source: "api",
      data: metadata
    });
  } catch (error) {
    console.error("DOI error:", error.response?.data || error.message);

    return res.status(500).json({
      message: "Metadata për këtë DOI nuk u gjetën."
    });
  }
});

export default router;
