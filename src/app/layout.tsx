import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NextFlow Builder",
  description:
    "Krea-style workflow builder with collapsible sidebar and React Flow canvas",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html
        lang="en"
        className={`${spaceGrotesk.variable} ${ibmPlexMono.variable} h-full antialiased`}
      >
        <body className="min-h-full flex flex-col font-[var(--font-space-grotesk)]" suppressHydrationWarning>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
