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

const REQUEST_STATUSES = ["draft", "submitted", "in_review", "correction", "approved", "rejected"];
const FUNDING_CATEGORIES = [
  "SCI, SSCI, AHCI",
  "Scopus Q1",
  "Scopus Q2",
  "Scopus Q3",
  "Scopus Q4",
  "Libra/Kapituj",
  "Konferenca/Simpoziume",
  "Projekte shkencore",
  "Pa verifikim",
];

function normalizeText(value) {
  return String(value ?? "").trim();
}

function normalizeRole(value) {
  const normalized = normalizeText(value).toLowerCase().replace(/[\s_-]+/g, "");
  return ROLE_ALIASES[normalized] || normalized;
}

function requireProRectorAccess(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized", message: "Duhet te kyqeni per te pare te dhenat e Prorektorit." });
    return;
  }

  if (!["prorector", "admin"].includes(normalizeRole(req.user.role))) {
    res.status(403).json({ error: "forbidden", message: "Vetem Prorektori ose administratori mund te shohin keto te dhena." });
    return;
  }

  next();
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function normalizeRequestStatus(status) {
  if (status === "needs_correction") return "correction";
  if (status === "committee_approved" || status === "paid") return "approved";
  if (REQUEST_STATUSES.includes(status)) return status;
  return status || "draft";
}

function fillSeries(rows = [], keys = []) {
  const existing = new Map(rows.map((row) => [String(row.name), row]));
  keys.forEach((key) => {
    if (!existing.has(key)) existing.set(key, { name: key, value: 0 });
  });
  return Array.from(existing.values());
}

function buildFilters(query = {}) {
  return {
    year: /^\d{4}$/.test(normalizeText(query.year)) ? Number(query.year) : null,
    faculty: normalizeText(query.faculty) || null,
    type: normalizeText(query.type) || null,
    platform: normalizeText(query.platform) || null,
    quartile: /^q[1-4]$/i.test(normalizeText(query.quartile)) ? normalizeText(query.quartile).toUpperCase() : normalizeText(query.quartile) || null,
    status: normalizeText(query.status) || null,
    search: normalizeText(query.search) || null,
  };
}

function mapPublication(row = {}) {
  const authors = Array.isArray(row.authors) ? row.authors : [];
  const mainAuthor = authors.find((author) => author?.isMainAuthor) || authors[0] || null;
  const correspondingAuthor = authors.find((author) => author?.isCorrespondingAuthor) || null;

  return {
    id: row.id,
    title: row.title || "",
    authors,
    authorNames: row.author_names || "",
    mainAuthor: mainAuthor?.fullName || row.owner_name || "",
    correspondingAuthor: correspondingAuthor?.fullName || "",
    faculty: row.faculty || "",
    department: row.department || "",
    type: row.publication_type || "",
    typeLabel: row.type_label || "",
    publishedIn: row.published_in || "",
    venue: row.venue || "",
    publisher: row.publisher || "",
    indexing: row.indexing || "Pa verifikim",
    platform: row.platform || "Pa verifikim",
    quartile: row.quartile || "Pa verifikim",
    date: row.publication_date || row.created_at,
    year: numberValue(row.publication_year),
    doi: row.doi || "",
    issn: row.issn || "",
    eIssn: row.e_issn || "",
    isbn: row.isbn || "",
    citeScore: row.cite_score || "",
    abstract: row.abstract || "",
    sourceUrl: row.source_url || "",
    status: row.status || "draft",
    statusLabel: row.status_label || row.status || "draft",
    regulationCategory: row.regulation_category || "Pa verifikim",
    employmentStatus: row.employment_status || "",
    employmentStatusLabel: row.employment_status_label || "",
    fundingAmount: numberValue(row.funding_amount),
    currency: row.currency || "EUR",
  };
}

function mapFunding(row = {}) {
  return {
    id: row.id,
    applicant: row.applicant || "",
    faculty: row.faculty || "",
    fundingType: row.funding_type || "",
    regulationCategory: row.regulation_category || "",
    title: row.title || "",
    requestedAmount: numberValue(row.requested_amount),
    approvedAmount: numberValue(row.approved_amount),
    currency: row.currency || "EUR",
    status: normalizeRequestStatus(row.status),
    statusLabel: row.status_label || normalizeRequestStatus(row.status),
    applicationDate: row.application_date || row.created_at,
  };
}

