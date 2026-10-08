import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Small, dependency-free UI primitives built on the design tokens in globals.css. */

export type Tone = "a" | "b" | "bridge" | "neutral" | "warn" | "ok";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

const TONE_TEXT: Record<Tone, string> = {
  a: "text-a",
  b: "text-b",
  bridge: "text-bridge",
  neutral: "text-muted",
  warn: "text-warn",
  ok: "text-ok",
};
const TONE_BG: Record<Tone, string> = {
  a: "bg-a-soft text-a",
  b: "bg-b-soft text-b",
  bridge: "bg-bridge-soft text-bridge",
  neutral: "bg-surface-2 text-muted",
  warn: "bg-warn-soft text-warn",
  ok: "bg-surface-2 text-ok",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-ink text-paper hover:opacity-90",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-surface-2",
        variant === "ghost" && "text-muted hover:bg-surface-2 hover:text-ink",
        className,
      )}
    />
  );
}

export function Card({
  children,
  className,
  tone,
}: {
  children: ReactNode;
  className?: string;
  tone?: "a" | "b" | "bridge";
}) {
  return (
    <div
      className={cx(
        "rounded-2xl border border-line bg-surface p-5",
        tone === "a" && "border-t-4 border-t-a",
        tone === "b" && "border-t-4 border-t-b",
        tone === "bridge" && "border-t-4 border-t-bridge",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_BG[tone],
      )}
    >
      {children}
    </span>
  );
}

export function Eyebrow({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <p className={cx("text-xs font-semibold tracking-[0.14em] uppercase", TONE_TEXT[tone])}>
      {children}
    </p>
  );
}

export function Heading({ children, level = 2 }: { children: ReactNode; level?: 1 | 2 | 3 }) {
  const cls = {
    1: "font-display text-4xl leading-tight sm:text-5xl",
    2: "font-display text-2xl leading-snug sm:text-3xl",
    3: "font-display text-lg leading-snug",
  }[level];
  const Tag = `h${level}` as const;
  return <Tag className={cx(cls, "tracking-tight text-ink")}>{children}</Tag>;
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
      <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-line border-t-bridge" />
      {label}
    </span>
  );
}

/** Two horizontal bars showing a candidate's percentile support in A and in B. */
export function SupportBars({
  a,
  b,
  labels = ["A", "B"],
}: {
  a: number | null;
  b: number | null;
  labels?: [string, string];
}) {
  const row = (v: number | null, tone: "a" | "b", label: string) => (
    <div className="flex items-center gap-2 text-xs">
      <span className={cx("w-16 shrink-0 truncate font-medium", TONE_TEXT[tone])} title={label}>
        {label}
      </span>
      <span className="relative h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span
          className={cx("absolute inset-y-0 left-0 rounded-full", tone === "a" ? "bg-a" : "bg-b")}
          style={{ width: `${v === null ? 0 : Math.round(v * 100)}%` }}
        />
      </span>
      <span className="w-10 shrink-0 text-right tabular-nums text-muted">
        {v === null ? "—" : ordinal(v)}
      </span>
    </div>
  );
  return (
    <div className="space-y-1.5" aria-label="Support from each community">
      {row(a, "a", labels[0])}
      {row(b, "b", labels[1])}
    </div>
  );
}

export function ordinal(v: number): string {
  const n = Math.round(v * 100);
  const m = n % 100;
  const suffix = m >= 11 && m <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${n}${suffix}`;
}

/** Image + name + type for a Qloo entity. Falls back to an initial when there's no image. */
export function EntityTile({
  name,
  type,
  imageUrl,
  size = "md",
  tone = "neutral",
}: {
  name: string;
  type?: string | null;
  imageUrl?: string | null;
  size?: "sm" | "md" | "lg";
  tone?: Tone;
}) {
  const box = { sm: "h-9 w-9", md: "h-12 w-12", lg: "h-16 w-16" }[size];
  return (
    <div className="flex min-w-0 items-center gap-3">
      {imageUrl ? (
        // Qloo image hosts vary, so a plain img avoids next/image domain config.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className={cx(box, "shrink-0 rounded-lg border border-line object-cover")}
        />
      ) : (
        <span
          className={cx(
            box,
            "flex shrink-0 items-center justify-center rounded-lg font-display text-lg",
            TONE_BG[tone],
          )}
          aria-hidden
        >
          {name.slice(0, 1)}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-medium text-ink">{name}</p>
        {type && <p className="truncate text-xs text-muted">{typeLabel(type)}</p>}
      </div>
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  tvShow: "TV show",
  tv_show: "TV show",
  artist: "Artist",
  book: "Book",
  podcast: "Podcast",
  place: "Place",
  movie: "Film",
  videogame: "Video game",
  videoGame: "Video game",
  destination: "Destination",
  brand: "Brand",
  person: "Person",
};

export function typeLabel(type: string): string {
  const key = type.split(":").pop() ?? type;
  return TYPE_LABELS[key] ?? key;
}

/** A clickable evidence reference (ev_0012). */
export function EvidenceChip({ id, onClick }: { id: string; onClick?: (id: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(id)}
      className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted hover:border-bridge hover:text-bridge"
      title="Show the Qloo evidence"
    >
      {id}
    </button>
  );
}

export function Notice({ tone = "warn", children }: { tone?: Tone; children: ReactNode }) {
  return <div className={cx("rounded-xl px-4 py-3 text-sm", TONE_BG[tone])}>{children}</div>;
}
