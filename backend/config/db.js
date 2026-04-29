import "./env.js";

import pg from "pg";

const { Pool } = pg;

const SUPABASE_HOST_PATTERN = /@((?:db\.[^:/?#]+\.supabase\.co)|(?:[^:/?#]+\.pooler\.supabase\.com))(?::(\d+))?\//i;

function encodePossiblyRawPassword(connectionString) {
  if (!connectionString) {
    return "";
  }

  try {
    const parsedUrl = new URL(connectionString);

    if (
      connectionString.toLowerCase().includes(".supabase.co")
      && !parsedUrl.hostname.toLowerCase().includes(".supabase.co")
    ) {
      throw new Error("Supabase hostname was parsed as part of the password.");
    }

    return connectionString;
  } catch {
    const match = connectionString.match(SUPABASE_HOST_PATTERN);

    if (!match) {
      return connectionString;
    }

    const hostMarker = `@${match[1]}${match[2] ? `:${match[2]}` : ""}/`;
    const hostIndex = connectionString.lastIndexOf(hostMarker);
    const credentialsEnd = hostIndex;
    const credentialsStart = connectionString.indexOf("//") + 2;
    const credentials = connectionString.slice(credentialsStart, credentialsEnd);
    const separatorIndex = credentials.indexOf(":");

    if (separatorIndex === -1) {
      return connectionString;
    }

    const protocolAndUser = connectionString.slice(0, credentialsStart + separatorIndex + 1);
    const rawPassword = credentials.slice(separatorIndex + 1);
    const suffix = connectionString.slice(hostIndex);

    return `${protocolAndUser}${encodeURIComponent(rawPassword)}${suffix}`;
  }
}

const rawConnectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || "";
const connectionString = encodePossiblyRawPassword(rawConnectionString);
const hasConnectionString = Boolean(connectionString);
const shouldUseSsl =
  process.env.DB_SSL === "true"
  || /\.supabase\.co/i.test(connectionString)
  || /\.pooler\.supabase\.com/i.test(connectionString);

const dbConfig = hasConnectionString
  ? {
      connectionString,
      ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DB_CONNECTION_LIMIT || 10),
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT || 5000)
    }
  : {
      host: process.env.DB_HOST || "127.0.0.1",
      port: Number(process.env.DB_PORT || 5432),
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD ?? "",
      database: process.env.DB_NAME || "postgres",
      ssl: shouldUseSsl ? { rejectUnauthorized: false } : undefined,
      max: Number(process.env.DB_CONNECTION_LIMIT || 10),
      connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT || 5000)
    };

const db = new Pool(dbConfig);

function getConnectionDescription() {
  if (hasConnectionString) {
    try {
      const url = new URL(connectionString);
      return `${url.hostname}:${url.port || 5432}${url.pathname}`;
    } catch {
      return "configured Postgres database";
    }
  }

  return `${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`;
}

export async function checkDbConnection() {
  try {
    const result = await db.query("select current_database() as database, current_user as user");
    const row = result.rows[0];

    console.log(`Connected to Postgres at ${getConnectionDescription()} as ${row.user}/${row.database}`);
    return true;
  } catch (error) {
    console.error(`Database connection failed (${getConnectionDescription()}):`, error);
    return false;
  }
}

export default db;
