import { getDeployStore, getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

type VisitRecord = {
  id: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

const STORE_NAME = "site-visits";
const VISITS_KEY = "visitors.json";

declare const Netlify: {
  context?: {
    deploy?: {
      context?: string;
    };
  };
};

function getVisitStore() {
  if (Netlify.context?.deploy.context === "production") {
    return getStore(STORE_NAME, { consistency: "strong" });
  }

  return getDeployStore(STORE_NAME);
}

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(init.headers ?? {}),
    },
  });
}

function cleanVisitorId(value: unknown) {
  return String(value ?? "")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 80);
}

async function getVisits() {
  const store = getVisitStore();
  const records = (await store.get(VISITS_KEY, { type: "json" })) as VisitRecord[] | null;
  return Array.isArray(records) ? records : [];
}

export default async (request: Request, _context: Context) => {
  if (request.method !== "POST") {
    return jsonResponse({ message: "不支援的操作。" }, { status: 405 });
  }

  const body = await request.json().catch(() => null);
  const visitorId = cleanVisitorId(body?.id);

  if (!visitorId) {
    return jsonResponse({ message: "缺少訪客識別碼。" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const visits = await getVisits();
  const existingIndex = visits.findIndex((visit) => visit.id === visitorId);

  if (existingIndex >= 0) {
    visits[existingIndex] = {
      ...visits[existingIndex],
      lastSeenAt: now,
    };
  } else {
    visits.push({
      id: visitorId,
      firstSeenAt: now,
      lastSeenAt: now,
    });
  }

  const store = getVisitStore();
  await store.setJSON(VISITS_KEY, visits);

  return jsonResponse({ count: visits.length });
};

export const config: Config = {
  path: "/api/visits",
};
