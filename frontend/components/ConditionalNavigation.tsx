"use client";

import { usePathname } from "next/navigation";
import Navigation from "./Navigation";
import CopilotSidebar from "./ui/CopilotSidebar";
import CopilotFAB from "./ui/CopilotFAB";

export default function ConditionalNavigation() {
  const pathname = usePathname();
  if (pathname === "/login") return null;
  return (
    <>
      <Navigation />
      <CopilotSidebar />
      <CopilotFAB />
    </>
  );
}
