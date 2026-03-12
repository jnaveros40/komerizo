import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Komerizo - Sistema de Gestión Comercial",
  description: "Plataforma integral para gestión de ventas, inventario, clientes y análisis comercial en tiempo real",
  keywords: ["Komerizo", "Gestión Comercial", "Ventas", "Inventario", "CRM", "POS", "Facturación"],
  authors: [{ name: "Komerizo", url: "https://komerizo.com" }],
  creator: "Komerizo",
  publisher: "Komerizo",
  applicationName: "Komerizo",
  generator: "Next.js",
  
  // Open Graph (Facebook, LinkedIn)
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://komerizo.com",
    siteName: "Komerizo",
    title: "Komerizo - Sistema de Gestión Comercial",
    description: "Plataforma integral para gestión de ventas, inventario, clientes y análisis comercial en tiempo real",
    images: [
      {
        url: "/android/play_store_512.png",
        width: 1200,
        height: 630,
        alt: "Komerizo",
      },
    ],
  },

  // Twitter
  twitter: {
    card: "summary_large_image",
    title: "Komerizo - Sistema de Gestión Comercial",
    description: "Plataforma integral para gestión de ventas, inventario, clientes y análisis comercial en tiempo real",
    images: ["//android/play_store_512.png"],
    creator: "@komerizo",
  },

  // Iconos y manifest
  icons: {
    icon: [
      { url: "/android/play_store_512.png" },
      { url: "/web/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/web/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/web/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/android/play_store_512.png",
      },
    ],
  },
  
  manifest: "/manifest.json",

  // Theme y colores
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#6366f1" },
    { media: "(prefers-color-scheme: dark)", color: "#4f46e5" },
  ],
  
  // Viewport
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
  },

  // PWA
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Komerizo",
  },

  // Otros
  formatDetection: {
    telephone: false,
  },
  
  category: "business",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="icon" href="/android/play_store_512.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
