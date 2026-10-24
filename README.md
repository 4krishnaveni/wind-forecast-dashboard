# Wind Forecast Dashboard

## Project Overview
The Wind Forecast Dashboard is a full-stack web application designed to compare actual and forecast UK wind generation data for January 2026. It helps users visualize wind generation trends, compare forecast values with actual generation, and evaluate forecast performance using statistical metrics.

## Live Demo
- **Frontend:** https://wind-forecast-dashboard-navy.vercel.app
- **Backend API:** https://wind-forecast-dashboard-25s1.onrender.com
- **API Documentation:** https://wind-forecast-dashboard-25s1.onrender.com/docs
- **GitHub Repository:** https://github.com/4krishnaveni/wind-forecast-dashboard

## Features
- View actual and forecast wind generation data.
- Select a date to explore hourly generation values.
- Compare actual and forecast values using interactive charts.
- View hourly data in a table.
- Evaluate forecast performance using MAE, RMSE, and forecast bias.
- Retrieve data through REST API endpoints.

## Technologies Used
- **Frontend:** React, Vite, JavaScript, CSS
- **Backend:** Python, FastAPI
- **Data Source:** Elexon BMRS API
- **Deployment:** Vercel and Render
- **Version Control:** Git and GitHub

## Project Architecture
The application uses a React frontend to display wind generation data and a FastAPI backend to retrieve and process data from the Elexon BMRS API. The frontend communicates with the backend through REST API endpoints. The returned data is used to compare actual and forecast generation and display performance metrics.

## Forecast Evaluation Metrics
- **MAE (Mean Absolute Error):** Measures the average absolute difference between forecast and actual generation.
- **RMSE (Root Mean Squared Error):** Measures forecast error while giving greater weight to larger errors.
- **Forecast Bias:** Measures the average difference between forecast and actual generation. Positive bias indicates overforecasting, while negative bias indicates underforecasting.

Metrics are calculated using matching forecast and actual delivery intervals. The forecast publication cutoff must be applied consistently for a valid day-ahead evaluation. MAPE, if included, requires special handling when actual generation is zero.

## API Endpoints
- `/api/wind/actual` — Retrieves actual wind generation data.
- `/api/wind/forecast` — Retrieves forecast wind generation data.

Visit the [API documentation](https://wind-forecast-dashboard-25s1.onrender.com/docs) to explore and test the available endpoints.

## Run Locally

### Prerequisites
- Python
- Node.js and npm
- Git

### 1. Clone the Repository
```bash
git clone https://github.com/4krishnaveni/wind-forecast-dashboard.git
cd wind-forecast-dashboard
```

### 2. Start the Backend
```bash
cd backend
python -m venv .venv
```

Activate the virtual environment on Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

Install dependencies and start the API:

```bash
pip install -r requirements.txt
uvicorn main:app --reload
```

The backend will run at `http://127.0.0.1:8000`.

### 3. Start the Frontend
Open a second terminal in the project root and run:

```bash
npm install
npm run dev
```

Open the local URL displayed by Vite in your browser. If the frontend uses an API base URL environment variable, configure it to point to `http://127.0.0.1:8000` for local development.

## Deployment
The frontend is deployed on Vercel, and the backend is deployed on Render. The backend CORS configuration allows requests from the deployed frontend. The GitHub repository is used to maintain and update the project code.

## Limitations
- Evaluation metrics depend on the availability of matching forecast and actual records.
- Forecast publication timing must be verified against the required day-ahead evaluation cutoff.
- Forecast error alone does not determine exact additional electricity procurement requirements; demand, market prices, reserve requirements, and procurement rules would also be needed.
- Data availability and accuracy depend on the source API and the processing applied by the application.

## AI Tool Disclosure
AI tools were used to assist with development troubleshooting, implementation guidance, and documentation preparation. The final code, calculations, and application behaviour should be reviewed and verified by the project author.

## Author
**Krishnaveni Kurra**

GitHub: https://github.com/4krishnaveni
