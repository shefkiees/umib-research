import express from "express";
import db from "../config/db.js";

const router = express.Router();

function getAuthenticatedUserId(req) {
  return req.isAuthenticated?.() && req.user?.id ? req.user.id : null;
}

/* GET all conferences */
router.get("/", async (req, res) => {
  try {
    const { rows } = await db.query(
      `select id, title, acronym, field, location, submission_deadline, conference_date, website, created_at, updated_at
       from conferences
       order by submission_deadline nulls last, created_at desc`
    );

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});


/* ADD conference */
router.post("/", async (req, res) => {
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
        getAuthenticatedUserId(req)
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
router.delete("/:id", async (req, res) => {
  try {

    const result = await db.query(
      "delete from conferences where id = $1",
      [req.params.id]
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
