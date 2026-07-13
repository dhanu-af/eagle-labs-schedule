"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createFolder, deleteFolder } from "@/lib/actions/formulation-actions";
import { formatBrisbaneDateTime } from "@/lib/ui";

type Folder = { id: string; name: string; count: number };
type FormulationRow = {
  id: string;
  productName: string;
  baseBatchSize: number;
  baseUnit: string;
  ingredientCount: number;
  updatedAt: string;
};

export default function FormulationCheckerClient({
  canManage,
  folders,
  activeFolderId,
  searchQuery,
  formulations,
}: {
  canManage: boolean;
  folders: Folder[];
  activeFolderId: string | null;
  searchQuery: string;
  formulations: FormulationRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [search, setSearch] = useState(searchQuery);

  const activeFolder = folders.find((f) => f.id === activeFolderId) ?? null;

  function addFolder() {
    if (!newFolderName.trim()) return;
    startTransition(async () => {
      await createFolder(newFolderName.trim());
      setNewFolderName("");
      setShowNewFolder(false);
      router.refresh();
    });
  }

  function removeFolder(id: string) {
    if (!confirm("Delete this folder? It must be empty.")) return;
    startTransition(async () => {
      try {
        await deleteFolder(id);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Couldn't delete this folder.");
      }
    });
  }

  function runSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!activeFolder) return;
    router.push(`/formulation-checker?folder=${activeFolder.id}${search ? `&q=${encodeURIComponent(search)}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Formulation Checker</h1>
          <p className="text-sm text-muted-foreground">
            Master formulations, auto batch calculations, and PDF export — organized by product folder.
          </p>
        </div>
        {canManage && !activeFolder && (
          <button
            onClick={() => setShowNewFolder(true)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            + New Folder
          </button>
        )}
        {canManage && activeFolder && (
          <Link
            href={`/formulation-checker/new?folder=${activeFolder.id}`}
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + New Formulation
          </Link>
        )}
      </div>

      <div className="flex items-center gap-2 text-sm">
        <Link href="/formulation-checker" className="font-medium text-primary hover:underline">
          All Folders
        </Link>
        {activeFolder && (
          <>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">{activeFolder.name}</span>
          </>
        )}
      </div>

      {!activeFolder ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {folders.map((f) => (
            <div key={f.id} className="group relative">
              <Link
                href={`/formulation-checker?folder=${f.id}`}
                className="card-shadow flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-5 text-center transition hover:-translate-y-0.5 hover:border-primary/40"
              >
                <span className="text-3xl" aria-hidden>
                  📁
                </span>
                <p className="text-sm font-medium text-foreground">{f.name}</p>
                <p className="text-xs text-muted-foreground">{f.count} formulation{f.count === 1 ? "" : "s"}</p>
              </Link>
              {canManage && f.count === 0 && (
                <button
                  onClick={() => removeFolder(f.id)}
                  disabled={pending}
                  className="absolute right-2 top-2 hidden rounded-md bg-surface px-1.5 py-0.5 text-xs text-muted-foreground hover:text-danger group-hover:block"
                  aria-label="Delete folder"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {folders.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border bg-surface p-8 text-center text-sm text-muted-foreground">
              No folders yet.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <form onSubmit={runSearch} className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search formulations in this folder..."
              className="w-full max-w-sm rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground"
            />
            <button type="submit" className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted">
              Search
            </button>
          </form>

          <div className="card-shadow overflow-x-auto rounded-2xl border border-border bg-surface">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2">Product Name</th>
                  <th className="px-3 py-2">Base Batch Size</th>
                  <th className="px-3 py-2">Ingredients</th>
                  <th className="px-3 py-2">Last Updated</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {formulations.map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0 hover:bg-surface-muted/50">
                    <td className="px-3 py-2 font-medium text-foreground">
                      <Link href={`/formulation-checker/${f.id}`} className="hover:underline">
                        {f.productName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {f.baseBatchSize} {f.baseUnit}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{f.ingredientCount}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatBrisbaneDateTime(f.updatedAt)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/formulation-checker/${f.id}`} className="text-xs font-medium text-primary hover:underline">
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
                {formulations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No formulations in this folder yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-base font-semibold text-foreground">New Folder</h2>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. NZ Products"
              className="w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-foreground"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowNewFolder(false)}
                className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                onClick={addFolder}
                disabled={pending || !newFolderName.trim()}
                className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                {pending ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
