import React, { useState } from "react";
import { Navbar } from "./components/Navbar";
import { InputForm } from "./components/InputForm";
import { AgentStatusFeed } from "./components/AgentStatusFeed";
import { ResultsDashboard } from "./components/ResultsDashboard";
import { Airport, RouteAnalysisResponse } from "./types";

export default function App() {
  const [screen, setScreen] = useState<"input" | "loading" | "results">("input");
  const [originQuery, setOriginQuery] = useState("");
  const [destQuery, setDestQuery] = useState("");

  const [responseState, setResponseState] = useState<RouteAnalysisResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Airport[] | null>(null);
  const [suggestionField, setSuggestionField] = useState<"from" | "to" | null>(null);

  const handleSubmit = async (params: {
    from: string;
    to: string;
    cruiseAltitudeFt: number;
    cruiseSpeedKmh: number;
    departureTime: string;
  }) => {
    setOriginQuery(params.from);
    setDestQuery(params.to);
    setErrorMessage(null);
    setSuggestions(null);
    setSuggestionField(null);
    setScreen("loading");

    const startTime = Date.now();

    try {
      const res = await fetch("/api/find-route", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          from: params.from,
          to: params.to,
          cruise_altitude_ft: params.cruiseAltitudeFt,
          cruise_speed_kmh: params.cruiseSpeedKmh,
          departure_time: params.departureTime,
        }),
      });

      const data: RouteAnalysisResponse = await res.json();

      // Ensure the agent status feed has at least ~3.5 seconds to showcase the ReAct loop telemetry
      const elapsed = Date.now() - startTime;
      const minDisplayDelay = 3500;
      if (elapsed < minDisplayDelay) {
        await new Promise((resolve) => setTimeout(resolve, minDisplayDelay - elapsed));
      }

      if (res.ok && data.success && data.origin && data.destination && data.routes && data.agent) {
        setResponseState(data);
        setScreen("results");
      } else {
        setScreen("input");
        setErrorMessage(data.error || "Unable to resolve flight route. Please verify airport names.");
        setSuggestions(data.suggestions || null);
        setSuggestionField(data.field || null);
      }
    } catch (err: any) {
      console.error("Route analysis error:", err);
      setScreen("input");
      setErrorMessage(
        "Network connection error or server timeout. Please ensure the server is running and try again."
      );
    }
  };

  const handleReset = () => {
    setScreen("input");
    setErrorMessage(null);
    setSuggestions(null);
  };

  return (
    <div className="min-h-screen bg-[#0B1220] text-[#F3F4F6] flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      <Navbar onReset={handleReset} showReset={screen === "results"} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col justify-center">
        {screen === "input" && (
          <InputForm
            onSubmit={handleSubmit}
            error={errorMessage}
            suggestions={suggestions}
            suggestionField={suggestionField}
            isLoading={false}
          />
        )}

        {screen === "loading" && (
          <AgentStatusFeed originQuery={originQuery} destQuery={destQuery} />
        )}

        {screen === "results" && responseState && responseState.origin && responseState.destination && responseState.routes && responseState.agent && (
          <ResultsDashboard
            origin={responseState.origin}
            destination={responseState.destination}
            routes={responseState.routes}
            agent={responseState.agent}
            onNewSearch={handleReset}
          />
        )}
      </main>

      {/* Cockpit Footer */}
      <footer className="border-t border-[#131F35] py-4 text-center text-xs text-slate-500 font-mono">
        SkyRoute AI • Agentic Cockpit Weather Router • Open-Meteo & Gemini ReAct Engine
      </footer>
    </div>
  );
}
