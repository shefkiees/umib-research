import express from "express";
import db from "../config/db.js";

const router = express.Router();

const PERIOD_MONTHS = {
  "1m": 1,
  "2m": 2,
  "6m": 6,
  "12m": 12,
};

const CITATION_COUNT_SQL = `
  case
    when coalesce(
      m.raw_json->>'is-referenced-by-count',
      m.raw_json#>>'{message,is-referenced-by-count}',
      m.raw_json->>'citationCount',
      m.raw_json->>'citation_count'
    ) ~ '^[0-9]+$'
    then coalesce(
      m.raw_json->>'is-referenced-by-count',
      m.raw_json#>>'{message,is-referenced-by-count}',
      m.raw_json->>'citationCount',
      m.raw_json->>'citation_count'
    )::int
    else 0
  end
`;

function requireAuthenticatedUser(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }

  next();
}

function getPeriodConfig(range) {
  const normalizedRange = String(range || "6m").toLowerCase();
  const months = PERIOD_MONTHS[normalizedRange] || PERIOD_MONTHS["6m"];
  const now = new Date();
  const startMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));

  return {
    range: PERIOD_MONTHS[normalizedRange] ? normalizedRange : "6m",
    months,
    startMonth: startMonth.toISOString().slice(0, 10),
  };
}

function toNumber(value) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function mapStatusRows(rows) {
  return rows.map((row) => ({
    status: row.status || "unknown",
    count: toNumber(row.count),
  }));
}

