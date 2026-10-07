"use client";

import { Eraser, KeyRound, LayoutGrid, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
    CLUES_PER_CATEGORY,
    MAX_CATEGORIES,
    MAX_CLUE_VALUE,
    MIN_CATEGORIES,
    MIN_CLUE_VALUE,
    PREFILLED_CATEGORIES,
} from "@/lib/buzz-in";
import type { BoardCategory, BoardClue, RoomState } from "@/lib/protocol";
import { cn } from "@/lib/utils";
import type { Send } from "./viewer";

const LABEL = "font-mono text-[11px] tracking-wider text-ink/70 uppercase";
const COUNT_ITEMS = Array.from({ length: MAX_CATEGORIES - MIN_CATEGORIES + 1 }, (_, index) => {
    const count = index + MIN_CATEGORIES;
    return { value: String(count), label: `${count} ${count === 1 ? "category" : "categories"}` };
});

type EditingClue = { category: BoardCategory; clue: BoardClue };

function CategoryName({ category, send }: { category: BoardCategory; send: Send }) {
    const [draft, setDraft] = useState(category.name);

    function commit() {
        const name = draft.trim();
        if (!name) {
            setDraft(category.name);
            return;
        }
        if (name !== category.name) send({ type: "rename_category", categoryId: category.id, name });
    }

    return (
        <Input
            value={draft}
            maxLength={40}
            aria-label="Category name"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                    setDraft(category.name);
                    event.currentTarget.blur();
                }
            }}
            className="h-auto min-h-10 border-transparent bg-transparent px-1 text-center text-xs font-bold text-white uppercase placeholder:text-white/40 hover:border-white/20 focus-visible:border-white/40 focus-visible:ring-white/20 md:text-xs dark:bg-transparent"
        />
    );
}

