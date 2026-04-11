import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "SOS Mastermind — Inbound Closing",
  description: "Sales rep performance dashboard",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#0a0b0f] text-[#e8e9f0] antialiased`}>
        {children}
      </body>
    </html>
  );
}
