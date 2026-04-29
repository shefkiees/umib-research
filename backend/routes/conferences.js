import express from "express";
import db from "../config/db.js";

const router = express.Router();

/* GET all conferences */
router.get("/", async (req, res) => {
  try {
    const [results] = await db.query(
      "SELECT * FROM conferences"
    );

    res.json(results);

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

    await db.query(
      `INSERT INTO conferences
      (title, acronym, field, location, submission_deadline, conference_date, website)
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        acronym,
        field,
        location,
        submission_deadline,
        conference_date,
        website
      ]
    );

    res.json({
      message: "Conference added"
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

    await db.query(
      "DELETE FROM conferences WHERE id=?",
      [req.params.id]
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