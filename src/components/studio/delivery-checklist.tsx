"use client";

import type { EvidenceBrief } from "@/lib/agent/brief";
import type { Program } from "@/lib/agent/program";
import { deliveryChecks } from "@/lib/agent/readiness";
import { Kicker, Title, cx } from "../ui";

export function DeliveryChecklist({
  program,
  brief,
  confirmed,
  onConfirmedChange,
}: {
  program: Program;
  brief: EvidenceBrief | null;
  confirmed: string[];
  onConfirmedChange: (ids: string[]) => void;
}) {
  const checks = deliveryChecks(program, brief);
  const pending = checks.filter(
    (c) => c.status !== "satisfied" && !confirmed.includes(c.id),
  ).length;
  return (
    <section aria-label="Before you invite people">
      <Kicker>Before you invite people</Kicker>
      <Title level={2} className="mt-3">
        A good draft. A few things to confirm.
      </Title>
      <p className="mt-4 max-w-2xl text-ink-2">
        {pending ? `${pending} checks remain.` : "You’ve marked the delivery checks as confirmed."}{" "}
        Qloo supports the cultural choices; bookings, costs and access need your confirmation.
        Checkmarks stay for this program until you refresh or replace it.
      </p>
      <ul className="mt-8 divide-y divide-line border-y border-line">
        {checks.map((check) => (
          <li key={check.id} className="grid gap-3 py-5 sm:grid-cols-[14rem_1fr]">
            <div>
              <p className="font-medium">{check.label}</p>
              <p
                className={cx(
                  "mt-1 text-xs",
                  check.status === "satisfied" || confirmed.includes(check.id)
                    ? "text-ok"
                    : "text-warn",
                )}
              >
                {confirmed.includes(check.id)
                  ? "Confirmed by you"
                  : check.status === "satisfied"
                    ? "References checked"
                    : check.status === "conflict"
                      ? "Review needed"
                      : "Needs confirmation"}
              </p>
            </div>
            <div className="text-sm leading-relaxed text-ink-2">
              <p>{check.detail}</p>
              {check.status === "confirm" && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-ink">
                  <input
                    type="checkbox"
                    checked={confirmed.includes(check.id)}
                    onChange={(e) =>
                      onConfirmedChange(
                        e.target.checked
                          ? [...confirmed, check.id]
                          : confirmed.filter((id) => id !== check.id),
                      )
                    }
                  />
                  I’ve confirmed this with the people involved
                </label>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
