import "./env.js";

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import db from "./db.js";
import { getAbsoluteUrlEnvValue } from "./urlConfig.js";

const DEFAULT_GOOGLE_CALLBACK_PATH = "/api/auth/google/callback";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const configuredGoogleCallbackUrl = getAbsoluteUrlEnvValue(process.env.GOOGLE_CALLBACK_URL);

const googleCallbackUrl =
  process.env.NODE_ENV === "production" && configuredGoogleCallbackUrl
    ? configuredGoogleCallbackUrl
    : DEFAULT_GOOGLE_CALLBACK_PATH;

const googleAuthConfigured = Boolean(googleClientId && googleClientSecret);

const ALLOWED_EMAIL_DOMAIN = "umib.net";
const DEFAULT_ROLE = "professor";

console.log("Google OAuth callback URL:", googleCallbackUrl);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function isAllowedUniversityEmail(email) {
  return email.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

if (googleAuthConfigured) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: googleCallbackUrl,
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const profileEmails = Array.isArray(profile.emails) ? profile.emails : [];

          const emailEntry = profileEmails
            .map((entry) => ({
              value: normalizeEmail(entry?.value),
              verified: entry?.verified,
            }))
            .find((entry) => entry.value && isAllowedUniversityEmail(entry.value));

          const email = emailEntry?.value;

          if (!email) {
            return done(null, false, {
              message: "Only @umib.net email addresses are allowed.",
            });
          }

          const googleEmailVerified =
            profile?._json?.email_verified === true ||
            emailEntry?.verified === true;

          if (!googleEmailVerified) {
            return done(null, false, {
              message: "Google email address is not verified.",
            });
          }

          const googleHostedDomain = normalizeEmail(profile?._json?.hd);

          if (googleHostedDomain && googleHostedDomain !== ALLOWED_EMAIL_DOMAIN) {
            return done(null, false, {
              message: "Google hosted domain is not allowed.",
            });
          }

          if (!profile.id) {
            return done(null, false, {
              message: "Google profile ID is missing.",
            });
          }

          const fullName =
            String(profile.displayName || "").trim() ||
            String(profile?._json?.name || "").trim() ||
            email;

          const result = await db.query(
            `INSERT INTO users (
               google_id,
               email,
               full_name,
               password_hash,
               role,
               created_at,
               updated_at
             )
             VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
             ON CONFLICT (email)
             DO UPDATE SET
               google_id = EXCLUDED.google_id,
               full_name = EXCLUDED.full_name,
               updated_at = NOW()
             RETURNING id, google_id, email, full_name, role`,
            [
              profile.id,
              email,
              fullName,
              "GOOGLE_OAUTH_ACCOUNT",
              DEFAULT_ROLE,
            ]
          );

          const dbUser = result.rows[0];

          if (!dbUser) {
            return done(null, false, {
              message: "User could not be synchronized with database.",
            });
          }

          return done(null, {
            id: dbUser.id,
            googleId: dbUser.google_id,
            email: dbUser.email,
            displayName: dbUser.full_name,
            role: dbUser.role,
          });
        } catch (error) {
          console.error("Google OAuth database sync failed:", error);
          return done(error);
        }
      }
    )
  );
} else {
  console.error(
    "Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET."
  );
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const result = await db.query(
      `SELECT id, google_id, email, full_name, role
       FROM users
       WHERE id = $1
       LIMIT 1`,
      [id]
    );

    if (result.rowCount === 0) {
      return done(null, false);
    }

    const dbUser = result.rows[0];

    return done(null, {
      id: dbUser.id,
      googleId: dbUser.google_id,
      email: dbUser.email,
      displayName: dbUser.full_name,
      role: dbUser.role,
    });
  } catch (error) {
    return done(error);
  }
});

export { googleAuthConfigured };
export default passport;