const FACULTY_SOURCE_CTE = `
with active_user_faculties as (
  select distinct lower(trim(faculty)) as faculty_key
  from users
  where nullif(trim(coalesce(faculty, '')), '') is not null
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
  where nullif(trim(coalesce(u.faculty, '')), '') is not null
    and not exists (
      select 1
      from faculties f
      where lower(trim(u.faculty)) in (lower(trim(f.name)), lower(trim(f.code)))
    )
  group by lower(trim(u.faculty)), trim(u.faculty)
)`;

const PUBLICATION_CORE_CTE = `
publication_core as (
  select
    p.id,
    p.title,
    p.doi,
    p.publication_type,
    p.venue,
    p.publisher,
    p.abstract,
    p.source_url,
    p.issn,
    p.e_issn,
    p.isbn,
    p.publication_date,
    coalesce(p.publication_year, extract(year from p.publication_date)::int, extract(year from p.created_at)::int) as publication_year,
    p.indexing_platform,
    p.custom_indexing_platform,
    p.web_of_science_index,
    p.indexing_category,
    p.indexing_verified,
    p.status,
    p.created_at,
    p.updated_at,
    coalesce(nullif(u.faculty, ''), 'Pa fakultet') as faculty,
    coalesce(nullif(u.department, ''), 'Pa departament') as department,
    u.full_name as owner_name,
    case
      when exists (
        select 1
        from jsonb_array_elements(coalesce(u.orcid_employments, '[]'::jsonb)) employment(item)
        where concat_ws(' ', employment.item->>'roleTitle', employment.item->>'department', employment.item->>'organization') ~* '(part[ -]?time|part[- ]?time|pjessh|gjysm)'
      ) then 'part_time'
      when exists (
        select 1
        from jsonb_array_elements(coalesce(u.orcid_employments, '[]'::jsonb)) employment(item)
        where concat_ws(' ', employment.item->>'roleTitle', employment.item->>'department', employment.item->>'organization') ~* '(full[ -]?time|full[- ]?time|plot)'
      ) then 'full_time'
      else ''
    end as employment_status,
    coalesce(authors.items, '[]'::jsonb) as authors,
    coalesce(authors.names, u.full_name, '') as author_names,
    coalesce(nullif(p.indexing_platform, ''), nullif(p.custom_indexing_platform, ''), nullif(latest_indexing.source, ''), nullif(latest_indexing.source_key, 'manual'), '') as platform_raw,
    latest_indexing.cite_score,
    coalesce(funding.approved_amount, 0) as funding_amount,
    coalesce(funding.currency, 'EUR') as currency,
    coalesce(
      case when p.indexing_category ~* '^Q[1-4]$' then upper(p.indexing_category) end,
      case when latest_indexing.quartile ~* '^Q[1-4]$' then upper(latest_indexing.quartile) end
    ) as quartile_raw,
    coalesce(nullif(p.web_of_science_index, ''), nullif(latest_indexing.web_of_science_index, ''), nullif(latest_indexing.category, ''), nullif(p.indexing_category, ''), '') as indexing_raw
  from publications p
  left join users u on u.id = p.owner_id
  left join lateral (
    select
      jsonb_agg(
        jsonb_build_object(
          'id', pa.id,
          'fullName', pa.full_name,
          'orcid', pa.orcid,
          'affiliation', pa.affiliation,
          'isMainAuthor', pa.is_main_author,
          'isCorrespondingAuthor', pa.is_corresponding_author,
          'order', coalesce(nullif(pa.author_order, 0), pa.position)
        )
        order by coalesce(nullif(pa.author_order, 0), pa.position), pa.created_at
      ) as items,
      string_agg(nullif(pa.full_name, ''), ', ' order by coalesce(nullif(pa.author_order, 0), pa.position), pa.created_at) as names
    from publication_authors pa
    where pa.publication_id = p.id
  ) authors on true
  left join lateral (
    select pi.*
    from publication_indexing pi
    where pi.publication_id = p.id
    order by pi.updated_at desc, pi.created_at desc
    limit 1
  ) latest_indexing on true
  left join lateral (
    select
      coalesce(sum(r.amount) filter (where r.status in ('approved', 'paid', 'committee_approved')), 0)::numeric(12, 2) as approved_amount,
      max(r.currency) as currency
    from reimbursements r
    where r.publication_id = p.id
  ) funding on true
)`;

