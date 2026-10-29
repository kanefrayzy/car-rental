"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon, CheckIcon, ChevronDownIcon } from "@/components/ui/icons";
import { contactTopics, type ContactTopic } from "@/config/content";
import { site } from "@/config/site";
import { track } from "@/lib/analytics";
import { ApiError, sendContactMessage } from "@/lib/api";
import { formatUsPhone } from "@/lib/validation";

const MESSAGE_MAX = 2000;

type Values = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  occasion: ContactTopic | "";
  preferredDates: string;
  message: string;
};
type Errors = Partial<Record<keyof Values, string>>;

const EMPTY: Values = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  occasion: "",
  preferredDates: "",
  message: "",
};

/** The same checks as the API (ContactRequest), so most mistakes are caught before sending. */
function validate(values: Values): Errors {
  const errors: Errors = {};
  if (!values.firstName.trim()) errors.firstName = "Enter your first name.";
  if (!values.lastName.trim()) errors.lastName = "Enter your last name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(values.email.trim())) errors.email = "Enter a valid email address.";
  const digits = values.phone.replace(/\D/g, "");
  if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) {
    errors.phone = "Enter a 10-digit US phone number.";
  }
  if (!values.occasion) errors.occasion = "Choose what it’s for.";
  if (values.message.trim().length < 10) errors.message = "Tell us a little more: at least 10 characters.";
  return errors;
}

/**
 * Questions and quote requests (the /contact page and the Contact section on the home page):
 * sent through the API to the business's inbox, with Reply-To set to the visitor. The hidden
 * "company" field is a honeypot for bots.
 */
export function ContactForm() {
  const id = useId();
  const [values, setValues] = useState<Values>(EMPTY);
  const [company, setCompany] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");
  const [sent, setSent] = useState(false);

  // "Request a quote" on a service page opens /contact?occasion=wedding: start with it chosen.
  useEffect(() => {
    const topic = new URLSearchParams(window.location.search).get("occasion");
    if (!contactTopics.some((item) => item.value === topic)) return;
    // Reading the address once after mount; the server render has no query to match.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValues((current) => (current.occasion ? current : { ...current, occasion: topic as ContactTopic }));
  }, []);

  const set = (key: keyof Values) => (value: string) => {
    setValues((current) => ({ ...current, [key]: key === "phone" ? formatUsPhone(value, current.phone) : value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const nextErrors = validate(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setBusy(true);
    setProblem("");
    try {
      await sendContactMessage({ ...values, occasion: values.occasion as ContactTopic, company });
      track("contact_submit", { occasion: values.occasion || undefined });
      setSent(true);
      setValues(EMPTY);
    } catch (error) {
      setProblem(
        error instanceof ApiError
          ? error.message
          : `We couldn’t send your message. Call or text us at ${site.phone.display}.`,
      );
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-4 py-6 motion-safe:animate-fade-in">
        <span className="flex size-12 items-center justify-center rounded-full bg-success/10 text-2xl text-success">
          <CheckIcon />
        </span>
        <p className="font-display text-xl font-bold text-ink">Thanks, we&apos;ll get back to you soon</p>
        <p className="text-sm leading-relaxed text-muted">
          We answer by email. In a hurry? Call or text{" "}
          <a href={site.phone.href} className="font-medium text-brand-deep hover:underline">
            {site.phone.display}
          </a>
          .
        </p>
        <Button variant="outline" size="sm" onClick={() => setSent(false)}>
          Send another message
        </Button>
      </div>
    );
  }

  const field = (key: keyof Values) => ({
    id: `${id}-${key}`,
    value: values[key],
    error: errors[key],
    onChange: set(key),
  });

  return (
    <form id="contact-form" onSubmit={submit} noValidate data-clarity-mask="true" aria-label="Send us a message" className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" autoComplete="given-name" {...field("firstName")} />
        <Field label="Last name" autoComplete="family-name" {...field("lastName")} />
        <Field label="Email" type="email" autoComplete="email" {...field("email")} />
        <Field label="Phone" type="tel" autoComplete="tel-national" placeholder="(631) 555-0142" {...field("phone")} />
        <Field label="Occasion" {...field("occasion")}>
          {(props) => (
            <div className="relative mt-1.5">
              <select {...props} className={`${props.className} h-12 appearance-none pr-11`}>
                <option value="" disabled>
                  Choose one
                </option>
                {contactTopics.map((topic) => (
                  <option key={topic.value} value={topic.value}>
                    {topic.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-muted" />
            </div>
          )}
        </Field>
        <Field label="Preferred dates" hint="optional" placeholder="e.g. Jul 3 – Jul 5" maxLength={120} {...field("preferredDates")} />
      </div>

      <Field label="Message" {...field("message")}>
        {(props) => (
          <>
            <textarea
              {...props}
              rows={5}
              maxLength={MESSAGE_MAX}
              placeholder="Where and when you need the car, delivery, anything we should know."
              className={`${props.className} mt-1.5 min-h-36 py-3`}
            />
            <p className="mt-1 text-right text-xs text-muted tabular-nums" aria-live="polite">
              {values.message.length}/{MESSAGE_MAX}
            </p>
          </>
        )}
      </Field>

      {/* Honeypot: off screen and out of the tab order, so only bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor={`${id}-company`}>Company</label>
        <input
          id={`${id}-company`}
          name="company"
          tabIndex={-1}
          autoComplete="off"
          value={company}
          onChange={(event) => setCompany(event.target.value)}
        />
      </div>

      {problem && (
        <p role="alert" className="rounded-btn-lg bg-danger/5 px-4 py-3 text-sm font-medium text-danger">
          {problem}
        </p>
      )}
      <Button type="submit" block loading={busy}>
        {busy ? "Sending…" : "Send message"}
        {!busy && <ArrowRightIcon className="text-base" />}
      </Button>
      <p className="text-center text-xs text-muted">We reply by email and use your details only to answer you.</p>
    </form>
  );
}

type ControlProps = {
  id: string;
  value: string;
  className: string;
  onChange: (event: { target: { value: string } }) => void;
  "aria-invalid"?: true;
  "aria-describedby"?: string;
};

function Field({
  id,
  label,
  hint,
  value,
  error,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
  maxLength,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
  type?: "text" | "email" | "tel";
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  /** A select or textarea in place of the text input. */
  children?: (props: ControlProps) => ReactNode;
}) {
  const props: ControlProps = {
    id,
    value,
    onChange: (event) => onChange(event.target.value),
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-error` : undefined,
    className: `block w-full rounded-btn-lg border bg-card px-4 text-base text-ink transition-colors placeholder:text-muted hover:border-brand-deep/50 ${
      error ? "border-danger" : "border-line-strong"
    }`,
  };
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {hint && <span className="font-normal text-muted"> ({hint})</span>}
      </label>
      {children ? (
        children(props)
      ) : (
        <input
          {...props}
          type={type}
          autoComplete={autoComplete}
          placeholder={placeholder}
          maxLength={maxLength}
          className={`${props.className} mt-1.5 h-12`}
        />
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-[0.8125rem] font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
