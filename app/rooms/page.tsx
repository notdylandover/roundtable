import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { RoomsLobby } from "./rooms-lobby";

export default async function RoomsPage() {
    if (!(await getSessionUser())) redirect("/?next=/rooms");
    return <RoomsLobby />;
}
