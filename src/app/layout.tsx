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
  title: "Plantilla Next.js | Ing Navs",
  description: "Plantilla profesional con React 19, Next.js 16, TypeScript, Tailwind CSS y PWA lista para producción",
  keywords: ["Next.js", "React", "TypeScript", "Tailwind CSS", "PWA", "Plantilla", "Template"],
  authors: [{ name: "Ing Navs", url: "https://ingnavs.vercel.app/" }],
  creator: "Ing Navs",
  publisher: "Ing Navs",
  applicationName: "Plantilla Next.js",
  generator: "Next.js",
  
  // Open Graph (Facebook, LinkedIn)
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: "https://tu-dominio.com",
    siteName: "Plantilla Next.js",
    title: "Plantilla Next.js | Ing Navs",
    description: "Plantilla profesional con React 19, Next.js 16, TypeScript, Tailwind CSS y PWA lista para producción",
    images: [
      {
        url: "/android/play_store_512.png",
        width: 1200,
        height: 630,
        alt: "Plantilla Next.js",
      },
    ],
  },

  // Twitter
  twitter: {
    card: "summary_large_image",
    title: "Plantilla Next.js | Ing Navs",
    description: "Plantilla profesional con React 19, Next.js 16, TypeScript, Tailwind CSS y PWA lista para producción",
    images: ["//android/play_store_512.png"],
    creator: "@ingnavs",
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
    title: "Plantilla Next.js",
  },

  // Otros
  formatDetection: {
    telephone: false,
  },
  
  category: "technology",
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
