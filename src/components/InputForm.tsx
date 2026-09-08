import React, { useState } from "react";
import { ArrowRightLeft, Sliders, PlaneTakeoff, PlaneLanding, AlertTriangle, Sparkles, Clock, Gauge } from "lucide-react";
import { Airport } from "../types";

interface InputFormProps {
  onSubmit: (params: {
    from: string;
    to: string;
    cruiseAltitudeFt: number;
    cruiseSpeedKmh: number;
    departureTime: string;
  }) => void;
  error?: string | null;
  suggestions?: Airport[] | null;
  suggestionField?: "from" | "to" | null;
  isLoading?: boolean;
}

const PRESET_ROUTES = [
  { from: "Chennai", to: "Delhi", label: "Chennai (MAA) → Delhi (DEL)" },
  { from: "London", to: "Dubai", label: "London (LHR) → Dubai (DXB)" },
  { from: "Tokyo", to: "Singapore", label: "Tokyo (HND) → Singapore (SIN)" },
  { from: "New York", to: "Los Angeles", label: "New York (JFK) → Los Angeles (LAX)" },
];

export const InputForm: React.FC<InputFormProps> = ({
  onSubmit,
  error,
  suggestions,
  suggestionField,
  isLoading = false,
}) => {
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [altitude, setAltitude] = useState(35000);
  const [speed, setSpeed] = useState(850);
  const [departureTime, setDepartureTime] = useState("Now (Immediate)");

  const handleSwap = () => {
    setFromInput(toInput);
    setToInput(fromInput);
  };

  const handleSelectSuggestion = (airport: Airport) => {
    const text = airport.municipality || airport.name || airport.ident;
    if (suggestionField === "to") {
      setToInput(text);
    } else {
      setFromInput(text);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fromInput.trim() || !toInput.trim()) return;
    onSubmit({
      from: fromInput.trim(),
      to: toInput.trim(),
      cruiseAltitudeFt: altitude,
      cruiseSpeedKmh: speed,
      departureTime,
    });
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div id="flight-dispatch-card" className="bg-[#0F1A2E] border border-[#1E2E4A] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Radar background glow accent */}
        <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-60 h-60 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            Agentic ReAct Weather Routing Engine
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
            SkyRoute AI
          </h1>
          <p className="text-slate-400 text-sm mt-1.5 max-w-md mx-auto">
            AI-powered weather routing for pilots. Evaluates live wind shear, 
            icing, and storm cells along multi-corridor flight paths.
          </p>
        </div>

        {/* Error Banner with Fuzzy Matching Suggestions */}
        {error && (
          <div id="input-error-banner" className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold text-amber-300">{error}</p>
                {suggestions && suggestions.length > 0 && (
                  <div className="mt-2.5">
                    <p className="text-xs text-slate-300 mb-1.5 font-medium">
                      Did you mean one of these airports?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {suggestions.map((s) => (
                        <button
                          key={s.ident}
                          type="button"
                          onClick={() => handleSelectSuggestion(s)}
                          className="px-2.5 py-1 text-xs rounded-lg bg-[#192742] hover:bg-blue-600/30 text-slate-200 border border-[#2B4066] hover:border-blue-400 transition flex items-center gap-1.5"
                        >
                          <span className="font-mono text-blue-400 font-bold">{s.ident}</span>
                          <span>{s.municipality || s.name} ({s.country})</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Main From / To inputs side-by-side with swap */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr,auto,1fr] items-center gap-3">
            {/* FROM */}
            <div>
              <label htmlFor="from-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <PlaneTakeoff className="w-3.5 h-3.5 text-blue-400" />
                Origin (From)
              </label>
              <div className="relative">
                <input
                  id="from-input"
                  type="text"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  placeholder="City name or ICAO (e.g. Chennai, VOMM)"
                  className="w-full bg-[#131F35] border border-[#223554] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition outline-none"
                  required
                />
              </div>
            </div>

            {/* SWAP BUTTON */}
            <div className="flex justify-center sm:pt-6">
              <button
                id="swap-route-btn"
                type="button"
                onClick={handleSwap}
                title="Swap origin and destination"
                className="p-2.5 rounded-xl bg-[#15233C] hover:bg-[#1E3256] text-slate-300 hover:text-white border border-[#223554] hover:border-blue-500 transition active:scale-95"
              >
                <ArrowRightLeft className="w-4 h-4" />
              </button>
            </div>

            {/* TO */}
            <div>
              <label htmlFor="to-input" className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5 flex items-center gap-1.5">
                <PlaneLanding className="w-3.5 h-3.5 text-emerald-400" />
                Destination (To)
              </label>
              <div className="relative">
                <input
                  id="to-input"
                  type="text"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  placeholder="City name or ICAO (e.g. Delhi, VIDP)"
                  className="w-full bg-[#131F35] border border-[#223554] focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 transition outline-none"
                  required
                />
              </div>
            </div>
          </div>

          {/* Collapsible Advanced Section */}
          <div className="border-t border-[#1C2C47] pt-4">
            <button
              id="advanced-options-toggle"
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-blue-400 transition"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showAdvanced ? "Hide Advanced Options" : "Show Advanced Options"}</span>
              <span className="text-[10px] font-mono text-slate-500">
                ({altitude.toLocaleString()} ft • {speed} km/h)
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-4 p-4 rounded-xl bg-[#121E33] border border-[#1D2F4E] space-y-4 text-xs">
                {/* Altitude Slider */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-slate-300 font-medium flex items-center gap-1.5">
                      <Gauge className="w-3.5 h-3.5 text-blue-400" />
                      Cruise Altitude:
                    </span>
                    <span className="font-mono text-blue-400 font-semibold">{altitude.toLocaleString()} ft (FL{Math.round(altitude / 100)})</span>
                  </div>
                  <input
                    id="cruise-altitude-slider"
                    type="range"
                    min="15000"
                    max="45000"
                    step="1000"
                    value={altitude}
                    onChange={(e) => setAltitude(Number(e.target.value))}
                    className="w-full h-1.5 bg-[#1E2E4A] rounded-lg appearance-none cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono">
                    <span>FL150 (15k ft)</span>
                    <span>FL350 (Standard Jet)</span>
                    <span>FL450 (High Alt)</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Cruise Speed */}
                  <div>
                    <label className="block text-slate-300 font-medium mb-1">
                      Cruise TAS (True Airspeed):
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="400"
                        max="1100"
                        step="25"
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        className="w-full bg-[#0F192C] border border-[#223554] rounded-lg px-3 py-2 text-white font-mono"
                      />
                      <span className="text-slate-400 font-mono text-xs">km/h</span>
                    </div>
                  </div>

                  {/* Departure Time */}
                  <div>
                    <label className="block text-slate-300 font-medium mb-1 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-400" />
                      Departure Schedule:
                    </label>
                    <select
                      value={departureTime}
                      onChange={(e) => setDepartureTime(e.target.value)}
                      className="w-full bg-[#0F192C] border border-[#223554] rounded-lg px-3 py-2 text-white text-xs outline-none"
                    >
                      <option value="Now (Immediate)">Immediate Departure (Now)</option>
                      <option value="+2 Hours">+2 Hours (Pre-flight Planning)</option>
                      <option value="+6 Hours">+6 Hours (Extended Horizon)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Button */}
          <button
            id="find-best-route-btn"
            type="submit"
            disabled={isLoading || !fromInput.trim() || !toInput.trim()}
            className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold text-sm tracking-wide shadow-lg shadow-blue-600/25 transition active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Computing Flight Vectors & Weather...</span>
              </>
            ) : (
              <>
                <PlaneTakeoff className="w-4 h-4" />
                <span>Find Best Route</span>
              </>
            )}
          </button>

          {/* Quick Route Presets */}
          <div className="pt-2 border-t border-[#18263E]">
            <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mb-2 text-center">
              Quick Flight Corridors
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESET_ROUTES.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setFromInput(p.from);
                    setToInput(p.to);
                  }}
                  className="px-2 py-1.5 rounded-lg bg-[#131E33] hover:bg-[#1A2A47] text-slate-300 hover:text-white border border-[#1E2E4A] text-[11px] text-center truncate transition"
                >
                  {p.from} → {p.to}
                </button>
              ))}
            </div>
          </div>

          {/* Pilot Disclaimer */}
          <p className="text-center text-[11px] text-slate-500 leading-relaxed pt-2">
            Decision-support tool — human pilot makes the final call. Data sourced from live Open-Meteo feeds.
          </p>
        </form>
      </div>
    </div>
  );
};
