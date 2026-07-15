import Link from "next/link";
import { VeskifyPuckEditorProof } from "@/integrations/puck/veskify-puck-editor";

export default function PuckProofPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8 sm:px-10 lg:px-12">
      <Link className="text-sm font-semibold text-[var(--brand-color-primary)] underline" href="/">
        Back to foundation shell
      </Link>
      <VeskifyPuckEditorProof />
    </main>
  );
}
