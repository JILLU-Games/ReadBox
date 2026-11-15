"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/components/ui/notifications";
import type {
  MailboxActionResult,
  MailboxCreationDomainOption,
} from "@/core/mailboxes/service";
import { Copy, Plus, Sparkles, X } from "lucide-react";
import { useState, useTransition } from "react";

const LOCAL_PART_WORDS = [
  "inbox",
  "relay",
  "desk",
  "team",
  "ops",
  "portal",
  "notice",
  "stream",
] as const;

export function generateRandomMailboxLocalPart(): string {
  const prefix =
    LOCAL_PART_WORDS[Math.floor(Math.random() * LOCAL_PART_WORDS.length)] ??
    "inbox";
  const token = Math.random().toString(36).slice(2, 7);
  return `${prefix}.${token}`;
}

export interface CreateUserMailboxModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly domains: readonly MailboxCreationDomainOption[];
  readonly createAction: (input: {
    readonly localPart: string;
    readonly domainUuid?: string;
  }) => Promise<
    MailboxActionResult<{
      uuid: string;
      emailAddress: string;
      localPart: string;
    }>
  >;
  readonly onCreated?: (created: {
    uuid: string;
    emailAddress: string;
    localPart: string;
  }) => void;
}

export function CreateUserMailboxModal({
  open,
  onClose,
  domains,
  createAction,
  onCreated,
}: CreateUserMailboxModalProps) {
  const defaultDomain =
    domains.find((d) => d.isDefault) ?? domains[0] ?? null;
  const [localPart, setLocalPart] = useState("");
  const [domainUuid, setDomainUuid] = useState(defaultDomain?.uuid ?? "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!open) return null;

  const selectedDomain =
    domains.find((d) => d.uuid === domainUuid) ?? defaultDomain;
  const normalizedPreviewLocal = localPart.trim().toLowerCase() || "local.part";
  const previewAddress = selectedDomain
    ? `${normalizedPreviewLocal}@${selectedDomain.name}`
    : normalizedPreviewLocal;

  function handleGenerate() {
    setLocalPart(generateRandomMailboxLocalPart());
    setErrorMessage(null);
  }

  function submitMailbox(copyOnSuccess: boolean) {
    const trimmed = localPart.trim().toLowerCase();
    if (!trimmed) {
      setErrorMessage("Enter a mailbox local part before creating.");
      return;
    }

    setErrorMessage(null);
    startTransition(async () => {
      const result = await createAction({
        localPart: trimmed,
        domainUuid: selectedDomain?.uuid || undefined,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        notify.error(result.error);
        return;
      }

      if (copyOnSuccess && typeof navigator !== "undefined") {
        try {
          await navigator.clipboard?.writeText(result.data.emailAddress);
          notify.success(`Created and copied ${result.data.emailAddress}`);
        } catch {
          notify.success(result.message ?? `Created ${result.data.emailAddress}`);
        }
      } else {
        notify.success(result.message ?? `Created ${result.data.emailAddress}`);
      }

      setLocalPart("");
      onCreated?.(result.data);
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-user-mailbox-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-lg">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2
              id="create-user-mailbox-title"
              className="text-base font-semibold tracking-tight text-foreground"
            >
              Create mailbox
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Provision a receive-only mailbox on an active, DNS-verified domain
              and assign it to your workspace.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create mailbox dialog"
            className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon glyph={X} />
          </button>
        </div>

        {domains.length === 0 ? (
          <div className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3.5 text-xs text-foreground">
            No active, DNS-verified domains are currently available. Ask an
            administrator to verify a domain in{" "}
            <span className="font-mono">/vcon/domains</span>.
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div>
              <label
                htmlFor="user-mailbox-domain"
                className="block text-xs font-medium text-foreground"
              >
                Domain
              </label>
              <select
                id="user-mailbox-domain"
                value={selectedDomain?.uuid ?? ""}
                onChange={(e) => setDomainUuid(e.target.value)}
                disabled={isPending}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"
              >
                {domains.map((domain) => (
                  <option key={domain.uuid} value={domain.uuid}>
                    {domain.name}
                    {domain.isDefault ? " (Default)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="user-mailbox-local-part"
                  className="block text-xs font-medium text-foreground"
                >
                  Mailbox local part
                </label>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isPending}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Icon glyph={Sparkles} className="size-3.5" />
                  Generate
                </button>
              </div>
              <input
                id="user-mailbox-local-part"
                type="text"
                value={localPart}
                onChange={(e) => {
                  setLocalPart(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="e.g. logan.rodriguez"
                autoComplete="off"
                spellCheck={false}
                disabled={isPending}
                className="mt-1.5 flex h-10 w-full rounded-md border border-input bg-background px-3 font-mono text-sm text-foreground"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Address preview:{" "}
                <span className="font-mono font-medium text-foreground">
                  {previewAddress}
                </span>
              </p>
            </div>

            {errorMessage ? (
              <div
                role="alert"
                className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
              >
                {errorMessage}
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => submitMailbox(true)}
              >
                <Icon glyph={Copy} />
                Create & copy
              </Button>
              <Button
                type="button"
                disabled={isPending}
                onClick={() => submitMailbox(false)}
              >
                <Icon glyph={Plus} />
                Create mailbox
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
