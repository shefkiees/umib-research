# umib-research

## Database

The backend uses Supabase Postgres through `DATABASE_URL`.

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to the Supabase Postgres connection string. For Vercel or IPv4-only networks, use Supabase's pooler connection string instead of the direct `db.<project-ref>.supabase.co` string.
3. If the database password contains special URL characters such as `!`, `@`, or `#`, URL-encode the password in the connection string.
4. Apply the schema:

```bash
npm run db:schema
```

The schema is stored in `backend/db/schema.sql`.
