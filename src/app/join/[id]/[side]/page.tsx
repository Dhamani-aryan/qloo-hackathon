import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JoinForm } from "@/components/join-form";
import { TopBar } from "@/components/shell";
import { getIntakeStore } from "@/lib/intake/server";

export const metadata: Metadata = {
  title: "Share your favourites · COMMON GROUND",
  robots: { index: false },
};

export default async function JoinPage({ params }: PageProps<"/join/[id]/[side]">) {
  const { id, side } = await params;
  if (side !== "a" && side !== "b") notFound();
  const session = await getIntakeStore()
    .getSession(id)
    .catch(() => null);
  if (!session) notFound();

  return (
    <>
      <TopBar />
      <main className="mx-auto w-full max-w-lg flex-1 px-4 pt-10 pb-16">
        <JoinForm id={id} side={side} label={session.labels[side]} title={session.title} />
      </main>
    </>
  );
}
