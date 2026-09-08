import React, { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Radio, Compass, ShieldCheck } from "lucide-react";

interface AgentStatusFeedProps {
  originQuery: string;
  destQuery: string;
}

const STATUS_STEPS = [
  { id: 1, text: "Resolving departure & destination airports via OurAirports database...", delay: 200 },
  { id: 2, text: "Generating 3 candidate routes (Direct Great-Circle, Northern, Southern deviations)...", delay: 1100 },
  { id: 3, text: "Fetching live Open-Meteo atmospheric telemetry at 15 waypoints...", delay: 2200 },
  { id: 4, text: "Calculating true heading bearings & headwind/tailwind ground vectors...", delay: 3200 },
  { id: 5, text: "Agent ReAct loop analyzing turbulence, icing risk, and wind shear...", delay: 4200 },
  { id: 6, text: "Executing tool comparisons across candidate corridors...", delay: 5400 },
  { id: 7, text: "Synthesizing pilot recommendation & generating route verdict...", delay: 6500 },
];

export const AgentStatusFeed: React.FC<AgentStatusFeedProps> = ({ originQuery, destQuery }) => {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    const timeouts = STATUS_STEPS.map((step, index) => {
      return setTimeout(() => {
        setActiveStepIndex(index);
      }, step.delay);
    });

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div id="agent-telemetry-card" className="bg-[#0F1A2E] border border-[#1E2E4A] rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Animated radar rings in background */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-blue-500/5 rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-blue-500/10 rounded-full pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 border border-blue-500/15 rounded-full pointer-events-none" />

        {/* Header Indicator */}
        <div className="flex items-center justify-between border-b border-[#1C2C47] pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Radio className="w-5 h-5 animate-pulse" />
              </div>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                Agentic Route Synthesis
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">
                  LIVE TELEMETRY
                </span>
              </h2>
              <p className="text-xs text-slate-400 font-mono">
                {originQuery} ➔ {destQuery}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Compass className="w-4 h-4 text-blue-400 animate-spin" style={{ animationDuration: "8s" }} />
            <span>HEADING LOCK</span>
          </div>
        </div>

        {/* Live Status Checklist Feed with Fade-in Animation */}
        <div className="space-y-3.5 relative z-10">
          {STATUS_STEPS.map((step, idx) => {
            const isCompleted = idx < activeStepIndex;
            const isCurrent = idx === activeStepIndex;
            const isUpcoming = idx > activeStepIndex;

            if (isUpcoming) return null;

            return (
              <div
                key={step.id}
                className={`flex items-start gap-3 transition-all duration-500 ease-out transform ${
                  isCurrent ? "translate-y-0 opacity-100" : "opacity-75"
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-xs font-mono leading-relaxed ${
                      isCompleted ? "text-slate-300" : "text-white font-medium"
                    }`}
                  >
                    {step.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Cockpit radar sweep progress indicator */}
        <div className="mt-8 pt-4 border-t border-[#1C2C47]">
          <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mb-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
              Verifying meteorological parameters
            </span>
            <span className="text-blue-400 font-bold">
              {Math.min(Math.round(((activeStepIndex + 1) / STATUS_STEPS.length) * 100), 98)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-[#142137] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 via-sky-400 to-emerald-400 transition-all duration-700 rounded-full"
              style={{ width: `${Math.min(((activeStepIndex + 1) / STATUS_STEPS.length) * 100, 98)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
