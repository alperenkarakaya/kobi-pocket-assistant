"use client";

import { Sparkles, ChevronLeft } from "lucide-react";
import { useCopilot } from "@/components/CopilotContext";

export default function CopilotFAB() {
  const { toggle, pendingCount, isOpen } = useCopilot();

  if (isOpen) return null;

  return (
    <button
      onClick={toggle}
      aria-label="AI Sohbet panelini aç"
      title="AI Asistan"
      className="fixed right-0 top-1/2 -translate-y-1/2 z-30
                 flex flex-col items-center gap-2.5 px-3 py-6
                 bg-brand-600 hover:bg-brand-700 active:bg-brand-800
                 text-white rounded-l-2xl shadow-2xl
                 transition-all duration-200 group
                 hover:px-4
                 focus-visible:outline-none focus-visible:ring-2
                 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      {pendingCount > 0 && (
        <span
          className="absolute -top-2 -left-2 flex items-center justify-center
                     w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full
                     shadow border-2 border-white animate-pulse"
        >
          {pendingCount > 9 ? "9+" : pendingCount}
        </span>
      )}

      <ChevronLeft
        size={14}
        className="group-hover:-translate-x-0.5 transition-transform duration-150"
      />

      <Sparkles size={15} className="opacity-90" />

      <span
        className="text-[11px] font-bold tracking-widest leading-none select-none"
        style={{
          writingMode: "vertical-rl",
          textOrientation: "mixed",
          transform: "rotate(180deg)",
        }}
      >
        AI Sohbet
      </span>
    </button>
  );
}
