import React, { useEffect, useState } from "react";
import { Plane, Compass, RotateCcw, Activity } from "lucide-react";

interface NavbarProps {
  onReset?: () => void;
  showReset?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ onReset, showReset }) => {
  const [utcTime, setUtcTime] = useState("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getUTCHours()).padStart(2, "0");
      const mins = String(now.getUTCMinutes()).padStart(2, "0");
      const secs = String(now.getUTCSeconds()).padStart(2, "0");
      setUtcTime(`${hours}:${mins}:${secs} UTC`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header id="flight-ops-header" className="border-b border-[#1A263D] bg-[#0E1729]/90 backdrop-blur sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-sm shadow-blue-500/10">
            <Plane className="w-5 h-5 -rotate-45" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white flex items-center gap-1.5">
                SkyRoute <span className="text-blue-400 font-mono text-sm px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/30">AI</span>
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                OPS ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Agentic Weather Routing for Pilots</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* UTC Clock for Aviators */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#131F35] border border-[#1E2E4A] text-slate-300 font-mono text-xs">
            <Compass className="w-3.5 h-3.5 text-blue-400 animate-spin" style={{ animationDuration: "12s" }} />
            <span>{utcTime || "00:00:00 UTC"}</span>
          </div>

          {showReset && onReset && (
            <button
              id="header-new-search-btn"
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#18253E] hover:bg-[#203050] text-slate-200 border border-[#2A3F66] transition"
            >
              <RotateCcw className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">New Route</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
