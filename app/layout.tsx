import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { SuppressMetaMaskErrors } from "@/components/ErrorBoundary";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "bugScoutAI | See every bug your users experience",
  description: "AI that automatically watches your session replays to detect bugs, rage clicks, and dead clicks—so you fix issues before users complain.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className={inter.variable}>
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Playfair+Display:ital,wght@1,400;1,700&display=swap"
            rel="stylesheet"
          />
        </head>
        <body className="font-sans">
          <SuppressMetaMaskErrors />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
