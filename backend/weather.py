"""
Weather module: Fetches live weather from Open-Meteo and computes flight dynamics & risk scores.
"""

import math
import requests


def fetch_weather_for_waypoints(waypoints):
    """
    Fetches live weather from Open-Meteo for a list of waypoints.
    Gracefully handles failures by marking 'data_unavailable' = True.
    """
    if not waypoints:
        return []

    lats = [f"{wp['latitude']:.4f}" for wp in waypoints]
    lons = [f"{wp['longitude']:.4f}" for wp in waypoints]

    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={','.join(lats)}"
        f"&longitude={','.join(lons)}"
        f"&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m"
    )

    enriched_waypoints = []

    try:
        resp = requests.get(url, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            # If multiple points, Open-Meteo returns a list of objects; if 1 point, a single object
            if isinstance(data, list):
                results = data
            else:
                results = [data]

            for i, wp in enumerate(waypoints):
                wp_copy = dict(wp)
                if i < len(results) and "current" in results[i]:
                    cur = results[i]["current"]
                    wp_copy["weather"] = {
                        "temperature_c": round(cur.get("temperature_2m", 0.0), 1),
                        "humidity_pct": round(cur.get("relative_humidity_2m", 0.0), 1),
                        "wind_speed_kmh": round(cur.get("wind_speed_10m", 0.0), 1),
                        "wind_direction_deg": round(cur.get("wind_direction_10m", 0.0), 1),
                        "available": True,
                    }
                else:
                    wp_copy["weather"] = {
                        "available": False,
                        "error": "No current weather payload",
                    }
                enriched_waypoints.append(wp_copy)
            return enriched_waypoints
    except Exception as e:
        print(f"Batch weather request failed: {e}, falling back to per-waypoint fetch")

    # Fallback to individual requests if batch failed
    for wp in waypoints:
        wp_copy = dict(wp)
        try:
            single_url = (
                f"https://api.open-meteo.com/v1/forecast"
                f"?latitude={wp['latitude']:.4f}&longitude={wp['longitude']:.4f}"
                f"&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m"
            )
            r = requests.get(single_url, timeout=4)
            if r.status_code == 200 and "current" in r.json():
                cur = r.json()["current"]
                wp_copy["weather"] = {
                    "temperature_c": round(cur.get("temperature_2m", 0.0), 1),
                    "humidity_pct": round(cur.get("relative_humidity_2m", 0.0), 1),
                    "wind_speed_kmh": round(cur.get("wind_speed_10m", 0.0), 1),
                    "wind_direction_deg": round(cur.get("wind_direction_10m", 0.0), 1),
                    "available": True,
                }
            else:
                wp_copy["weather"] = {"available": False, "error": "Failed response"}
        except Exception:
            wp_copy["weather"] = {"available": False, "error": "Connection error"}
        enriched_waypoints.append(wp_copy)

    return enriched_waypoints


def analyze_route_weather(route, cruise_speed_kmh=850.0):
    """
    Calculates:
      - Effective ground speed
      - Flight time
      - Averages for temp, humidity, wind
      - Risk score (Low / Medium / High) with hazard indicators
    """
    enriched_wps = fetch_weather_for_waypoints(route["waypoints"])
    route["waypoints"] = enriched_wps

    temps = []
    humidities = []
    wind_speeds = []
    effective_speeds = []
    hazard_notes = []

    for wp in enriched_wps:
        w = wp.get("weather", {})
        if not w.get("available"):
            continue

        temp = w["temperature_c"]
        humidity = w["humidity_pct"]
        wind_speed = w["wind_speed_kmh"]
        wind_dir = w["wind_direction_deg"]
        bearing = wp["bearing"]

        temps.append(temp)
        humidities.append(humidity)
        wind_speeds.append(wind_speed)

        # Headwind component:
        # relative wind angle = wind_direction - bearing
        # headwind = wind_speed * cos(theta) (positive = headwind, negative = tailwind)
        angle_rad = math.radians(wind_dir - bearing)
        headwind = wind_speed * math.cos(angle_rad)
        eff_speed = max(cruise_speed_kmh - headwind, 300.0)
        effective_speeds.append(eff_speed)

        # Waypoint-level hazard check
        if wind_speed >= 50.0:
            hazard_notes.append(f"{wp['name']}: Severe winds ({wind_speed} km/h)")
        elif wind_speed >= 35.0:
            hazard_notes.append(f"{wp['name']}: Moderate crosswind/gusts ({wind_speed} km/h)")

        if humidity >= 90.0 and temp <= 5.0:
            hazard_notes.append(f"{wp['name']}: Potential icing / convective cloud layer")

    avg_temp = round(sum(temps) / len(temps), 1) if temps else 0.0
    avg_humidity = round(sum(humidities) / len(humidities), 1) if humidities else 0.0
    avg_wind = round(sum(wind_speeds) / len(wind_speeds), 1) if wind_speeds else 0.0
    max_wind = max(wind_speeds) if wind_speeds else 0.0
    avg_eff_speed = round(sum(effective_speeds) / len(effective_speeds), 1) if effective_speeds else cruise_speed_kmh

    # Estimated flight time
    total_dist = route["total_distance_km"]
    flight_time_hours = total_dist / avg_eff_speed
    hours = int(flight_time_hours)
    minutes = int(round((flight_time_hours - hours) * 60))
    time_str = f"{hours}h {minutes:02d}m" if hours > 0 else f"{minutes}m"

    # Risk level calculation
    if max_wind >= 55.0 or (avg_wind >= 45.0) or len([h for h in hazard_notes if "Severe" in h]) >= 2:
        risk_level = "High"
    elif max_wind >= 35.0 or avg_wind >= 25.0 or len(hazard_notes) >= 1:
        risk_level = "Medium"
    else:
        risk_level = "Low"

    route["stats"] = {
        "total_distance_km": total_dist,
        "avg_temperature_c": avg_temp,
        "avg_humidity_pct": avg_humidity,
        "avg_wind_speed_kmh": avg_wind,
        "max_wind_speed_kmh": max_wind,
        "effective_ground_speed_kmh": avg_eff_speed,
        "estimated_flight_time": time_str,
        "flight_time_hours": round(flight_time_hours, 2),
        "risk_level": risk_level,
        "hazards": hazard_notes,
    }

    return route
