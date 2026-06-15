import { getDeployStore, getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

type CommentRecord = {
  id: string;
  lesson: string;
  generation: string;
  name: string;
  message: string;
  createdAt: string;
};

const STORE_NAME = "course-comments";
const ADMIN_PASSWORD_HASH = "7924073a9d829ad930791e059dcfd17068daa83b811c708d627f0bfaacb7bdd3";
const LESSONS = [
  { id: "lesson-1", label: "第 1 堂 【奠定基石】基礎三要素" },
  { id: "lesson-2", label: "第 2 堂 【穿梭黑白鍵】按鍵與音階流暢度" },
  { id: "lesson-3", label: "第 3 堂 【節奏大師】複雜節奏技巧掌握" },
  { id: "lesson-4", label: "第 4 堂 【情感調色盤】圓滑奏與音量控制" },
  { id: "lesson-5", label: "第 5 堂 【風格解鎖】裝飾奏、振音與個人特色" },
  { id: "lesson-6", label: "第 6 堂 【合奏派對】音樂融合與默契培養" },
];
const LESSON_IDS = new Set(LESSONS.map((lesson) => lesson.id));

declare const Netlify: {
  context?: {
    deploy?: {
      context?: string;
    };
  };
};

function getCommentStore() {
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

function cleanText(value: unknown, limit: number) {
  return String(value ?? "").trim().slice(0, limit);
}

async function hashText(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function isAuthorized(request: Request) {
  const submittedPassword = request.headers.get("x-admin-password") ?? "";
  return Boolean(submittedPassword && (await hashText(submittedPassword)) === ADMIN_PASSWORD_HASH);
}

async function getComments(lesson: string) {
  const store = getCommentStore();
  const comments = (await store.get(`${lesson}.json`, { type: "json" })) as CommentRecord[] | null;
  return Array.isArray(comments) ? comments : [];
}

async function getAllComments() {
  const entries = await Promise.all(
    LESSONS.map(async (lesson) => ({
      ...lesson,
      comments: await getComments(lesson.id),
    })),
  );

  return entries;
}

export default async (request: Request, _context: Context) => {
  if (!(await isAuthorized(request))) {
    return jsonResponse({ message: "管理密碼不正確。" }, { status: 401 });
  }

  if (request.method === "GET") {
    return jsonResponse({ lessons: await getAllComments() });
  }

  if (request.method !== "DELETE") {
    return jsonResponse({ message: "不支援的操作。" }, { status: 405 });
  }

  const body = await request.json().catch(() => null);
  const lesson = cleanText(body?.lesson, 16);
  const id = cleanText(body?.id, 80);

  if (!LESSON_IDS.has(lesson) || !id) {
    return jsonResponse({ message: "找不到這則留言。" }, { status: 400 });
  }

  const comments = await getComments(lesson);
  const nextComments = comments.filter((comment) => comment.id !== id);

  if (nextComments.length === comments.length) {
    return jsonResponse({ message: "找不到這則留言。" }, { status: 404 });
  }

  const store = getCommentStore();
  await store.setJSON(`${lesson}.json`, nextComments);

  return jsonResponse({ lessons: await getAllComments() });
};

export const config: Config = {
  path: "/api/admin/comments",
};
