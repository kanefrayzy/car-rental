"use client";

import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { site } from "@/config/site";
import { ApiError, uploadDocuments, type BookingDetails, type BookingLink } from "@/lib/api";
import { useResetOnLeave } from "@/lib/useResetOnLeave";
import { validateFile } from "@/lib/validation";
import { FileDropzone } from "./FileDropzone";

type Kind = "license" | "insurance";

const DOCUMENTS: { kind: Kind; label: string; hint: string }[] = [
  { kind: "license", label: "Driver’s license", hint: "A clear photo of the front." },
  { kind: "insurance", label: "Proof of insurance", hint: "Your full coverage insurance card or declarations page." },
];

/** The license and insurance upload on the booking page. Files go to the API's private storage. */
export function DocumentsForm({
  link,
  documents,
  onUploaded,
}: {
  link: BookingLink;
  documents: BookingDetails["documents"];
  onUploaded: (details: BookingDetails) => void;
}) {
  const [files, setFiles] = useState<Record<Kind, File | null>>({ license: null, insurance: null });
  const [errors, setErrors] = useState<Partial<Record<Kind, string>>>({});
  const [busy, setBusy] = useState(false);
  // Set at once on submit (state is a render late): a double click uploads once.
  const sending = useRef(false);
  // Back on this page, or restored from the back-forward cache: never with the spinner still on.
  useResetOnLeave(() => {
    sending.current = false;
    setBusy(false);
  });
  const [submitError, setSubmitError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (sending.current) return;

    // A document already on file may be left as it is; a missing one is required.
    const nextErrors: Partial<Record<Kind, string>> = {};
    for (const { kind } of DOCUMENTS) {
      if (!files[kind] && !documents[kind]) nextErrors[kind] = validateFile(null) ?? undefined;
    }
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) return;
    if (!files.license && !files.insurance) return;

    sending.current = true;
    setBusy(true);
    setSubmitError("");
    try {
      onUploaded(await uploadDocuments(link, { license: files.license ?? undefined, insurance: files.insurance ?? undefined }));
      setFiles({ license: null, insurance: null });
    } catch (error) {
      setSubmitError(
        error instanceof ApiError && (error.status === 403 || error.status === 404)
          ? `This link has expired. Call or text ${site.phone.display} and we’ll send you a new one.`
          : error instanceof ApiError && error.status === 0
            ? `The upload didn’t finish, most likely a weak connection. Try again, on Wi-Fi if you can, or call ${site.phone.display}.`
            : error instanceof ApiError
              ? error.message
              : `The upload didn’t go through. Try again or call ${site.phone.display}.`,
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate data-clarity-mask="true">
      <div className="grid gap-5">
        {DOCUMENTS.map(({ kind, label, hint }) => (
          <div key={kind}>
            {documents[kind] && !files[kind] && (
              <p className="mb-2 flex items-center gap-2 text-sm font-medium text-success">
                <CheckIcon className="text-base" />
                {label} received. Choose a new file only to replace it.
              </p>
            )}
            <FileDropzone
              label={label}
              hint={hint}
              file={files[kind]}
              error={errors[kind]}
              onChange={(file, error) => {
                setFiles((current) => ({ ...current, [kind]: file }));
                setErrors((current) => ({ ...current, [kind]: error ?? undefined }));
              }}
            />
          </div>
        ))}
      </div>
      <p className="mt-4 text-[0.8125rem] leading-relaxed text-muted">
        Stored privately: only we can see them, and they are deleted after your rental.
      </p>
      {submitError && (
        <p role="alert" className="mt-4 text-sm font-medium text-danger">
          {submitError}
        </p>
      )}
      <Button type="submit" loading={busy} className="mt-5 max-sm:w-full">
        {busy ? "Uploading…" : "Upload documents"}
      </Button>
    </form>
  );
}
