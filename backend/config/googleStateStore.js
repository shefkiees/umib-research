import { randomBytes, timingSafeEqual } from "node:crypto";

export default class GoogleStateStore {
  store(req, callback) {
    if (!req.session) return callback(new Error("OAuth requires a session."));
    const nonce = randomBytes(32).toString("hex");
    const pending = { nonce, expiresAt: Date.now() + 10 * 60 * 1000 };
    if (!req.sessionStore?.issueOAuthState) return callback(new Error("OAuth requires an atomic state store."));
    req.session.save((error) => {
      if (error) return callback(error);
      req.sessionStore.issueOAuthState(req.sessionID, pending, (storeError) => {
        if (!storeError) req.session.googleOAuthState = pending;
        callback(storeError, nonce);
      });
    });
  }

  verify(req, supplied, callback) {
    if (!req.session) return callback(new Error("OAuth requires a session."));
    const pending = req.session.googleOAuthState;
    delete req.session.googleOAuthState;
    const valid = typeof supplied === "string" && /^[a-f0-9]{64}$/.test(supplied)
      && typeof pending?.nonce === "string" && /^[a-f0-9]{64}$/.test(pending.nonce) && pending.expiresAt > Date.now()
      && timingSafeEqual(Buffer.from(pending.nonce), Buffer.from(supplied));
    if (!req.sessionStore?.consumeOAuthState) return callback(new Error("OAuth requires an atomic state store."));
    req.sessionStore.consumeOAuthState(req.sessionID, pending?.nonce, (error, consumed) => {
      callback(error, Boolean(valid && consumed), { message: "Invalid authorization request state." });
    });
  }
}
