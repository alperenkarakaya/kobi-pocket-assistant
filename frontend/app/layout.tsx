import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "KOBI Tarım Asistanı | Tire Kooperatifi",
  description: "AI destekli envanter ve tedarik yönetimi — Tire Tarım Kooperatifi",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="min-h-screen antialiased bg-slate-50">
        <Navigation />
        <main>{children}</main>
        <Toaster
          position="bottom-right"
          richColors
          expand={false}
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
            },
          }}
        />
      </body>
    </html>
  );
}
