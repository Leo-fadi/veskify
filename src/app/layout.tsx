import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vesko Storefront Studio",
  description: "Create, edit, preview and publish a storefront with Vesko.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
