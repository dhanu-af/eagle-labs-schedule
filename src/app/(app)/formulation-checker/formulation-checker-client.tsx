"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createFolder, deleteFolder } from "@/lib/actions/formulation-actions";
import { formatBrisbaneDateTime } from "@/lib/ui";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Th, THEAD_ROW_CLASS } from "@/components/ui/Th";

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
      <PageHeader
        title="Formulation Checker"
        subtitle="Master formulations, auto batch calculations, and PDF export — organized by product folder."
        actions={
          <>
            {canManage && !activeFolder && (
              <Button variant="secondary" onClick={() => setShowNewFolder(true)}>
                + New Folder
              </Button>
            )}
            {canManage && activeFolder && (
              <Link
                href={`/formulation-checker/new?folder=${activeFolder.id}`}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground transition-colors duration-150 ease-out hover:opacity-90 active:scale-[0.98]"
              >
                + New Formulation
              </Link>
            )}
          </>
        }
      />

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
                className="card-shadow card-hover flex flex-col items-center gap-2 rounded-xl border border-border bg-surface p-5 text-center hover:border-primary/40"
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
                  className="absolute right-2 top-2 hidden rounded-md bg-surface px-1.5 py-0.5 text-xs text-muted-foreground transition-colors duration-150 ease-out hover:text-danger group-hover:block"
                  aria-label="Delete folder"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
          {folders.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-border bg-surface">
              <EmptyState title="No folders yet." />
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
              className="input max-w-sm"
            />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </form>

          <Card padding="none" className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead>
                <tr className={THEAD_ROW_CLASS}>
                  <Th>Product Name</Th>
                  <Th>Base Batch Size</Th>
                  <Th>Ingredients</Th>
                  <Th>Last Updated</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {formulations.map((f) => (
                  <tr key={f.id} className="border-b border-border last:border-0 transition-colors duration-150 ease-out even:bg-surface-muted/30 hover:bg-surface-muted/60">
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      <Link href={`/formulation-checker/${f.id}`} className="hover:underline">
                        {f.productName}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {f.baseBatchSize.toFixed(2)} {f.baseUnit}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{f.ingredientCount}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{formatBrisbaneDateTime(f.updatedAt)}</td>
                    <td className="px-3 py-2.5">
                      <Link href={`/formulation-checker/${f.id}`} className="text-xs font-medium text-primary hover:underline">
                        Open →
                      </Link>
                    </td>
                  </tr>
                ))}
                {formulations.length === 0 && (
                  <tr>
                    <td colSpan={5}>
                      <EmptyState title="No formulations in this folder yet." />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {showNewFolder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card-elevated w-full max-w-sm rounded-xl border border-border bg-surface p-5">
            <h2 className="mb-3 text-base font-semibold text-foreground">New Folder</h2>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="e.g. NZ Products"
              className="input"
              autoFocus
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setShowNewFolder(false)}>
                Cancel
              </Button>
              <Button onClick={addFolder} disabled={pending || !newFolderName.trim()}>
                {pending ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
