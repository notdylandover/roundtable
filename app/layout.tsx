import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { GeistPixelSquare, GeistPixelGrid, GeistPixelCircle, GeistPixelTriangle, GeistPixelLine } from "geist/font/pixel";
import { SessionProvider } from "@/components/session-provider";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getClientSession } from "@/lib/auth/server";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next"

export const metadata: Metadata = {
    title: "RoundTable",
    description: "Pick a table.\nBring your friends.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
    const session = await getClientSession();

    return (
        <html
            lang="en"
            className={cn("h-full", "antialiased", GeistMono.variable, GeistSans.variable, GeistPixelSquare.variable, GeistPixelGrid.variable, GeistPixelCircle.variable, GeistPixelTriangle.variable, GeistPixelLine.variable)}
        >
            <body className="flex min-h-full flex-col bg-paper text-ink">
                <SessionProvider initialSession={session}>
                    <TooltipProvider>
                        <Toaster>{children}</Toaster>
                    </TooltipProvider>
                </SessionProvider>
                <Analytics />
                <SpeedInsights />
            </body>
        </html>
    );
}
