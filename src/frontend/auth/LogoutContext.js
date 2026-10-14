import { createContext, useContext } from "react";

export const LogoutContext = createContext(null);
export function useLogout() {
  return useContext(LogoutContext);
}
