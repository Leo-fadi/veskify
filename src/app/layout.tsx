import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Veskify — Aurum Nordic demo",
  description: "Standalone AI storefront design agent demo foundation.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
