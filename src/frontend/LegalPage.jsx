import { Link } from "react-router-dom";
import UMIBLogo from "../assets/umiblogo.jpg";
import TransparentLogo from "./common/TransparentLogo";
import "./LegalPage.css";

const pages = {
  privacy: {
    title: "Politika e Privatësisë",
    intro:
      "Universiteti “Isa Boletini” në Mitrovicë është i përkushtuar për mbrojtjen e privatësisë dhe të dhënave personale të përdoruesve të platformës UMIBRes. Kjo Politikë e Privatësisë shpjegon se si mblidhen, përdoren, ruhen dhe mbrohen të dhënat gjatë përdorimit të platformës.",
    sections: [
      {
        title: "Të dhënat që mbledhim",
        body:
          "Gjatë përdorimit të UMIBRes, mund të mblidhen dhe përpunohen këto kategori të të dhënave:",
        items: [
          "të dhënat identifikuese, si emri, mbiemri dhe adresa elektronike;",
          "të dhënat akademike dhe institucionale, si fakulteti, departamenti, titulli akademik dhe roli në sistem;",
          "të dhënat që lidhen me publikimet shkencore, konferencat dhe aktivitetet kërkimore;",
          "identifikues akademikë, si ORCID dhe DOI, kur janë të aplikueshëm;",
          "të dhënat dhe dokumentet e paraqitura në kuadër të kërkesave për financim ose rimbursim;",
          "të dhënat teknike të nevojshme për funksionimin dhe sigurinë e platformës.",
        ],
      },
      {
        title: "Qëllimi i përpunimit",
        body: "Të dhënat personale përpunohen për këto qëllime:",
        items: [
          "autentikimin dhe identifikimin e përdoruesve;",
          "krijimin dhe menaxhimin e profileve akademike;",
          "regjistrimin dhe administrimin e publikimeve shkencore;",
          "administrimin e konferencave dhe aktiviteteve shkencore;",
          "paraqitjen, verifikimin dhe shqyrtimin e kërkesave për financim ose rimbursim;",
          "përgatitjen e raporteve dhe statistikave institucionale;",
          "sigurimin dhe përmirësimin e funksionimit të platformës.",
        ],
      },
      {
        title: "Kyçja me Google",
        paragraphs: [
          "UMIBRes mundëson autentikimin përmes Google OAuth. Gjatë kyçjes, mund të përdoren të dhënat bazë të llogarisë Google, si emri dhe adresa elektronike, me qëllim të identifikimit dhe autentikimit të përdoruesit.",
          "Të dhënat e marra përmes Google përdoren vetëm për funksionimin e shërbimeve të UMIBRes dhe nuk përdoren për qëllime reklamimi apo marketingu.",
        ],
      },
      {
        title: "Baza ligjore",
        paragraphs: [
          "Përpunimi i të dhënave personale bëhet në përputhje me legjislacionin në fuqi për mbrojtjen e të dhënave personale në Republikën e Kosovës dhe me aktet e brendshme të Universitetit “Isa Boletini” në Mitrovicë.",
          "Kur është e aplikueshme, përpunimi i të dhënave bëhet gjithashtu në përputhje me Rregulloren e Përgjithshme për Mbrojtjen e të Dhënave (GDPR).",
        ],
      },
      {
        title: "Ruajtja dhe siguria e të dhënave",
        paragraphs: [
          "Universiteti “Isa Boletini” në Mitrovicë zbaton masa teknike dhe organizative për mbrojtjen e të dhënave të përpunuara përmes UMIBRes nga qasja e paautorizuar, humbja, ndryshimi, keqpërdorimi ose zbulimi i tyre.",
          "Të dhënat ruhen për aq kohë sa janë të nevojshme për realizimin e qëllimeve akademike, administrative dhe institucionale, si dhe për përmbushjen e detyrimeve ligjore.",
        ],
      },
      {
        title: "Ndarja dhe qasja në të dhëna",
        paragraphs: [
          "Qasja në të dhënat e ruajtura në UMIBRes u lejohet vetëm personave dhe roleve të autorizuara brenda Universitetit, në përputhje me përgjegjësitë e tyre.",
          "Të dhënat personale nuk u zbulohen palëve të treta, përveç rasteve kur kjo kërkohet me ligj ose është e nevojshme për ofrimin dhe funksionimin e shërbimeve të platformës përmes ofruesve të autorizuar teknikë.",
        ],
      },
      {
        title: "Të drejtat tuaja",
        body:
          "Në përputhje me legjislacionin në fuqi për mbrojtjen e të dhënave personale, përdoruesit mund të kenë të drejtë të:",
        items: [
          "kërkojnë qasje në të dhënat e tyre personale;",
          "kërkojnë korrigjimin ose përditësimin e të dhënave;",
          "kërkojnë fshirjen ose kufizimin e përpunimit, kur kjo është e aplikueshme;",
          "kundërshtojnë përpunimin në rrethana të caktuara;",
          "paraqesin ankesë pranë autoritetit kompetent për mbrojtjen e të dhënave personale.",
        ],
      },
      {
        title: "Kontakti",
        paragraphs: [
          "Për çdo pyetje lidhur me privatësinë, mbrojtjen e të dhënave personale ose përdorimin e platformës UMIBRes, mund të kontaktoni:",
        ],
        contact: [
          "Universiteti “Isa Boletini” në Mitrovicë",
          "Rr. Ukshin Kovaçica, 40000 Mitrovicë, Republika e Kosovës",
          "Tel: +383 28 515 516",
        ],
        email: "info@umib.net",
      },
    ],
    closing:
      "Kjo Politikë e Privatësisë mund të përditësohet herë pas here në përputhje me ndryshimet në funksionalitetet e UMIBRes, kërkesat institucionale ose legjislacionin në fuqi. Çdo ndryshim do të publikohet në këtë faqe.",
  },
  terms: {
    title: "Kushtet e Përdorimit",
    intro:
      "Këto Kushte të Përdorimit përcaktojnë rregullat për qasjen dhe përdorimin e platformës UMIBRes, të Universitetit “Isa Boletini” në Mitrovicë.",
    secondaryIntro:
      "Duke përdorur platformën UMIBRes, përdoruesi pajtohet që ta përdorë atë në përputhje me këto kushte, rregulloret e Universitetit dhe legjislacionin në fuqi.",
    sections: [
      {
        title: "Qëllimi i platformës",
        body:
          "UMIBRes është platformë institucionale që shërben për menaxhimin e proceseve akademike dhe kërkimore të Universitetit, duke përfshirë:",
        items: [
          "menaxhimin e profileve akademike;",
          "regjistrimin dhe administrimin e publikimeve shkencore;",
          "regjistrimin e konferencave dhe aktiviteteve shkencore;",
          "paraqitjen dhe shqyrtimin e kërkesave për financim ose rimbursim;",
          "menaxhimin e dokumentacionit që lidhet me këto procese;",
          "raportimin dhe administrimin institucional.",
        ],
      },
      {
        title: "Qasja dhe llogaria e përdoruesit",
        paragraphs: [
          "Qasja në UMIBRes u mundësohet përdoruesve të autorizuar nga Universiteti.",
          "Përdoruesi është përgjegjës për përdorimin e llogarisë së tij dhe për saktësinë e të dhënave që paraqet në platformë.",
          "Përdoruesi nuk duhet të lejojë persona të tjerë të përdorin llogarinë e tij dhe duhet të njoftojë Universitetin nëse dyshon për qasje ose përdorim të paautorizuar.",
        ],
      },
      {
        title: "Kyçja në platformë",
        paragraphs: [
          "UMIBRes mund të përdorë Google OAuth për autentikimin e përdoruesve.",
          "Përdoruesi duhet të përdorë llogarinë e autorizuar për qasje në platformë. Universiteti mund të kufizojë ose të ndërpresë qasjen kur një përdorues nuk plotëson më kushtet për përdorimin e sistemit.",
        ],
      },
      {
        title: "Përgjegjësia e përdoruesit",
        body:
          "Gjatë përdorimit të UMIBRes, përdoruesi obligohet:",
        items: [
          "të paraqesë të dhëna të sakta dhe të plota;",
          "të përditësojë të dhënat kur është e nevojshme;",
          "të ngarkojë vetëm dokumente autentike dhe relevante;",
          "të përdorë platformën vetëm për qëllime akademike dhe institucionale;",
          "të respektojë rregulloret dhe procedurat e Universitetit;",
          "të mos tentojë qasje të paautorizuar në të dhënat, llogaritë ose funksionet e sistemit;",
          "të mos përdorë platformën në mënyrë që mund të cenojë sigurinë ose funksionimin e saj.",
        ],
      },
      {
        title: "Publikimet dhe aktivitetet shkencore",
        paragraphs: [
          "Përdoruesi është përgjegjës për saktësinë e të dhënave që paraqet lidhur me publikimet, konferencat dhe aktivitetet e tjera shkencore.",
          "Të dhënat dhe dokumentet e paraqitura mund të verifikohen nga personat ose organet përgjegjëse të Universitetit në kuadër të procedurave institucionale.",
        ],
      },
      {
        title: "Kërkesat për financim ose rimbursim",
        paragraphs: [
          "Paraqitja e një kërkese për financim ose rimbursim përmes UMIBRes nuk nënkupton miratimin automatik të saj.",
          "Kërkesat shqyrtohen dhe vlerësohen nga strukturat përgjegjëse të Universitetit sipas rregulloreve, kritereve dhe procedurave institucionale në fuqi.",
          "Përdoruesi është përgjegjës për saktësinë dhe vlefshmërinë e të dhënave dhe dokumenteve të paraqitura në kuadër të kërkesës.",
        ],
      },
      {
        title: "Përdorimi i papranueshëm",
        body:
          "Nuk lejohet përdorimi i UMIBRes për:",
        items: [
          "paraqitjen e qëllimshme të të dhënave të rreme ose mashtruese;",
          "ngarkimin e dokumenteve të falsifikuara ose të paautorizuara;",
          "përdorimin e llogarisë së një personi tjetër;",
          "tentimin për të anashkaluar mekanizmat e autentikimit ose autorizimit;",
          "ndërhyrjen në funksionimin ose sigurinë e platformës;",
          "përdorimin e platformës për qëllime që nuk lidhen me funksionet e saj institucionale.",
        ],
        afterItems:
          "Në rast të keqpërdorimit, Universiteti mund të kufizojë ose të ndërpresë qasjen në platformë dhe të ndërmarrë veprimet përkatëse sipas rregulloreve dhe legjislacionit në fuqi.",
      },
      {
        title: "Disponueshmëria e platformës",
        paragraphs: [
          "Universiteti synon të sigurojë funksionimin e rregullt dhe të sigurt të UMIBRes.",
          "Megjithatë, qasja në platformë mund të ndërpritet përkohësisht për shkak të mirëmbajtjes, përditësimeve teknike, problemeve të sigurisë ose rrethanave të tjera teknike.",
        ],
      },
      {
        title: "Mbrojtja e të dhënave personale",
        body:
          "Përpunimi dhe mbrojtja e të dhënave personale gjatë përdorimit të UMIBRes bëhet në përputhje me Politikën e Privatësisë së UMIBRes dhe legjislacionin në fuqi për mbrojtjen e të dhënave personale.",
      },
      {
        title: "Ndryshimet në platformë dhe kushtet e përdorimit",
        paragraphs: [
          "Universiteti mund të përditësojë ose ndryshojë funksionalitetet e UMIBRes në përputhje me nevojat akademike, administrative, teknike ose institucionale.",
          "Këto Kushte të Përdorimit gjithashtu mund të përditësohen herë pas here. Versioni i përditësuar do të publikohet në platformë.",
        ],
      },
      {
        title: "Kontakti",
        paragraphs: [
          "Për pyetje lidhur me përdorimin e platformës UMIBRes, mund të kontaktoni:",
        ],
        contact: [
          "Universiteti “Isa Boletini” në Mitrovicë",
          "Rr. Ukshin Kovaçica, 40000 Mitrovicë, Republika e Kosovës",
          "Tel: +383 28 515 516",
        ],
        email: "info@umib.net",
      },
    ],
  },
};

function renderSectionText(section) {
  const paragraphs = section.paragraphs || (section.body ? [section.body] : []);

  return (
    <>
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      {section.items?.length ? (
        <ul>
          {section.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}
      {section.afterItems ? <p>{section.afterItems}</p> : null}
      {section.contact?.length ? (
        <address>
          {section.contact.map((line) => (
            <span key={line}>{line}</span>
          ))}
          {section.email ? (
            <span>
              E-mail: <a href={`mailto:${section.email}`}>{section.email}</a>
            </span>
          ) : null}
        </address>
      ) : null}
    </>
  );
}

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
        {page.updatedAt ? <p>{page.updatedAt}</p> : null}
        <h1>{page.title}</h1>
        <span>{page.intro}</span>
        {page.secondaryIntro ? <span>{page.secondaryIntro}</span> : null}
      </section>

      <section className="legal-content" aria-label={page.title}>
        {page.sections.map((section) => (
          <article key={section.title}>
            <h2>{section.title}</h2>
            {renderSectionText(section)}
          </article>
        ))}

        {page.closing ? (
          <article>
            <p>{page.closing}</p>
          </article>
        ) : null}
      </section>
    </main>
  );
}
