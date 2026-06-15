import type { Config, Context } from "@netlify/functions";
import {
  getCourseSettings,
  jsonResponse,
  normalizeSettings,
  saveCourseSettings,
} from "./course-settings.mts";

const ADMIN_PASSWORD_HASH = "7924073a9d829ad930791e059dcfd17068daa83b811c708d627f0bfaacb7bdd3";

async function hashText(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isAuthorized(request: Request) {
  const submittedPassword = request.headers.get("x-admin-password") ?? "";
  return Boolean(submittedPassword && (await hashText(submittedPassword)) === ADMIN_PASSWORD_HASH);
}

export default async (request: Request, _context: Context) => {
  if (!(await isAuthorized(request))) {
    return jsonResponse({ message: "管理密碼不正確。" }, { status: 401 });
  }

  if (request.method === "GET") {
    return jsonResponse({ settings: await getCourseSettings() });
  }

  if (request.method !== "POST") {
    return jsonResponse({ message: "不支援的操作。" }, { status: 405 });
  }

  const body = await request.json().catch(() => null);
  const settings = normalizeSettings(body?.settings);
  await saveCourseSettings(settings);

  return jsonResponse({ settings });
};

export const config: Config = {
  path: "/api/admin/course-settings",
};