const PUBLICATION_SELECT = `
select
  pc.*,
  case
    when pc.publication_type = 'journal_article' then 'Artikull reviste'
    when pc.publication_type = 'conference_paper' then 'Punim konference'
    when pc.publication_type in ('book', 'book_chapter') then 'Libra/Kapituj'
    else coalesce(nullif(pc.publication_type, ''), 'Tjeter')
  end as type_label,
  coalesce(nullif(pc.venue, ''), nullif(pc.publisher, ''), '-') as published_in,
  coalesce(nullif(pc.platform_raw, ''), 'Pa verifikim') as platform,
  coalesce(nullif(pc.indexing_raw, ''), 'Pa verifikim') as indexing,
  coalesce(pc.quartile_raw, 'Pa verifikim') as quartile,
  case
    when pc.employment_status = 'full_time' then 'Autor me orar të plotë'
    when pc.employment_status = 'part_time' then 'Autor me orar të pjesshëm'
    else ''
  end as employment_status_label,
  case
    when upper(pc.indexing_raw) in ('SCI', 'SSCI', 'AHCI') or upper(pc.web_of_science_index) in ('SCI', 'SSCI', 'AHCI') then 'SCI, SSCI, AHCI'
    when pc.platform_raw ~* 'scopus' and pc.quartile_raw = 'Q1' then 'Scopus Q1'
    when pc.platform_raw ~* 'scopus' and pc.quartile_raw = 'Q2' then 'Scopus Q2'
    when pc.platform_raw ~* 'scopus' and pc.quartile_raw = 'Q3' then 'Scopus Q3'
    when pc.platform_raw ~* 'scopus' and pc.quartile_raw = 'Q4' then 'Scopus Q4'
    when pc.publication_type in ('book', 'book_chapter') then 'Libra/Kapituj'
    else 'Pa verifikim'
  end as regulation_category,
  case
    when pc.status = 'submitted' then 'Dorëzuar'
    when pc.status = 'in_review' then 'Në shqyrtim'
    when pc.status = 'needs_correction' then 'Korrigjim'
    when pc.status = 'approved' then 'Aprovuar'
    when pc.status = 'rejected' then 'Refuzuar'
    else 'Draft'
  end as status_label
from publication_core pc`;

const FUNDING_CORE_CTE = `
funding_core as (
  select
    r.id,
    r.title,
    r.amount,
    r.currency,
    r.status,
    r.request_type,
    r.conference_id,
    r.request_data,
    r.submitted_at,
    r.created_at,
    r.updated_at,
    coalesce(nullif(u.full_name, ''), u.email, '') as applicant,
    coalesce(nullif(u.faculty, ''), 'Pa fakultet') as faculty,
    coalesce(nullif(u.department, ''), 'Pa departament') as department,
    p.publication_type,
    coalesce(
      case when p.indexing_category ~* '^Q[1-4]$' then upper(p.indexing_category) end,
      case when pi.quartile ~* '^Q[1-4]$' then upper(pi.quartile) end
    ) as publication_quartile,
    coalesce(nullif(p.indexing_platform, ''), nullif(p.custom_indexing_platform, ''), nullif(pi.source, ''), '') as publication_platform,
    coalesce(nullif(p.web_of_science_index, ''), nullif(pi.web_of_science_index, ''), nullif(pi.category, ''), nullif(p.indexing_category, ''), '') as publication_indexing
  from reimbursements r
  left join users u on u.id = r.owner_id
  left join publications p on p.id = r.publication_id
  left join lateral (
    select publication_indexing.*
    from publication_indexing
    where publication_indexing.publication_id = p.id
    order by publication_indexing.updated_at desc, publication_indexing.created_at desc
    limit 1
  ) pi on true
)`;

