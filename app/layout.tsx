import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit", weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "PushUp Arena - 1v1 Fitness Esports",
  description: "Real-time 1v1 push-up challenges",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${outfit.variable}`}>
      <body className="bg-background text-slate-100 font-sans antialiased">
        {children}
      </body>
    </html>
  );
}