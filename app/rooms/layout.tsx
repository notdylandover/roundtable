import { RoomSessionProvider } from "./room-session";

/** Shared by the lobby and every room so the room connection survives navigating between them. */
export default function RoomsLayout({ children }: LayoutProps<"/rooms">) {
    return <RoomSessionProvider>{children}</RoomSessionProvider>;
}