const FUNDING_SELECT = `
select
  fc.*,
  fc.amount as requested_amount,
  case when fc.status in ('approved', 'paid') then fc.amount else 0 end as approved_amount,
  coalesce(fc.submitted_at, fc.created_at) as application_date,
  case
    when fc.request_type = 'conference' or fc.conference_id is not null then 'Financim për konferenca/simpoziume'
    when fc.request_type = 'project' then 'Financim për projekte shkencore'
    else 'Financim për publikime shkencore'
  end as funding_type,
  case
    when fc.request_type = 'conference' then 'Konferenca/Simpoziume'
    when fc.request_type = 'project' then 'Projekte shkencore'
    when upper(fc.publication_indexing) in ('SCI', 'SSCI', 'AHCI') then 'SCI, SSCI, AHCI'
    when fc.publication_platform ~* 'scopus' and fc.publication_quartile = 'Q1' then 'Scopus Q1'
    when fc.publication_platform ~* 'scopus' and fc.publication_quartile = 'Q2' then 'Scopus Q2'
    when fc.publication_platform ~* 'scopus' and fc.publication_quartile = 'Q3' then 'Scopus Q3'
    when fc.publication_platform ~* 'scopus' and fc.publication_quartile = 'Q4' then 'Scopus Q4'
    when fc.publication_type in ('book', 'book_chapter') then 'Libra/Kapituj'
    else 'Pa verifikim'
  end as regulation_category,
  case
    when fc.status = 'submitted' then 'Dorëzuar'
    when fc.status = 'received' then 'Pranuar'
    when fc.status = 'in_review' then 'Në shqyrtim'
    when fc.status = 'needs_correction' then 'Korrigjim'
    when fc.status in ('committee_approved', 'approved', 'paid') then 'Aprovuar'
    when fc.status = 'rejected' then 'Refuzuar'
    else 'Draft'
  end as status_label
from funding_core fc`;

async function getOverview() {
  const result = await db.query(
    `with ${PUBLICATION_CORE_CTE}, ${FUNDING_CORE_CTE},
     publication_rows as (${PUBLICATION_SELECT}),
     funding_rows as (${FUNDING_SELECT}),
     publication_categories as (
       select regulation_category as name, count(*)::int as value
       from publication_rows
       group by regulation_category
     ),
     request_statuses as (
       select
         case
           when status = 'needs_correction' then 'correction'
           when status in ('committee_approved', 'paid') then 'approved'
           else status
         end as name,
         count(*)::int as value
       from funding_rows
       group by 1
     )
     select jsonb_build_object(
       'kpis', jsonb_build_object(
         'totalPublications', (select count(*) from publications),
         'scopusQ1Q2Publications', (
           select count(*) from publication_rows
           where regulation_category in ('Scopus Q1', 'Scopus Q2')
         ),
         'approvedFundingTotal', (
           select coalesce(sum(approved_amount), 0) from funding_rows
         ),
         'activeRequests', (
           select count(*) from funding_rows
           where status in ('submitted', 'in_review', 'needs_correction')
         ),
         'activeResearchProfessors', (
           select count(distinct owner_id)
           from publications
           where owner_id is not null and status <> 'draft'
         ),
         'leadingFaculty', (
           select coalesce(faculty, 'Pa të dhëna')
           from publication_rows
           group by faculty
           order by count(*) desc, faculty asc
           limit 1
         )
       ),
       'charts', jsonb_build_object(
         'publicationsByYear', coalesce((
           select jsonb_agg(jsonb_build_object('name', publication_year::text, 'value', value) order by publication_year)
           from (
             select publication_year, count(*)::int as value
             from publication_rows
             where publication_year is not null
             group by publication_year
           ) y
         ), '[]'::jsonb),
         'fundingByYear', coalesce((
           select jsonb_agg(jsonb_build_object('name', funding_year::text, 'value', value) order by funding_year)
           from (
             select extract(year from application_date)::int as funding_year, coalesce(sum(approved_amount), 0)::numeric(12, 2) as value
             from funding_rows
             where application_date is not null
             group by extract(year from application_date)::int
           ) y
         ), '[]'::jsonb),
         'publicationsByCategory', coalesce((
           select jsonb_agg(jsonb_build_object('name', name, 'value', value) order by name)
           from publication_categories
         ), '[]'::jsonb),
         'requestsByStatus', coalesce((
           select jsonb_agg(jsonb_build_object('name', name, 'value', value) order by name)
           from request_statuses
         ), '[]'::jsonb)
       )
     ) as payload`
  );

  const payload = result.rows[0]?.payload || {};
  return {
    kpis: {
      totalPublications: numberValue(payload.kpis?.totalPublications),
      scopusQ1Q2Publications: numberValue(payload.kpis?.scopusQ1Q2Publications),
      approvedFundingTotal: numberValue(payload.kpis?.approvedFundingTotal),
      activeRequests: numberValue(payload.kpis?.activeRequests),
      activeResearchProfessors: numberValue(payload.kpis?.activeResearchProfessors),
      leadingFaculty: payload.kpis?.leadingFaculty || "Pa të dhëna",
    },
    charts: {
      publicationsByYear: payload.charts?.publicationsByYear || [],
      fundingByYear: payload.charts?.fundingByYear || [],
      publicationsByCategory: fillSeries(payload.charts?.publicationsByCategory || [], FUNDING_CATEGORIES.slice(0, 6)),
      requestsByStatus: fillSeries(payload.charts?.requestsByStatus || [], REQUEST_STATUSES),
    },
  };
}

