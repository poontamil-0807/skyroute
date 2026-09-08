import React, { useState } from "react";
import { Terminal, ChevronDown, ChevronUp, Bot, Wrench, Eye, Check, Copy } from "lucide-react";
import { AgentTraceStep } from "../types";

interface AgentReasoningLogProps {
  trace: AgentTraceStep[];
  explanation: string;
  recommendedRoute: string;
  warningNote?: string;
}

export const AgentReasoningLog: React.FC<AgentReasoningLogProps> = ({
  trace,
  explanation,
  recommendedRoute,
  warningNote,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const rawText = trace
      .map((t) => {
        if (t.type === "thought") {
          return `[STEP ${t.step} - THOUGHT]\n${t.content}`;
        }
        return `[STEP ${t.step} - ACTION: ${t.tool}]\nArgs: ${JSON.stringify(t.arguments)}\nObservation: ${t.observation}`;
      })
      .join("\n\n");

    const fullLog = `SKYROUTE AI REASONING TRACE\nRecommended Route: ${recommendedRoute}\n\n${rawText}\n\nConclusion: ${explanation}`;
    navigator.clipboard.writeText(fullLog);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div id="agent-reasoning-log-section" className="mt-8 rounded-2xl bg-[#0F1A2E] border border-[#1E2E4A] overflow-hidden shadow-xl">
      {/* Accordion Toggle Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-[#132038] transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Terminal className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white tracking-wide">
                Full Agent Reasoning Log (ReAct Loop)
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {trace.length} STEPS
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Complete Reason ➔ Act (Tool Use) ➔ Observe audit trail
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isExpanded && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="px-2.5 py-1 text-xs rounded bg-[#1A2842] hover:bg-[#25395E] text-slate-300 flex items-center gap-1 font-mono transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? "Copied" : "Copy Trace"}</span>
            </button>
          )}
          <button type="button" className="text-slate-400">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Expanded Step-by-Step Log Body */}
      {isExpanded && (
        <div className="border-t border-[#1C2C47] p-5 bg-[#0A1220] font-mono text-xs space-y-4">
          {warningNote && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] mb-3">
              ℹ {warningNote}
            </div>
          )}

          {trace.map((step, idx) => (
            <div key={idx} className="p-3.5 rounded-xl bg-[#0F1A2E] border border-[#1C2D47] space-y-2">
              {/* Step indicator */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 border-b border-[#18263E] pb-2">
                <span className="font-bold text-blue-400">STEP {step.step}</span>
                <span className="uppercase text-[10px] px-2 py-0.5 rounded bg-[#16233B]">
                  {step.type === "thought" ? "Reason (Thought)" : "Act & Observe (Tool)"}
                </span>
              </div>

              {/* Thought Content */}
              {step.type === "thought" && (
                <div className="flex items-start gap-2 text-slate-200">
                  <Bot className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
                  <div className="leading-relaxed whitespace-pre-wrap font-sans text-xs">
                    {step.content}
                  </div>
                </div>
              )}

              {/* Action / Tool Execution */}
              {step.type === "action" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-amber-400 font-semibold">
                    <Wrench className="w-3.5 h-3.5" />
                    <span>Tool Call: {step.tool}</span>
                  </div>
                  {step.arguments && (
                    <div className="p-2 rounded bg-[#080E1A] text-slate-300 text-[11px] overflow-x-auto">
                      <span className="text-slate-500">// Arguments:</span>
                      <pre className="mt-1">{JSON.stringify(step.arguments, null, 2)}</pre>
                    </div>
                  )}
                  {step.observation && (
                    <div className="flex items-start gap-2 text-emerald-300 pt-1">
                      <Eye className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="leading-relaxed text-[11px]">
                        <span className="text-emerald-500 font-bold block mb-0.5">Observation:</span>
                        <div className="bg-[#080E1A] p-2 rounded text-slate-300 whitespace-pre-wrap">
                          {step.observation}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Final Decision Box */}
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 space-y-1.5 font-sans">
            <div className="font-bold text-emerald-400 flex items-center gap-1.5 font-mono text-xs uppercase">
              <Check className="w-4 h-4" />
              Final Decision: {recommendedRoute}
            </div>
            <p className="text-xs text-slate-200 leading-relaxed">
              {explanation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
