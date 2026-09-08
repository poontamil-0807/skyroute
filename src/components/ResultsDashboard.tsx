import React, { useState } from "react";
import { ArrowLeft, RotateCcw, Plane, ShieldCheck, AlertCircle } from "lucide-react";
import { Airport, FlightRoute, AgentResult } from "../types";
import { MapView } from "./MapView";
import { RouteCard } from "./RouteCard";
import { AgentReasoningLog } from "./AgentReasoningLog";

interface ResultsDashboardProps {
  origin: Airport;
  destination: Airport;
  routes: FlightRoute[];
  agent: AgentResult;
  onNewSearch: () => void;
}

export const ResultsDashboard: React.FC<ResultsDashboardProps> = ({
  origin,
  destination,
  routes,
  agent,
  onNewSearch,
}) => {
  // Sort routes so recommended route appears first
  const recommendedRouteName = agent.recommended_route || routes[0]?.name || "";
  const sortedRoutes = [...routes].sort((a, b) => {
    if (a.name === recommendedRouteName) return -1;
    if (b.name === recommendedRouteName) return 1;
    return 0;
  });

  const [selectedRouteId, setSelectedRouteId] = useState<string>(
    sortedRoutes[0]?.id || "direct"
  );

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Route Header Banner */}
      <div id="results-top-banner" className="bg-[#0F1A2E] border border-[#1E2E4A] rounded-2xl p-4 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
            <Plane className="w-6 h-6 -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-lg sm:text-xl font-bold text-white font-mono">
                {origin.ident} ({origin.municipality || origin.name})
              </span>
              <span className="text-slate-500">➔</span>
              <span className="text-lg sm:text-xl font-bold text-white font-mono">
                {destination.ident} ({destination.municipality || destination.name})
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              3 corridors evaluated with real-time Open-Meteo atmospheric telemetry.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-end">
          <button
            id="start-new-search-btn"
            onClick={onNewSearch}
            className="w-full md:w-auto px-4 py-2.5 rounded-xl bg-[#16243D] hover:bg-[#1E3356] text-slate-200 border border-[#253A61] text-xs font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
            <span>Start New Search</span>
          </button>
        </div>
      </div>

      {/* Recommended Route Executive Callout */}
      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs">
          <div className="font-bold text-emerald-300 uppercase tracking-wide flex items-center gap-1.5">
            <span>Primary Recommendation: {recommendedRouteName}</span>
          </div>
          <p className="text-slate-200 mt-1 leading-relaxed text-sm">
            {agent.explanation}
          </p>
          {agent.agent_warning && (
            <p className="text-amber-300 text-[11px] mt-1.5 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {agent.agent_warning}
            </p>
          )}
        </div>
      </div>

      {/* Two-Column Cockpit Layout: Left (60% Map) / Right (40% Route Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: Map View (60% on desktop) */}
        <div className="lg:col-span-7 h-[450px] sm:h-[550px] lg:h-[680px]">
          <MapView
            origin={origin}
            destination={destination}
            routes={routes}
            recommendedRouteName={recommendedRouteName}
            selectedRouteId={selectedRouteId}
            onSelectRoute={(id) => setSelectedRouteId(id)}
          />
        </div>

        {/* RIGHT COLUMN: 3 Stacked Route Cards (40% on desktop) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Candidate Flight Corridors
            </h2>
            <span className="text-[11px] font-mono text-slate-500">
              Recommended first
            </span>
          </div>

          <div className="space-y-3.5">
            {sortedRoutes.map((route) => {
              const isRec = route.name === recommendedRouteName;
              const isSel = route.id === selectedRouteId;
              const verdict = agent.route_verdicts?.[route.name] || "";

              return (
                <RouteCard
                  key={route.id}
                  route={route}
                  isRecommended={isRec}
                  isSelected={isSel}
                  verdict={verdict}
                  onSelect={() => setSelectedRouteId(route.id)}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Section: Full Agent Reasoning Log (ReAct loop trace) */}
      <AgentReasoningLog
        trace={agent.reasoning_trace || []}
        explanation={agent.explanation}
        recommendedRoute={recommendedRouteName}
        warningNote={agent.agent_warning}
      />
    </div>
  );
};