router.get("/overview", requireProRectorAccess, async (_req, res) => {
  try {
    res.json(await getOverview());
  } catch (error) {
    console.error("GET /api/prorector/overview failed:", error);
    res.status(500).json({ error: "prorector_overview_failed", message: "Të dhënat kryesore nuk u ngarkuan." });
  }
});

router.get("/faculties", requireProRectorAccess, async (_req, res) => {
  try {
    const result = await db.query(
      `${FACULTY_SOURCE_CTE},
       faculty_rows as (
         select
           fs.id,
           fs.code,
           fs.name,
           coalesce(users_stats.professor_count, 0)::int as professor_count,
           coalesce(publications_stats.publication_count, 0)::int as publication_count,
           coalesce(funding_stats.approved_total, 0)::numeric(12, 2) as approved_funding_total,
           coalesce(users_stats.active_user_count, 0)::int as active_user_count
         from faculty_source fs
         left join lateral (
           select
             count(*) filter (where coalesce(u.status, 'active') = 'active')::int as active_user_count,
             count(*) filter (where coalesce(u.status, 'active') = 'active' and coalesce(u.role, 'professor') = 'professor')::int as professor_count
           from users u
           where lower(trim(u.faculty)) in (lower(trim(fs.name)), lower(trim(fs.code)))
         ) users_stats on true
         left join lateral (
           select count(*)::int as publication_count
           from publications p
           join users u on u.id = p.owner_id
           where lower(trim(u.faculty)) in (lower(trim(fs.name)), lower(trim(fs.code)))
         ) publications_stats on true
         left join lateral (
           select coalesce(sum(r.amount) filter (where r.status in ('approved', 'paid')), 0)::numeric(12, 2) as approved_total
           from reimbursements r
           join users u on u.id = r.owner_id
           where lower(trim(u.faculty)) in (lower(trim(fs.name)), lower(trim(fs.code)))
         ) funding_stats on true
       )
       select *
       from faculty_rows
       order by publication_count desc, name asc`
    );

    res.json({
      faculties: result.rows.map((row) => ({
        id: row.id,
        code: row.code || "",
        name: row.name || "",
        professorCount: numberValue(row.professor_count),
        publicationCount: numberValue(row.publication_count),
        approvedFundingTotal: numberValue(row.approved_funding_total),
        status: numberValue(row.active_user_count) > 0 ? "active" : "inactive",
        statusLabel: numberValue(row.active_user_count) > 0 ? "Aktiv" : "Pa staf aktiv",
      })),
    });
  } catch (error) {
    console.error("GET /api/prorector/faculties failed:", error);
    res.status(500).json({ error: "prorector_faculties_failed", message: "Fakultetet nuk u ngarkuan." });
  }
});

