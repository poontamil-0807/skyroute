"""
Route generation module: Great-circle math and northern/southern deviation paths with 5 waypoints.
"""

import math
from geopy.distance import geodesic


def calculate_bearing(lat1, lon1, lat2, lon2):
    """Calculate initial compass bearing from (lat1, lon1) to (lat2, lon2) in degrees [0, 360)."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)

    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360) % 360


def intermediate_point(lat1, lon1, lat2, lon2, fraction):
    """
    Calculate spherical intermediate point along great-circle path at given fraction [0..1].
    """
    if fraction <= 0.0:
        return lat1, lon1
    if fraction >= 1.0:
        return lat2, lon2

    phi1 = math.radians(lat1)
    lambda1 = math.radians(lon1)
    phi2 = math.radians(lat2)
    lambda2 = math.radians(lon2)

    # Angular distance
    delta_sigma = 2 * math.asin(
        math.sqrt(
            math.sin((phi2 - phi1) / 2) ** 2
            + math.cos(phi1) * math.cos(phi2) * math.sin((lambda2 - lambda1) / 2) ** 2
        )
    )

    if delta_sigma == 0:
        return lat1, lon1

    a = math.sin((1 - fraction) * delta_sigma) / math.sin(delta_sigma)
    b = math.sin(fraction * delta_sigma) / math.sin(delta_sigma)

    x = a * math.cos(phi1) * math.cos(lambda1) + b * math.cos(phi2) * math.cos(lambda2)
    y = a * math.cos(phi1) * math.sin(lambda1) + b * math.cos(phi2) * math.sin(lambda2)
    z = a * math.sin(phi1) + b * math.sin(phi2)

    phi_i = math.atan2(z, math.sqrt(x**2 + y**2))
    lambda_i = math.atan2(y, x)

    return math.degrees(phi_i), math.degrees(lambda_i)


def apply_lateral_offset(lat, lon, bearing, offset_km):
    """
    Offset a point perpendicular to the route bearing (bearing + 90 degrees).
    Positive offset = right/north, negative = left/south.
    """
    earth_radius = 6371.0  # km
    perp_bearing = (bearing + 90) % 360
    theta = math.radians(perp_bearing)
    delta = offset_km / earth_radius

    phi1 = math.radians(lat)
    lambda1 = math.radians(lon)

    phi2 = math.asin(math.sin(phi1) * math.cos(delta) + math.cos(phi1) * math.sin(delta) * math.cos(theta))
    lambda2 = lambda1 + math.atan2(
        math.sin(theta) * math.sin(delta) * math.cos(phi1),
        math.cos(delta) - math.sin(phi1) * math.sin(phi2)
    )

    return math.degrees(phi2), (math.degrees(lambda2) + 540) % 360 - 180


def generate_candidate_routes(origin, destination, cruise_speed_kmh=850.0):
    """
    Generates 3 routes: Direct, Northern Deviation, Southern Deviation.
    Each route has 5 evenly spaced waypoints.
    """
    lat1, lon1 = origin["latitude"], origin["longitude"]
    lat2, lon2 = destination["latitude"], destination["longitude"]

    base_bearing = calculate_bearing(lat1, lon1, lat2, lon2)
    direct_dist_km = geodesic((lat1, lon1), (lat2, lon2)).kilometers

    # Deviation scale is proportional to distance, capped reasonably (e.g. 150-400 km)
    max_dev_km = min(max(direct_dist_km * 0.15, 120.0), 380.0)

    fractions = [0.0, 0.25, 0.5, 0.75, 1.0]

    routes = [
        {
            "id": "direct",
            "name": "Direct Route",
            "type": "direct",
            "description": "Shortest great-circle path between origin and destination.",
            "offset_mult": 0.0,
        },
        {
            "id": "northern",
            "name": "Northern Deviation",
            "type": "northern",
            "description": "Alternative path deviated to the north of the direct corridor.",
            "offset_mult": 1.0,
        },
        {
            "id": "southern",
            "name": "Southern Deviation",
            "type": "southern",
            "description": "Alternative path deviated to the south of the direct corridor.",
            "offset_mult": -1.0,
        },
    ]

    result = []
    for r in routes:
        waypoints = []
        mult = r["offset_mult"]

        for i, frac in enumerate(fractions):
            base_lat, base_lon = intermediate_point(lat1, lon1, lat2, lon2, frac)
            # Sine envelope so endpoints stay at origin and destination, max deflection at midpoint
            envelope = math.sin(frac * math.pi)
            offset = mult * max_dev_km * envelope

            if abs(offset) > 0.1:
                wp_lat, wp_lon = apply_lateral_offset(base_lat, base_lon, base_bearing, offset)
            else:
                wp_lat, wp_lon = base_lat, base_lon

            # Calculate bearing at this waypoint
            next_frac = min(frac + 0.05, 1.0)
            if frac < 1.0:
                n_lat, n_lon = intermediate_point(lat1, lon1, lat2, lon2, next_frac)
                wp_bearing = calculate_bearing(wp_lat, wp_lon, n_lat, n_lon)
            else:
                wp_bearing = base_bearing

            wp_name = "Origin" if i == 0 else ("Destination" if i == 4 else f"Waypoint {i}")

            waypoints.append({
                "index": i,
                "name": wp_name,
                "latitude": round(wp_lat, 4),
                "longitude": round(wp_lon, 4),
                "bearing": round(wp_bearing, 1),
                "fraction": frac,
            })

        # Calculate total route distance along the waypoints
        total_dist = 0.0
        for i in range(len(waypoints) - 1):
            p1 = (waypoints[i]["latitude"], waypoints[i]["longitude"])
            p2 = (waypoints[i + 1]["latitude"], waypoints[i + 1]["longitude"])
            total_dist += geodesic(p1, p2).kilometers

        result.append({
            "id": r["id"],
            "name": r["name"],
            "type": r["type"],
            "description": r["description"],
            "total_distance_km": round(total_dist, 1),
            "waypoints": waypoints,
        })

    return result
