import "./config/env.js";

import express from "express";
import session from "express-session";
import cors from "cors";
import { checkDbConnection } from "./config/db.js";
import passport from "./config/passport.js";
import authRoutes from "./routes/auth.js";
import doiRoutes from "./routes/doi.js";
import conferenceRoutes from "./routes/conferences.js";

const app = express();

const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
const callbackOrigin = process.env.GOOGLE_CALLBACK_URL
  ? new URL(process.env.GOOGLE_CALLBACK_URL).origin
  : null;

const allowedOrigins = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  process.env.CLIENT_URL,
  callbackOrigin,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null
].filter(Boolean));

app.set("trust proxy", 1);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "umibres-secret",
  resave: false,
  saveUninitialized: false,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax"
  }
}));

app.use(passport.initialize());
app.use(passport.session());

app.use(passport.initialize());
app.use(passport.session());

// Route bazë për test
app.get("/", (req, res) => {
  res.send("Backend running...");
});

// Keep the legacy route while the frontend and Vercel rewrites use /api/auth.
app.use("/auth", authRoutes);

// Route për autentifikim
app.use("/api/auth", authRoutes);

// Route për DOI metadata
app.use("/api/doi", doiRoutes);

// ✅ Route për konferenca
app.use("/api/conferences", conferenceRoutes);

const PORT = process.env.PORT || 5000;

if (!process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await checkDbConnection();
  });
}

export default app;