router.get("/stats", requireAuthenticatedUser, async (req, res) => {
  const period = getPeriodConfig(req.query.range);
  const userId = req.user.id;

  try {
    const [
      summaryResult,
      monthlyResult,
      publicationStatusResult,
      reimbursementStatusResult,
      reimbursementTypeResult,
      reimbursementAmountResult,
    ] = await Promise.all([
      db.query(
        `select
           (select count(*)::int
            from publications
            where owner_id = $1) as publications_total,
           (select count(*)::int
            from publications
            where owner_id = $1 and status = 'approved') as publications_approved,
           (select count(*)::int
            from publications
            where owner_id = $1 and status in ('submitted', 'in_review')) as publications_in_review,
           (select count(*)::int
            from publications
            where owner_id = $1 and status = 'draft') as publications_draft,
           (select coalesce(sum(
              ${CITATION_COUNT_SQL}
            ), 0)::int
            from publications p
            left join publication_metadata m on m.doi = p.doi
            where p.owner_id = $1) as citations_total,
           (select count(*)::int
            from (
              select c.id::text as activity_id
              from conferences c
              where c.created_by = $1
              union
              select coalesce(r.conference_id::text, nullif(r.request_data->>'conferenceId', ''), r.id::text) as activity_id
              from reimbursements r
              where r.owner_id = $1 and r.request_type = 'conference'
            ) conference_activities) as conferences_total,
           (select count(*)::int
            from conferences c
            where c.created_by = $1 and c.conference_date >= current_date) as upcoming_conferences,
           (select count(*)::int
            from reimbursements
            where owner_id = $1) as reimbursements_total,
           (select count(*)::int
            from reimbursements
            where owner_id = $1 and status in ('submitted', 'in_review')) as reimbursements_in_review,
           (select count(*)::int
            from reimbursements
            where owner_id = $1 and status in ('approved', 'paid')) as reimbursements_approved,
           (select count(*)::int
            from notifications
            where user_id = $1 and is_read = false) as unread_notifications`,
        [userId]
      ),
      db.query(
        `with months as (
           select generate_series(
             $2::date,
             date_trunc('month', current_date)::date,
             interval '1 month'
           )::date as month_start
         ),
         publication_monthly as (
           select
             date_trunc('month', p.created_at)::date as month_start,
             count(*)::int as publications,
             coalesce(sum(
               ${CITATION_COUNT_SQL}
             ), 0)::int as citations
           from publications p
           left join publication_metadata m on m.doi = p.doi
           where p.owner_id = $1 and p.created_at >= $2::date
           group by 1
         ),
         conference_events as (
           select c.created_at as occurred_at
           from conferences c
           where c.created_by = $1
           union all
           select coalesce(r.submitted_at, r.created_at) as occurred_at
           from reimbursements r
           where r.owner_id = $1 and r.request_type = 'conference'
         ),
         conference_monthly as (
           select
             date_trunc('month', occurred_at)::date as month_start,
             count(*)::int as conferences
           from conference_events
           where occurred_at >= $2::date
           group by 1
         ),
         reimbursement_monthly as (
           select
             date_trunc('month', coalesce(submitted_at, created_at))::date as month_start,
             count(*)::int as reimbursements
           from reimbursements
           where owner_id = $1 and coalesce(submitted_at, created_at) >= $2::date
           group by 1
         )
         select
           months.month_start,
           coalesce(publication_monthly.publications, 0)::int as publications,
           coalesce(publication_monthly.citations, 0)::int as citations,
           coalesce(conference_monthly.conferences, 0)::int as conferences,
           coalesce(reimbursement_monthly.reimbursements, 0)::int as reimbursements
         from months
         left join publication_monthly using (month_start)
         left join conference_monthly using (month_start)
         left join reimbursement_monthly using (month_start)
         order by months.month_start`,
        [userId, period.startMonth]
      ),
      db.query(
        `select status, count(*)::int as count
         from publications
         where owner_id = $1
         group by status
         order by count desc, status`,
        [userId]
      ),
      db.query(
        `select status, count(*)::int as count
         from reimbursements
         where owner_id = $1
         group by status
         order by count desc, status`,
        [userId]
      ),
      db.query(
        `select request_type as type, count(*)::int as count
         from reimbursements
         where owner_id = $1
         group by request_type
         order by count desc, request_type`,
        [userId]
      ),
      db.query(
        `select
           currency,
           coalesce(sum(amount), 0)::numeric(12, 2) as requested,
           coalesce(sum(amount) filter (where status in ('approved', 'paid')), 0)::numeric(12, 2) as approved
         from reimbursements
         where owner_id = $1 and amount is not null
         group by currency
         order by currency`,
        [userId]
      ),
    ]);

    const summaryRow = summaryResult.rows[0] || {};

    res.json({
      period,
      summary: {
        publicationsTotal: toNumber(summaryRow.publications_total),
        publicationsApproved: toNumber(summaryRow.publications_approved),
        publicationsInReview: toNumber(summaryRow.publications_in_review),
        publicationsDraft: toNumber(summaryRow.publications_draft),
        citationsTotal: toNumber(summaryRow.citations_total),
        conferencesTotal: toNumber(summaryRow.conferences_total),
        upcomingConferences: toNumber(summaryRow.upcoming_conferences),
        reimbursementsTotal: toNumber(summaryRow.reimbursements_total),
        reimbursementsInReview: toNumber(summaryRow.reimbursements_in_review),
        reimbursementsApproved: toNumber(summaryRow.reimbursements_approved),
        unreadNotifications: toNumber(summaryRow.unread_notifications),
        requestedAmounts: reimbursementAmountResult.rows.map((row) => ({
          currency: row.currency || "EUR",
          requested: toNumber(row.requested),
          approved: toNumber(row.approved),
        })),
      },
      monthly: monthlyResult.rows.map((row) => ({
        month: row.month_start,
        publikime: toNumber(row.publications),
        citime: toNumber(row.citations),
        konferenca: toNumber(row.conferences),
        rimbursime: toNumber(row.reimbursements),
      })),
      publicationsByStatus: mapStatusRows(publicationStatusResult.rows),
      reimbursementsByStatus: mapStatusRows(reimbursementStatusResult.rows),
      reimbursementsByType: reimbursementTypeResult.rows.map((row) => ({
        type: row.type || "unknown",
        count: toNumber(row.count),
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/professor/stats failed:", error);
    res.status(500).json({ error: "stats_failed" });
  }
});

export default router;
