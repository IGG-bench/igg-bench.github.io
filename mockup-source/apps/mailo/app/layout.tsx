import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mailo",
  description: "A realistic Mailo email benchmark mock interface",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full" suppressHydrationWarning>
      <body className="h-full" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