router.get("/faculties/:id", requireProRectorAccess, async (req, res) => {
  try {
    const result = await db.query(
      `${FACULTY_SOURCE_CTE},
       selected_faculty as (
         select *
         from faculty_source
         where id = $1 or lower(trim(code)) = lower(trim($1)) or lower(trim(name)) = lower(trim($1))
         order by case when id = $1 then 0 else 1 end
         limit 1
       ),
       selected_users as (
         select u.*
         from users u
         join selected_faculty sf on lower(trim(u.faculty)) in (lower(trim(sf.name)), lower(trim(sf.code)))
       ),
       ${PUBLICATION_CORE_CTE},
       ${FUNDING_CORE_CTE},
       publication_rows as (${PUBLICATION_SELECT}),
       funding_rows as (${FUNDING_SELECT})
       select jsonb_build_object(
         'faculty', (
           select jsonb_build_object(
             'id', sf.id,
             'code', sf.code,
             'name', sf.name,
             'professorCount', (select count(*) from selected_users where coalesce(status, 'active') = 'active' and coalesce(role, 'professor') = 'professor'),
             'publicationCount', (select count(*) from publication_rows pr join selected_faculty sf2 on lower(trim(pr.faculty)) in (lower(trim(sf2.name)), lower(trim(sf2.code)))),
             'approvedFundingTotal', (select coalesce(sum(approved_amount), 0) from funding_rows fr join selected_faculty sf2 on lower(trim(fr.faculty)) in (lower(trim(sf2.name)), lower(trim(sf2.code)))),
             'statusLabel', case when exists (select 1 from selected_users where coalesce(status, 'active') = 'active') then 'Aktiv' else 'Pa staf aktiv' end
           )
           from selected_faculty sf
         ),
         'summary', jsonb_build_object(
           'journalArticles', (select count(*) from publication_rows pr join selected_faculty sf2 on lower(trim(pr.faculty)) in (lower(trim(sf2.name)), lower(trim(sf2.code))) where pr.publication_type = 'journal_article'),
           'conferencePapers', (select count(*) from publication_rows pr join selected_faculty sf2 on lower(trim(pr.faculty)) in (lower(trim(sf2.name)), lower(trim(sf2.code))) where pr.publication_type = 'conference_paper'),
           'booksChapters', (select count(*) from publication_rows pr join selected_faculty sf2 on lower(trim(pr.faculty)) in (lower(trim(sf2.name)), lower(trim(sf2.code))) where pr.publication_type in ('book', 'book_chapter')),
           'activeAuthors', (select count(distinct pr.owner_name) from publication_rows pr join selected_faculty sf2 on lower(trim(pr.faculty)) in (lower(trim(sf2.name)), lower(trim(sf2.code))) where nullif(pr.owner_name, '') is not null),
           'fundingRequests', (select count(*) from funding_rows fr join selected_faculty sf2 on lower(trim(fr.faculty)) in (lower(trim(sf2.name)), lower(trim(sf2.code)))),
           'fundedTotal', (select coalesce(sum(approved_amount), 0) from funding_rows fr join selected_faculty sf2 on lower(trim(fr.faculty)) in (lower(trim(sf2.name)), lower(trim(sf2.code))))
         ),
         'publicationsByYear', coalesce((
           select jsonb_agg(jsonb_build_object('name', publication_year::text, 'value', value) order by publication_year)
           from (
             select pr.publication_year, count(*)::int as value
             from publication_rows pr
             join selected_faculty sf2 on lower(trim(pr.faculty)) in (lower(trim(sf2.name)), lower(trim(sf2.code)))
             where pr.publication_year is not null
             group by pr.publication_year
           ) y
         ), '[]'::jsonb),
         'fundingByYear', coalesce((
           select jsonb_agg(jsonb_build_object('name', funding_year::text, 'value', value) order by funding_year)
           from (
             select extract(year from fr.application_date)::int as funding_year, coalesce(sum(fr.approved_amount), 0)::numeric(12, 2) as value
             from funding_rows fr
             join selected_faculty sf2 on lower(trim(fr.faculty)) in (lower(trim(sf2.name)), lower(trim(sf2.code)))
             where fr.application_date is not null
             group by extract(year from fr.application_date)::int
           ) y
         ), '[]'::jsonb)
       ) as payload`
      ,
      [normalizeText(req.params.id)]
    );

    const payload = result.rows[0]?.payload;
    if (!payload?.faculty) {
      res.status(404).json({ error: "faculty_not_found", message: "Fakulteti nuk u gjet." });
      return;
    }

    res.json(payload);
  } catch (error) {
    console.error("GET /api/prorector/faculties/:id failed:", error);
    res.status(500).json({ error: "prorector_faculty_failed", message: "Detajet e fakultetit nuk u ngarkuan." });
  }
});

