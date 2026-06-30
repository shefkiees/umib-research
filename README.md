# UMIBRes

UMIBRes është një sistem për menaxhimin e publikimeve shkencore dhe kërkesave për rimbursim në Universitetin "Isa Boletini" në Mitrovicë.

Sistemi u mundëson profesorëve, komisionit, prorektorit dhe administratorit të menaxhojnë publikimet shkencore, kërkesat për rimbursim, procesin e shqyrtimit dhe raportimin institucional në një platformë të vetme.

---

## Features

- Autentikim me Google OAuth
- Dashboard i personalizuar sipas rolit
- Menaxhim i publikimeve shkencore
- Marrje automatike e metadata nga DOI (CrossRef)
- Integrim me ORCID
- Menaxhim i kërkesave për rimbursim
- Shqyrtim dhe aprovime nga komisioni
- Gjenerim i dokumenteve PDF dhe DOCX
- Njoftime brenda sistemit
- Audit Log
- Statistika dhe raporte institucionale
- Mbështetje për gjuhën shqipe dhe angleze

---

## User Roles

### Professor

- Regjistron publikime shkencore
- Dorëzon kërkesa për rimbursim
- Ngarkon dokumente mbështetëse
- Monitoron statusin e kërkesave
- Merr njoftime

### Committee

- Shqyrton kërkesat
- Verifikon dokumentacionin
- Aprovojnë, refuzojnë ose kërkojnë korrigjime
- Vendosin komente

### Pro-Rector

- Monitoron publikimet
- Analizon statistikat sipas fakulteteve
- Shikon raportet institucionale

### Administrator

- Menaxhon përdoruesit
- Menaxhon rolet
- Monitoron aktivitetin
- Administron konfigurimet e sistemit

---

## Technology Stack

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

### Database

- PostgreSQL

### Integrations

- Google OAuth
- CrossRef API
- ORCID
- PDFKit
- docx
- Supabase
- Resend

---

## Project Structure

```text
src/
│
├── frontend/
│   ├── admin/
│   ├── committee/
│   ├── professor/
│   ├── prorector/
│   └── common/
│
├── backend/
│   ├── routes/
│   ├── services/
│   ├── config/
│   └── scripts/
│
├── shared/
└── public/
```

---

## Installation

Clone repository

```bash
git clone <repository-url>
```

Install dependencies

```bash
npm install
```

Install backend dependencies

```bash
cd backend
npm install
```

---

## Environment Variables

Create a `.env` file and configure:

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

---

## Running the Project

Frontend

```bash
npm run dev
```

Backend

```bash
cd backend
npm start
```

---

## Build

```bash
npm run build
```

---

## License

This project was developed for academic and research purposes at the University "Isa Boletini" in Mitrovica.
