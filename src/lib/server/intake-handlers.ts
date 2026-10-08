import { z } from "zod";
import { PickSchema, SIDE_KEYS, type IntakeStore } from "@/lib/intake/store";
import { errorResponse, jsonError } from "./errors";

/** Intake handlers (testable with the in-memory store). */

const CreateSchema = z.object({
  title: z.string().trim().min(1).max(120),
  labels: z.object({ a: z.string().trim().min(1).max(80), b: z.string().trim().min(1).max(80) }),
});

const SubmitSchema = z.object({ picks: z.array(PickSchema).min(1).max(3) });

const SideSchema = z.enum(SIDE_KEYS);
const IdSchema = z.string().regex(/^[a-z0-9]{8,32}$/);

export function newSessionId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(9));
  return [...bytes]
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 14);
}

export async function handleCreateIntake(
  req: Request,
  store: () => IntakeStore,
): Promise<Response> {
  try {
    const body = CreateSchema.parse(await req.json());
    const id = newSessionId();
    const s = store();
    await s.createSession({ id, title: body.title, labels: body.labels, createdAt: Date.now() });
    return Response.json({
      id,
      storage: s.kind,
      links: { a: `/join/${id}/a`, b: `/join/${id}/b` },
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function handleGetIntake(id: string, store: () => IntakeStore): Promise<Response> {
  try {
    if (!IdSchema.safeParse(id).success) return jsonError(404, "not_found");
    const s = store();
    const session = await s.getSession(id);
    if (!session) return jsonError(404, "not_found");
    const [a, b] = await Promise.all([s.summary(id, "a"), s.summary(id, "b")]);
    return Response.json({ session, sides: { a, b } });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function handleSubmitIntake(
  req: Request,
  id: string,
  side: string,
  store: () => IntakeStore,
): Promise<Response> {
  try {
    const parsedSide = SideSchema.safeParse(side);
    if (!IdSchema.safeParse(id).success || !parsedSide.success) return jsonError(404, "not_found");
    const s = store();
    if (!(await s.getSession(id))) return jsonError(404, "not_found");
    const body = SubmitSchema.parse(await req.json());
    await s.addPicks(id, parsedSide.data, body.picks);
    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