router.get("/publications", requireProRectorAccess, async (req, res) => {
  const filters = buildFilters(req.query);

  try {
    const result = await db.query(
      `with ${PUBLICATION_CORE_CTE},
       rows as (${PUBLICATION_SELECT})
       select *
       from rows
       where ($1::int is null or publication_year = $1)
         and ($2::text is null or faculty = $2)
         and ($3::text is null or publication_type = $3)
         and ($4::text is null or platform ilike '%' || $4 || '%')
         and ($5::text is null or quartile = $5)
         and (
           ($6::text is null and status not in ('draft', 'needs_correction'))
           or status = $6
           or ($6 = 'in_review' and status = 'submitted')
         )
         and ($7::text is null or title ilike '%' || $7 || '%' or author_names ilike '%' || $7 || '%' or doi ilike '%' || $7 || '%')
       order by coalesce(publication_date, created_at) desc, title asc
       limit 500`,
      [filters.year, filters.faculty, filters.type, filters.platform, filters.quartile, filters.status, filters.search]
    );

    res.json({ publications: result.rows.map(mapPublication) });
  } catch (error) {
    console.error("GET /api/prorector/publications failed:", error);
    res.status(500).json({ error: "prorector_publications_failed", message: "Publikimet nuk u ngarkuan." });
  }
});

router.get("/funding", requireProRectorAccess, async (req, res) => {
  const filters = buildFilters(req.query);

  try {
    const result = await db.query(
      `with ${FUNDING_CORE_CTE},
       rows as (${FUNDING_SELECT})
       select *
       from rows
       where ($1::int is null or extract(year from application_date)::int = $1)
         and ($2::text is null or faculty = $2)
         and ($3::text is null or funding_type = $3)
         and ($4::text is null or status = $4 or ($4 = 'correction' and status = 'needs_correction'))
         and ($5::text is null or title ilike '%' || $5 || '%' or applicant ilike '%' || $5 || '%')
       order by application_date desc, title asc
       limit 500`,
      [filters.year, filters.faculty, filters.type, filters.status, filters.search]
    );

    res.json({ funding: result.rows.map(mapFunding) });
  } catch (error) {
    console.error("GET /api/prorector/funding failed:", error);
    res.status(500).json({ error: "prorector_funding_failed", message: "Financimet nuk u ngarkuan." });
  }
});

router.get("/reports", requireProRectorAccess, async (_req, res) => {
  try {
    const overview = await getOverview();
    res.json({ ...overview, regulationCategories: FUNDING_CATEGORIES });
  } catch (error) {
    console.error("GET /api/prorector/reports failed:", error);
    res.status(500).json({ error: "prorector_reports_failed", message: "Raportet nuk u ngarkuan." });
  }
});

router.get("/analytics", requireProRectorAccess, async (_req, res) => {
  try {
    const overview = await getOverview();
    res.json({ charts: overview.charts, regulationCategories: FUNDING_CATEGORIES });
  } catch (error) {
    console.error("GET /api/prorector/analytics failed:", error);
    res.status(500).json({ error: "prorector_analytics_failed", message: "Analitika nuk u ngarkua." });
  }
});

export default router;
