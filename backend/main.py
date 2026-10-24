
from datetime import datetime, timedelta, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import requests

app = FastAPI(title="UK Wind Forecast Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "https://wind-forecast-dashboard-navy.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ELEXON_BASE_URL = "https://data.elexon.co.uk/bmrs/api/v1"


@app.get("/")
def home():
    return {
        "message": "UK Wind Forecast Dashboard API is running"
    }


@app.get("/api/health")
def health():
    return {
        "status": "healthy",
        "service": "wind-forecast-backend"
    }


@app.get("/api/wind/actual")
def get_actual_wind():
    url = f"{ELEXON_BASE_URL}/datasets/FUELHH"

    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    end = datetime(2026, 2, 1, tzinfo=timezone.utc)

    all_records = []

    try:
        cursor = start

        while cursor < end:
            next_cursor = min(cursor + timedelta(days=6), end)

            params = {
                "publishDateTimeFrom": cursor.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "publishDateTimeTo": next_cursor.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "fuelType": "WIND",
                "format": "json",
            }

            response = requests.get(url, params=params, timeout=60)
            response.raise_for_status()
            result = response.json()

            if isinstance(result, dict):
                records = result.get("data", [])
            elif isinstance(result, list):
                records = result
            else:
                raise HTTPException(
                    status_code=502,
                    detail="Unexpected actual generation response format from Elexon",
                )

            all_records.extend(records)
            cursor = next_cursor

        # Keep only January delivery intervals and remove duplicate records.
        january_records = {}

        for record in all_records:
            start_time = record.get("startTime", "")

            if (
                record.get("fuelType") == "WIND"
                and start_time.startswith("2026-01-")
            ):
                key = (start_time, record.get("settlementPeriod"))
                january_records[key] = record

        data = sorted(
            january_records.values(),
            key=lambda record: record.get("startTime", ""),
        )

        return {
            "count": len(data),
            "period": "January 2026",
            "data": data,
        }

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to retrieve actual wind data from Elexon: {exc}",
        )


@app.get("/api/wind/forecast")
def get_wind_forecast():
    url = f"{ELEXON_BASE_URL}/datasets/WINDFOR/stream"

    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    end = datetime(2026, 2, 1, tzinfo=timezone.utc)

    all_records = []

    try:
        cursor = start

        while cursor < end:
            next_cursor = min(cursor + timedelta(days=6), end)

            params = {
                "publishDateTimeFrom": cursor.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "publishDateTimeTo": next_cursor.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "format": "json",
            }

            response = requests.get(url, params=params, timeout=60)
            response.raise_for_status()
            result = response.json()

            if isinstance(result, dict):
                records = result.get("data", [])
            elif isinstance(result, list):
                records = result
            else:
                raise HTTPException(
                    status_code=502,
                    detail="Unexpected forecast response format from Elexon",
                )

            all_records.extend(records)
            cursor = next_cursor

        selected = {}

        for record in all_records:
            start_time = record.get("startTime", "")
            publish_time = record.get("publishTime")
            generation = record.get("generation")

            if (
                not start_time.startswith("2026-01-")
                or not publish_time
                or generation is None
            ):
                continue

            try:
                delivery_dt = datetime.fromisoformat(
                    start_time.replace("Z", "+00:00")
                )
                publish_dt = datetime.fromisoformat(
                    publish_time.replace("Z", "+00:00")
                )
                generation_value = float(generation)
            except (ValueError, TypeError):
                continue

            # Exclude forecasts published at or after delivery.
            if publish_dt >= delivery_dt:
                continue

            previous = selected.get(start_time)

            if (
                previous is None
                or publish_dt > datetime.fromisoformat(
                    previous["publishTime"].replace("Z", "+00:00")
                )
            ):
                selected[start_time] = {
                    **record,
                    "generation": generation_value,
                }

        data = sorted(
            selected.values(),
            key=lambda record: record["startTime"],
        )

        return {
            "count": len(data),
            "period": "January 2026",
            "selectionRule": (
                "Latest available forecast published before its delivery time; "
                "not necessarily a day-ahead forecast"
            ),
            "data": data,
        }

    except requests.RequestException as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Unable to retrieve forecast wind data from Elexon: {exc}",
        )
