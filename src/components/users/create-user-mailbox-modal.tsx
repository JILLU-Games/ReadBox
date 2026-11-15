"use client";

import {
  AlertBanner,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  Icon,
  IconButton,
  Input,
  Label,
  notify,
  Select,
} from "@/components/ui";
import {
  copyTextWithFallback,
  generateRandomUsaLocalPart,
  generateUsaMailboxSuggestions,
  sanitizeLocalPartInput,
} from "@/components/users/user-workspace-helpers";
import type {
  MailboxActionResult,
  MailboxCreationDomainOption,
} from "@/core/mailboxes/service";
import { Copy, Dices, Plus, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

export function generateRandomMailboxLocalPart(): string {
  return generateRandomUsaLocalPart();
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
  const router = useRouter();
  const defaultDomain =
    domains.find((d) => d.isDefault) ?? domains[0] ?? null;
  const [localPart, setLocalPart] = useState("");
  const [domainUuid, setDomainUuid] = useState(defaultDomain?.uuid ?? "");
  const [suggestions, setSuggestions] = useState<string[]>(() =>
    generateUsaMailboxSuggestions(3),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClose() {
    setErrorMessage(null);
    setSuggestions(generateUsaMailboxSuggestions(3));
    onClose();
  }

  const selectedDomain =
    domains.find((d) => d.uuid === domainUuid) ?? defaultDomain;
  const normalizedPreviewLocal = localPart.trim().toLowerCase() || "local.part";
  const previewAddress = selectedDomain
    ? `${normalizedPreviewLocal}@${selectedDomain.name}`
    : normalizedPreviewLocal;

  function handleGenerate() {
    setLocalPart(generateRandomUsaLocalPart());
    setErrorMessage(null);
  }

  function handleRefreshSuggestions() {
    setSuggestions(generateUsaMailboxSuggestions(3));
  }

  function submitMailbox(copyOnSuccess: boolean) {
    const trimmed = sanitizeLocalPartInput(localPart.trim());
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

      if (copyOnSuccess) {
        const copied = await copyTextWithFallback(result.data.emailAddress);
        notify.success(
          copied
            ? `Created and copied ${result.data.emailAddress}`
            : (result.message ?? `Created ${result.data.emailAddress}`),
        );
      } else {
        notify.success(result.message ?? `Created ${result.data.emailAddress}`);
      }

      setLocalPart("");
      setSuggestions(generateUsaMailboxSuggestions(3));
      onCreated?.(result.data);
      router.refresh();
      onClose();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => (!nextOpen ? handleClose() : undefined)}>
      <DialogContent className="max-w-md">
        <DialogTitle>Create mailbox</DialogTitle>

        {domains.length === 0 ? (
          <AlertBanner variant="warning">
            No active, DNS-verified domains are available.
          </AlertBanner>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              submitMailbox(false);
            }}
          >
            <div>
              <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                <Label htmlFor="user-mailbox-local-part">Mailbox address</Label>

                <div className="flex flex-wrap items-center gap-1">
                  <span className="text-[11px] text-muted-foreground">
                    Quick:
                  </span>
                  {suggestions.map((suggestion) => (
                    <Button
                      key={suggestion}
                      type="button"
                      variant="outline"
                      size="xs"
                      disabled={isPending}
                      onClick={() => {
                        setLocalPart(suggestion);
                        setErrorMessage(null);
                      }}
                      className="font-mono"
                    >
                      {suggestion}
                    </Button>
                  ))}
                  <IconButton
                    type="button"
                    disabled={isPending}
                    onClick={handleRefreshSuggestions}
                    label="Refresh name suggestions"
                    title="Shuffle suggestions"
                    className="size-6 border border-border bg-card"
                  >
                    <Icon glyph={RefreshCw} className="size-3" />
                  </IconButton>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-stretch gap-1.5">
                  <Input
                    id="user-mailbox-local-part"
                    type="text"
                    value={localPart}
                    onChange={(e) => {
                      setLocalPart(sanitizeLocalPartInput(e.target.value));
                      setErrorMessage(null);
                    }}
                    placeholder="e.g. logan.rodriguez"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={isPending}
                    className="min-w-0 flex-1 font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleGenerate}
                    disabled={isPending}
                    aria-label="Generate random local part"
                    title="Generate"
                  >
                    <Icon glyph={Dices} className="size-3.5" />
                    <span className="hidden sm:inline">Generate</span>
                  </Button>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs text-muted-foreground">
                    @
                  </span>
                  <Select
                    id="user-mailbox-domain"
                    aria-label="Mailbox domain"
                    value={selectedDomain?.uuid ?? ""}
                    onChange={(e) => setDomainUuid(e.target.value)}
                    disabled={isPending}
                    className="w-full font-mono"
                  >
                    {domains.map((domain) => (
                      <option key={domain.uuid} value={domain.uuid}>
                        {domain.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                {previewAddress}
              </p>
            </div>

            {errorMessage ? (
              <AlertBanner variant="error">{errorMessage}</AlertBanner>
            ) : null}

            <DialogFooter className="border-t border-border pt-3 sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  disabled={isPending}
                >
                  <Icon glyph={Plus} />
                  Create mailbox
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
              </div>
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isPending}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
