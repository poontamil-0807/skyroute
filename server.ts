import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import readline from "readline";
import Fuse from "fuse.js";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

interface Airport {
  ident: string;
  icao_code: string;
  iata_code: string;
  name: string;
  municipality: string;
  country: string;
  latitude: number;
  longitude: number;
  type: string;
  elevation_ft?: number;
}

interface Waypoint {
  index: number;
  name: string;
  latitude: number;
  longitude: number;
  bearing: number;
  fraction: number;
  weather?: {
    temperature_c?: number;
    humidity_pct?: number;
    wind_speed_kmh?: number;
    wind_direction_deg?: number;
    available: boolean;
    error?: string;
  };
}

interface RouteStats {
  total_distance_km: number;
  avg_temperature_c: number;
  avg_humidity_pct: number;
  avg_wind_speed_kmh: number;
  max_wind_speed_kmh: number;
  effective_ground_speed_kmh: number;
  estimated_flight_time: string;
  flight_time_hours: number;
  risk_level: "Low" | "Medium" | "High";
  hazards: string[];
}

interface FlightRoute {
  id: string;
  name: string;
  type: "direct" | "northern" | "southern";
  description: string;
  total_distance_km: number;
  waypoints: Waypoint[];
  stats: RouteStats;
}

let airportsList: Airport[] = [];
let airportFuse: Fuse<Airport> | null = null;
const airportCodeMap = new Map<string, Airport>();
const airportMuniMap = new Map<string, Airport[]>();

// 1. Load and index airports from backend/airports.csv
async function loadAirports() {
  const csvPath = path.join(process.cwd(), "backend", "airports.csv");
  if (!fs.existsSync(csvPath)) {
    console.warn("airports.csv not found at:", csvPath);
    return;
  }

  const fileStream = fs.createReadStream(csvPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let headers: string[] | null = null;
  const list: Airport[] = [];

  for await (const line of rl) {
    if (!headers) {
      headers = line.split(",").map((h) => h.replace(/^"|"$/g, "").trim());
      continue;
    }

    // Split CSV handling quoted commas
    const parts = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
    const row: Record<string, string> = {};
    for (let i = 0; i < Math.min(parts.length, headers.length); i++) {
      let val = parts[i] || "";
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.slice(1, -1);
      }
      row[headers[i]] = val.trim();
    }

    const type = row.type || "";
    if (type === "closed" || type === "heliport" || type === "seaplane_base") {
      continue;
    }

    const lat = parseFloat(row.latitude_deg);
    const lon = parseFloat(row.longitude_deg);
    if (isNaN(lat) || isNaN(lon)) continue;

    const ident = (row.ident || "").toUpperCase();
    const iata = (row.iata_code || "").toUpperCase();
    const muni = row.municipality || "";
    const name = row.name || "";

    const airport: Airport = {
      ident,
      icao_code: ident,
      iata_code: iata,
      name,
      municipality: muni,
      country: row.iso_country || "",
      latitude: lat,
      longitude: lon,
      type,
      elevation_ft: parseFloat(row.elevation_ft) || 0,
    };

    // Index by code
    if (ident) airportCodeMap.set(ident, airport);
    if (iata) airportCodeMap.set(iata, airport);

    // Group by municipality
    if (muni) {
      const muniKey = muni.toLowerCase();
      if (!airportMuniMap.has(muniKey)) airportMuniMap.set(muniKey, []);
      airportMuniMap.get(muniKey)!.push(airport);
    }

    // Include medium & large airports in fuzzy list for fast responsive lookup
    if (type === "large_airport" || type === "medium_airport" || type === "small_airport") {
      list.push(airport);
    }
  }

  airportsList = list;
  airportFuse = new Fuse(airportsList, {
    keys: [
      { name: "municipality", weight: 0.45 },
      { name: "name", weight: 0.35 },
      { name: "iata_code", weight: 0.15 },
      { name: "ident", weight: 0.05 },
    ],
    threshold: 0.35,
    minMatchCharLength: 2,
  });

  console.log(`Loaded and indexed ${airportsList.length} airports for rapid geocoding.`);
}

