import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Хүүхдийн баярын гар зургийн санал хураалт",
  description: "SAP кодоор нэвтэрдэг хүүхдийн гар зургийн санал хураалтын галерей."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="mn" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
