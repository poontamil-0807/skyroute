"""
Geocoding module: Place name to airport resolution using OurAirports CSV and rapidfuzz.
"""

import os
import pandas as pd
from rapidfuzz import process, fuzz

AIRPORTS_CSV_PATH = os.path.join(os.path.dirname(__file__), "airports.csv")

_airports_df = None


def get_airports_df():
    global _airports_df
    if _airports_df is None:
        if not os.path.exists(AIRPORTS_CSV_PATH):
            raise FileNotFoundError(f"airports.csv not found at {AIRPORTS_CSV_PATH}")
        df = pd.read_csv(AIRPORTS_CSV_PATH, low_memory=False)
        # Filter for valid airports with coordinates
        df = df[df["latitude_deg"].notna() & df["longitude_deg"].notna()]
        # Filter out closed airports if type column has 'closed'
        df = df[df["type"] != "closed"]
        # Standardize strings
        df["municipality_clean"] = df["municipality"].fillna("").astype(str).str.strip().str.lower()
        df["name_clean"] = df["name"].fillna("").astype(str).str.strip().str.lower()
        df["ident_clean"] = df["ident"].fillna("").astype(str).str.strip().str.upper()
        df["iata_clean"] = df["iata_code"].fillna("").astype(str).str.strip().str.upper()
        _airports_df = df
    return _airports_df


def format_airport_record(row):
    return {
        "ident": str(row["ident"]),
        "icao_code": str(row["ident"]),
        "iata_code": str(row["iata_code"]) if pd.notna(row["iata_code"]) else "",
        "name": str(row["name"]),
        "municipality": str(row["municipality"]) if pd.notna(row["municipality"]) else "",
        "country": str(row["iso_country"]) if pd.notna(row["iso_country"]) else "",
        "latitude": float(row["latitude_deg"]),
        "longitude": float(row["longitude_deg"]),
        "type": str(row["type"]) if pd.notna(row["type"]) else "airport",
    }


def resolve_airport(place_name: str):
    """
    Resolves a place name or airport code into the best matching airport.
    Returns:
      {
        "resolved": True,
        "airport": { ... }
      }
      or
      {
        "resolved": False,
        "suggestions": [ { ... }, ... ]
      }
    """
    df = get_airports_df()
    query = place_name.strip()
    q_lower = query.lower()
    q_upper = query.upper()

    # 1. Exact ICAO or IATA code match
    exact_code = df[(df["ident_clean"] == q_upper) | (df["iata_clean"] == q_upper)]
    if not exact_code.empty:
        # Prioritize large or medium airports if multiple
        top = exact_code.sort_values(by="type", ascending=False).iloc[0]
        return {"resolved": True, "airport": format_airport_record(top)}

    # 2. Substring or exact municipality match (prioritizing large > medium > small)
    type_priority = {"large_airport": 3, "medium_airport": 2, "small_airport": 1}
    muni_matches = df[
        (df["municipality_clean"] == q_lower) |
        (df["municipality_clean"].str.contains(r'\b' + q_lower + r'\b', regex=True, na=False)) |
        (df["iata_clean"] == q_upper)
    ]
    if not muni_matches.empty:
        muni_matches = muni_matches.copy()
        muni_matches["priority"] = muni_matches["type"].map(lambda t: type_priority.get(t, 0))
        top = muni_matches.sort_values(by=["priority", "elevation_ft"], ascending=False).iloc[0]
        return {"resolved": True, "airport": format_airport_record(top)}

    # 3. Exact airport name match or name contains phrase
    exact_name = df[df["name_clean"].str.contains(r'\b' + q_lower + r'\b', regex=True, na=False)]
    if not exact_name.empty:
        exact_name = exact_name.copy()
        exact_name["priority"] = exact_name["type"].map(lambda t: type_priority.get(t, 0))
        top = exact_name.sort_values(by=["priority", "elevation_ft"], ascending=False).iloc[0]
        return {"resolved": True, "airport": format_airport_record(top)}

    # 4. Fuzzy search using rapidfuzz across municipalities and names
    # Create searchable representation: "City - Name (CODE)"
    # Focus search on medium and large airports first for speed, then others
    major_airports = df[df["type"].isin(["large_airport", "medium_airport"])].copy()
    if major_airports.empty or len(major_airports) < 100:
        major_airports = df

    search_pool = {}
    for idx, row in major_airports.iterrows():
        muni = str(row["municipality"]) if pd.notna(row["municipality"]) else ""
        name = str(row["name"])
        ident = str(row["ident"])
        desc = f"{muni} {name} {ident}".strip().lower()
        search_pool[idx] = desc

    matches = process.extract(
        q_lower,
        search_pool,
        scorer=fuzz.WRatio,
        limit=5
    )

    if not matches:
        return {"resolved": False, "suggestions": []}

    best_match = matches[0]
    best_score = best_match[1]
    best_idx = best_match[2]

    # If top score is strong (> 85), treat as resolved
    if best_score >= 85:
        row = df.loc[best_idx]
        return {"resolved": True, "airport": format_airport_record(row)}

    # Otherwise return top 3 suggestions for user to choose from
    suggestions = []
    for match in matches[:3]:
        idx = match[2]
        suggestions.append(format_airport_record(df.loc[idx]))

    return {"resolved": False, "suggestions": suggestions}
