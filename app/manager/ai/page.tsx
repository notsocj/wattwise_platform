import { redirect } from "next/navigation";

// The manager assistant is now the floating owl button on every manager page,
// and its priority cards are on the Fleet page.
export default function ManagerAiPage() {
  redirect("/manager");
}
