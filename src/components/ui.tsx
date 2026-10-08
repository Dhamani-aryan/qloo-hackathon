import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Editorial primitives. Containers are rare: hierarchy comes from type, rules and space.
 * Colour is used only to mark data (community A, community B, the bridge).
 */

export type Side = "a" | "b";
export type Tone = "a" | "b" | "bridge" | "muted" | "warn" | "ok";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

const TEXT: Record<Tone, string> = {
  a: "text-a",
  b: "text-b",
  bridge: "text-bridge",
  muted: "text-muted",
  warn: "text-warn",
  ok: "text-ok",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "quiet" | "link" }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
        variant === "primary" && "rounded-md bg-ink px-5 py-2.5 text-paper hover:bg-ink-2",
        variant === "quiet" &&
          "rounded-md border border-line px-3.5 py-2 text-ink hover:border-ink",
        variant === "link" &&
          "text-ink underline decoration-line underline-offset-4 hover:decoration-ink",
        className,
      )}
    />
  );
}

/** Small uppercase label above a section or value. */
export function Kicker({ children, tone = "muted" }: { children: ReactNode; tone?: Tone }) {
  return (
    <p className={cx("text-[11px] font-semibold tracking-[0.16em] uppercase", TEXT[tone])}>
      {children}
    </p>
  );
}

export function Title({
  children,
  level = 1,
  className,
}: {
  children: ReactNode;
  level?: 1 | 2 | 3;
  className?: string;
}) {
  const Tag = `h${level}` as const;
  const size = {
    1: "text-[2.6rem] leading-[1.05] sm:text-6xl",
    2: "text-3xl leading-tight sm:text-4xl",
    3: "text-xl leading-snug",
  }[level];
  return <Tag className={cx("font-display text-ink", size, className)}>{children}</Tag>;
}

export function Lede({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cx("max-w-2xl text-lg leading-relaxed text-ink-2", className)}>{children}</p>
  );
}

export function Rule({ className }: { className?: string }) {
  return <hr className={cx("border-0 border-t border-line", className)} />;
}

export function Dot({ tone, className }: { tone: Tone; className?: string }) {
  const bg = {
    a: "bg-a",
    b: "bg-b",
    bridge: "bg-bridge",
    muted: "bg-muted",
    warn: "bg-warn",
    ok: "bg-ok",
  }[tone];
  return (
    <span aria-hidden className={cx("inline-block h-2 w-2 shrink-0 rounded-full", bg, className)} />
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-muted" role="status">
      <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-bridge" />
      {label}
    </span>
  );
}

/** A quiet inline callout with a coloured rule on the left. */
export function Note({ tone = "muted", children }: { tone?: Tone; children: ReactNode }) {
  const border = {
    a: "border-a",
    b: "border-b",
    bridge: "border-bridge",
    muted: "border-line",
    warn: "border-warn",
    ok: "border-ok",
  }[tone];
  return (
    <div className={cx("border-l-2 py-1 pl-4 text-sm leading-relaxed text-ink-2", border)}>
      {children}
    </div>
  );
}

/** Percentile (0–1) as "85th". */
export function ordinal(v: number): string {
  const n = Math.round(v * 100);
  const m = n % 100;
  const suffix = m >= 11 && m <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th");
  return `${n}${suffix}`;
}

export const pct = (v: number | null) => (v === null ? "—" : ordinal(v));

/** First word of a community label ("University film & music club" → "University"). */
export function shortLabel(label: string): string {
  return label.trim().split(/\s+/)[0] ?? label;
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

/** Square thumbnail for an entity; falls back to its initial. */
export function Thumb({
  src,
  name,
  size = 40,
  tone,
}: {
  src?: string | null;
  name: string;
  size?: number;
  tone?: Tone;
}) {
  const style = { width: size, height: size };
  if (src) {
    // Qloo image hosts vary, so a plain img avoids next/image domain configuration.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        style={style}
        className="shrink-0 rounded-[3px] bg-paper-2 object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cx(
        "flex shrink-0 items-center justify-center rounded-[3px] bg-paper-2 font-display",
        tone ? TEXT[tone] : "text-muted",
      )}
    >
      {name.slice(0, 1)}
    </span>
  );
}

/**
 * Two thin horizontal bars: how strongly community A and community B support a candidate,
 * as a percentile within the candidate pool. Optional third bar for general popularity.
 */
export function SupportBars({
  a,
  b,
  popularity,
  labels,
  className,
}: {
  a: number | null;
  b: number | null;
  popularity?: number | null;
  labels: [string, string];
  className?: string;
}) {
  const row = (v: number | null, color: string, label: string, title: string) => (
    <div className="grid grid-cols-[6.5rem_1fr_2.75rem] items-center gap-3 text-xs" title={title}>
      <span className="truncate text-muted">{label}</span>
      <span className="relative h-[3px] bg-line">
        <span
          className={cx("absolute inset-y-0 left-0", color)}
          style={{ width: `${v === null ? 0 : Math.round(v * 100)}%` }}
        />
      </span>
      <span className="figures text-right text-ink-2">{pct(v)}</span>
    </div>
  );
  return (
    <div className={cx("space-y-2", className)}>
      {row(a, "bg-a", shortLabel(labels[0]), labels[0])}
      {row(b, "bg-b", shortLabel(labels[1]), labels[1])}
      {popularity !== undefined &&
        row(popularity, "bg-muted", "Mainstream", "Percentile of general popularity")}
    </div>
  );
}
