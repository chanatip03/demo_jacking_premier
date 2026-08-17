import "./globals.css";
import { RobotProvider } from "../providers/robot.provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="flex h-dvh">
        <RobotProvider>
          <main className="min-w-0 flex-1">{children}</main>
        </RobotProvider>
      </body>
    </html>
  );
}
