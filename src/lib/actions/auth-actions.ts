"use server";

import { redirect } from "next/navigation";
import { login as loginUser, logout as logoutUser } from "@/lib/auth";

export async function loginAction(
  _prevState: { error?: string } | undefined,
  formData: FormData
) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const remember = formData.get("remember") === "on";
  const next = String(formData.get("next") ?? "/");

  if (!username || !password) {
    return { error: "Please enter your User ID and password." };
  }

  const result = await loginUser(username, password, remember);
  if ("error" in result) {
    return { error: result.error };
  }

  redirect(result.mustChangePassword ? "/change-password" : next.startsWith("/") ? next : "/");
}

export async function logoutAction() {
  await logoutUser();
  redirect("/login");
}
