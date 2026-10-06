import type { Metadata } from "next";
import { GamePreview } from "./game-preview";

export const metadata: Metadata = {
    title: "Game preview · RoundTable",
};

/** Public, read-only board for players and big screens. Answers stay hidden until revealed. */
export default async function PreviewPage({ params }: PageProps<"/rooms/[slug]/preview">) {
    const { slug } = await params;
    return <GamePreview slug={slug} />;
}
