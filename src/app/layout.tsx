import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { ToastProvider } from "@/components/ToastProvider";
import { AuthProvider } from "@/components/AuthProvider";

export const viewport: Viewport = {
  themeColor: "#070a12",
};

export const metadata: Metadata = {
  title: "LeadFlow ERP & CRM Pro | Prospecção Inteligente",
  description: "Sistema de ERP e CRM especializado em agências digitais — prospecção de leads, pipeline de vendas, gestão de clientes e relatórios financeiros.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "LeadFlow CRM",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt" className="h-full antialiased">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full flex">
        <AuthProvider>
          <ToastProvider>
            <Sidebar />
            <main className="flex-1 min-h-screen overflow-y-auto custom-scrollbar pt-14 lg:pt-0">
              {children}
            </main>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
