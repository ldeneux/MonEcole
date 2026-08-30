"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

export async function changerAnnee(formData: FormData) {
  const annee_id = formData.get("annee_id") as string;
  cookies().set("annee_id", annee_id, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  const referer = headers().get("referer") || "/dashboard";
  redirect(referer);
}
