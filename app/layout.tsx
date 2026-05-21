import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hookline — Webhook Delivery Gateway",
  description:
    "A reliable webhook delivery gateway: HMAC signing, exponential-backoff retries, a dead-letter queue, idempotent ingestion and replay.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
