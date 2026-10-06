import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { RoomClient } from "./room-client";

export default async function RoomPage({ params }: PageProps<"/rooms/[slug]">) {
    const { slug } = await params;
    if (!(await getSessionUser())) redirect(`/?next=${encodeURIComponent(`/rooms/${slug}`)}`);
    return <RoomClient slug={slug} />;
}
