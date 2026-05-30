import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "KeystoneSync",
  description: "Tracker de Mythic+ Keystones para WoW",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="wowhead-tooltips-config" strategy="beforeInteractive">
          {`const whTooltips = { colorLinks: true, iconizeLinks: true, renameLinks: false };`}
        </Script>
        <Script src="https://wow.zamimg.com/js/tooltips.js" strategy="afterInteractive" />
        {children}
      </body>
    </html>
  );
}
