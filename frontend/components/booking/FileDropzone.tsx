"use client";

import { useId, useRef, useState, type DragEvent } from "react";
import { CloseIcon } from "@/components/ui/icons";
import { site } from "@/config/site";
import { shrinkImage } from "@/lib/shrinkImage";
import { acceptedFileLabel, acceptedFileTypes, validateFile } from "@/lib/validation";

type FileDropzoneProps = {
  label: string;
  hint: string;
  file: File | null;
  error?: string;
  onChange: (file: File | null, error: string | null) => void;
};

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

// Click or drop to choose one file. Large photos are shrunk first (lib/shrinkImage), then type
// and size are checked here for fast feedback; the API checks again.
export function FileDropzone({ label, hint, file, error, onChange }: FileDropzoneProps) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const picks = useRef(0);

  const choose = async (picked: File | null) => {
    const pick = ++picks.current;
    // A wrong type is refused before any work; the size limit applies to the shrunk photo.
    if (!picked || !acceptedFileTypes.includes(picked.type)) {
      onChange(null, validateFile(picked));
      return;
    }
    setPreparing(true);
    const next = await shrinkImage(picked);
    if (pick !== picks.current) return; // another file was chosen meanwhile
    setPreparing(false);
    const problem = validateFile(next);
    onChange(problem ? null : next, problem);
  };

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    void choose(event.dataTransfer.files[0] ?? null);
  };

  return (
    <div>
      <p id={`${id}-label`} className="text-sm font-medium text-ink">
        {label}
      </p>

      {file ? (
        <div className="mt-2 flex items-center gap-3 rounded-btn-lg border border-line-strong bg-surface/60 px-4 py-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-ink-soft">{file.name}</span>
            <span className="text-xs text-muted">{formatSize(file.size)}</span>
          </span>
          <button
            type="button"
            onClick={() => onChange(null, null)}
            aria-label={`Remove ${file.name}`}
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-lg text-ink-soft hover:bg-tint"
          >
            <CloseIcon />
          </button>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`mt-2 flex cursor-pointer flex-col items-center rounded-btn-lg border border-dashed px-4 py-5 text-center transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-deep ${
            error
              ? "border-danger bg-danger/5"
              : dragging
                ? "border-brand-deep bg-tint"
                : "border-line-strong bg-surface/60 hover:border-brand-deep"
          }`}
        >
          <span className="text-sm font-medium text-brand-deep">
            {preparing ? "Preparing the photo…" : "Choose a file or drop it here"}
          </span>
          <span className="mt-1 text-xs text-muted">
            {hint} {acceptedFileLabel}, up to {site.booking.upload.maxSizeMb} MB.
          </span>
          <input
            id={id}
            type="file"
            accept={acceptedFileTypes.join(",")}
            aria-labelledby={`${id}-label`}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            disabled={preparing}
            onChange={(event) => {
              void choose(event.target.files?.[0] ?? null);
              // Let the same file be chosen again after an error.
              event.target.value = "";
            }}
            className="sr-only"
          />
        </label>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
