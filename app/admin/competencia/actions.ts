// [LA14 · COMPETENCIA · v2]
"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { txt } from "@/lib/forms";

export async function searchCompetencia(formData: FormData) {
  await requireAdmin();
  const query = txt(formData, "query", 120);
  if (!query) redirect("/admin/competencia?error=consulta");
  const safeQuery = query || "";
  redirect(`/admin/competencia?q=${encodeURIComponent(safeQuery)}`);
}
