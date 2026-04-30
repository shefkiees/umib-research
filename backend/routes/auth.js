import express from "express";
import passport from "../config/passport.js";
import { googleAuthConfigured } from "../config/passport.js";
import { getAbsoluteUrlEnvValue } from "../config/urlConfig.js";

const router = express.Router();
const isProduction = process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
const LOGIN_ROUTE = "/login";
const PROFESSOR_DASHBOARD_ROUTE = "/professor/dashboard";
const DASHBOARD_BY_ROLE = {
  admin: "/prorector/dashboard",
  committee: "/committee/dashboard",
  professor: PROFESSOR_DASHBOARD_ROUTE,
  prorector: "/prorector/dashboard"
};
const configuredClientUrl = getAbsoluteUrlEnvValue(process.env.CLIENT_URL);
const configuredGoogleCallbackUrl = getAbsoluteUrlEnvValue(process.env.GOOGLE_CALLBACK_URL);

function getRequestOrigin(req) {
  const forwardedProto = req.get("x-forwarded-proto");
  const forwardedHost = req.get("x-forwarded-host");
  const host = forwardedHost || req.get("host");

  if (!host) {
    return null;
  }

  return `${forwardedProto || "https"}://${host}`;
}

function isLocalOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
}

function getAppOrigin(req) {
  if (!isProduction) {
    return configuredClientUrl || "http://localhost:5173";
  }

  const requestOrigin = getRequestOrigin(req);

  if (requestOrigin && !isLocalOrigin(requestOrigin)) {
    return requestOrigin;
  }

  if (configuredClientUrl) {
    return configuredClientUrl;
  }

  if (configuredGoogleCallbackUrl) {
    return new URL(configuredGoogleCallbackUrl).origin;
  }

  return requestOrigin || null;
}

function getClientUrl(req) {
  return getAppOrigin(req);
}

function getGoogleCallbackUrl(req) {
  if (!isProduction && configuredGoogleCallbackUrl) {
    return configuredGoogleCallbackUrl;
  }

  const appOrigin = getAppOrigin(req);

  if (appOrigin) {
    return `${appOrigin}/api/auth/google/callback`;
  }

  return "http://localhost:5000/api/auth/google/callback";
}

const redirectToLoginWithError = (res, authError, req) => {
  res.redirect(`${getClientUrl(req)}${LOGIN_ROUTE}?authError=${encodeURIComponent(authError)}`);
};

const getCallbackErrorCode = (error) => {
  const errorCode = String(error?.code || "");

  if (errorCode.startsWith("ER_") || errorCode.startsWith("23")) {
    return "db_user_sync_failed";
  }

  return "oauth_callback_failed";
};

router.get("/me", (req, res) => {
  if (!req.isAuthenticated?.() || !req.user) {
    res.status(401).json({ user: null });
    return;
  }

  res.json({ user: req.user });
});

router.post("/logout", (req, res) => {
  req.logout((error) => {
    if (error) {
      res.status(500).json({ error: "logout_failed" });
      return;
    }

    req.session?.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });
});

router.get("/google", (req, res, next) => {
  if (!googleAuthConfigured) {
    redirectToLoginWithError(res, "oauth_not_configured", req);
    return;
  }

  passport.authenticate("google", {
    scope: ["profile", "email"],
    callbackURL: getGoogleCallbackUrl(req)
  })(req, res, next);
});

router.get("/google/callback", (req, res, next) => {
  console.log("CALLBACK HIT");

  passport.authenticate("google", {
    callbackURL: getGoogleCallbackUrl(req)
  }, (error, user, info) => {
    if (error) {
      console.error("Google OAuth callback failed:", error);
      redirectToLoginWithError(res, getCallbackErrorCode(error), req);
      return;
    }

    if (!user) {
      const authError = info?.message?.includes("@umib.net")
        ? "unauthorized_domain"
        : "google_login_failed";

      redirectToLoginWithError(res, authError, req);
      return;
    }

    req.logIn(user, (loginError) => {
      if (loginError) {
        console.error("Creating session after Google login failed:", loginError);
        redirectToLoginWithError(res, "session_login_failed", req);
        return;
      }

      const dashboardRoute = DASHBOARD_BY_ROLE[user.role] || PROFESSOR_DASHBOARD_ROUTE;

      console.log("LOGIN SUCCESS");
      res.redirect(`${getClientUrl(req)}${dashboardRoute}`);
    });
  })(req, res, next);
});

export default router;
