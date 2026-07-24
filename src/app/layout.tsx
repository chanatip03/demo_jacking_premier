import "./globals.css";
import { RobotProvider } from "./providers/robot.provider";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <RobotProvider>{children}</RobotProvider>
      </body>
    </html>
  );
}
