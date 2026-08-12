import { Link } from "react-router-dom";
import UMIBLogo from "../assets/umiblogo.jpg";
import TransparentLogo from "./common/TransparentLogo";
import "./LegalPage.css";

const CONTACT_EMAIL = "shefkie.segashi@umib.net";

const pages = {
  privacy: {
    title: "Politika e Privatësisë",
    updatedAt: "Përditësuar së fundi: 12 gusht 2026",
    intro:
      "UMIBRes përdoret për menaxhimin e profileve akademike, publikimeve, konferencave dhe kërkesave për rimbursim në Universitetin \"Isa Boletini\" Mitrovicë.",
    sections: [
      {
        title: "Të dhënat që mund të përpunohen",
        body:
          "Platforma mund të përpunojë të dhëna të profilit si emri, emaili, roli, fakulteti, departamenti dhe të dhëna akademike të lidhura me publikime, konferenca, dokumente mbështetëse dhe kërkesa institucionale.",
      },
      {
        title: "Si përdoren të dhënat",
        body:
          "Të dhënat përdoren për autentikim, menaxhim të profilit akademik, administrim të publikimeve dhe konferencave, shqyrtim të kërkesave për rimbursim, raportim institucional dhe siguri të sistemit.",
      },
      {
        title: "Kyçja me Google",
        body:
          "Nëse përdoret Google OAuth, UMIBRes e përdor atë për të verifikuar identitetin dhe emailin e përdoruesit. Të dhënat nuk shiten dhe nuk përdoren për reklamim.",
      },
      {
        title: "Ndarja e të dhënave",
        body:
          "Të dhënat mund të jenë të qasshme vetëm për role të autorizuara brenda institucionit, sipas nevojës për administrim, shqyrtim dhe raportim. Të dhënat mund të ndahen edhe kur kërkohet nga ligji ose nga detyrimet institucionale.",
      },
      {
        title: "Ruajtja dhe siguria",
        body:
          "UMIBRes zbaton masa teknike dhe organizative për mbrojtjen e të dhënave. Të dhënat ruhen për aq kohë sa janë të nevojshme për qëllimet akademike, administrative dhe ligjore të institucionit.",
      },
    ],
  },
  terms: {
    title: "Kushtet e Përdorimit",
    updatedAt: "Përditësuar së fundi: 12 gusht 2026",
    intro:
      "Duke përdorur UMIBRes, përdoruesi pajtohet që platforma të përdoret vetëm për qëllime akademike, administrative dhe institucionale të Universitetit \"Isa Boletini\" Mitrovicë.",
    sections: [
      {
        title: "Përdorimi i platformës",
        body:
          "UMIBRes shërben për evidentimin e profileve akademike, publikimeve, konferencave, dokumenteve mbështetëse dhe proceseve të rimbursimit ose shqyrtimit institucional.",
      },
      {
        title: "Përgjegjësia e përdoruesit",
        body:
          "Përdoruesi është përgjegjës për saktësinë e të dhënave që vendos në platformë, për ruajtjen e llogarisë së tij dhe për përdorimin e sistemit në përputhje me rregullat institucionale.",
      },
      {
        title: "Dokumentet dhe kërkesat",
        body:
          "Dokumentet, publikimet dhe kërkesat e dorëzuara mund të shqyrtohen nga role të autorizuara të institucionit. Dorëzimi në platformë nuk garanton automatikisht miratim apo rimbursim.",
      },
      {
        title: "Përdorimi i papranueshëm",
        body:
          "Ndalohet vendosja e të dhënave të pasakta, përdorimi i paautorizuar i llogarive të tjera, ndërhyrja në sistem dhe çdo veprim që dëmton integritetin e platformës ose të dhënave.",
      },
      {
        title: "Disponueshmëria dhe ndryshimet",
        body:
          "Platforma mund të përditësohet ose të ketë ndërprerje të përkohshme për mirëmbajtje. Institucioni mund t'i përditësojë këto kushte kur është e nevojshme.",
      },
    ],
  },
};

export default function LegalPage({ type }) {
  const page = pages[type] || pages.privacy;

  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link className="legal-brand" to="/">
          <TransparentLogo src={UMIBLogo} alt="UMIBRes" className="legal-logo" />
          <span>UMIBRes</span>
        </Link>
        <Link className="legal-login-link" to="/login">
          Hyr në Portal
        </Link>
      </header>

      <section className="legal-hero">
        <p>{page.updatedAt}</p>
        <h1>{page.title}</h1>
        <span>{page.intro}</span>
      </section>

      <section className="legal-content" aria-label={page.title}>
        {page.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}

        <article>
          <h2>Kontakti</h2>
          <p>
            Për pyetje rreth këtyre faqeve ose përdorimit të të dhënave në UMIBRes,
            kontaktoni në <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </p>
        </article>
      </section>
    </main>
  );
}
