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
  faculty text,
  department text,
  office text,
  orcid_profile jsonb not null default '{}'::jsonb,
  orcid_educations jsonb not null default '[]'::jsonb,
  orcid_employments jsonb not null default '[]'::jsonb,
  orcid_last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users add column if not exists orcid_id text;
alter table users add column if not exists office text;
alter table users add column if not exists orcid_profile jsonb not null default '{}'::jsonb;
alter table users add column if not exists orcid_educations jsonb not null default '[]'::jsonb;
alter table users add column if not exists orcid_employments jsonb not null default '[]'::jsonb;
alter table users add column if not exists orcid_last_synced_at timestamptz;
create index if not exists users_orcid_id_idx
  on users (orcid_id)
  where orcid_id is not null;

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
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists conferences_submission_deadline_idx
on conferences (submission_deadline);

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
  type text not null default '',
  abstract text not null default '',
  source_url text not null default '',
  raw_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publication_metadata_year_idx
on publication_metadata (year);

drop trigger if exists publication_metadata_set_updated_at on publication_metadata;
create trigger publication_metadata_set_updated_at
before update on publication_metadata
for each row execute function set_updated_at();

create table if not exists publications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references users(id) on delete set null,
  doi text references publication_metadata(doi) on delete set null,
  title text not null,
  venue text,
  publication_year integer,
  status text not null default 'draft'
    check (status in ('draft', 'submitted', 'in_review', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists publications_owner_id_idx
on publications (owner_id);

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
    check (status in ('draft', 'submitted', 'in_review', 'approved', 'rejected', 'paid')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reimbursements_owner_id_idx
on reimbursements (owner_id);

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
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx
on notifications (user_id, is_read, created_at desc);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references users(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_entity_idx
on audit_logs (entity_type, entity_id);

alter table users enable row level security;
alter table faculties enable row level security;
alter table departments enable row level security;
alter table conferences enable row level security;
alter table publication_metadata enable row level security;
alter table publications enable row level security;
alter table reimbursements enable row level security;
alter table approval_events enable row level security;
alter table notifications enable row level security;
alter table audit_logs enable row level security;
