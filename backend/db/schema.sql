create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  google_id text unique,
  orcid_id text,
  email text not null unique,
  full_name text not null default '',
  password_hash text not null default '',
  role text not null default 'professor'
    check (role in ('professor', 'committee', 'prorector', 'admin')),
  status text not null default 'active'
    check (status in ('active', 'inactive', 'suspended')),
  academic_title text,
  scientific_title text,
  faculty text,
  department text,
  office text,
  orcid_profile jsonb not null default '{}'::jsonb,
  orcid_educations jsonb not null default '[]'::jsonb,
  orcid_employments jsonb not null default '[]'::jsonb,
  orcid_last_synced_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users add column if not exists orcid_id text;
alter table users add column if not exists academic_title text;
alter table users add column if not exists scientific_title text;
alter table users add column if not exists office text;
alter table users add column if not exists status text not null default 'active';
alter table users drop constraint if exists users_status_check;
alter table users add constraint users_status_check
check (status in ('active', 'inactive', 'suspended'));
alter table users add column if not exists orcid_profile jsonb not null default '{}'::jsonb;
alter table users add column if not exists orcid_educations jsonb not null default '[]'::jsonb;
alter table users add column if not exists orcid_employments jsonb not null default '[]'::jsonb;
alter table users add column if not exists orcid_last_synced_at timestamptz;
alter table users add column if not exists last_login_at timestamptz;
create index if not exists users_orcid_id_idx
  on users (orcid_id)
  where orcid_id is not null;

create table if not exists public.user_bank_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  label text not null default '',
  bank_applicant_name text not null default '',
  bank_name text not null default '',
  bank_account_number text not null default '',
  iban text not null default '',
  swift_code text not null default '',
  bank_country text not null default 'Kosove',
  currency text not null default 'EUR',
  is_default boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_bank_accounts add column if not exists id uuid default gen_random_uuid();
alter table public.user_bank_accounts add column if not exists user_id uuid references public.users(id) on delete cascade;
alter table public.user_bank_accounts add column if not exists label text not null default '';
alter table public.user_bank_accounts add column if not exists bank_applicant_name text not null default '';
alter table public.user_bank_accounts add column if not exists bank_name text not null default '';
alter table public.user_bank_accounts add column if not exists bank_account_number text not null default '';
alter table public.user_bank_accounts add column if not exists iban text not null default '';
alter table public.user_bank_accounts add column if not exists swift_code text not null default '';
alter table public.user_bank_accounts add column if not exists bank_country text not null default 'Kosove';
alter table public.user_bank_accounts add column if not exists currency text not null default 'EUR';
alter table public.user_bank_accounts add column if not exists is_default boolean not null default false;
alter table public.user_bank_accounts add column if not exists archived_at timestamptz;
alter table public.user_bank_accounts add column if not exists created_at timestamptz not null default now();
alter table public.user_bank_accounts add column if not exists updated_at timestamptz not null default now();

create index if not exists user_bank_accounts_user_active_idx
on public.user_bank_accounts (user_id, archived_at);

create unique index if not exists user_bank_accounts_one_active_default_idx
on public.user_bank_accounts (user_id)
where is_default = true
  and archived_at is null;

drop trigger if exists user_bank_accounts_set_updated_at on public.user_bank_accounts;
create trigger user_bank_accounts_set_updated_at
before update on public.user_bank_accounts
for each row execute function set_updated_at();

