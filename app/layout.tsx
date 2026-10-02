import type { Metadata } from "next";
import { Newsreader, Work_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/components/CartProvider";

// Las fuentes se descargan al construir y se sirven desde tu propio sitio
// (sin pedirle nada a Google desde el navegador del cliente).
const serif = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  weight: ["400", "500"],
  style: ["normal", "italic"],
});
const sans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: { default: "La 14 Lounge", template: "%s · La 14 Lounge" },
  description:
    "Licores con entrega en el Gran Área Metropolitana de Costa Rica. Venta exclusiva a mayores de 18 años.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="es"
      className={`${serif.variable} ${sans.variable} ${mono.variable}`}
    >
      <body><CartProvider>{children}</CartProvider></body>
    </html>
  );
}
