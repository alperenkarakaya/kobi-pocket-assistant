"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface CopilotContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  pendingCount: number;
  setPendingCount: (n: number) => void;
}

const CopilotContext = createContext<CopilotContextType | null>(null);

export function CopilotProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  const open   = useCallback(() => setIsOpen(true), []);
  const close  = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(p => !p), []);

  return (
    <CopilotContext.Provider value={{ isOpen, open, close, toggle, pendingCount, setPendingCount }}>
      {children}
    </CopilotContext.Provider>
  );
}

export function useCopilot() {
  const ctx = useContext(CopilotContext);
  if (!ctx) throw new Error("useCopilot must be used within CopilotProvider");
  return ctx;
}
