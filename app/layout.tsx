import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "pomodoro",
  description:
    "Hourly time tracking: log what you did with every hour of your day.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
