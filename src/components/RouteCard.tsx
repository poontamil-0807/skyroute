import React, { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Wind, Thermometer, Droplets, Clock, Navigation, AlertTriangle, ShieldCheck } from "lucide-react";
import { FlightRoute } from "../types";

interface RouteCardProps {
  route: FlightRoute;
  isRecommended: boolean;
  isSelected: boolean;
  verdict: string;
  onSelect: () => void;
  reasoningNote?: string;
}

export const RouteCard: React.FC<RouteCardProps> = ({
  route,
  isRecommended,
  isSelected,
  verdict,
  onSelect,
  reasoningNote,
}) => {
  const [expandedWhy, setExpandedWhy] = useState(isRecommended);

  const getRiskBadge = (risk: "Low" | "Medium" | "High") => {
    if (risk === "Low") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
          <ShieldCheck className="w-3 h-3" />
          LOW RISK
        </span>
      );
    }
    if (risk === "Medium") {
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          MEDIUM RISK
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-red-500/15 text-red-400 border border-red-500/30 flex items-center gap-1">
        <AlertTriangle className="w-3 h-3" />
        HIGH RISK
      </span>
    );
  };

  const cardBorder = isRecommended
    ? "border-emerald-500 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40"
    : isSelected
    ? "border-blue-500 shadow-md shadow-blue-500/10"
    : "border-[#1E2E4A] hover:border-[#2E456E]";

  return (
    <div
      id={`route-card-${route.id}`}
      onClick={onSelect}
      className={`rounded-xl bg-[#0F1A2E] border p-4 sm:p-5 transition cursor-pointer relative ${cardBorder}`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-1.5">
              {route.name}
            </h3>
            {isRecommended && (
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-500 text-slate-950 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" />
                ✓ RECOMMENDED
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{route.description}</p>
        </div>

        <div>{getRiskBadge(route.stats.risk_level)}</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 py-3 px-3 rounded-lg bg-[#142036] border border-[#1A2C4A] text-xs mb-3">
        {/* Distance */}
        <div>
          <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
            <Navigation className="w-3 h-3 text-blue-400" />
            Distance
          </span>
          <p className="font-mono font-bold text-slate-100 mt-0.5">
            {route.stats.total_distance_km.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">km</span>
          </p>
        </div>

        {/* Est. Time */}
        <div>
          <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3 text-emerald-400" />
            Est. Time
          </span>
          <p className="font-mono font-bold text-slate-100 mt-0.5">
            {route.stats.estimated_flight_time}
          </p>
        </div>

        {/* Avg Temp */}
        <div>
          <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
            <Thermometer className="w-3 h-3 text-amber-400" />
            Avg Temp
          </span>
          <p className="font-mono font-bold text-slate-100 mt-0.5">
            {route.stats.avg_temperature_c}°C
          </p>
        </div>

        {/* Avg Humidity */}
        <div>
          <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
            <Droplets className="w-3 h-3 text-sky-400" />
            Avg Hum.
          </span>
          <p className="font-mono font-bold text-slate-100 mt-0.5">
            {route.stats.avg_humidity_pct}%
          </p>
        </div>

        {/* Avg Wind Speed */}
        <div className="col-span-2 sm:col-span-1">
          <span className="text-[10px] font-mono uppercase text-slate-400 flex items-center gap-1">
            <Wind className="w-3 h-3 text-teal-400" />
            Avg Wind
          </span>
          <p className="font-mono font-bold text-slate-100 mt-0.5">
            {route.stats.avg_wind_speed_kmh} <span className="text-[10px] font-normal text-slate-400">km/h</span>
          </p>
        </div>
      </div>

      {/* One-line Plain-English Verdict */}
      <div className="flex items-start gap-2 text-xs text-slate-300 font-sans leading-relaxed mb-2.5">
        <span className="text-blue-400 font-mono font-semibold shrink-0">Verdict:</span>
        <span>{verdict || "Corridor evaluated against active atmospheric conditions."}</span>
      </div>

      {/* Hazards pill if present */}
      {route.stats.hazards && route.stats.hazards.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {route.stats.hazards.map((h, i) => (
            <span
              key={i}
              className="px-2 py-0.5 rounded text-[10px] font-mono bg-red-500/10 text-red-300 border border-red-500/20"
            >
              ⚠ {h}
            </span>
          ))}
        </div>
      )}

      {/* Expandable "Why?" Section */}
      <div className="border-t border-[#1C2C47] pt-2 mt-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpandedWhy(!expandedWhy);
          }}
          className="flex items-center justify-between w-full text-xs font-mono text-slate-400 hover:text-blue-400 transition"
        >
          <span className="flex items-center gap-1">
            <span>Agentic Reasoning ({isRecommended ? "Why chosen?" : "Why not primary?"})</span>
          </span>
          {expandedWhy ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>

        {expandedWhy && (
          <div className="mt-2 text-xs font-sans text-slate-300 bg-[#121E33] p-3 rounded-lg border border-[#1A2942] leading-relaxed">
            <p>
              {reasoningNote ||
                (isRecommended
                  ? `${route.name} was selected because it maximizes fuel/ground efficiency with an effective speed of ${route.stats.effective_ground_speed_kmh} km/h while avoiding hazardous wind shear and convective storm cells.`
                  : `${route.name} provides a secondary alternative, but exhibits higher drag/headwind vectors or deviates further from the optimum geodesic path.`)}
            </p>
            <div className="mt-2 text-[10px] font-mono text-slate-400 flex items-center justify-between">
              <span>Peak Corridor Wind: {route.stats.max_wind_speed_kmh} km/h</span>
              <span>Effective TAS: {route.stats.effective_ground_speed_kmh} km/h</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
