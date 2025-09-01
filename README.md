# AOP Network Visualizer

This repo excludes `node_modules` and other build artifacts. Use the steps below to install dependencies and run the app locally on Windows. The article for this tool is available @ [bioarxiv](https://www.biorxiv.org/content/10.1101/2025.08.25.672239v1) 

## Prerequisites
- Node.js 20+ (includes npm)
- Python 3.10+ (for the backend)
- Git

Optional but recommended:
- pnpm 10+ (faster installs). If not installed, npm works too.

## Install and Run (Windows PowerShell)

### 1) Backend (Flask)
From the `backend` folder:

```powershell
cd .\backend
# Create and activate a virtual environment (one-time)
python -m venv .venv; .\.venv\Scripts\Activate.ps1
# Install requirements
pip install -r .\requirements.txt
# Run API (defaults to http://localhost:5001)
python .\src\main.py
```

### 2) Frontend (Vite + React)
Open a new terminal in the `frontend` folder:

```powershell
cd .\frontend
# If you have pnpm:
# corepack enable; corepack prepare pnpm@10.4.1 --activate
pnpm install
pnpm dev

# Or using npm:
npm install
npm run dev
```

The frontend looks for `VITE_API_BASE_URL` (see `frontend/src/config.js`). If not set, it defaults to `http://localhost:5001`.

To build a production bundle:
```powershell
npm run build
# Preview static build
npm run preview
```

## Environment variables
Create a `.env` file in `backend` if you need to set any secrets or config for Flask. Frontend env vars go in `frontend/.env` (e.g., `VITE_API_BASE_URL=http://localhost:5001`).

## Common Troubleshooting
- Port 5001 already in use: stop the previous backend or change the port in `backend/src/main.py`.
- CORS errors: backend enables CORS by default via Flask-CORS.
- Missing data files: verify TSV/CSV paths under `backend/src` and `data/`.

## Commit hygiene
- `node_modules`, build outputs (`dist`, `build`), and virtual envs (`.venv`) are ignored via `.gitignore`.
- Commit lockfiles for reproducibility:
  - Frontend: `package-lock.json` (or `pnpm-lock.yaml` if you switch to pnpm and commit the lockfile).
  - Backend: keep `requirements.txt` up to date.
 
<img width="1016" height="497" alt="image" src="https://github.com/user-attachments/assets/41685589-c395-4dda-92c0-644bdfcedb1a" />

<img width="1019" height="594" alt="Screenshot 2025-08-19 152021" src="https://github.com/user-attachments/assets/474816d3-b00f-4698-9d7a-2223f4483d2c" />

