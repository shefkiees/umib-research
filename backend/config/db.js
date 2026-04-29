import "./env.js";
import mysql from "mysql2/promise";

const dbConfig = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD ?? "",
  database: process.env.DB_NAME || "umibres",
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT || 5000),
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

const db = mysql.createPool(dbConfig);

export async function checkDbConnection() {
  try {
    const connection = await db.getConnection();
    await connection.ping();
    connection.release();

    console.log(`Connected to MySQL at ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
    return true;
  } catch (error) {
    console.error(
      `Gabim ne lidhje me databazen (${dbConfig.host}:${dbConfig.port}/${dbConfig.database}):`,
      error
    );

    if (error.code === "ETIMEDOUT") {
      console.error(
        "MySQL po degjon ne porten 3306, por nuk po kthen handshake. Kontrollo XAMPP MySQL dhe restartoje sherbimin."
      );
    }

    return false;
  }
}

export default db;
