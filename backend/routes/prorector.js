import express from "express";
import db from "../config/db.js";

const router = express.Router();

const ROLE_ALIASES = {
  administrator: "admin",
  admin: "admin",
  prorektor: "prorector",
  prorector: "prorector",
  prorektorat: "prorector",
};

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeRole(value) {
  const normalized = normalizeText(value).toLowerCase().replace(/[\s_-]+/g, "");
  return ROLE_ALIASES[normalized] || normalized;
}

function requireProRectorAccess(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized", message: "Duhet te kyqeni per te pare te dhenat e prorektorit." });
    return;
  }

  if (!["prorector", "admin"].includes(normalizeRole(req.user.role))) {
    res.status(403).json({ error: "forbidden", message: "Vetem prorektori ose administratori mund te shohin kete faqe." });
    return;
  }

  next();
}

function mapFaculty(row) {
  const activeUserCount = Number(row.active_user_count || 0);

  return {
    id: row.id,
    code: row.code || "",
    name: row.name || "",
    isOfficial: Boolean(row.faculty_id),
    departmentCount: Number(row.department_count || 0),
    activeUserCount,
    professorCount: Number(row.professor_count || 0),
    publicationCount: Number(row.publication_count || 0),
    reimbursementCount: Number(row.reimbursement_count || 0),
    status: activeUserCount > 0 ? "active" : "inactive",
    statusLabel: activeUserCount > 0 ? "Aktiv" : "Pa staf aktiv",
    updatedAt: row.updated_at,
  };
}

router.get("/faculties", requireProRectorAccess, async (req, res) => {
  try {
    const result = await db.query(
      `with active_user_faculties as (
         select distinct lower(trim(faculty)) as faculty_key
         from users
         where coalesce(status, 'active') = 'active'
           and nullif(trim(faculty), '') is not null
       ),
       faculty_source as (
         select
           f.id::text as id,
           f.id as faculty_id,
           f.code,
           f.name,
           f.updated_at
         from faculties f
         where exists (
           select 1
           from active_user_faculties auf
           where auf.faculty_key in (lower(trim(f.name)), lower(trim(f.code)))
         )
         union all
         select
           'users-' || md5(lower(trim(u.faculty))) as id,
           null::bigint as faculty_id,
           upper(substr(regexp_replace(trim(u.faculty), '[^[:alnum:]]+', '', 'g'), 1, 12)) as code,
           trim(u.faculty) as name,
           max(u.updated_at) as updated_at
         from users u
         where coalesce(u.status, 'active') = 'active'
           and nullif(trim(u.faculty), '') is not null
           and (
             trim(u.faculty) ~* '(fakult|faculty|universitet|university|college|school)'
             or (length(trim(u.faculty)) >= 12 and trim(u.faculty) like '% %')
           )
           and not exists (
             select 1
             from faculties f
             where lower(trim(u.faculty)) in (lower(trim(f.name)), lower(trim(f.code)))
           )
         group by lower(trim(u.faculty)), trim(u.faculty)
       )
       select
         fs.id,
         fs.code,
         fs.name,
         fs.updated_at,
         coalesce(departments.department_count, 0)::int as department_count,
         coalesce(users_stats.active_user_count, 0)::int as active_user_count,
         coalesce(users_stats.professor_count, 0)::int as professor_count,
         coalesce(publications_stats.publication_count, 0)::int as publication_count,
         coalesce(reimbursements_stats.reimbursement_count, 0)::int as reimbursement_count
       from faculty_source fs
       left join lateral (
         select count(*)::int as department_count
         from departments d
         where fs.faculty_id is not null and d.faculty_id = fs.faculty_id
       ) departments on true
       left join lateral (
         select
           count(*) filter (where coalesce(u.status, 'active') = 'active')::int as active_user_count,
           count(*) filter (
             where coalesce(u.status, 'active') = 'active'
               and coalesce(u.role, 'professor') = 'professor'
           )::int as professor_count
         from users u
         where lower(trim(u.faculty)) in (lower(trim(fs.name)), lower(trim(fs.code)))
       ) users_stats on true
       left join lateral (
         select count(*)::int as publication_count
         from publications p
         join users u on u.id = p.owner_id
         where lower(trim(u.faculty)) in (lower(trim(fs.name)), lower(trim(fs.code)))
           and p.status <> 'draft'
       ) publications_stats on true
       left join lateral (
         select count(*)::int as reimbursement_count
         from reimbursements r
         join users u on u.id = r.owner_id
         where lower(trim(u.faculty)) in (lower(trim(fs.name)), lower(trim(fs.code)))
           and r.status <> 'draft'
       ) reimbursements_stats on true
       order by fs.name asc`
    );

    res.json({ faculties: result.rows.map(mapFaculty) });
  } catch (error) {
    console.error("GET /api/prorector/faculties failed:", error);
    res.status(500).json({
      error: "prorector_faculties_failed",
      message: "Fakultetet nuk u ngarkuan.",
    });
  }
});

export default router;
