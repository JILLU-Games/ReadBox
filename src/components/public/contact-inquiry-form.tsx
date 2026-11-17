"use client";

import {
  AlertBanner,
  Button,
  CaptionText,
  Checkbox,
  FormField,
  Icon,
  Input,
  Label,
  Panel,
  PanelBody,
  PanelHeader,
  SectionTitle,
  Select,
  Textarea,
} from "@/components/ui";
import { RotateCcw, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface ContactInquiryFormProps {
  readonly initialServiceType?: string;
  readonly siteName: string;
  readonly privacyUrl?: string;
}

const INQUIRY_TOPICS = [
  {
    value: "personal",
    shortLabel: "Account & Workspace",
    optionLabel: "Account & Personal Workspace",
  },
  {
    value: "team",
    shortLabel: "Team & Quotas",
    optionLabel: "Team Mailboxes & Quota Policy",
  },
  {
    value: "business",
    shortLabel: "Custom Domain",
    optionLabel: "Custom Domain & Enterprise Setup",
  },
  {
    value: "other",
    shortLabel: "Technical Support",
    optionLabel: "Technical Support & General Inquiry",
  },
] as const;

const VALID_SERVICE_TYPES = new Set(INQUIRY_TOPICS.map((item) => item.value));

export function ContactInquiryForm({
  initialServiceType = "",
  siteName,
  privacyUrl = "/privacy",
}: ContactInquiryFormProps) {
  const normalizedInitialService = VALID_SERVICE_TYPES.has(
    initialServiceType as (typeof INQUIRY_TOPICS)[number]["value"],
  )
    ? initialServiceType
    : "business";

  const [fullName, setFullName] = useState("");
  const [workEmail, setWorkEmail] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceType, setServiceType] = useState(normalizedInitialService);
  const [teamSize, setTeamSize] = useState("");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [websiteHoneypot, setWebsiteHoneypot] = useState("");
  const formStartedAtRef = useRef<number>(0);

  const [csrfToken, setCsrfToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [statusBanner, setStatusBanner] = useState<{
    readonly type: "success" | "error";
    readonly text: string;
    readonly requestId?: string;
  } | null>(null);

  const csrfPromiseRef = useRef<Promise<string> | null>(null);

  const fetchCsrfToken = async (forceRefresh = false): Promise<string> => {
    if (!forceRefresh && csrfToken) return csrfToken;
    if (!csrfPromiseRef.current) {
      csrfPromiseRef.current = fetch("/api/contact/csrf", {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "application/json" },
        cache: "no-store",
      })
        .then(async (res) => {
          if (!res.ok) {
            throw new Error("Unable to initialize secure form.");
          }
          const data = (await res.json()) as { token?: string };
          if (!data.token) {
            throw new Error("Invalid form security response.");
          }
          setCsrfToken(data.token);
          return data.token;
        })
        .finally(() => {
          csrfPromiseRef.current = null;
        });
    }
    return csrfPromiseRef.current;
  };

  useEffect(() => {
    formStartedAtRef.current = Date.now() - 3_000;
    fetchCsrfToken().catch(() => {
      // Deferred retry on submit if initial prefetch fails
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReset = () => {
    setFullName("");
    setWorkEmail("");
    setCompany("");
    setPhone("");
    setServiceType(normalizedInitialService);
    setTeamSize("");
    setMessage("");
    setConsent(false);
    setFieldErrors({});
    setStatusBanner(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFieldErrors({});
    setStatusBanner(null);

    const localErrors: Record<string, string> = {};
    if (fullName.trim().length < 2) {
      localErrors.full_name = "Enter at least 2 characters.";
    }
    if (!workEmail.trim() || !workEmail.includes("@")) {
      localErrors.work_email = "Enter a valid email address.";
    }
    if (
      !VALID_SERVICE_TYPES.has(
        serviceType as (typeof INQUIRY_TOPICS)[number]["value"],
      )
    ) {
      localErrors.service_type = "Select an inquiry topic.";
    }
    if (message.trim().length < 20) {
      localErrors.message = "Enter at least 20 characters.";
    }
    if (!consent) {
      localErrors.consent = "Consent is required.";
    }

    if (Object.keys(localErrors).length > 0) {
      setFieldErrors(localErrors);
      setStatusBanner({
        type: "error",
        text: "Please complete all required fields before submitting.",
      });
      return;
    }

    setLoading(true);
    try {
      const submitWithToken = async (token: string) =>
        fetch("/api/contact", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-ReadBox-CSRF": token,
          },
          body: JSON.stringify({
            full_name: fullName,
            work_email: workEmail,
            company,
            phone,
            service_type: serviceType,
            team_size: teamSize,
            message,
            consent,
            website: websiteHoneypot,
            form_started_at: String(
              formStartedAtRef.current || Date.now() - 3_000,
            ),
          }),
        });

      const token = await fetchCsrfToken();
      let response = await submitWithToken(token);

      if (response.status === 403) {
        setCsrfToken("");
        const refreshedToken = await fetchCsrfToken(true);
        response = await submitWithToken(refreshedToken);
      }

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        request_id?: string;
        errors?: Record<string, string>;
      };

      if (!response.ok) {
        if (data.errors) {
          setFieldErrors(data.errors);
        }
        if (response.status === 429) {
          const retryAfterRaw = response.headers.get("Retry-After");
          const retrySeconds = retryAfterRaw ? Number(retryAfterRaw) : NaN;
          const retryNote =
            Number.isFinite(retrySeconds) && retrySeconds > 0
              ? ` Wait about ${retrySeconds >= 60 ? `${Math.ceil(retrySeconds / 60)} min` : `${Math.ceil(retrySeconds)}s`} before trying again.`
              : "";
          throw new Error(
            `${data.message || "Too many inquiries submitted recently."}${retryNote}`,
          );
        }
        throw new Error(
          data.message || "Your inquiry could not be submitted.",
        );
      }

        setStatusBanner({
        type: "success",
        text: `Thank you. Your inquiry has been received by the ${siteName} support team.`,
        requestId: data.request_id,
      });
      setFullName("");
      setWorkEmail("");
      setCompany("");
      setPhone("");
      setServiceType(normalizedInitialService);
      setTeamSize("");
      setMessage("");
      setConsent(false);
      formStartedAtRef.current = Date.now() - 3_000;
    } catch (error) {
      setStatusBanner({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.",
      });
    } finally {
      setCsrfToken("");
      fetchCsrfToken().catch(() => {});
      setLoading(false);
    }
  };

  return (
    <Panel>
      <PanelHeader>
        <SectionTitle>Support &amp; Onboarding Inquiry</SectionTitle>
      </PanelHeader>

      <PanelBody className="p-4">
        <form data-contact-form noValidate onSubmit={handleSubmit}>
          {statusBanner ? (
            <AlertBanner
              data-form-status
              variant={statusBanner.type}
              role="status"
              aria-live="polite"
              className="mb-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>{statusBanner.text}</span>
                {statusBanner.requestId ? (
                  <CaptionText className="font-mono text-current">
                    Ref: {statusBanner.requestId.slice(0, 12)}
                  </CaptionText>
                ) : null}
              </div>
            </AlertBanner>
          ) : null}

          {/* Quick Inquiry Topic Selector */}
          <div className="mb-3 border-b border-border pb-3">
            <CaptionText className="mb-1.5 block font-medium">
              Quick topic selection
            </CaptionText>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {INQUIRY_TOPICS.map((topic) => {
                const isSelected = serviceType === topic.value;
                return (
                  <Button
                    key={topic.value}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => setServiceType(topic.value)}
                    className="w-full justify-center whitespace-nowrap"
                  >
                    {topic.shortLabel}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FormField
              id="full_name"
              label="Full name *"
              error={fieldErrors.full_name}
            >
              <Input
                id="full_name"
                name="full_name"
                type="text"
                required
                minLength={2}
                maxLength={100}
                autoComplete="name"
                placeholder="Alex Morgan"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                aria-invalid={Boolean(fieldErrors.full_name)}
                aria-describedby={
                  fieldErrors.full_name ? "full_name-error" : undefined
                }
              />
            </FormField>

            <FormField
              id="work_email"
              label="Email address *"
              error={fieldErrors.work_email}
            >
              <Input
                id="work_email"
                name="work_email"
                type="email"
                required
                maxLength={254}
                autoComplete="email"
                placeholder="alex@company.com"
                value={workEmail}
                onChange={(e) => setWorkEmail(e.target.value)}
                aria-invalid={Boolean(fieldErrors.work_email)}
                aria-describedby={
                  fieldErrors.work_email ? "work_email-error" : undefined
                }
              />
            </FormField>

            <FormField
              id="company"
              label="Organization or domain"
              error={fieldErrors.company}
            >
              <Input
                id="company"
                name="company"
                type="text"
                maxLength={120}
                autoComplete="organization"
                placeholder="Example Corp / example.com"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                aria-invalid={Boolean(fieldErrors.company)}
                aria-describedby={
                  fieldErrors.company ? "company-error" : undefined
                }
              />
            </FormField>

            <FormField
              id="phone"
              label="Phone (optional)"
              error={fieldErrors.phone}
            >
              <Input
                id="phone"
                name="phone"
                type="tel"
                maxLength={40}
                autoComplete="tel"
                placeholder="+1 (555) 010-2400"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={Boolean(fieldErrors.phone)}
                aria-describedby={fieldErrors.phone ? "phone-error" : undefined}
              />
            </FormField>

            <FormField
              id="service_type"
              label="Inquiry topic *"
              error={fieldErrors.service_type}
            >
              <Select
                id="service_type"
                name="service_type"
                required
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                aria-invalid={Boolean(fieldErrors.service_type)}
                aria-describedby={
                  fieldErrors.service_type ? "service_type-error" : undefined
                }
                className="w-full"
              >
                <option value="">Select a topic</option>
                {INQUIRY_TOPICS.map((topic) => (
                  <option key={topic.value} value={topic.value}>
                    {topic.optionLabel}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField
              id="team_size"
              label="Team or workspace size"
              error={fieldErrors.team_size}
            >
              <Select
                id="team_size"
                name="team_size"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                aria-invalid={Boolean(fieldErrors.team_size)}
                aria-describedby={
                  fieldErrors.team_size ? "team_size-error" : undefined
                }
                className="w-full"
              >
                <option value="">Select team size</option>
                <option value="1">1 user</option>
                <option value="2-5">2–5 users</option>
                <option value="6-20">6–20 users</option>
                <option value="21-50">21–50 users</option>
                <option value="50+">50+ users</option>
              </Select>
            </FormField>

            <div className="sm:col-span-2">
              <FormField
                id="message"
                label="Message or technical details *"
                error={fieldErrors.message}
              >
                <Textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  minLength={20}
                  maxLength={2000}
                  aria-describedby={
                    fieldErrors.message
                      ? "message-help message-error"
                      : "message-help"
                  }
                  placeholder="Describe your custom domain setup, workspace quota requirements, or technical support question."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  aria-invalid={Boolean(fieldErrors.message)}
                />
                <CaptionText
                  id="message-help"
                  className="text-right font-mono tabular-nums"
                >
                  <span data-message-count>{message.length}</span> / 2000 (min
                  20)
                </CaptionText>
              </FormField>
            </div>
          </div>

          {/* Honeypot field hidden from human users */}
          <div className="sr-only" aria-hidden="true">
            <Label htmlFor="website">Leave this field empty</Label>
            <Input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={websiteHoneypot}
              onChange={(e) => setWebsiteHoneypot(e.target.value)}
            />
          </div>

          <div className="mt-3">
            <Label
              htmlFor="consent"
              className="flex items-start gap-2 font-normal text-muted-foreground"
            >
              <Checkbox
                id="consent"
                name="consent"
                required
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                aria-invalid={Boolean(fieldErrors.consent)}
                className="mt-0.5"
              />
              <span>
                I agree that {siteName} may process these details to respond to
                my inquiry in accordance with the{" "}
                <Link
                  href={privacyUrl || "/privacy"}
                  className="font-medium text-foreground underline decoration-border underline-offset-2 hover:text-primary"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </Label>
            {fieldErrors.consent ? (
              <p
                id="consent-error"
                role="alert"
                className="mt-1 text-xs text-destructive"
              >
                {fieldErrors.consent}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit" disabled={loading}>
                <Icon glyph={Send} className="size-3" />
                <span data-submit-label>
                  {loading ? "Sending inquiry…" : "Send inquiry"}
                </span>
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={handleReset}
              >
                <Icon glyph={RotateCcw} className="size-3" />
                <span>Clear</span>
              </Button>
            </div>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}
