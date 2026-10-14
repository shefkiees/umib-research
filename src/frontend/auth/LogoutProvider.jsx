import { useEffect, useRef, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { authClient } from "./authClient.js";
import { LogoutContext } from "./LogoutContext.js";
import { useLanguage } from "../i18n/LanguageContext";
import "./LogoutProvider.css";

export default function LogoutProvider({ children }) {
  const { language } = useLanguage();
  const english = language === "en";
  const location = useLocation();
  const navigate = useNavigate();
  const notificationConsumed = useRef(false);
  const [showSuccess, setShowSuccess] = useState(() =>
    window.location.pathname === "/" && new URLSearchParams(window.location.search).get("loggedOut") === "1"
  );
  const pending = useRef(false);
  const requestController = useRef(null);
  const [status, setStatus] = useState("idle");
  useEffect(() => () => requestController.current?.abort(), []);
  useEffect(() => {
    if (!showSuccess || notificationConsumed.current) return;
    notificationConsumed.current = true;
    // Consume the notification marker so refresh and history cannot replay it.
    const params = new URLSearchParams(location.search);
    params.delete("loggedOut");
    navigate({ pathname: "/", search: params.toString(), hash: location.hash }, { replace: true });
  }, [showSuccess, location.search, location.hash, navigate]);
  useEffect(() => {
    if (!showSuccess) return;
    const timer = setTimeout(() => setShowSuccess(false), 4000);
    return () => clearTimeout(timer);
  }, [showSuccess]);

  const logout = async () => {
    if (pending.current) return;
    pending.current = true;
    const controller = new AbortController();
    requestController.current = controller;
    setStatus("pending");
    try {
      await authClient.logout(controller.signal);
    } catch {
      if (!controller.signal.aborted) setStatus("error");
      return;
    } finally {
      pending.current = false;
      requestController.current = null;
    }
    if (controller.signal.aborted) return;
    // Reload clears dashboard state and prevents old callbacks from navigating after logout.
    for (const storage of ["localStorage", "sessionStorage"]) {
      try { window[storage].removeItem("authToken"); } catch { /* Storage may be unavailable. */ }
    }
    window.location.replace("/?loggedOut=1");
  };

  return (
    <LogoutContext.Provider value={logout}>
      <div style={{ display: "contents" }} inert={status === "pending"}>{children}</div>
      {showSuccess && location.pathname === "/" && (
        <div className="logout-toast" role="status" aria-live="polite" aria-atomic="true">
          <CheckCircle2 size={20} aria-hidden="true" />
          <span>{english ? "You have signed out successfully." : "Keni dalë me sukses nga platforma."}</span>
        </div>
      )}
      {status !== "idle" && (
        <div className="logout-overlay">
          <section className="logout-dialog" role="dialog" aria-modal="true" aria-labelledby="logout-title" aria-busy={status === "pending"}>
            <h2 id="logout-title">{english ? "Sign out" : "Dil nga platforma"}</h2>
            {status === "pending" ? (
              <p role="status">{english ? "Signing out..." : "Duke dalë nga platforma..."}</p>
            ) : (
              <>
                <p role="alert">{english ? "Sign out could not be confirmed. Please try again." : "Dalja nuk u konfirmua. Ju lutemi provoni përsëri."}</p>
                <button type="button" onClick={logout} autoFocus><RefreshCw size={18} />{english ? "Try again" : "Provo përsëri"}</button>
                <button type="button" onClick={() => setStatus("idle")}>{english ? "Close" : "Mbyll"}</button>
              </>
            )}
          </section>
        </div>
      )}
    </LogoutContext.Provider>
  );
}