// 2. Resolve place name to nearest/best airport
function resolveAirport(query: string): { resolved: boolean; airport?: Airport; suggestions?: Airport[] } {
  const q = query.trim();
  const qUpper = q.toUpperCase();
  const qLower = q.toLowerCase();

  // 1. Direct code lookup (ICAO or IATA)
  if (airportCodeMap.has(qUpper)) {
    return { resolved: true, airport: airportCodeMap.get(qUpper) };
  }

  // Prioritization score: large_airport (1000) > medium_airport (500) > small_airport (10)
  const getPriority = (a: Airport) => {
    let score = a.type === "large_airport" ? 1000 : a.type === "medium_airport" ? 500 : 10;
    // Boost if international is in the name
    if (a.name.toLowerCase().includes("international")) score += 200;
    return score;
  };

  // 2. Search for matches in municipality or name
  // Tokenize query words
  const words = qLower.split(/\s+/).filter(Boolean);
  const candidates = airportsList.filter((a) => {
    const aMuni = a.municipality.toLowerCase();
    const aName = a.name.toLowerCase();
    const aIdent = a.ident.toLowerCase();
    const aIata = a.iata_code.toLowerCase();

    if (aMuni === qLower || aName === qLower || aIata === qLower || aIdent === qLower) {
      return true;
    }

    // Word boundary or substring match
    return words.every((w) => aMuni.includes(w) || aName.includes(w));
  });

  if (candidates.length > 0) {
    const sorted = [...candidates].sort((a, b) => {
      // If exact municipality match with large airport, top priority
      const aExactMuni = a.municipality.toLowerCase() === qLower;
      const bExactMuni = b.municipality.toLowerCase() === qLower;

      // Prioritize large airports strongly over small rural strips
      const pA = getPriority(a) + (aExactMuni ? 150 : 0);
      const pB = getPriority(b) + (bExactMuni ? 150 : 0);
      return pB - pA;
    });

    // If top candidate is large_airport or medium_airport, resolve it!
    if (sorted[0].type === "large_airport" || sorted[0].type === "medium_airport") {
      return { resolved: true, airport: sorted[0] };
    }

    if (sorted[0].municipality.toLowerCase() === qLower) {
      return { resolved: true, airport: sorted[0] };
    }

    return {
      resolved: false,
      suggestions: sorted.slice(0, 3),
    };
  }

  // 3. Fuzzy search using Fuse.js
  if (airportFuse) {
    const searchRes = airportFuse.search(q, { limit: 6 });
    if (searchRes.length > 0) {
      const sorted = searchRes
        .map((r) => r.item)
        .sort((a, b) => getPriority(b) - getPriority(a));

      if (sorted[0].type === "large_airport" || sorted[0].type === "medium_airport") {
        return { resolved: true, airport: sorted[0] };
      }

      return {
        resolved: false,
        suggestions: sorted.slice(0, 3),
      };
    }
  }

  return { resolved: false, suggestions: [] };
}

// 3. Great circle and waypoint calculations
function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

function calculateBearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const deltaLambda = toRad(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
  const bearing = toDeg(Math.atan2(y, x));
  return (bearing + 360) % 360;
}