function CategoryMenu({ category, onBoard, send }: { category: BoardCategory; onBoard: Set<string>; send: Send }) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                render={
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-white/70 hover:bg-white/15 hover:text-white"
                        aria-label={`Options for ${category.name}`}
                    />
                }
            >
                <MoreHorizontal />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                        <Sparkles /> Use a prefilled category
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="max-h-80 w-52">
                        <DropdownMenuGroup>
                            <DropdownMenuLabel>Replaces this column</DropdownMenuLabel>
                            {PREFILLED_CATEGORIES.map((prefilled) => (
                                <DropdownMenuItem
                                    key={prefilled.id}
                                    disabled={onBoard.has(prefilled.id)}
                                    onClick={() =>
                                        send({ type: "use_prefilled_category", categoryId: category.id, prefilledId: prefilled.id })
                                    }
                                >
                                    {prefilled.name}
                                    {onBoard.has(prefilled.id) && (
                                        <span className="ml-auto text-[10px] text-muted-foreground">On board</span>
                                    )}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuGroup>
                    </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => send({ type: "clear_category", categoryId: category.id })}>
                    <Eraser /> Clear category
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function ClueDialog({ editing, onClose, send }: { editing: EditingClue; onClose: () => void; send: Send }) {
    const { category, clue } = editing;
    const [value, setValue] = useState(clue.value);
    const [prompt, setPrompt] = useState(clue.prompt);
    const [answer, setAnswer] = useState(clue.answer);

    function save(event: FormEvent) {
        event.preventDefault();
        send({ type: "update_clue", clueId: clue.id, value, prompt, answer });
        onClose();
    }

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={save} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle className="text-base font-bold">
                            {category.name} · {clue.value}
                        </DialogTitle>
                        <DialogDescription>Players only see this clue once it&apos;s picked from the board.</DialogDescription>
                    </DialogHeader>
                    <Field>
                        <FieldLabel htmlFor="clue-value" className={LABEL}>Points</FieldLabel>
                        <Input
                            id="clue-value"
                            type="number"
                            required
                            min={MIN_CLUE_VALUE}
                            max={MAX_CLUE_VALUE}
                            step={100}
                            value={value}
                            onChange={(event) => setValue(Number(event.target.value))}
                            className="h-9 text-sm md:text-sm"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="clue-prompt" className={LABEL}>Question or statement</FieldLabel>
                        <Textarea
                            id="clue-prompt"
                            autoFocus
                            maxLength={240}
                            placeholder="Write the clue or question"
                            value={prompt}
                            onChange={(event) => setPrompt(event.target.value)}
                            className="min-h-24 text-sm md:text-sm"
                        />
                    </Field>
                    <Field>
                        <FieldLabel htmlFor="clue-answer" className={LABEL}>Correct answer</FieldLabel>
                        <Input
                            id="clue-answer"
                            maxLength={160}
                            placeholder="Expected answer"
                            value={answer}
                            onChange={(event) => setAnswer(event.target.value)}
                            className="h-9 text-sm md:text-sm"
                        />
                        <FieldDescription>Leave the question or answer empty to keep this tile off the board.</FieldDescription>
                    </Field>
                    <DialogFooter className="sm:justify-between">
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={!clue.prompt && !clue.answer}
                            onClick={() => {
                                send({ type: "update_clue", clueId: clue.id, value, prompt: "", answer: "" });
                                onClose();
                            }}
                        >
                            <Trash2 /> Clear clue
                        </Button>
                        <div className="flex gap-2">
                            <Button type="button" variant="outline" onClick={onClose}>
                                Cancel
                            </Button>
                            <Button type="submit">Save clue</Button>
                        </div>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

/** Full-height board editor shown on the stage in edit mode. */
export function BoardEditor({ room, send }: { room: RoomState; send: Send }) {
    const [editing, setEditing] = useState<EditingClue | null>(null);
    const [pendingCount, setPendingCount] = useState<number | null>(null);
    const { board, buzz } = room;
    const clues = board.flatMap((category) => category.clues);
    const filledCount = clues.filter((clue) => clue.filled).length;
    const onBoard = new Set(board.map((category) => category.prefilledId).filter((id): id is string => Boolean(id)));

    function changeCount(count: number) {
        const losesClues = board.slice(count).some((category) => category.clues.some((clue) => clue.filled));
        if (losesClues) setPendingCount(count);
        else send({ type: "set_category_count", count });
    }

    return (
        <div className="flex h-full flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-bold">
                    <LayoutGrid className="size-4 text-mustard" /> Edit board
                </span>
                <Badge
                    variant="outline"
                    className={cn(
                        "h-6 border px-2.5 font-mono",
                        filledCount === clues.length ? "border-green-400/40 bg-green-400/15 text-green-300" : "border-white/20 text-white/70"
                    )}
                >
                    {filledCount}/{clues.length} ready
                </Badge>
                <span className="hidden text-xs text-white/50 @4xl:inline">
                    Click a tile to write its clue. Only you and the host can see this.
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    <Select
                        items={COUNT_ITEMS}
                        value={String(board.length)}
                        onValueChange={(value) => {
                            const count = Number(value);
                            if (count && count !== board.length) changeCount(count);
                        }}
                    >
                        <SelectTrigger aria-label="Board size" className="w-40 border-white/20 bg-white/5 text-white data-[size=default]:h-9">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {COUNT_ITEMS.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                    {item.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <ConfirmDialog
                        trigger={
                            <Button
                                variant="outline"
                                className="h-9 border-white/20 bg-white/5 text-white hover:bg-white/15"
                                disabled={Boolean(buzz.activeQuestionId)}
                            >
                                <Sparkles /> Use prefilled board
                            </Button>
                        }
                        icon={<Sparkles />}
                        title="Fill the board with prefilled categories?"
                        description={`All ${board.length} columns are replaced with random prefilled categories and clues. Anything you've written on this board is lost.`}
                        confirmLabel="Use prefilled board"
                        onConfirm={() => send({ type: "use_prefilled_board" })}
                    />
                </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto rounded-xl">
                <div
                    className="grid h-full min-h-[36rem] gap-2"
                    style={{
                        gridAutoFlow: "column",
                        gridTemplateColumns: `repeat(${board.length}, minmax(11rem, 1fr))`,
                        gridTemplateRows: `auto repeat(${CLUES_PER_CATEGORY}, minmax(6.5rem, 1fr))`,
                    }}
                >
                    {board.map((category) => [
                        <div key={category.id} className="flex min-h-14 items-center gap-1 rounded-lg bg-board px-1.5 shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)]">
                            <CategoryName key={category.name} category={category} send={send} />
                            <CategoryMenu category={category} onBoard={onBoard} send={send} />
                        </div>,
                        ...category.clues.map((clue) => (
                            <ClueTile
                                key={clue.id}
                                clue={clue}
                                used={buzz.usedQuestionIds.includes(clue.id)}
                                onScreen={buzz.activeQuestionId === clue.id}
                                onEdit={() => setEditing({ category, clue })}
                            />
                        )),
                    ])}
                </div>
            </div>

            {editing && <ClueDialog key={editing.clue.id} editing={editing} onClose={() => setEditing(null)} send={send} />}

            <ConfirmDialog
                open={pendingCount !== null}
                onOpenChange={(open) => !open && setPendingCount(null)}
                icon={<Trash2 />}
                destructive
                title={`Shrink the board to ${pendingCount} ${pendingCount === 1 ? "category" : "categories"}?`}
                description="The columns on the right are removed along with their clues."
                confirmLabel="Remove columns"
                onConfirm={() => {
                    if (pendingCount !== null) send({ type: "set_category_count", count: pendingCount });
                    setPendingCount(null);
                }}
            />
        </div>
    );
}

/** One editable tile: points, the question, and the answer. */
function ClueTile({ clue, used, onScreen, onEdit }: { clue: BoardClue; used: boolean; onScreen: boolean; onEdit: () => void }) {
    const empty = !clue.prompt && !clue.answer;

    return (
        <button
            type="button"
            disabled={onScreen}
            onClick={onEdit}
            className={cn(
                "group relative flex min-h-0 cursor-pointer flex-col gap-1.5 overflow-hidden rounded-lg p-2.5 text-left outline-none focus-visible:ring-3 focus-visible:ring-aqua disabled:cursor-not-allowed",
                clue.filled
                    ? "bg-board text-white shadow-[inset_0_-3px_0_rgba(0,0,0,0.25)] hover:brightness-110"
                    : "border-2 border-dashed border-white/20 text-white/60 hover:border-white/45 hover:text-white",
                (used || onScreen) && "opacity-50"
            )}
        >
            <span className="flex items-center justify-between gap-2">
                <span className="font-pixel-square text-xl leading-none text-mustard">{clue.value}</span>
                {onScreen ? (
                    <span className="font-mono text-[9px] tracking-widest text-white/70 uppercase">On screen</span>
                ) : used ? (
                    <span className="font-mono text-[9px] tracking-widest text-white/70 uppercase">Used</span>
                ) : (
                    <Pencil className="size-3.5 text-white/60 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden="true" />
                )}
            </span>
            {empty ? (
                <span className="m-auto flex items-center gap-1 text-xs font-semibold">
                    <Plus className="size-3.5" /> Add clue
                </span>
            ) : (
                <>
                    <span className={cn("line-clamp-3 text-xs leading-snug", clue.prompt ? "text-white/90" : "text-coral italic")}>
                        {clue.prompt || "Needs a question"}
                    </span>
                    <span
                        className={cn(
                            "mt-auto flex min-w-0 items-center gap-1 rounded-md bg-black/25 px-1.5 py-1 text-xs font-bold",
                            clue.answer ? "text-green-300" : "text-coral italic"
                        )}
                    >
                        <KeyRound className="size-3 shrink-0" />
                        <span className="truncate">{clue.answer || "Needs an answer"}</span>
                    </span>
                </>
            )}
        </button>
    );
}
