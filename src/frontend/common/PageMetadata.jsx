import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ORIGIN = "https://www.umibres.page";
const PUBLIC_PAGES = {
  "/": {
    title: "UMIBRes | Platforma e Kërkimit Shkencor",
    description: "UMIBRes është platforma e kërkimit shkencor e Universitetit 'Isa Boletini' në Mitrovicë, për menaxhimin e publikimeve, konferencave dhe aktiviteteve akademike.",
  },
  "/privacy": {
    title: "Politika e Privatësisë | UMIBRes",
    description: "Politika e privatësisë dhe mbrojtja e të dhënave personale në platformën UMIBRes.",
  },
  "/terms": {
    title: "Kushtet e Përdorimit | UMIBRes",
    description: "Kushtet e përdorimit të platformës së kërkimit shkencor UMIBRes.",
  },
};

export default function PageMetadata() {
  const { pathname } = useLocation();

  useEffect(() => {
    const path = pathname.replace(/\/+$/, "") || "/";
    const page = PUBLIC_PAGES[path];
    document.title = page?.title || "UMIBRes";
    document.querySelector('meta[name="robots"]').content = page ? "index, follow" : "noindex, nofollow";

    for (const [selector, value] of [
      ['meta[name="description"]', page?.description],
      ['meta[property="og:title"]', page?.title],
      ['meta[property="og:description"]', page?.description],
      ['meta[property="og:url"]', page ? `${ORIGIN}${path}` : null],
    ]) {
      document.querySelector(selector).content = value || "";
    }

    const canonical = document.querySelector('link[rel="canonical"]');
    if (page) canonical.setAttribute("href", `${ORIGIN}${path}`);
    else canonical.removeAttribute("href");
  }, [pathname]);

  return null;
}
