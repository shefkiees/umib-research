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
    departmentNames: Array.isArray(row.department_names) ? row.department_names.filter(Boolean) : [],
    activeUserCount,
    professorCount: Number(row.professor_count || 0),
    publicationCount: Number(row.publication_count || 0),
    reimbursementCount: Number(row.reimbursement_count || 0),
    status: activeUserCount > 0 ? "active" : "inactive",
    statusLabel: activeUserCount > 0 ? "Aktiv" : "Pa staf aktiv",
    updatedAt: row.updated_at,
  };
}

const FACULTY_SOURCE_CTE = `with active_user_faculties as (
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
)`;

function normalizeFacultyRouteKey(value) {
  return normalizeText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeQuartile(value) {
  const match = normalizeText(value).toUpperCase().match(/\bQ[1-4]\b/);
  return match?.[0] || "";
}

function getPublicationQuartile(publication = {}) {
  return normalizeQuartile(
    publication.quartile
    || publication.category
    || publication.indexingCategory
    || publication.indexing_category
    || publication.quartileCategory
    || publication.quartile_category
  );
}

function getPublicationTime(publication = {}) {
  const value = publication.updatedAt || publication.updated_at || publication.publicationDate || publication.publication_date || publication.createdAt || publication.created_at;
  const time = value ? new Date(value).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

function buildFacultyPublicationAnalytics(publications = []) {
  const quartileCounts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };
  const departmentRows = new Map();
  const publicationTypeRows = new Map();
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const attentionPriority = {
    needs_correction: 0,
    in_review: 1,
    submitted: 1,
    rejected: 2,
    approved: 3,
  };

  publications.forEach((publication) => {
    const quartile = getPublicationQuartile(publication);
    const type = publication.publicationType || publication.publication_type || "unknown";
    const departmentName = normalizeText(
      publication.department?.name
      || publication.departmentName
      || publication.department_name
      || publication.owner?.department
    ) || "Pa departament";

    if (quartileCounts[quartile] !== undefined) {
      quartileCounts[quartile] += 1;
    }

    publicationTypeRows.set(type, (publicationTypeRows.get(type) || 0) + 1);

    if (!departmentRows.has(departmentName)) {
      departmentRows.set(departmentName, {
        departmentName,
        publicationCount: 0,
        q1Count: 0,
        q2Count: 0,
        q3Count: 0,
        q4Count: 0,
      });
    }

    const department = departmentRows.get(departmentName);
    department.publicationCount += 1;

    if (quartile === "Q1") department.q1Count += 1;
    if (quartile === "Q2") department.q2Count += 1;
    if (quartile === "Q3") department.q3Count += 1;
    if (quartile === "Q4") department.q4Count += 1;
  });

  const recentPublications = [...publications]
    .sort((first, second) => getPublicationTime(second) - getPublicationTime(first))
    .slice(0, 10);
  const attentionPublications = publications
    .filter((publication) => {
      const status = publication.status || "draft";
      const approvedThisMonth = status === "approved" && String(publication.updatedAt || publication.updated_at || publication.createdAt || publication.created_at || "").startsWith(currentMonthKey);
      return ["needs_correction", "in_review", "submitted", "rejected"].includes(status) || approvedThisMonth;
    })
    .sort((first, second) => {
      const firstStatus = first.status || "draft";
      const secondStatus = second.status || "draft";
      const priorityDelta = (attentionPriority[firstStatus] ?? 9) - (attentionPriority[secondStatus] ?? 9);

      return priorityDelta || getPublicationTime(second) - getPublicationTime(first);
    })
    .slice(0, 10);

  return {
    totalPublications: publications.length,
    quartileDistribution: Object.entries(quartileCounts).map(([quartile, count]) => ({ quartile, count })),
    departments: Array.from(departmentRows.values())
      .sort((first, second) => second.publicationCount - first.publicationCount || first.departmentName.localeCompare(second.departmentName, "sq")),
    publicationTypes: Array.from(publicationTypeRows, ([type, count]) => ({ type, count })),
    recentPublications,
    attentionPublications,
  };
}

router.get("/faculties", requireProRectorAccess, async (req, res) => {
  try {
    const result = await db.query(
      `${FACULTY_SOURCE_CTE}
       select
         fs.id,
         fs.code,
         fs.name,
         fs.updated_at,
         greatest(
           coalesce(departments.department_count, 0),
           coalesce(user_departments.department_count, 0)
         )::int as department_count,
         coalesce(user_departments.department_names, array[]::text[]) as department_names,
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
           count(distinct lower(trim(u.department)))::int as department_count,
           array_agg(distinct trim(u.department) order by trim(u.department)) as department_names
         from users u
         where lower(trim(u.faculty)) in (lower(trim(fs.name)), lower(trim(fs.code)))
           and coalesce(u.status, 'active') = 'active'
           and nullif(trim(u.department), '') is not null
       ) user_departments on true
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

router.get("/faculties/:id", requireProRectorAccess, async (req, res) => {
  const routeId = normalizeText(req.params.id);
  const routeKey = normalizeFacultyRouteKey(routeId);

  try {
    const result = await db.query(
      `${FACULTY_SOURCE_CTE},
       selected_faculty as (
         select *
         from faculty_source fs
         where fs.id = $1
            or lower(trim(fs.code)) = lower(trim($1))
            or regexp_replace(lower(trim(fs.name)), '[^a-z0-9]+', ' ', 'g') = $2
         order by case when fs.id = $1 then 0 else 1 end, fs.name
         limit 1
       ),
       selected_users as (
         select u.*
         from users u
         join selected_faculty sf on lower(trim(u.faculty)) in (lower(trim(sf.name)), lower(trim(sf.code)))
       ),
       faculty_publications as (
         select p.*, u.full_name as owner_name, u.email as owner_email, u.faculty as owner_faculty, u.department as owner_department
         from publications p
         join selected_users u on u.id = p.owner_id
         where p.status <> 'draft'
       ),
       faculty_reimbursements as (
         select r.*, u.full_name as owner_name, u.email as owner_email, u.faculty as owner_faculty, u.department as owner_department
         from reimbursements r
         join selected_users u on u.id = r.owner_id
         where r.status <> 'draft'
       )
       select
         sf.id,
         sf.code,
         sf.name,
         sf.updated_at,
         greatest(
           coalesce(departments.department_count, 0),
           coalesce(user_departments.department_count, 0)
         )::int as department_count,
         coalesce(user_departments.department_names, array[]::text[]) as department_names,
         coalesce(users_stats.active_user_count, 0)::int as active_user_count,
         coalesce(users_stats.professor_count, 0)::int as professor_count,
         coalesce(publications_stats.publication_count, 0)::int as publication_count,
         coalesce(reimbursements_stats.reimbursement_count, 0)::int as reimbursement_count,
         coalesce(quartiles.q1_count, 0)::int as q1_count,
         coalesce(quartiles.q2_count, 0)::int as q2_count,
         coalesce(quartiles.q3_count, 0)::int as q3_count,
         coalesce(quartiles.q4_count, 0)::int as q4_count,
         coalesce(publications_list.items, '[]'::jsonb) as publications,
         coalesce(reimbursements_list.items, '[]'::jsonb) as reimbursements
       from selected_faculty sf
       left join lateral (
         select count(*)::int as department_count
         from departments d
         where sf.faculty_id is not null and d.faculty_id = sf.faculty_id
       ) departments on true
       left join lateral (
         select
           count(distinct lower(trim(u.department)))::int as department_count,
           array_agg(distinct trim(u.department) order by trim(u.department)) as department_names
         from selected_users u
         where coalesce(u.status, 'active') = 'active'
           and nullif(trim(u.department), '') is not null
       ) user_departments on true
       left join lateral (
         select
           count(*) filter (where coalesce(u.status, 'active') = 'active')::int as active_user_count,
           count(*) filter (
             where coalesce(u.status, 'active') = 'active'
               and coalesce(u.role, 'professor') = 'professor'
           )::int as professor_count
         from selected_users u
       ) users_stats on true
       left join lateral (
         select count(*)::int as publication_count
         from faculty_publications
       ) publications_stats on true
       left join lateral (
         select count(*)::int as reimbursement_count
         from faculty_reimbursements
       ) reimbursements_stats on true
       left join lateral (
         select
           count(*) filter (where primary_quartile = 'Q1')::int as q1_count,
           count(*) filter (where primary_quartile = 'Q2')::int as q2_count,
           count(*) filter (where primary_quartile = 'Q3')::int as q3_count,
           count(*) filter (where primary_quartile = 'Q4')::int as q4_count
         from (
           select coalesce(
             case
               when fp.indexing_category ~* '^Q[1-4]$' then upper(fp.indexing_category)
               else null
             end,
             (
               select nullif(pi.quartile, '')
               from publication_indexing pi
               where pi.publication_id = fp.id
               order by pi.created_at desc
               limit 1
             )
           ) as primary_quartile
           from faculty_publications fp
         ) q
       ) quartiles on true
       left join lateral (
         select jsonb_agg(
           jsonb_build_object(
             'id', p.id,
             'title', p.title,
             'doi', p.doi,
             'venue', p.venue,
             'publisher', p.publisher,
             'publicationType', p.publication_type,
             'publication_type', p.publication_type,
             'publicationDate', p.publication_date,
             'publication_date', p.publication_date,
             'publicationYear', p.publication_year,
             'publication_year', p.publication_year,
             'status', p.status,
             'indexingCategory', p.indexing_category,
             'indexing_category', p.indexing_category,
             'category', p.indexing_category,
             'quartileCategory', p.indexing_category,
             'quartile_category', p.indexing_category,
             'quartile', coalesce(
               case
                 when p.indexing_category ~* '^Q[1-4]$' then upper(p.indexing_category)
                 else null
               end,
               (
                 select nullif(pi.quartile, '')
                 from publication_indexing pi
                 where pi.publication_id = p.id
                 order by pi.created_at desc
                 limit 1
               )
             ),
             'createdAt', p.created_at,
             'created_at', p.created_at,
             'updatedAt', p.updated_at,
             'updated_at', p.updated_at,
             'owner', jsonb_build_object(
               'id', p.owner_id,
               'name', p.owner_name,
               'email', p.owner_email,
               'faculty', p.owner_faculty,
               'department', p.owner_department
             )
           )
           order by p.updated_at desc, p.created_at desc
         ) as items
         from faculty_publications p
       ) publications_list on true
       left join lateral (
         select jsonb_agg(
           jsonb_build_object(
             'id', r.id,
             'title', r.title,
             'amount', r.amount,
             'currency', r.currency,
             'status', r.status,
             'requestType', r.request_type,
             'request_type', r.request_type,
             'submittedAt', r.submitted_at,
             'submitted_at', r.submitted_at,
             'createdAt', r.created_at,
             'created_at', r.created_at,
             'updatedAt', r.updated_at,
             'updated_at', r.updated_at,
             'requestData', r.request_data,
             'request_data', r.request_data,
             'owner', jsonb_build_object(
               'id', r.owner_id,
               'name', r.owner_name,
               'email', r.owner_email,
               'faculty', r.owner_faculty,
               'department', r.owner_department
             )
           )
           order by coalesce(r.submitted_at, r.created_at) desc
         ) as items
         from faculty_reimbursements r
       ) reimbursements_list on true`,
      [routeId, routeKey]
    );

    const row = result.rows[0];

    if (!row) {
      res.status(404).json({ error: "faculty_not_found", message: "Fakulteti nuk u gjet." });
      return;
    }

    const faculty = mapFaculty(row);
    const publications = Array.isArray(row.publications) ? row.publications : [];
    const reimbursements = Array.isArray(row.reimbursements) ? row.reimbursements : [];
    const publicationAnalytics = buildFacultyPublicationAnalytics(publications);
    const payload = {
      faculty: {
        ...faculty,
        q1Count: publicationAnalytics.quartileDistribution.find((item) => item.quartile === "Q1")?.count || Number(row.q1_count || 0),
        q2Count: publicationAnalytics.quartileDistribution.find((item) => item.quartile === "Q2")?.count || Number(row.q2_count || 0),
        q3Count: publicationAnalytics.quartileDistribution.find((item) => item.quartile === "Q3")?.count || Number(row.q3_count || 0),
        q4Count: publicationAnalytics.quartileDistribution.find((item) => item.quartile === "Q4")?.count || Number(row.q4_count || 0),
      },
      publications,
      reimbursements,
      ...publicationAnalytics,
    };

    console.log("[prorector:faculty-details]", {
      facultyId: payload.faculty.id,
      totalPublications: payload.totalPublications,
      quartileDistribution: payload.quartileDistribution,
      departments: payload.departments.map((department) => ({
        departmentName: department.departmentName,
        publicationCount: department.publicationCount,
      })),
      publicationTypes: payload.publicationTypes,
      recentPublications: payload.recentPublications.length,
      attentionPublications: payload.attentionPublications.length,
    });
    res.json(payload);
  } catch (error) {
    console.error("GET /api/prorector/faculties/:id failed:", error);
    res.status(500).json({
      error: "prorector_faculty_details_failed",
      message: "Detajet e fakultetit nuk u ngarkuan.",
    });
  }
});

export default router;
