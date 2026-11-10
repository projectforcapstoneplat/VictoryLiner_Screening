# Victory Liner Recruitment Screening System

Victory Liner Recruitment Screening System is a Vite + React recruitment portal for browsing job openings, applying for positions, and reviewing applicant workflows in a structured HR-facing interface. The project combines a careers website front-end with Supabase-backed data models and optional AI-assisted screening support for resume and interview evaluation.

---

## Group Members & Roles
* **Martin Fredirico Bechayda** – Frontend / Project Manager / Developer
* **Stephen Clyde Sujede** – Backend / Lead Developer
* **Mark Anthony Galang** – UI / UX / Database Administrator

---

## Tech Stack
* **Frontend:** React, Vite, HTML, CSS, JavaScript
* **Backend / Data Layer:** Supabase (Authentication, Storage, PostgreSQL)
* **Database:** PostgreSQL via Supabase
* **Tools & Version Control:** Git, VS Code, npm, Supabase CLI (optional for edge functions)

---

## System Requirements & Prerequisites
Before you begin, ensure you have the following installed on your local machine:
* Node.js (v18 or newer)
* npm (included with Node.js)
* A Supabase project (required for the full application workflow)
* VS Code or another terminal-enabled code editor

---

## Installation & Setup Instructions

Follow these steps to set up the project locally:

### 1. Clone the Repository
```bash
git clone <repository-url>
cd victoryLiner_screening
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Copy the example environment file and add your Supabase project values:
```bash
cp .env.example .env
```

Then update `.env` with your project credentials:
```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_HR_GOOGLE_DOMAIN=
```

---

## Database Setup & Configuration
This project includes a Supabase-ready schema and seed data under the `supabase/` directory for the full applicant and HR workflow.

1. Create a new Supabase project in the Supabase dashboard.
2. Open the SQL editor and run the migration files in `supabase/migrations/` in order.
3. Optionally run the seed scripts in `supabase/` to load sample jobs, applicants, and interview data.
4. Confirm your `.env` file has the correct `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` values.

The front-end can be viewed as a prototype without a live database, but the complete applicant and HR flows depend on the Supabase configuration.

---

## Running the Application

Start the local development server:
```bash
npm run dev
```

Then open the local URL shown in the terminal, typically:
```text
http://localhost:5173
```

To create a production build:
```bash
npm run build
```

To preview the production build locally:
```bash
npm run preview
```

---

## Project Structure
* `src/` — main React application, pages, reusable UI components, and state logic
* `supabase/` — SQL migrations, setup instructions, seed data, and edge-function configuration
* `public/` — static assets and media used by the site
* `README.md` — project overview and setup guide

This project is designed as a recruitment portal interface and supporting data layer for Victory Liner’s candidate screening workflow, with room to extend into AI-assisted applicant evaluation and HR review.
