"use client";

import { Settings2, ShieldCheck, SlidersHorizontal, Timer, X } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RoomState } from "@/lib/protocol";
import { FinalSettings } from "./final-settings";
import { GameRules } from "./game-rules";
import { RoomSetup } from "./room-setup";
import { TimerSettings } from "./timer-settings";
import type { Send, Viewer } from "./viewer";

type RoomSettingsProps = {
    room: RoomState;
    viewer: Viewer;
    send: Send;
    onDeleteRoom: () => void;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type SettingsTab = "room" | "rules" | "timers";

const DRAWER_SIZE = { "--drawer-content-width": "min(calc(100vw - 1rem), 32rem)" } as CSSProperties;

/** Whether the viewer has anything to change in the settings drawer. */
export function hasRoomSettings(room: RoomState, viewer: Viewer) {
    return viewer.canConfigure || (room.gameMode === "buzz_in" && viewer.isGameMaster);
}

/** Drawer with room setup, game rules, and timers. Opened from the room's top bar. */
export function RoomSettings({ room, viewer, send, onDeleteRoom, open, onOpenChange }: RoomSettingsProps) {
    const buzzIn = room.gameMode === "buzz_in";
    const tabs: { value: SettingsTab; label: string; icon: typeof Settings2 }[] = [];
    if (viewer.canConfigure) tabs.push({ value: "room", label: "Room", icon: Settings2 });
    if (buzzIn && viewer.isGameMaster) {
        tabs.push({ value: "rules", label: "Rules", icon: SlidersHorizontal });
        tabs.push({ value: "timers", label: "Timers", icon: Timer });
    }
    const [selected, setSelected] = useState<SettingsTab>(tabs[0]?.value ?? "room");
    // Fall back when a tab disappears, e.g. after switching the room to Teams.
    const tab = tabs.some((item) => item.value === selected) ? selected : tabs[0]?.value;
    if (!tab) return null;

    return (
        <Drawer swipeDirection="right" open={open} onOpenChange={onOpenChange}>
            <DrawerContent style={DRAWER_SIZE} className="border-2 border-ink bg-paper text-ink shadow-[-6px_6px_0_var(--ink)]">
                <DrawerHeader className="flex-row items-center gap-3 border-b-2 border-ink p-4 text-left md:text-left">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-ink bg-white">
                        <Settings2 className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <DrawerTitle className="text-base font-bold text-ink">Room settings</DrawerTitle>
                        <DrawerDescription className="truncate text-ink/60">{room.title}</DrawerDescription>
                    </div>
                    {viewer.isAdmin && !viewer.isOwner && (
                        <Badge className="gap-1 bg-violet-600 text-white">
                            <ShieldCheck /> Admin
                        </Badge>
                    )}
                    <DrawerClose render={<Button variant="ghost" size="icon" aria-label="Close settings" />}>
                        <X />
                    </DrawerClose>
                </DrawerHeader>

                <Tabs value={tab} onValueChange={(value) => setSelected(value as SettingsTab)} className="min-h-0 flex-1 gap-0">
                    {tabs.length > 1 && (
                        <TabsList className="mx-4 mt-4 h-10! w-auto border-2 border-ink bg-white p-1">
                            {tabs.map((item) => (
                                <TabsTrigger
                                    key={item.value}
                                    value={item.value}
                                    className="h-full text-xs font-semibold data-active:bg-ink data-active:text-white data-active:hover:text-white"
                                >
                                    <item.icon /> {item.label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    )}
                    <TabsContent value="room" className="min-h-0 overflow-y-auto p-4">
                        {viewer.canConfigure && <RoomSetup room={room} viewer={viewer} send={send} onDeleteRoom={onDeleteRoom} />}
                    </TabsContent>
                    <TabsContent value="rules" className="min-h-0 overflow-y-auto p-4">
                        {buzzIn && viewer.isGameMaster && <GameRules room={room} send={send} />}
                    </TabsContent>
                    <TabsContent value="timers" className="flex min-h-0 flex-col gap-4 overflow-y-auto p-4">
                        {buzzIn && viewer.isGameMaster && (
                            <>
                                <FinalSettings final={room.final} send={send} />
                                {viewer.isHost ? (
                                    <TimerSettings timer={room.timer} send={send} />
                                ) : (
                                    <p className="rounded-xl border-2 border-dashed border-ink/25 p-4 text-xs text-ink/60">
                                        <Timer className="mr-1 inline size-3.5" /> The clue timer is set by the host.
                                    </p>
                                )}
                            </>
                        )}
                    </TabsContent>
                </Tabs>
            </DrawerContent>
        </Drawer>
    );
}
