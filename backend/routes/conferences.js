import express from "express";
import db from "../config/db.js";

const router = express.Router();

function requireAuthenticatedUser(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized", message: "Duhet te kyqeni per te menaxhuar konferencat." });
    return;
  }

  next();
}

/* GET professor conferences */
router.get("/", requireAuthenticatedUser, async (req, res) => {
  try {
    const { rows } = await db.query(
      `select id, title, acronym, field, location, submission_deadline, conference_date, website, created_by, created_at, updated_at
       from conferences
       where created_by = $1
       order by submission_deadline nulls last, created_at desc`,
      [req.user.id]
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});


/* ADD conference */
router.post("/", requireAuthenticatedUser, async (req, res) => {
  try {

    const {
      title,
      acronym,
      field,
      location,
      submission_deadline,
      conference_date,
      website
    } = req.body;

    const { rows } = await db.query(
      `insert into conferences
      (title, acronym, field, location, submission_deadline, conference_date, website, created_by)
      values ($1, $2, $3, $4, $5, $6, $7, $8)
      returning id, title, acronym, field, location, submission_deadline, conference_date, website, created_by, created_at, updated_at`,
      [
        title,
        acronym || null,
        field || null,
        location || null,
        submission_deadline || null,
        conference_date || null,
        website || null,
        req.user.id
      ]
    );

    res.json({
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


/* DELETE conference */
router.delete("/:id", requireAuthenticatedUser, async (req, res) => {
  try {
    const conferenceResult = await db.query(
      "select id, created_by from conferences where id = $1 limit 1",
      [req.params.id]
    );

    if (conferenceResult.rowCount === 0) {
      res.status(404).json({ error: "Conference not found" });
      return;
    }

    if (conferenceResult.rows[0].created_by !== req.user.id) {
      res.status(403).json({ error: "forbidden", message: "Nuk mund te fshini konferenca qe nuk ju perkasin." });
      return;
    }

    await db.query(
      "delete from conferences where id = $1 and created_by = $2",
      [req.params.id, req.user.id]
    );

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
