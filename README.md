# UMIBRes

UMIBRes eshte aplikacion web per menaxhimin e publikimeve shkencore dhe kerkesave per rimbursim ne Universitetin "Isa Boletini" ne Mitrovice.

Qellimi i projektit eshte qe profesoret, komisioni, prorektori dhe administratori te kene nje sistem te perbashket ku mund te regjistrohen publikimet, te dorezohen kerkesat per rimbursim, te shqyrtohen dokumentet dhe te percillen njoftimet/statuset.

## Ideja e projektit

Ne vend qe publikimet dhe rimbursimet te menaxhohen me dokumente te shperndara ose ne menyre manuale, UMIBRes i vendos keto procese ne nje platforme te vetme. Sistemi e ben me te lehte:

- ruajtjen e publikimeve shkencore;
- dorezimin e kerkesave per rimbursim;
- kontrollimin e dokumenteve nga komisioni;
- kthimin e kerkesave per korrigjim;
- njoftimin e perdoruesve per ndryshime;
- shfaqjen e statistikave dhe raporteve.

## Rolet ne sistem

### Profesor

- regjistron publikime shkencore;
- perdor DOI per plotesim te te dhenave kur eshte e mundur;
- dorezon kerkesa per rimbursim;
- shton dokumente mbeshtetese;
- sheh statusin dhe historikun e kerkesave;
- pranon njoftime ne sistem.

### Komision

- sheh kerkesat qe jane per shqyrtim;
- kontrollon publikimet, dokumentet dhe metadata;
- aprovon, refuzon ose kthen kerkesa per korrigjim;
- vendos komente per perdoruesin;
- ndjek vendimet dhe historikun e shqyrtimit.

### Prorektor

- sheh permbledhje te publikimeve dhe financimeve;
- analizon te dhenat sipas fakulteteve;
- shikon raporte dhe statistika;
- perdor dashboard-in per monitorim institucional.

### Administrator

- menaxhon perdoruesit;
- ndryshon role dhe status te llogarive;
- sheh historikun e veprimeve;
- menaxhon njoftimet dhe statistikat administrative;
- kontrollon disa konfigurime te sistemit.

## Funksionalitetet kryesore

- Login dhe menaxhim i sesionit.
- Autentikim me Google OAuth.
- Dashboard i ndare sipas roleve.
- Menaxhim i profilit te perdoruesit.
- Regjistrim i publikimeve shkencore.
- Kerkim i te dhenave nga DOI/CrossRef.
- Lidhje me ORCID.
- Menaxhim i konferencave.
- Kerkesa per rimbursim per publikime dhe konferenca.
- Gjenerim i dokumenteve PDF dhe DOCX per rimbursime.
- Shqyrtim i kerkesave nga komisioni.
- Njoftime brenda aplikacionit.
- Audit log per veprimet kryesore.
- Statistika dhe raporte per perdorues, publikime, fakultete dhe financime.
- Nderfaqe ne shqip dhe anglisht.

## Teknologjite kryesore

### Frontend

- React
- Vite
- React Router
- CSS
- Lucide React
- Recharts / Chart.js

### Backend

- Node.js
- Express.js
- Passport.js
- Express Session
- PostgreSQL
- Supabase, kur perdoret per sinkronizim/autentikim

### Integrime dhe dokumente

- DOI / CrossRef
- ORCID
- PDFKit
- docx
- Resend per email njoftime, nese eshte i konfiguruar

## Struktura e projektit

```text
src/
  frontend/
    admin/        pjesa e administratorit
    committee/    pjesa e komisionit
    professor/    pjesa e profesorit
    ProRector/    pjesa e prorektorit
    common/       komponente te perbashketa

backend/
  routes/         API endpoints
  services/       logjika kryesore e sistemit
  config/         databaza, sesionet dhe autentikimi
  scripts/        skripta ndihmese

shared/           funksione te perbashketa
public/           logo, favicon, PDF i rregullores dhe asete tjera
```

## Si startohet projekti

Instalimi i paketave:

```bash
npm install
```

Startimi i frontend-it:

```bash
npm run dev
```

Startimi i backend-it:

```bash
cd backend
npm install
npm start
```

Build:

```bash
npm run build
```

## Konfigurimi

Projekti perdor `.env` per databaze dhe integrime. Disa nga variablat qe mund te nevojiten jane:

```env
DATABASE_URL=
CLIENT_URL=
SESSION_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=
VITE_API_BASE_URL=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ORCID_CLIENT_ID=
ORCID_CLIENT_SECRET=
ORCID_REDIRECT_URI=
RESEND_API_KEY=
EMAIL_FROM=
```

## Shenim

Versioni i vjeter i dokumentimit ka pasur disa pjese qe kane ndryshuar gjate zhvillimit. Projekti aktual nuk perdor MySQL ose NestJS, por perdor PostgreSQL dhe Express.js. Gjithashtu fokusi kryesor i sistemit aktual eshte te publikimet, rimbursimet, shqyrtimi nga komisioni, njoftimet, statistikat dhe menaxhimi i perdoruesve.
