export interface Airport {
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

export interface WaypointWeather {
  temperature_c?: number;
  humidity_pct?: number;
  wind_speed_kmh?: number;
  wind_direction_deg?: number;
  available: boolean;
  error?: string;
}

export interface Waypoint {
  index: number;
  name: string;
  latitude: number;
  longitude: number;
  bearing: number;
  fraction: number;
  weather?: WaypointWeather;
}

export interface RouteStats {
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

export interface FlightRoute {
  id: string;
  name: string;
  type: "direct" | "northern" | "southern";
  description: string;
  total_distance_km: number;
  waypoints: Waypoint[];
  stats: RouteStats;
}

export interface AgentTraceStep {
  step: number;
  type: "thought" | "action";
  content?: string;
  tool?: string;
  arguments?: Record<string, any>;
  observation?: string;
}

export interface AgentResult {
  recommended_route: string;
  explanation: string;
  route_verdicts: Record<string, string>;
  reasoning_trace: AgentTraceStep[];
  status: string;
  agent_warning?: string;
}

export interface RouteAnalysisResponse {
  success: boolean;
  origin?: Airport;
  destination?: Airport;
  routes?: FlightRoute[];
  agent?: AgentResult;
  error?: string;
  field?: "from" | "to";
  suggestions?: Airport[];
}
