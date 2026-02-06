import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata = {
  title: "Asistencia Docente",
  description: "Gestión de asistencia ágil y moderna para docentes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.className} brand-gradient min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
