"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  FileText,
  Loader2,
  X,
  Plus,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface Props {
  caseId: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type StagedStatus = "queued" | "uploading" | "uploaded" | "failed";

interface StagedFile {
  id: string;
  file: File;
  status: StagedStatus;
  fileKey?: string;
  errorMessage?: string;
}

export function PetitionUploader({ caseId }: Props) {
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [refId, setRefId] = useState<string | null>(null);
  const [topLevelError, setTopLevelError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setTopLevelError(null);
    setRefId(null);
    const next: StagedFile[] = [];
    for (const f of Array.from(list)) {
      next.push({
        id: `${f.name}-${f.size}-${f.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
        file: f,
        status: "queued",
      });
    }
    setStaged((prev) => [...prev, ...next]);
  }

  function removeStaged(id: string) {
    setStaged((prev) => prev.filter((s) => s.id !== id));
  }

  async function uploadOne(s: StagedFile): Promise<StagedFile> {
    try {
      const presign = await apiPost("/uploads/presign", {
        caseId,
        filename: s.file.name,
        contentType: s.file.type || "application/pdf",
      });
      const put = await fetch(presign.url, {
        method: "PUT",
        headers: { "Content-Type": s.file.type || "application/pdf" },
        body: s.file,
      });
      if (!put.ok) throw new Error(`MinIO PUT failed: ${put.status}`);
      return { ...s, status: "uploaded", fileKey: presign.fileKey };
    } catch (err) {
      return {
        ...s,
        status: "failed",
        errorMessage: err instanceof Error ? err.message : "upload failed",
      };
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (staged.length === 0 || submitting) return;
    setSubmitting(true);
    setTopLevelError(null);

    try {
      // 1) Upload every staged file to MinIO (in parallel for speed)
      const updates: StagedFile[] = staged.map((s) => ({
        ...s,
        status: "uploading" as StagedStatus,
      }));
      setStaged(updates);

      const settled = await Promise.all(
        updates.map((s) => uploadOne(s)),
      );
      setStaged(settled);

      const successes = settled.filter((s) => s.status === "uploaded");
      if (successes.length === 0) {
        setTopLevelError("All uploads failed. Try again.");
        return;
      }

      // 2) Create the Petition with the first as brief, rest as exhibits
      const body = {
        caseId,
        files: successes.map((s, i) => ({
          fileKey: s.fileKey!,
          filename: s.file.name,
          role: i === 0 ? "brief" : "exhibit",
        })),
      };
      const petition = await apiPost("/petitions", body);
      if (petition?.analysisId) setRefId(String(petition.analysisId));

      // 3) Reset and refresh
      setStaged([]);
      startTransition(() => router.refresh());
    } catch (err) {
      setTopLevelError(err instanceof Error ? err.message : "Couldn't create petition");
    } finally {
      setSubmitting(false);
    }
  }

  const allStagedReady = staged.length > 0 && !submitting;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <label
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          submitting
            ? "border-brand-400 bg-brand-50"
            : "border-gray-300 bg-white hover:border-brand-400 hover:bg-brand-25"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          className="hidden"
          disabled={submitting}
          onChange={(e) => {
            addFiles(e.target.files);
            // reset so selecting the same file twice still fires onChange
            if (inputRef.current) inputRef.current.value = "";
          }}
        />
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Upload className="h-5 w-5" />
        </span>
        <p className="text-sm font-semibold text-gray-900">
          Drop petition PDFs here, or click to choose
        </p>
        <p className="text-xs leading-5 text-gray-500">
          Upload the brief plus any supporting exhibits in one go. PDF only ·
          up to 25 MB each · we don&rsquo;t store anything outside your machine
        </p>
      </label>

      {/* Staged file list */}
      {staged.length > 0 && (
        <div className="card overflow-hidden">
          <div className="border-b border-gray-100 bg-gray-25 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Files to upload ({staged.length})
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {staged.map((s, i) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600">
                  <FileText className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {s.file.name}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {(s.file.size / 1024).toFixed(1)} KB ·{" "}
                    <span className="font-medium">
                      {i === 0 ? "Brief" : "Exhibit"}
                    </span>
                  </p>
                </div>
                <StagedPill staged={s} />
                {s.status === "queued" && (
                  <button
                    type="button"
                    onClick={() => removeStaged(s.id)}
                    className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                    aria-label="Remove from upload"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
            >
              <Plus className="h-3.5 w-3.5" /> Add another file
            </button>
            <form onSubmit={onSubmit}>
              <button
                type="submit"
                disabled={!allStagedReady}
                className="btn-primary text-xs"
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>Submit {staged.length === 1 ? "1 file" : `${staged.length} files`}</>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {topLevelError && (
        <p className="inline-flex items-center gap-1 text-xs text-error-700">
          <AlertCircle className="h-3.5 w-3.5" /> {topLevelError}
        </p>
      )}

      {refId && !submitting && (
        <p className="text-[11px] text-gray-500">
          Review reference:{" "}
          <span className="font-mono text-gray-700">{refId.slice(-8)}</span>{" "}
          &middot; keep this URL bookmarked &mdash; you can close the tab and
          come back any time.
        </p>
      )}
    </div>
  );
}

function StagedPill({ staged }: { staged: StagedFile }) {
  if (staged.status === "uploading") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-700">
        <Loader2 className="h-3 w-3 animate-spin" />
        uploading
      </span>
    );
  }
  if (staged.status === "uploaded") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[10px] font-medium text-success-700">
        <CheckCircle2 className="h-3 w-3" />
        ready
      </span>
    );
  }
  if (staged.status === "failed") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full border border-error-200 bg-error-50 px-2 py-0.5 text-[10px] font-medium text-error-700"
        title={staged.errorMessage}
      >
        <AlertCircle className="h-3 w-3" />
        failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600">
      queued
    </span>
  );
}

async function apiPost(path: string, body: unknown) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${await res.text()}`);
  return res.json();
}
