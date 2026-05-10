import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "KOBI Pocket Assistant | Tire Cooperative",
  description: "AI-powered inventory and supply management for agricultural cooperatives",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased bg-[#0a0f0d]">
        <Navigation />
        <main>{children}</main>
        <Toaster
          theme="dark"
          position="bottom-right"
          richColors
          toastOptions={{
            style: {
              background: "#111a14",
              border: "1px solid rgba(34,197,94,0.15)",
              color: "#e2e8f0",
            },
            actionButtonStyle: {
              background: "rgba(34,197,94,0.15)",
              color: "#4ade80",
              border: "1px solid rgba(34,197,94,0.25)",
            },
          }}
        />
      </body>
    </html>
  );
}
