import "./env.js";

import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
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

console.log("Google OAuth callback URL:", googleCallbackUrl);

if (googleAuthConfigured) {
  passport.use(new GoogleStrategy(
    {
      clientID: googleClientId,
      clientSecret: googleClientSecret,
      callbackURL: googleCallbackUrl,
      proxy: true
    },
    async (accessToken, refreshToken, profile, done) => {
      console.log("Google profile object:", profile);
      console.log("Google ID:", profile.id);
      console.log("Emails:", profile.emails);
      console.log("Display Name:", profile.displayName);

      const profileEmails = Array.isArray(profile.emails) ? profile.emails : [];
      const email = profileEmails
        .map((entry) => entry?.value?.trim().toLowerCase())
        .find((value) => value?.endsWith("@umib.net"));

      if (!email) {
        return done(null, false, { message: "Google account did not provide an email address." });
      }

      if (!email.endsWith("@umib.net")) {
        return done(null, false, { message: "Only @umib.net email addresses are allowed." });
      }

      const user = {
        id: profile.id,
        email,
        displayName: profile.displayName,
        role: "professor"
      };

      return done(null, user);
    }
  ));
} else {
  console.error(
    "Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET."
  );
}

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

export { googleAuthConfigured };
export default passport;
