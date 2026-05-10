import express from "express";
import db from "../config/db.js";

const router = express.Router();
const MAX_LIMIT = 50;

function requireAuthenticatedUser(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized", message: "Duhet te kyqeni per te menaxhuar konferencat." });
    return;
  }

  next();
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function parsePagination(query = {}) {
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || 25, 1), MAX_LIMIT);

  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function isValidDateString(value) {
  if (!value) {
    return true;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isValidWebsite(value) {
  if (!value) {
    return true;
  }

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

function validateConferencePayload(body = {}) {
  const values = {
    title: normalizeText(body.title),
    acronym: normalizeText(body.acronym),
    field: normalizeText(body.field),
    location: normalizeText(body.location),
    submission_deadline: normalizeText(body.submission_deadline),
    conference_date: normalizeText(body.conference_date),
    website: normalizeText(body.website),
  };
  const errors = [];

  if (!values.title) {
    errors.push({ field: "title", message: "Titulli i konferences eshte obligativ." });
  }

  if (values.title.length > 300) {
    errors.push({ field: "title", message: "Titulli i konferences eshte shume i gjate." });
  }

  if (!values.submission_deadline) {
    errors.push({ field: "submission_deadline", message: "Afati i aplikimit eshte obligativ." });
  }

  if (!isValidDateString(values.submission_deadline)) {
    errors.push({ field: "submission_deadline", message: "Afati i aplikimit nuk eshte valid." });
  }

  if (!isValidDateString(values.conference_date)) {
    errors.push({ field: "conference_date", message: "Data e konferences nuk eshte valide." });
  }

  if (!isValidWebsite(values.website)) {
    errors.push({ field: "website", message: "Web faqja duhet te jete URL valide http/https." });
  }

  return { values, errors };
}

/* GET professor conferences */
router.get("/", requireAuthenticatedUser, async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const q = normalizeText(req.query.q || req.query.search);
  const status = normalizeText(req.query.status);
  const filters = ["created_by = $1"];
  const params = [req.user.id];

  if (q) {
    params.push(`%${q}%`);
    filters.push(`(title ilike $${params.length} or acronym ilike $${params.length} or field ilike $${params.length} or location ilike $${params.length} or website ilike $${params.length})`);
  }

  if (status) {
    if (!["open", "closing_soon", "closed"].includes(status)) {
      res.status(400).json({ error: "invalid_status", message: "Statusi i konferences nuk eshte valid." });
      return;
    }

    if (status === "closed") {
      filters.push("submission_deadline < current_date");
    } else if (status === "closing_soon") {
      filters.push("submission_deadline >= current_date and submission_deadline <= current_date + interval '7 days'");
    } else {
      filters.push("submission_deadline > current_date + interval '7 days'");
    }
  }

  const whereClause = filters.join(" and ");

  try {
    const dataParams = [...params, limit, offset];
    const limitParam = dataParams.length - 1;
    const offsetParam = dataParams.length;
    const [listResult, countResult] = await Promise.all([
      db.query(
        `select id, title, acronym, field, location, submission_deadline, conference_date, website, created_by, created_at, updated_at
       from conferences
       where ${whereClause}
       order by submission_deadline nulls last, created_at desc
       limit $${limitParam} offset $${offsetParam}`,
        dataParams
      ),
      db.query(
        `select count(*)::int as total
         from conferences
         where ${whereClause}`,
        params
      ),
    ]);

    const total = Number(countResult.rows[0]?.total || 0);

    res.json({
      data: listResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});


/* ADD conference */
router.post("/", requireAuthenticatedUser, async (req, res) => {
  const { values, errors } = validateConferencePayload(req.body);

  if (errors.length) {
    res.status(400).json({ error: "validation_failed", message: errors[0].message, errors });
    return;
  }

  try {
    const { rows } = await db.query(
      `insert into conferences
      (title, acronym, field, location, submission_deadline, conference_date, website, created_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning id, title, acronym, field, location, submission_deadline, conference_date, website, created_by, created_at, updated_at`,
      [
        values.title,
        values.acronym || null,
        values.field || null,
        values.location || null,
        values.submission_deadline || null,
        values.conference_date || null,
        values.website || null,
        req.user.id
      ]
    );

    res.status(201).json({
      message: "Conference added",
      data: rows[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Insert failed"
    });
  }
});

router.put("/:id", requireAuthenticatedUser, async (req, res) => {
  const { values, errors } = validateConferencePayload(req.body);

  if (errors.length) {
    res.status(400).json({ error: "validation_failed", message: errors[0].message, errors });
    return;
  }

  try {
    const { rows } = await db.query(
      `update conferences
       set title = $3,
           acronym = $4,
           field = $5,
           location = $6,
           submission_deadline = $7,
           conference_date = $8,
           website = $9,
           updated_at = now()
       where id = $1 and created_by = $2
       returning id, title, acronym, field, location, submission_deadline, conference_date, website, created_by, created_at, updated_at`,
      [
        req.params.id,
        req.user.id,
        values.title,
        values.acronym || null,
        values.field || null,
        values.location || null,
        values.submission_deadline || null,
        values.conference_date || null,
        values.website || null,
      ]
    );

    if (!rows[0]) {
      res.status(404).json({ error: "not_found", message: "Konferenca nuk u gjet." });
      return;
    }

    res.json({ message: "Conference updated", data: rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Update failed" });
  }
});


/* DELETE conference */
router.delete("/:id", requireAuthenticatedUser, async (req, res) => {
  try {
    const result = await db.query(
      "delete from conferences where id = $1 and created_by = $2 returning id",
      [req.params.id, req.user.id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: "Conference not found" });
      return;
    }

    res.json({
      message: "Deleted"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Delete failed"
    });
  }
});

export default router;
