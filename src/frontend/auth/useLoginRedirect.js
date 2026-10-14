import { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export function useLoginRedirect() {
  const navigate = useNavigate();
  const mounted = useRef(false);
  const redirected = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  return useCallback(() => {
    if (!mounted.current || redirected.current) return;
    redirected.current = true;
    navigate("/login", { replace: true });
  }, [navigate]);
}