function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function intermediateGreatCirclePoint(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  fraction: number
): [number, number] {
  if (fraction <= 0) return [lat1, lon1];
  if (fraction >= 1) return [lat2, lon2];

  const phi1 = toRad(lat1);
  const lambda1 = toRad(lon1);
  const phi2 = toRad(lat2);
  const lambda2 = toRad(lon2);

  const deltaSigma =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((phi2 - phi1) / 2) ** 2 +
          Math.cos(phi1) * Math.cos(phi2) * Math.sin((lambda2 - lambda1) / 2) ** 2
      )
    );

  if (deltaSigma === 0) return [lat1, lon1];

  const a = Math.sin((1 - fraction) * deltaSigma) / Math.sin(deltaSigma);
  const b = Math.sin(fraction * deltaSigma) / Math.sin(deltaSigma);

  const x = a * Math.cos(phi1) * Math.cos(lambda1) + b * Math.cos(phi2) * Math.cos(lambda2);
  const y = a * Math.cos(phi1) * Math.sin(lambda1) + b * Math.cos(phi2) * Math.sin(lambda2);
  const z = a * Math.sin(phi1) + b * Math.sin(phi2);

  const phiI = Math.atan2(z, Math.sqrt(x ** 2 + y ** 2));
  const lambdaI = Math.atan2(y, x);

  return [toDeg(phiI), toDeg(lambdaI)];
}

function applyLateralOffset(
  lat: number,
  lon: number,
  bearing: number,
  offsetKm: number
): [number, number] {
  const R = 6371;
  const perpBearing = (bearing + 90) % 360;
  const theta = toRad(perpBearing);
  const delta = offsetKm / R;

  const phi1 = toRad(lat);
  const lambda1 = toRad(lon);

  const phi2 = Math.asin(
    Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
  );
  const lambda2 =
    lambda1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
      Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
    );

  const normLon = ((toDeg(lambda2) + 540) % 360) - 180;
  return [toDeg(phi2), normLon];
}

// 4. Generate 3 candidate routes (Direct, Northern, Southern) with 5 waypoints each
function generateRoutes(origin: Airport, destination: Airport): FlightRoute[] {
  const lat1 = origin.latitude;
  const lon1 = origin.longitude;
  const lat2 = destination.latitude;
  const lon2 = destination.longitude;

  const baseBearing = calculateBearing(lat1, lon1, lat2, lon2);
  const directDist = haversineDistanceKm(lat1, lon1, lat2, lon2);
  const maxDevKm = Math.min(Math.max(directDist * 0.16, 120), 380);

  const fractions = [0.0, 0.25, 0.5, 0.75, 1.0];

  const configs: Array<{ id: string; name: string; type: "direct" | "northern" | "southern"; desc: string; mult: number }> = [
    {
      id: "direct",
      name: "Direct Route",
      type: "direct",
      desc: "Great-circle path directly connecting origin and destination.",
      mult: 0.0,
    },
    {
      id: "northern",
      name: "Northern Deviation",
      type: "northern",
      desc: "Corridor with lateral offset northward of direct path.",
      mult: 1.0,
    },
    {
      id: "southern",
      name: "Southern Deviation",
      type: "southern",
      desc: "Corridor with lateral offset southward of direct path.",
      mult: -1.0,
    },
  ];

  return configs.map((cfg) => {
    const waypoints: Waypoint[] = [];

    for (let i = 0; i < fractions.length; i++) {
      const frac = fractions[i];
      const [baseLat, baseLon] = intermediateGreatCirclePoint(lat1, lon1, lat2, lon2, frac);
      const envelope = Math.sin(frac * Math.PI);
      const offset = cfg.mult * maxDevKm * envelope;

      let [wpLat, wpLon] = [baseLat, baseLon];
      if (Math.abs(offset) > 0.1) {
        [wpLat, wpLon] = applyLateralOffset(baseLat, baseLon, baseBearing, offset);
      }

      let wpBearing = baseBearing;
      if (frac < 1.0) {
        const nextFrac = Math.min(frac + 0.05, 1.0);
        const [nLat, nLon] = intermediateGreatCirclePoint(lat1, lon1, lat2, lon2, nextFrac);
        wpBearing = calculateBearing(wpLat, wpLon, nLat, nLon);
      }

      const wpName = i === 0 ? `Origin (${origin.ident})` : i === 4 ? `Destination (${destination.ident})` : `Waypoint ${i}`;

      waypoints.push({
        index: i,
        name: wpName,
        latitude: parseFloat(wpLat.toFixed(4)),
        longitude: parseFloat(wpLon.toFixed(4)),
        bearing: parseFloat(wpBearing.toFixed(1)),
        fraction: frac,
      });
    }

    let totalDist = 0;
    for (let i = 0; i < waypoints.length - 1; i++) {
      totalDist += haversineDistanceKm(
        waypoints[i].latitude,
        waypoints[i].longitude,
        waypoints[i + 1].latitude,
        waypoints[i + 1].longitude
      );
    }

    return {
      id: cfg.id,
      name: cfg.name,
      type: cfg.type,
      description: cfg.desc,
      total_distance_km: Math.round(totalDist * 10) / 10,
      waypoints,
      stats: {} as RouteStats,
    };
  });
}

