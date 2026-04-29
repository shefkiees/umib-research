# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Google OAuth Redirect URI setup

This project starts Google sign-in from `/api/auth/google` and, in production, defaults to the canonical `https://umibres.page` host for the OAuth flow. Google must allow these exact callback URLs:

- `http://localhost:5000/api/auth/google/callback`
- `https://umibres.page/api/auth/google/callback`

Add both of them in Google Cloud Console:

1. Open `APIs & Services` -> `Credentials`
2. Open the OAuth 2.0 client used by this app
3. Under `Authorized redirect URIs`, add both URLs above

Important:

- In production, the frontend now starts Google sign-in from `https://umibres.page/api/auth/google` by default, even if the page was opened from another host.
- The backend now falls back to `https://umibres.page/api/auth/google/callback` in production unless `GOOGLE_CALLBACK_URL` is explicitly set.
- The backend logs the callback URL it sends to Google as `Google OAuth callback URL:`. If sign-in still fails, copy that exact URL and add it under `Authorized redirect URIs`.

Optional environment variables:

- `VITE_API_BASE_URL` for a custom frontend -> backend API host
- `FRONTEND_URL` for the post-login redirect target
- `GOOGLE_CALLBACK_URL` only if production must use a custom absolute callback URL

When adding `FRONTEND_URL` or `GOOGLE_CALLBACK_URL` in Vercel, the value must be only the URL.
Example:

- `FRONTEND_URL` -> `https://www.umibres.page`
- `GOOGLE_CALLBACK_URL` -> `https://www.umibres.page/api/auth/google/callback`

Do not paste `GOOGLE_CALLBACK_URL=https://...` into the value field, because Google will treat that as an invalid redirect URI.

Required production environment variables:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `SESSION_SECRET`

If `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET` is missing in production, the app now redirects back to `/login?authError=oauth_not_configured` instead of failing with a generic `500`.
