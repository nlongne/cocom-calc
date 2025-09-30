import "./globals.css";            // ← this must exist
import type { Metadata } from "next";

export const metadata: Metadata = { title: "CoCom" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
