"use client";

import type { Dispatch } from "react";
import { ACTIVITY_LABELS, type PlanningSettings } from "@/lib/planning";
import type { DraftAction } from "./draft";

const field = "mt-2 w-full rounded-md border border-line bg-paper px-3 py-2.5 text-sm";

export function PlanningSettingsForm({
  settings,
  dispatch,
}: {
  settings: PlanningSettings;
  dispatch: Dispatch<DraftAction>;
}) {
  const update = (patch: Partial<PlanningSettings>) => dispatch({ type: "settings", patch });
  return (
    <section className="mt-10 border-t border-line pt-8" aria-label="Program preferences">
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-2xl">Make it work in real life.</h2>
        <p className="text-xs text-muted">Optional. Leave what you don’t know open.</p>
      </div>
      <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <label className="text-sm">
          What would you like to do?
          <select
            className={field}
            value={settings.activity}
            onChange={(e) => update({ activity: e.target.value as PlanningSettings["activity"] })}
          >
            {Object.entries(ACTIVITY_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Participant cost
          <select
            className={field}
            value={settings.budget}
            onChange={(e) => update({ budget: e.target.value as PlanningSettings["budget"] })}
          >
            <option value="unspecified">Not decided yet</option>
            <option value="free">Free to participants</option>
            <option value="paid">Some spending is possible</option>
          </select>
        </label>
        <label className="text-sm">
          Who is attending?
          <select
            className={field}
            value={settings.audience}
            onChange={(e) => update({ audience: e.target.value as PlanningSettings["audience"] })}
          >
            <option value="unspecified">Not specified</option>
            <option value="all_ages">Mixed ages, including under-18s</option>
            <option value="adults">Adults only</option>
          </select>
        </label>
        <label className="text-sm">
          Number of participants
          <input
            className={field}
            type="number"
            min={2}
            max={500}
            placeholder="e.g. 20"
            value={settings.groupSize ?? ""}
            onChange={(e) => update({ groupSize: e.target.value ? Number(e.target.value) : null })}
          />
        </label>
        <label className="text-sm">
          Where can it happen?
          <select
            className={field}
            value={settings.venue}
            onChange={(e) => update({ venue: e.target.value as PlanningSettings["venue"] })}
          >
            <option value="flexible">We’re flexible</option>
            <option value="existing">Use our existing venue</option>
            <option value="outing">We can go on outings</option>
          </select>
        </label>
        <label className="text-sm">
          How adventurous should the picks be?
          <select
            className={field}
            value={settings.novelty}
            onChange={(e) => update({ novelty: e.target.value as PlanningSettings["novelty"] })}
          >
            <option value="familiar">Familiar — shared favorites first</option>
            <option value="balanced">Balanced — fit with some discovery</option>
            <option value="exploratory">Exploratory — less mainstream</option>
          </select>
        </label>
        {settings.venue === "existing" && (
          <label className="text-sm sm:col-span-2">
            Your venue <span className="text-muted">(optional)</span>
            <input
              className={field}
              maxLength={160}
              value={settings.venueName}
              placeholder="e.g. Library community room"
              onChange={(e) => update({ venueName: e.target.value })}
            />
          </label>
        )}
        <label className="text-sm sm:col-span-2 lg:col-span-3">
          Access needs
          <input
            className={field}
            maxLength={300}
            value={settings.access}
            placeholder="e.g. step-free access, captions, no personal devices required"
            onChange={(e) => update({ access: e.target.value })}
          />
        </label>
      </div>
    </section>
  );
}
