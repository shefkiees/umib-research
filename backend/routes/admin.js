import express from "express";
import { syncMissingSupabaseAuthUsers } from "../services/supabaseAuthSync.service.js";

const router = express.Router();

function requireAdmin(req, res, next) {
  if (!req.isAuthenticated?.() || !req.user?.id) {
    res.status(401).json({ error: "unauthenticated" });
    return;
  }

  if (req.user.role !== "admin") {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  next();
}

router.post("/auth-sync", requireAdmin, async (req, res) => {
  try {
    const summary = await syncMissingSupabaseAuthUsers({
      dryRun: req.body?.dryRun !== false,
      mode: req.body?.mode,
      roles: req.body?.roles,
    });

    res.json(summary);
  } catch (error) {
    console.error("POST /api/admin/auth-sync failed:", {
      message: error?.message,
      code: error?.code,
      status: error?.status,
    });
    res.status(500).json({
      error: "auth_sync_failed",
      message: error?.message || "Auth sync failed.",
    });
  }
});

export default router;