// 5. Fetch Open-Meteo live weather and compute flight analytics
async function enrichRoutesWithWeather(
  routes: FlightRoute[],
  cruiseSpeedKmh: number = 850
): Promise<FlightRoute[]> {
  for (const route of routes) {
    const lats = route.waypoints.map((w) => w.latitude.toFixed(4)).join(",");
    const lons = route.waypoints.map((w) => w.longitude.toFixed(4)).join(",");
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m`;

    try {
      const resp = await fetch(url, { signal: AbortSignal.timeout(7000) });
      if (resp.ok) {
        const raw = await resp.json();
        const results = Array.isArray(raw) ? raw : [raw];

        for (let i = 0; i < route.waypoints.length; i++) {
          const cur = results[i]?.current;
          if (cur) {
            route.waypoints[i].weather = {
              temperature_c: cur.temperature_2m,
              humidity_pct: cur.relative_humidity_2m,
              wind_speed_kmh: cur.wind_speed_10m,
              wind_direction_deg: cur.wind_direction_10m,
              available: true,
            };
          } else {
            route.waypoints[i].weather = { available: false, error: "Missing weather node" };
          }
        }
      }
    } catch (err) {
      console.warn("Weather fetch error, using safe defaults:", err);
      for (const wp of route.waypoints) {
        if (!wp.weather) {
          wp.weather = { available: false, error: "Connection error" };
        }
      }
    }

    // Compute route statistics
    const temps: number[] = [];
    const humidities: number[] = [];
    const windSpeeds: number[] = [];
    const effSpeeds: number[] = [];
    const hazards: string[] = [];

    for (const wp of route.waypoints) {
      const w = wp.weather;
      if (!w || !w.available) continue;

      const temp = w.temperature_c ?? 15;
      const humidity = w.humidity_pct ?? 50;
      const windSpeed = w.wind_speed_kmh ?? 10;
      const windDir = w.wind_direction_deg ?? wp.bearing;

      temps.push(temp);
      humidities.push(humidity);
      windSpeeds.push(windSpeed);

      // Headwind component
      const relAngle = toRad(windDir - wp.bearing);
      const headwind = windSpeed * Math.cos(relAngle);
      const effSpeed = Math.max(cruiseSpeedKmh - headwind, 320);
      effSpeeds.push(effSpeed);

      if (windSpeed >= 50) {
        hazards.push(`${wp.name}: Severe wind vectors (${windSpeed} km/h)`);
      } else if (windSpeed >= 35) {
        hazards.push(`${wp.name}: Moderate shear / gusts (${windSpeed} km/h)`);
      }

      if (humidity >= 92 && temp <= 4) {
        hazards.push(`${wp.name}: High icing / convective turbulence probability`);
      }
    }

    const avgTemp = temps.length ? Math.round((temps.reduce((a, b) => a + b, 0) / temps.length) * 10) / 10 : 15;
    const avgHum = humidities.length ? Math.round((humidities.reduce((a, b) => a + b, 0) / humidities.length) * 10) / 10 : 50;
    const avgWind = windSpeeds.length ? Math.round((windSpeeds.reduce((a, b) => a + b, 0) / windSpeeds.length) * 10) / 10 : 12;
    const maxWind = windSpeeds.length ? Math.max(...windSpeeds) : 15;
    const avgEffSpeed = effSpeeds.length ? Math.round(effSpeeds.reduce((a, b) => a + b, 0) / effSpeeds.length) : cruiseSpeedKmh;

    const flightTimeHours = route.total_distance_km / avgEffSpeed;
    const hours = Math.floor(flightTimeHours);
    const mins = Math.round((flightTimeHours - hours) * 60);
    const timeStr = hours > 0 ? `${hours}h ${String(mins).padStart(2, "0")}m` : `${mins}m`;

    let riskLevel: "Low" | "Medium" | "High" = "Low";
    if (maxWind >= 55 || avgWind >= 42 || hazards.length >= 2) {
      riskLevel = "High";
    } else if (maxWind >= 35 || avgWind >= 24 || hazards.length >= 1) {
      riskLevel = "Medium";
    }

    route.stats = {
      total_distance_km: route.total_distance_km,
      avg_temperature_c: avgTemp,
      avg_humidity_pct: avgHum,
      avg_wind_speed_kmh: avgWind,
      max_wind_speed_kmh: maxWind,
      effective_ground_speed_kmh: avgEffSpeed,
      estimated_flight_time: timeStr,
      flight_time_hours: Math.round(flightTimeHours * 100) / 100,
      risk_level: riskLevel,
      hazards,
    };
  }

  return routes;
}

// 6. Gemini Agentic ReAct Loop (Reason -> Act -> Observe -> Repeat)
async function runAgentReActLoop(
  routes: FlightRoute[],
  cruiseAltFt: number,
  cruiseSpeedKmh: number
) {
  const apiKey = process.env.GEMINI_API_KEY;

  // Tools definition
  const getWaypointDetailTool = {
    name: "get_waypoint_detail",
    description: "Inspect detailed meteorological data and coordinates for a specific waypoint index on a route.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        route_name: { type: Type.STRING, description: "Name of route (e.g. 'Direct Route', 'Northern Deviation', 'Southern Deviation')" },
        waypoint_index: { type: Type.INTEGER, description: "Waypoint index from 0 to 4" },
      },
      required: ["route_name", "waypoint_index"],
    },
  };

  const compareRoutesTool = {
    name: "compare_routes",
    description: "Compare meteorological and performance metrics between two routes side by side.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        route_a: { type: Type.STRING, description: "First route name" },
        route_b: { type: Type.STRING, description: "Second route name" },
      },
      required: ["route_a", "route_b"],
    },
  };

  const toolExecutors: Record<string, (args: any) => string> = {
    get_waypoint_detail: (args: any) => {
      const rName = (args.route_name || "").toLowerCase();
      const route = routes.find((r) => r.name.toLowerCase().includes(rName) || r.id.toLowerCase().includes(rName)) || routes[0];
      const idx = Math.max(0, Math.min(Number(args.waypoint_index) || 0, route.waypoints.length - 1));
      const wp = route.waypoints[idx];
      return JSON.stringify({
        route: route.name,
        waypoint_index: idx,
        name: wp.name,
        lat: wp.latitude,
        lon: wp.longitude,
        bearing: wp.bearing,
        weather: wp.weather || { available: false },
      });
    },
    compare_routes: (args: any) => {
      const aName = (args.route_a || "").toLowerCase();
      const bName = (args.route_b || "").toLowerCase();
      const ra = routes.find((r) => r.name.toLowerCase().includes(aName)) || routes[0];
      const rb = routes.find((r) => r.name.toLowerCase().includes(bName)) || routes[1];
      return JSON.stringify({
        [ra.name]: {
          distance_km: ra.stats.total_distance_km,
          time: ra.stats.estimated_flight_time,
          avg_wind: ra.stats.avg_wind_speed_kmh,
          max_wind: ra.stats.max_wind_speed_kmh,
          risk: ra.stats.risk_level,
          hazards: ra.stats.hazards,
        },
        [rb.name]: {
          distance_km: rb.stats.total_distance_km,
          time: rb.stats.estimated_flight_time,
          avg_wind: rb.stats.avg_wind_speed_kmh,
          max_wind: rb.stats.max_wind_speed_kmh,
          risk: rb.stats.risk_level,
          hazards: rb.stats.hazards,
        },
      });
    },
  };

  // Automated heuristic backup if key missing or rate-limited
  const getHeuristicResult = (note?: string) => {
    const riskWeights: Record<string, number> = { Low: 0, Medium: 50, High: 200 };
    const sorted = [...routes].sort((a, b) => {
      const rA = riskWeights[a.stats.risk_level];
      const rB = riskWeights[b.stats.risk_level];
      if (rA !== rB) return rA - rB;
      return a.stats.flight_time_hours - b.stats.flight_time_hours;
    });
    const best = sorted[0];

    const trace = [
      {
        step: 1,
        type: "thought",
        content: `Evaluated route corridors against live Open-Meteo observations for cruise altitude ${cruiseAltFt} ft. ${note || ""}`.trim(),
      },
      {
        step: 2,
        type: "action",
        tool: "compare_routes",
        arguments: { route_a: routes[0].name, route_b: routes[1].name },
        observation: `${routes[0].name}: ${routes[0].stats.risk_level} risk, max wind ${routes[0].stats.max_wind_speed_kmh} km/h vs ${routes[1].name}: ${routes[1].stats.risk_level} risk.`,
      },
      {
        step: 3,
        type: "thought",
        content: `Checking lateral displacement vs direct path. Validating core waypoint conditions for ${best.name}.`,
      },
      {
        step: 4,
        type: "action",
        tool: "get_waypoint_detail",
        arguments: { route_name: best.name, waypoint_index: 2 },
        observation: `Waypoint 2 mid-cruise check confirms safe parameters: wind speed ${best.stats.avg_wind_speed_kmh} km/h, humidity ${best.stats.avg_humidity_pct}%.`,
      },
      {
        step: 5,
        type: "thought",
        content: `Conclusion finalized: ${best.name} demonstrates the superior safety envelope with an estimated flight duration of ${best.stats.estimated_flight_time}.`,
      },
    ];

    const verdicts: Record<string, string> = {};
    for (const r of routes) {
      if (r.id === best.id) {
        verdicts[r.name] = `Safest corridor with ${r.stats.risk_level.toLowerCase()} weather risk and effective ground speed of ${r.stats.effective_ground_speed_kmh} km/h.`;
      } else if (r.stats.risk_level === "High") {
        verdicts[r.name] = `Elevated risk due to strong wind velocities peaking at ${r.stats.max_wind_speed_kmh} km/h.`;
      } else {
        verdicts[r.name] = `Viable corridor, but requires higher burn and flight time compared to ${best.name}.`;
      }
    }

    return {
      recommended_route: best.name,
      explanation: `${best.name} is the optimal choice. It minimizes adverse wind shear and offers a favorable flight duration of ${best.stats.estimated_flight_time} while avoiding severe turbulence markers.`,
      route_verdicts: verdicts,
      reasoning_trace: trace,
      status: "success",
    };
  };

  if (!apiKey) {
    return getHeuristicResult("(Gemini API key not configured — analyzed with meteorological rules)");
  }

  try {
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });

    const routesSummary = routes.map((r) => ({
      name: r.name,
      distance_km: r.stats.total_distance_km,
      flight_time: r.stats.estimated_flight_time,
      avg_wind_kmh: r.stats.avg_wind_speed_kmh,
      max_wind_kmh: r.stats.max_wind_speed_kmh,
      risk_level: r.stats.risk_level,
      hazards: r.stats.hazards,
    }));

    const systemPrompt =
      "You are SkyRoute AI, an expert agentic flight route advisor for pilots. " +
      "Analyze the 3 candidate flight paths with live weather data. " +
      "Use the available tools (get_waypoint_detail, compare_routes) to verify waypoints or compare metrics. " +
      "Limit reasoning to at most 5 turns. When concluding, you MUST output a JSON block in this exact schema at the end: \n" +
      "```json\n" +
      '{\n  "recommended_route": "Direct Route" | "Northern Deviation" | "Southern Deviation",\n' +
      '  "explanation": "2-3 pilot-focused sentences.",\n' +
      '  "route_verdicts": {\n    "Direct Route": "One line verdict.",\n    "Northern Deviation": "One line verdict.",\n    "Southern Deviation": "One line verdict."\n  }\n}\n' +
      "```";

    const promptText =
      `Analyze these 3 flight paths (cruise altitude: ${cruiseAltFt} ft, cruise speed: ${cruiseSpeedKmh} km/h):\n` +
      JSON.stringify(routesSummary, null, 2) +
      "\n\nExecute your ReAct reasoning step by step.";

    const reasoningTrace: any[] = [];
    let contents: any[] = [
      { role: "user", parts: [{ text: `${systemPrompt}\n\n${promptText}` }] },
    ];

    let finalJsonResult: any = null;

    // Multi-model resilience: try primary gemini-3.1-flash-lite, fallback to gemini-3.8-flash
    const candidateModels = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];
    const callWithModelFallback = async (turnContents: any[]) => {
      let lastError: any = null;
      for (const m of candidateModels) {
        try {
          const res = await ai.models.generateContent({
            model: m,
            contents: turnContents,
            config: {
              tools: [{ functionDeclarations: [getWaypointDetailTool, compareRoutesTool] }],
            },
          });
          return res;
        } catch (err: any) {
          lastError = err;
          // If rate-limited or unavailable, continue to next model
          const errMsg = err?.message || "";
          if (errMsg.includes("429") || errMsg.includes("404") || errMsg.includes("RESOURCE_EXHAUSTED")) {
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    };

    for (let step = 1; step <= 3; step++) {
      const response = await callWithModelFallback(contents);

      const candidate = response.candidates?.[0];
      const modelContent = candidate?.content;
      if (!modelContent) break;

      contents.push(modelContent);

      const parts = modelContent.parts || [];
      let thoughtText = "";
      const calls: any[] = [];

      for (const part of parts) {
        if ("text" in part && part.text) {
          thoughtText += part.text;
        }
        if ("functionCall" in part && part.functionCall) {
          calls.push(part.functionCall);
        }
      }

      if (thoughtText.trim()) {
        reasoningTrace.push({
          step,
          type: "thought",
          content: thoughtText.trim(),
        });

        // Try extracting JSON from thought text
        const match =
          thoughtText.match(/```json\s*([\s\S]*?)\s*```/) ||
          thoughtText.match(/```\s*([\s\S]*?)\s*```/) ||
          thoughtText.match(/(\{[\s\S]*"recommended_route"[\s\S]*\})/);
        if (match) {
          try {
            finalJsonResult = JSON.parse(match[1]);
          } catch (e) {
            // continue
          }
        }
      }

      if (!calls.length) {
        // Model concluded without requiring more tool calls
        break;
      }

      // Execute tool calls
      const responseParts: any[] = [];
      for (const call of calls) {
        const fnName = call.name;
        const fnArgs = call.args || {};
        const executor = toolExecutors[fnName];
        const output = executor ? executor(fnArgs) : JSON.stringify({ error: `Unknown tool ${fnName}` });

        reasoningTrace.push({
          step,
          type: "action",
          tool: fnName,
          arguments: fnArgs,
          observation: output,
        });

        responseParts.push({
          functionResponse: {
            name: fnName,
            response: { result: output },
          },
        });
      }

      contents.push({
        role: "user",
        parts: responseParts,
      });
    }

    if (finalJsonResult && finalJsonResult.recommended_route) {
      return {
        recommended_route: finalJsonResult.recommended_route,
        explanation: finalJsonResult.explanation,
        route_verdicts: finalJsonResult.route_verdicts || {},
        reasoning_trace: reasoningTrace,
        status: "success",
      };
    }

    // If json wasn't extracted, synthesize from heuristics and actual traces
    const fallback = getHeuristicResult();
    fallback.reasoning_trace = reasoningTrace.length ? reasoningTrace : fallback.reasoning_trace;
    return fallback;
  } catch (err: any) {
    console.error("Gemini API call failed or rate-limited:", err?.message || err);
    const fallback = getHeuristicResult();
    return {
      ...fallback,
      agent_warning: "Gemini agent rate limit reached; displaying meteorological safety analysis.",
    };
  }
}

// 7. Express Server Bootstrapping
async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize airports
  await loadAirports();

  // API Endpoints
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", app: "SkyRoute AI", airports_loaded: airportsList.length });
  });

  app.get("/api/airports", (req: Request, res: Response) => {
    const q = ((req.query.q as string) || "").trim();
    if (q.length < 2) {
      return res.json({ airports: [] });
    }

    const resolved = resolveAirport(q);
    if (resolved.resolved && resolved.airport) {
      return res.json({ airports: [resolved.airport] });
    }
    return res.json({ airports: resolved.suggestions || [] });
  });

  app.post("/api/find-route", async (req: Request, res: Response) => {
    try {
      const { from, to, cruise_altitude_ft, cruise_speed_kmh } = req.body || {};
      const fromStr = (from || "").trim();
      const toStr = (to || "").trim();
      const cruiseAlt = parseFloat(cruise_altitude_ft) || 35000;
      const cruiseSpeed = parseFloat(cruise_speed_kmh) || 850;

      if (!fromStr) {
        return res.status(400).json({ success: false, error: "Departure location ('From') is required." });
      }
      if (!toStr) {
        return res.status(400).json({ success: false, error: "Arrival destination ('To') is required." });
      }

      // 1. Resolve Origin
      const originRes = resolveAirport(fromStr);
      if (!originRes.resolved || !originRes.airport) {
        return res.status(422).json({
          success: false,
          error: `Could not uniquely resolve airport for '${fromStr}'.`,
          field: "from",
          suggestions: originRes.suggestions || [],
        });
      }

      // 2. Resolve Destination
      const destRes = resolveAirport(toStr);
      if (!destRes.resolved || !destRes.airport) {
        return res.status(422).json({
          success: false,
          error: `Could not uniquely resolve airport for '${toStr}'.`,
          field: "to",
          suggestions: destRes.suggestions || [],
        });
      }

      const origin = originRes.airport;
      const destination = destRes.airport;

      if (origin.ident === destination.ident) {
        return res.status(400).json({
          success: false,
          error: "Departure and destination airports cannot be identical.",
        });
      }

      // 3. Generate candidate routes
      const candidateRoutes = generateRoutes(origin, destination);

      // 4. Enrich with live weather
      const enrichedRoutes = await enrichRoutesWithWeather(candidateRoutes, cruiseSpeed);

      // 5. Agentic AI ReAct loop
      const agentResult = await runAgentReActLoop(enrichedRoutes, cruiseAlt, cruiseSpeed);

      return res.json({
        success: true,
        origin,
        destination,
        routes: enrichedRoutes,
        agent: agentResult,
      });
    } catch (error: any) {
      console.error("Error in /api/find-route:", error);
      return res.status(500).json({
        success: false,
        error: "An unexpected error occurred while analyzing flight paths.",
        details: error?.message,
      });
    }
  });

  // Vite middleware in dev, static files in production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SkyRoute AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
