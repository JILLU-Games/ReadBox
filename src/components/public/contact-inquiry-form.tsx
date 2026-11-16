"use client";

import {
  AlertBanner,
  Button,
  Checkbox,
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
import { Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export interface ContactInquiryFormProps {
  readonly initialServiceType?: string;
  readonly siteName: string;
  readonly privacyUrl?: string;
}

const VALID_SERVICE_TYPES = new Set(["personal", "team", "business", "other"]);

export function ContactInquiryForm({
  initialServiceType = "",
  siteName,
  privacyUrl = "/privacy",
}: ContactInquiryFormProps) {
  const normalizedInitialService = VALID_SERVICE_TYPES.has(initialServiceType)
    ? initialServiceType
    : "";

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
  } | null>(null);

  const csrfPromiseRef = useRef<Promise<string> | null>(null);

  const fetchCsrfToken = async (): Promise<string> => {
    if (csrfToken) return csrfToken;
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
    if (!VALID_SERVICE_TYPES.has(serviceType)) {
      localErrors.service_type = "Select a valid mailbox requirement.";
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
      const token = await fetchCsrfToken();
      const response = await fetch("/api/contact", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "X-VibMail-CSRF": token,
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
          form_started_at: String(formStartedAtRef.current || Date.now() - 3_000),
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        message?: string;
        errors?: Record<string, string>;
      };

      if (!response.ok) {
        if (data.errors) {
          setFieldErrors(data.errors);
        }
        throw new Error(
          data.message || "Your inquiry could not be submitted.",
        );
      }

      setStatusBanner({
        type: "success",
        text: `Thank you. Your inquiry has been sent to the ${siteName} administration team.`,
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
        <SectionTitle>Mailbox &amp; Service Inquiry</SectionTitle>
        <span className="text-[11px] text-muted-foreground">
          Fields marked with <span aria-hidden="true">*</span> are required
        </span>
      </PanelHeader>

      <PanelBody>
        <form data-contact-form noValidate onSubmit={handleSubmit}>
          {statusBanner ? (
            <AlertBanner
              data-form-status
              variant={statusBanner.type}
              role="status"
              aria-live="polite"
              className="mb-3"
            >
              {statusBanner.text}
            </AlertBanner>
          ) : null}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="full_name">
                Full name <span aria-hidden="true">*</span>
              </Label>
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
              />
              {fieldErrors.full_name ? (
                <p
                  data-error-for="full_name"
                  className="text-[11px] text-destructive"
                >
                  {fieldErrors.full_name}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="work_email">
                Email address <span aria-hidden="true">*</span>
              </Label>
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
              />
              {fieldErrors.work_email ? (
                <p
                  data-error-for="work_email"
                  className="text-[11px] text-destructive"
                >
                  {fieldErrors.work_email}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="company">Organization or domain</Label>
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
              />
              {fieldErrors.company ? (
                <p
                  data-error-for="company"
                  className="text-[11px] text-destructive"
                >
                  {fieldErrors.company}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="phone">Phone (optional)</Label>
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
              />
              {fieldErrors.phone ? (
                <p
                  data-error-for="phone"
                  className="text-[11px] text-destructive"
                >
                  {fieldErrors.phone}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="service_type">
                Mailbox requirement <span aria-hidden="true">*</span>
              </Label>
              <Select
                id="service_type"
                name="service_type"
                required
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                aria-invalid={Boolean(fieldErrors.service_type)}
                className="w-full"
              >
                <option value="">Select a service</option>
                <option value="personal">Personal Private Mailbox</option>
                <option value="team">Team Mailbox Access</option>
                <option value="business">Business Mailbox Operations</option>
                <option value="other">Custom / Other Requirement</option>
              </Select>
              {fieldErrors.service_type ? (
                <p
                  data-error-for="service_type"
                  className="text-[11px] text-destructive"
                >
                  {fieldErrors.service_type}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1">
              <Label htmlFor="team_size">Expected users</Label>
              <Select
                id="team_size"
                name="team_size"
                value={teamSize}
                onChange={(e) => setTeamSize(e.target.value)}
                aria-invalid={Boolean(fieldErrors.team_size)}
                className="w-full"
              >
                <option value="">Select team size</option>
                <option value="1">1 user</option>
                <option value="2-5">2–5 users</option>
                <option value="6-20">6–20 users</option>
                <option value="21-50">21–50 users</option>
                <option value="50+">50+ users</option>
              </Select>
              {fieldErrors.team_size ? (
                <p
                  data-error-for="team_size"
                  className="text-[11px] text-destructive"
                >
                  {fieldErrors.team_size}
                </p>
              ) : null}
            </div>

            <div className="grid gap-1 sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="message">
                  Project or mailbox details <span aria-hidden="true">*</span>
                </Label>
                <span
                  id="message-help"
                  className="font-mono text-[11px] text-muted-foreground"
                >
                  <span data-message-count>{message.length}</span> / 2000
                </span>
              </div>
              <Textarea
                id="message"
                name="message"
                rows={4}
                required
                minLength={20}
                maxLength={2000}
                aria-describedby="message-help"
                placeholder="Tell us which domain(s), mailbox addresses, or team workflows you need to set up."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={Boolean(fieldErrors.message)}
              />
              {fieldErrors.message ? (
                <p
                  data-error-for="message"
                  className="text-[11px] text-destructive"
                >
                  {fieldErrors.message}
                </p>
              ) : null}
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
                data-error-for="consent"
                className="mt-1 text-[11px] text-destructive"
              >
                {fieldErrors.consent}
              </p>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
            <Button type="submit" disabled={loading}>
              <Icon glyph={Send} className="size-3" />
              <span data-submit-label>
                {loading ? "Sending inquiry…" : "Send inquiry"}
              </span>
            </Button>
            <span className="text-[11px] text-muted-foreground">
              Protected against automated spam &amp; rate abuse.
            </span>
          </div>
        </form>
      </PanelBody>
    </Panel>
  );
}