create table if not exists access_reset_requests (
  id bigserial primary key,
  user_id uuid references users(id) on delete set null,
  requested_email text not null,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed', 'rejected')),
  requester_ip text,
  user_agent text,
  handled_by uuid references users(id) on delete set null,
  handled_at timestamptz,
  notes text,
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table access_reset_requests add column if not exists user_id uuid references users(id) on delete set null;
alter table access_reset_requests add column if not exists requested_email text;
alter table access_reset_requests add column if not exists status text not null default 'pending';
alter table access_reset_requests add column if not exists requester_ip text;
alter table access_reset_requests add column if not exists user_agent text;
alter table access_reset_requests add column if not exists handled_by uuid references users(id) on delete set null;
alter table access_reset_requests add column if not exists handled_at timestamptz;
alter table access_reset_requests add column if not exists notes text;
alter table access_reset_requests add column if not exists requested_at timestamptz not null default now();
alter table access_reset_requests add column if not exists updated_at timestamptz not null default now();
alter table access_reset_requests drop constraint if exists access_reset_requests_status_check;
alter table access_reset_requests add constraint access_reset_requests_status_check
check (status in ('pending', 'in_progress', 'completed', 'rejected'));

create index if not exists access_reset_requests_status_idx
on access_reset_requests (status, requested_at desc);

create index if not exists access_reset_requests_user_id_idx
on access_reset_requests (user_id);

drop trigger if exists access_reset_requests_set_updated_at on access_reset_requests;
create trigger access_reset_requests_set_updated_at
before update on access_reset_requests
for each row execute function set_updated_at();

create table if not exists app_sessions (
  sid text primary key,
  data jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_sessions_expires_at_idx
on app_sessions (expires_at);

drop trigger if exists app_sessions_set_updated_at on app_sessions;
create trigger app_sessions_set_updated_at
before update on app_sessions
for each row execute function set_updated_at();

drop trigger if exists users_set_updated_at on users;
create trigger users_set_updated_at
before update on users
for each row execute function set_updated_at();

create table if not exists faculties (
  id bigserial primary key,
  code text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists faculties_set_updated_at on faculties;
create trigger faculties_set_updated_at
before update on faculties
for each row execute function set_updated_at();

create table if not exists departments (
  id bigserial primary key,
  faculty_id bigint not null references faculties(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (faculty_id, name)
);

drop trigger if exists departments_set_updated_at on departments;
create trigger departments_set_updated_at
before update on departments
for each row execute function set_updated_at();

create table if not exists conferences (
  id bigserial primary key,
  title text not null,
  acronym text,
  field text,
  location text,
  submission_deadline date,
  conference_date date,
  website text,
  status text not null default 'Interested'
    check (status in ('Interested', 'Planning', 'Submitted', 'Accepted', 'Attended', 'Completed')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table conferences add column if not exists status text not null default 'Interested';
alter table conferences drop constraint if exists conferences_status_check;
alter table conferences add constraint conferences_status_check
check (status in ('Interested', 'Planning', 'Submitted', 'Accepted', 'Attended', 'Completed'));

create index if not exists conferences_submission_deadline_idx
on conferences (submission_deadline);

create index if not exists conferences_created_by_idx
on conferences (created_by);

create index if not exists conferences_created_by_deadline_idx
on conferences (created_by, submission_deadline, created_at desc);

create index if not exists conferences_created_by_status_idx
on conferences (created_by, status);

drop trigger if exists conferences_set_updated_at on conferences;
create trigger conferences_set_updated_at
before update on conferences
for each row execute function set_updated_at();

create table if not exists publication_metadata (
  doi text primary key,
  title text not null default '',
  authors jsonb not null default '[]'::jsonb,
  container_title text not null default '',
  publisher text not null default '',
  published_date text not null default '',
  year integer,
  volume text not null default '',
  issue text not null default '',
  pages text not null default '',
  issn text not null default '',
  isbn text not null default '',
  type text not null default '',
  abstract text not null default '',
  source_url text not null default '',
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table publication_metadata add column if not exists issn text not null default '';
alter table publication_metadata add column if not exists isbn text not null default '';
alter table publication_metadata add column if not exists volume text not null default '';
alter table publication_metadata add column if not exists issue text not null default '';
alter table publication_metadata add column if not exists pages text not null default '';
alter table publication_metadata add column if not exists type text not null default '';
alter table publication_metadata add column if not exists abstract text not null default '';
alter table publication_metadata add column if not exists raw_json jsonb not null default '{}'::jsonb;
alter table publication_metadata alter column abstract drop not null;
alter table publication_metadata alter column abstract drop default;
alter table publication_metadata alter column pages drop not null;
alter table publication_metadata alter column pages drop default;
alter table publication_metadata alter column issn drop not null;
alter table publication_metadata alter column issn drop default;
alter table publication_metadata alter column isbn drop not null;
alter table publication_metadata alter column isbn drop default;

create index if not exists publication_metadata_year_idx
on publication_metadata (year);

drop trigger if exists publication_metadata_set_updated_at on publication_metadata;
create trigger publication_metadata_set_updated_at
before update on publication_metadata
for each row execute function set_updated_at();

create table if not exists publications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete set null,
  doi text,
  title text not null,
  abstract text not null default '',
  publication_type text not null default '',
  venue text,
  conference_location text not null default '',
  publisher text not null default '',
  publication_date date,
  publication_year integer,
  source_url text not null default '',
  volume text not null default '',
  issue text not null default '',
  pages text not null default '',
  issn text not null default '',
  isbn text not null default '',
  metadata_source text not null default 'manual',
  metadata_verified boolean not null default false,
  external_metadata_id text references publication_metadata(doi) on delete set null,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'in_review', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table publications drop constraint if exists publications_doi_fkey;
alter table publications add column if not exists abstract text not null default '';
alter table publications add column if not exists publication_type text not null default '';
alter table publications add column if not exists conference_location text not null default '';
alter table publications add column if not exists publisher text not null default '';
alter table publications add column if not exists publication_date date;
alter table publications add column if not exists source_url text not null default '';
alter table publications add column if not exists volume text not null default '';
alter table publications add column if not exists issue text not null default '';
alter table publications add column if not exists pages text not null default '';
alter table publications add column if not exists issn text not null default '';
alter table publications add column if not exists isbn text not null default '';
alter table publications add column if not exists author_affiliation text not null default '';
alter table publications add column if not exists indexing_platform text not null default '';
alter table publications add column if not exists indexing_category text not null default '';
alter table publications add column if not exists indexing_verified boolean not null default false;
alter table publications add column if not exists indexing_source text not null default 'manual';
alter table publications add column if not exists metadata_source text not null default 'manual';
alter table publications add column if not exists metadata_verified boolean not null default false;
alter table publications add column if not exists external_metadata_id text references publication_metadata(doi) on delete set null;
alter table publications add column if not exists metadata_review_status text not null default 'unchecked';
alter table publications add column if not exists metadata_review_checklist jsonb not null default '{}'::jsonb;
alter table publications add column if not exists metadata_review_comment text not null default '';
alter table publications add column if not exists revision_requested_by uuid references users(id) on delete set null;
alter table publications add column if not exists revision_requested_at timestamptz;
alter table publications add column if not exists resubmitted_at timestamptz;
alter table publications drop constraint if exists publications_status_check;
alter table publications add constraint publications_status_check
check (status in ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'needs_correction'));
alter table publications drop constraint if exists publications_metadata_review_status_check;
alter table publications add constraint publications_metadata_review_status_check
check (metadata_review_status in ('unchecked', 'in_review', 'ok', 'correction'));
alter table publications drop constraint if exists publications_indexing_source_check;
alter table publications add constraint publications_indexing_source_check
check (indexing_source in ('scopus', 'scimago', 'doaj', 'openalex', 'manual'));
alter table publications alter column abstract drop not null;
alter table publications alter column abstract drop default;
alter table publications alter column pages drop not null;
alter table publications alter column pages drop default;
alter table publications alter column issn drop not null;
alter table publications alter column issn drop default;
alter table publications alter column isbn drop not null;
alter table publications alter column isbn drop default;
alter table publications alter column author_affiliation drop not null;
alter table publications alter column author_affiliation drop default;

update publications p
set
  abstract = coalesce(nullif(p.abstract, ''), m.abstract, ''),
  publication_type = coalesce(nullif(p.publication_type, ''), m.type, ''),
  publisher = coalesce(nullif(p.publisher, ''), m.publisher, ''),
  publication_date = coalesce(
    p.publication_date,
    case
      when m.published_date ~ '^\d{4}-\d{1,2}-\d{1,2}$' then m.published_date::date
      when m.published_date ~ '^\d{4}-\d{1,2}$' then (m.published_date || '-01')::date
      when m.year is not null then make_date(m.year, 1, 1)
      else null
    end
  ),
  source_url = coalesce(nullif(p.source_url, ''), m.source_url, ''),
  volume = coalesce(nullif(p.volume, ''), m.volume, ''),
  issue = coalesce(nullif(p.issue, ''), m.issue, ''),
  pages = coalesce(nullif(p.pages, ''), m.pages, ''),
  issn = coalesce(nullif(p.issn, ''), m.issn, ''),
  isbn = coalesce(nullif(p.isbn, ''), m.isbn, ''),
  metadata_source = case when p.metadata_source = 'manual' and p.doi is not null then 'doi' else p.metadata_source end,
  metadata_verified = case when p.doi is not null then true else p.metadata_verified end,
  external_metadata_id = coalesce(p.external_metadata_id, p.doi)
from publication_metadata m
where p.doi = m.doi;

create index if not exists publications_owner_id_idx
on publications (owner_id);

create unique index if not exists publications_owner_doi_unique_idx
on publications (owner_id, doi)
where doi is not null;

create index if not exists publications_owner_updated_at_idx
on publications (owner_id, updated_at desc, created_at desc);

create index if not exists publications_owner_year_idx
on publications (owner_id, publication_year);

create index if not exists publications_owner_type_idx
on publications (owner_id, publication_type);

create index if not exists publications_metadata_review_status_idx
on publications (metadata_review_status, updated_at desc);

create table if not exists publication_review_history (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references publications(id) on delete cascade,
  previous_status text,
  status text not null,
  actor_id uuid references users(id) on delete set null,
  actor_role text,
  actor_name text,
  comment text not null default '',
  checklist jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table publication_review_history add column if not exists actor_role text;
alter table publication_review_history add column if not exists actor_name text;
alter table publication_review_history add column if not exists comment text not null default '';
alter table publication_review_history add column if not exists checklist jsonb not null default '{}'::jsonb;

create index if not exists publication_review_history_publication_idx
on publication_review_history (publication_id, created_at desc);

create index if not exists publication_review_history_actor_idx
on publication_review_history (actor_id);

create table if not exists publication_authors (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references publications(id) on delete cascade,
  full_name text not null default '',
  given_name text not null default '',
  family_name text not null default '',
  orcid text not null default '',
  affiliation text not null default '',
  is_main_author boolean not null default false,
  is_corresponding_author boolean not null default false,
  author_order integer not null default 0,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table publication_authors add column if not exists author_order integer not null default 0;
alter table publication_authors add column if not exists is_corresponding_author boolean not null default false;
alter table publication_authors alter column affiliation drop not null;
alter table publication_authors alter column affiliation drop default;
update publication_authors
set author_order = position
where author_order = 0 and position > 0;

update publication_authors
set is_main_author = author_order = 1
where author_order > 0;

create index if not exists publication_authors_publication_idx
on publication_authors (publication_id, author_order, position, created_at);

create table if not exists publication_identifiers (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references publications(id) on delete cascade,
  identifier_type text not null,
  identifier_value text not null,
  created_at timestamptz not null default now(),
  unique (publication_id, identifier_type, identifier_value)
);

create index if not exists publication_identifiers_publication_idx
on publication_identifiers (publication_id);

create table if not exists publication_indexing (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references publications(id) on delete cascade,
  source text not null default '',
  source_key text not null default 'manual',
  category text not null default '',
  quartile text not null default '',
  impact_factor text not null default '',
  sjr text not null default '',
  cite_score text,
  indexed_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table publication_indexing add column if not exists source_key text not null default 'manual';
alter table publication_indexing add column if not exists category text not null default '';
alter table publication_indexing add column if not exists sjr text not null default '';
alter table publication_indexing add column if not exists cite_score text;
alter table publication_indexing alter column cite_score drop not null;
alter table publication_indexing alter column cite_score drop default;

create index if not exists publication_indexing_publication_idx
on publication_indexing (publication_id);

create table if not exists publication_attachments (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references publications(id) on delete cascade,
  file_url text not null default '',
  file_type text not null default '',
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists publication_attachments_publication_idx
on publication_attachments (publication_id, uploaded_at desc);

drop trigger if exists publication_authors_set_updated_at on publication_authors;
create trigger publication_authors_set_updated_at
before update on publication_authors
for each row execute function set_updated_at();

drop trigger if exists publication_indexing_set_updated_at on publication_indexing;
create trigger publication_indexing_set_updated_at
before update on publication_indexing
for each row execute function set_updated_at();

insert into publication_authors (publication_id, full_name, is_main_author, author_order, position)
select p.id, trim(both '"' from author_item.value::text), author_item.author_position = 1, author_item.author_position, author_item.author_position
from publications p
join publication_metadata m on m.doi = p.doi
cross join lateral jsonb_array_elements(m.authors) with ordinality as author_item(value, author_position)
where not exists (
  select 1
  from publication_authors pa
  where pa.publication_id = p.id
)
and jsonb_typeof(author_item.value) = 'string';

update publications p
set publication_type = case replace(lower(m.type), '-', '_')
  when 'article_journal' then 'journal_article'
  when 'journal_article' then 'journal_article'
  when 'proceedings_article' then 'conference_paper'
  when 'conference_paper' then 'conference_paper'
  when 'book' then 'book'
  when 'book_chapter' then 'book'
  when 'chapter' then 'book'
  when 'posted_content' then ''
  when 'preprint' then ''
  when 'accepted_in_press' then ''
  else publication_type
end
from publication_metadata m
where m.doi = coalesce(p.external_metadata_id, p.doi)
  and (
    nullif(p.publication_type, '') is null
    or p.publication_type = m.type
    or p.publication_type not in ('journal_article', 'conference_paper', 'book')
  );

insert into publication_authors
  (publication_id, full_name, given_name, family_name, orcid, affiliation, is_main_author, author_order, position)
select
  p.id,
  coalesce(nullif(author_item.value->>'fullName', ''), nullif(author_item.value->>'full_name', ''), nullif(author_item.value->>'name', ''), trim(both '"' from author_item.value::text)),
  coalesce(author_item.value->>'givenName', author_item.value->>'given_name', ''),
  coalesce(author_item.value->>'familyName', author_item.value->>'family_name', ''),
  regexp_replace(coalesce(author_item.value->>'orcid', ''), '^https?://orcid\.org/', ''),
  coalesce(author_item.value->>'affiliation', ''),
  author_item.author_position = 1,
  author_item.author_position,
  author_item.author_position
from publications p
join publication_metadata m on m.doi = coalesce(p.external_metadata_id, p.doi)
cross join lateral jsonb_array_elements(m.authors) with ordinality as author_item(value, author_position)
where not exists (
  select 1
  from publication_authors pa
  where pa.publication_id = p.id
)
and jsonb_typeof(author_item.value) = 'object';

drop trigger if exists publications_set_updated_at on publications;
create trigger publications_set_updated_at
before update on publications
for each row execute function set_updated_at();

create table if not exists reimbursements (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete set null,
  publication_id uuid references publications(id) on delete set null,
  conference_id bigint references conferences(id) on delete set null,
  title text not null,
  amount numeric(12, 2),
  currency text not null default 'EUR',
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'received', 'in_review', 'needs_correction', 'committee_approved', 'approved', 'rejected', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reimbursements_owner_id_idx
on reimbursements (owner_id);

alter table reimbursements add column if not exists request_type text not null default 'publication';
alter table reimbursements add column if not exists request_data jsonb not null default '{}'::jsonb;
alter table reimbursements add column if not exists document_number text;
alter table reimbursements add column if not exists document_filename text;
alter table reimbursements add column if not exists document_docx_filename text;
alter table reimbursements add column if not exists generated_pdf bytea;
alter table reimbursements add column if not exists generated_docx bytea;
alter table reimbursements add column if not exists submitted_at timestamptz;

alter table reimbursements drop constraint if exists reimbursements_status_check;
alter table reimbursements add constraint reimbursements_status_check
check (status in ('draft', 'submitted', 'received', 'in_review', 'needs_correction', 'committee_approved', 'approved', 'rejected', 'paid'));

create index if not exists reimbursements_request_type_idx
on reimbursements (request_type);

create table if not exists reimbursement_status_history (
  id uuid primary key default gen_random_uuid(),
  reimbursement_id uuid not null references reimbursements(id) on delete cascade,
  previous_status text
    check (previous_status is null or previous_status in ('draft', 'submitted', 'received', 'in_review', 'needs_correction', 'committee_approved', 'approved', 'rejected', 'paid')),
  status text not null
    check (status in ('draft', 'submitted', 'received', 'in_review', 'needs_correction', 'committee_approved', 'approved', 'rejected', 'paid')),
  actor_id uuid references users(id) on delete set null,
  actor_role text,
  actor_name text,
  note text,
  created_at timestamptz not null default now()
);

alter table reimbursement_status_history add column if not exists actor_role text;
alter table reimbursement_status_history add column if not exists actor_name text;

create index if not exists reimbursement_status_history_reimbursement_idx
on reimbursement_status_history (reimbursement_id, created_at);

create index if not exists reimbursement_status_history_actor_idx
on reimbursement_status_history (actor_id);

insert into reimbursement_status_history
  (reimbursement_id, previous_status, status, actor_id, note, created_at)
select
  r.id,
  null,
  r.status,
  r.owner_id,
  'Statusi fillestar u regjistrua nga skema.',
  coalesce(r.submitted_at, r.created_at, now())
from reimbursements r
where not exists (
  select 1
  from reimbursement_status_history h
  where h.reimbursement_id = r.id
);

create table if not exists reimbursement_attachments (
  id uuid primary key default gen_random_uuid(),
  reimbursement_id uuid not null references reimbursements(id) on delete cascade,
  uploaded_by uuid references users(id) on delete set null,
  filename text not null,
  mime_type text not null,
  size_bytes integer not null default 0,
  content bytea not null,
  created_at timestamptz not null default now()
);

create index if not exists reimbursement_attachments_reimbursement_idx
on reimbursement_attachments (reimbursement_id, created_at);

drop trigger if exists reimbursements_set_updated_at on reimbursements;
create trigger reimbursements_set_updated_at
before update on reimbursements
for each row execute function set_updated_at();

create table if not exists approval_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('publication', 'reimbursement', 'conference')),
  entity_id text not null,
  actor_id uuid references users(id) on delete set null,
  action text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists approval_events_entity_idx
on approval_events (entity_type, entity_id);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  title text not null,
  message text not null,
  category text,
  metadata jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table notifications add column if not exists metadata jsonb not null default '{}'::jsonb;

create index if not exists notifications_user_id_idx
on notifications (user_id, is_read, created_at desc);

create index if not exists notifications_metadata_publication_idx
on notifications ((metadata->>'publicationId'))
where metadata ? 'publicationId';

create table if not exists admin_journals (
  id uuid primary key default gen_random_uuid(),
  issn text not null default '',
  name text not null,
  publisher text not null default '',
  quartile text not null default '',
  wos_category text not null default '',
  ceeol boolean not null default false,
  is_predatory boolean not null default false,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table admin_journals add column if not exists issn text not null default '';
alter table admin_journals add column if not exists name text not null default '';
alter table admin_journals add column if not exists publisher text not null default '';
alter table admin_journals add column if not exists quartile text not null default '';
alter table admin_journals add column if not exists wos_category text not null default '';
alter table admin_journals add column if not exists ceeol boolean not null default false;
alter table admin_journals add column if not exists is_predatory boolean not null default false;
alter table admin_journals add column if not exists created_by uuid references users(id) on delete set null;
alter table admin_journals add column if not exists created_at timestamptz not null default now();
alter table admin_journals add column if not exists updated_at timestamptz not null default now();

create index if not exists admin_journals_search_idx
on admin_journals (lower(name), lower(issn));

drop trigger if exists admin_journals_set_updated_at on admin_journals;
create trigger admin_journals_set_updated_at
before update on admin_journals
for each row execute function set_updated_at();

create table if not exists admin_system_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_by uuid references users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table admin_system_settings add column if not exists value jsonb not null default '{}'::jsonb;
alter table admin_system_settings add column if not exists updated_by uuid references users(id) on delete set null;
alter table admin_system_settings add column if not exists updated_at timestamptz not null default now();

create table if not exists user_preferences (
  user_id uuid primary key references users(id) on delete cascade,
  email_notifications boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table audit_logs add column if not exists actor_id uuid references users(id) on delete set null;
alter table audit_logs add column if not exists action text;
alter table audit_logs add column if not exists entity_type text;
alter table audit_logs add column if not exists entity_id text;
alter table audit_logs add column if not exists metadata jsonb not null default '{}'::jsonb;
alter table audit_logs add column if not exists created_at timestamptz not null default now();

create index if not exists audit_logs_entity_idx
on audit_logs (entity_type, entity_id);

create index if not exists audit_logs_created_at_idx
on audit_logs (created_at desc);

create index if not exists audit_logs_action_idx
on audit_logs (action, created_at desc);

alter table users enable row level security;
alter table user_bank_accounts enable row level security;
alter table faculties enable row level security;
alter table departments enable row level security;
alter table conferences enable row level security;
alter table publication_metadata enable row level security;
alter table publications enable row level security;
alter table publication_authors enable row level security;
alter table publication_identifiers enable row level security;
alter table publication_indexing enable row level security;
alter table publication_attachments enable row level security;
alter table publication_review_history enable row level security;
alter table reimbursements enable row level security;
alter table reimbursement_status_history enable row level security;
alter table reimbursement_attachments enable row level security;
alter table approval_events enable row level security;
alter table notifications enable row level security;
alter table admin_journals enable row level security;
alter table admin_system_settings enable row level security;
alter table user_preferences enable row level security;
alter table audit_logs enable row level security;
