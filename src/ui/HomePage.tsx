import { useEffect, useId, useRef, useState, type MouseEvent } from "react";
import { Link, useNavigate } from "react-router";
import { Download, FileJson, FileText, LoaderCircle, Pencil, Trash2, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeckRepository } from "../storage/deck-repository-context.tsx";
import type { DeckSummary, DeckTheme } from "../storage/deck-repository.ts";
import { exportDeckAsSlaideFile } from "../slaide-file/export-deck.ts";
import {
  importErrorMessage,
  prepareDeckImportFromFile,
} from "../slaide-file/import-deck.ts";
import { requestPersistentStorageAfterFirstDeck } from "../storage/persistent-storage.ts";
import { ExportThemeDialog } from "./ExportThemeDialog.tsx";
import { ThemeSelector } from "./ThemeSelector.tsx";
import { useTheme } from "./ThemeProvider.tsx";

type DialogState =
  | { type: "none" }
  | { type: "rename"; deck: DeckSummary; title: string }
  | { type: "delete"; deck: DeckSummary };

export function HomePage() {
  const repository = useDeckRepository();
  const navigate = useNavigate();
  const { theme, setThemePreference } = useTheme();
  const [decks, setDecks] = useState<DeckSummary[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [dialog, setDialog] = useState<DialogState>({ type: "none" });
  const [busy, setBusy] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [exportingDeckId, setExportingDeckId] = useState<string | null>(null);
  const [exportError, setExportError] = useState(false);
  const [pendingExport, setPendingExport] = useState<{
    deck: DeckSummary;
    format: "pdf" | "slaide";
  } | null>(null);
  const titleInputId = useId();
  const importInputRef = useRef<HTMLInputElement>(null);
  const dialogTriggerRef = useRef<HTMLElement | null>(null);

  function openDialogFrom(
    event: MouseEvent<HTMLElement>,
    next: Exclude<DialogState, { type: "none" }>,
  ) {
    dialogTriggerRef.current = event.currentTarget;
    setDialog(next);
  }

  useEffect(() => {
    let cancelled = false;
    void repository.listDecks().then((listed) => {
      if (!cancelled) setDecks(listed);
    });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  async function refreshDecks() {
    setDecks(await repository.listDecks());
  }

  async function handleCreateDeck() {
    if (creating) return;
    setCreating(true);
    try {
      const deckCountBefore = (await repository.listDecks()).length;
      const created = await repository.createDeck();
      if (deckCountBefore === 0) {
        void requestPersistentStorageAfterFirstDeck();
      }
      navigate(`/decks/${created.deck.id}`);
    } finally {
      setCreating(false);
    }
  }

  async function handleRenameSave() {
    if (dialog.type !== "rename" || busy) return;
    setBusy(true);
    try {
      await repository.renameDeck(dialog.deck.id, dialog.title);
      setDialog({ type: "none" });
      await refreshDecks();
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (dialog.type !== "delete" || busy) return;
    setBusy(true);
    try {
      await repository.deleteDeck(dialog.deck.id);
      setDialog({ type: "none" });
      await refreshDecks();
    } finally {
      setBusy(false);
    }
  }

  async function handleExport(
    deck: DeckSummary,
    format: "pdf" | "slaide",
    exportTheme: DeckTheme,
  ) {
    if (exportingDeckId !== null) return;
    setExportingDeckId(deck.id);
    setExportError(false);
    try {
      const loaded = await repository.loadDeck(deck.id);
      if (loaded.status !== "ok") {
        setExportError(true);
        return;
      }
      if (format === "pdf") {
        const { exportDeckAsPdf } = await import("../pdf/export-deck.ts");
        await exportDeckAsPdf(loaded.deck, loaded.slides, exportTheme);
      } else {
        exportDeckAsSlaideFile(loaded.deck, loaded.slides, exportTheme);
      }
    } catch {
      setExportError(true);
    } finally {
      setExportingDeckId(null);
    }
  }

  async function handleImportFile(file: File) {
    if (importing) return;
    setImporting(true);
    setImportError(null);
    try {
      const existingDecks = await repository.listDecks();
      const prepared = await prepareDeckImportFromFile(
        file,
        existingDecks.map((deck) => deck.title),
      );
      await repository.importDeck(prepared.deck, prepared.slides);
      if (prepared.deck.theme) {
        try {
          await setThemePreference(prepared.deck.theme);
        } catch {
          // Keep the import successful even if the theme switch fails.
        }
      }
      if (existingDecks.length === 0) {
        void requestPersistentStorageAfterFirstDeck();
      }
      await refreshDecks();
    } catch (error) {
      setImportError(importErrorMessage(error));
    } finally {
      setImporting(false);
      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6">
          <h1
            className="text-lg font-semibold tracking-tight"
            aria-label="Slaide"
          >
            💅
          </h1>
          <ThemeSelector />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 pb-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">Your local decks</p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".slaide,application/json"
              className="sr-only"
              data-testid="import-slaide-input"
              aria-label="Import Slaide file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleImportFile(file);
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => importInputRef.current?.click()}
              disabled={importing}
            >
              <Upload />
              Import deck
            </Button>
            <Button
              type="button"
              onClick={() => void handleCreateDeck()}
              disabled={creating}
            >
              New deck
            </Button>
          </div>
        </div>

        {importError ? (
          <Alert className="mb-6" role="alert" data-testid="import-error">
            <AlertTitle>Import failed</AlertTitle>
            <AlertDescription>{importError}</AlertDescription>
          </Alert>
        ) : null}
        {exportError ? (
          <Alert className="mb-6" role="alert" data-testid="export-error">
            <AlertTitle>Export failed</AlertTitle>
            <AlertDescription>
              This deck could not be exported. Try again.
            </AlertDescription>
          </Alert>
        ) : null}

        {decks === null ? (
          <p className="text-muted-foreground">Loading decks…</p>
        ) : decks.length === 0 ? (
          <p className="text-muted-foreground">No decks yet</p>
        ) : (
          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {decks.map((deck) => (
              <li key={deck.id} className="min-w-0">
                <Card size="sm" className="h-full">
                  <CardHeader>
                    <CardTitle className="min-w-0">
                      <Link
                        to={`/decks/${deck.id}`}
                        className="block truncate text-foreground underline-offset-4 hover:underline"
                        title={deck.title}
                      >
                        {deck.title}
                      </Link>
                    </CardTitle>
                    <CardDescription>
                      {formatSlideCount(deck.slideCount)}
                    </CardDescription>
                    <CardAction>
                      <time
                        className="text-xs text-muted-foreground"
                        dateTime={new Date(deck.updatedAt).toISOString()}
                      >
                        {formatModifiedTime(deck.updatedAt)}
                      </time>
                    </CardAction>
                  </CardHeader>
                  <CardFooter className="gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          aria-label={
                            exportingDeckId === deck.id
                              ? `Exporting ${deck.title}`
                              : `Export ${deck.title}`
                          }
                          title={
                            exportingDeckId === deck.id
                              ? `Exporting ${deck.title}`
                              : `Export ${deck.title}`
                          }
                          disabled={exportingDeckId !== null}
                        >
                          {exportingDeckId === deck.id ? (
                            <LoaderCircle className="animate-spin" />
                          ) : (
                            <Download />
                          )}
                          <span className="sr-only">Export {deck.title}</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          onSelect={() =>
                            setPendingExport({ deck, format: "slaide" })
                          }
                        >
                          <FileJson />
                          SLAIDE
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            setPendingExport({ deck, format: "pdf" })
                          }
                        >
                          <FileText />
                          PDF
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon-sm"
                      aria-label={`Rename ${deck.title}`}
                      title={`Rename ${deck.title}`}
                      onClick={(event) =>
                        openDialogFrom(event, {
                          type: "rename",
                          deck,
                          title: deck.title,
                        })
                      }
                    >
                      <Pencil />
                      <span className="sr-only">Rename {deck.title}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon-sm"
                      aria-label={`Delete ${deck.title}`}
                      title={`Delete ${deck.title}`}
                      onClick={(event) =>
                        openDialogFrom(event, { type: "delete", deck })
                      }
                    >
                      <Trash2 />
                      <span className="sr-only">Delete {deck.title}</span>
                    </Button>
                  </CardFooter>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <Dialog
          open={dialog.type !== "none"}
          onOpenChange={(open) => {
            if (!open) setDialog({ type: "none" });
          }}
        >
          <DialogContent
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              dialogTriggerRef.current?.focus();
            }}
          >
            {dialog.type === "rename" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Rename deck</DialogTitle>
                </DialogHeader>
                <div className="grid gap-2">
                  <Label htmlFor={titleInputId}>Deck title</Label>
                  <Input
                    id={titleInputId}
                    value={dialog.title}
                    onChange={(event) =>
                      setDialog({ ...dialog, title: event.target.value })
                    }
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialog({ type: "none" })}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={() => void handleRenameSave()}
                    disabled={busy}
                  >
                    Save
                  </Button>
                </DialogFooter>
              </>
            ) : null}
            {dialog.type === "delete" ? (
              <>
                <DialogHeader>
                  <DialogTitle>Delete “{dialog.deck.title}”</DialogTitle>
                  <DialogDescription>
                    This permanently deletes {dialog.deck.title} and its{" "}
                    {formatSlideCount(dialog.deck.slideCount)}.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialog({ type: "none" })}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={() => void handleDeleteConfirm()}
                    disabled={busy}
                  >
                    Delete deck
                  </Button>
                </DialogFooter>
              </>
            ) : null}
          </DialogContent>
        </Dialog>

        <ExportThemeDialog
          format={pendingExport?.format ?? null}
          defaultTheme={theme}
          onCancel={() => setPendingExport(null)}
          onConfirm={(exportTheme) => {
            const target = pendingExport;
            setPendingExport(null);
            if (target) {
              void handleExport(target.deck, target.format, exportTheme);
            }
          }}
        />
      </main>
    </div>
  );
}

function formatSlideCount(slideCount: number): string {
  return slideCount === 1 ? "1 slide" : `${slideCount} slides`;
}

function formatModifiedTime(updatedAt: number): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(updatedAt));
}
