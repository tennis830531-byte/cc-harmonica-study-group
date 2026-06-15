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

const LESSON_IDS = new Set(["lesson-1", "lesson-2", "lesson-3", "lesson-4", "lesson-5", "lesson-6"]);
const STORE_NAME = "course-comments";
const CAPTCHA_STORE_NAME = "comment-captchas";
const CAPTCHA_MAX_AGE_MS = 10 * 60 * 1000;

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

function getCaptchaStore() {
  if (Netlify.context?.deploy.context === "production") {
    return getStore(CAPTCHA_STORE_NAME, { consistency: "strong" });
  }

  return getDeployStore(CAPTCHA_STORE_NAME);
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
  return String(value ?? "")
    .replace(/[<>]/g, "")
    .replace(/\s+\n/g, "\n")
    .trim()
    .slice(0, limit);
}

async function getComments(lesson: string) {
  const store = getCommentStore();
  const comments = (await store.get(`${lesson}.json`, { type: "json" })) as CommentRecord[] | null;
  return Array.isArray(comments) ? comments : [];
}

async function verifyCaptcha(token: string, answer: string) {
  if (!token || !answer) return false;

  const store = getCaptchaStore();
  const challenge = (await store.get(token, { type: "json" })) as
    | { code?: string; createdAt?: number }
    | null;

  if (!challenge?.code || !challenge?.createdAt) return false;

  const expired = Date.now() - challenge.createdAt > CAPTCHA_MAX_AGE_MS;
  if (expired) {
    await store.delete(token);
    return false;
  }

  const isMatch = challenge.code.toUpperCase() === answer.toUpperCase();
  if (isMatch) {
    await store.delete(token);
  }

  return isMatch;
}

export default async (request: Request, _context: Context) => {
  const url = new URL(request.url);
  const lesson = url.searchParams.get("lesson") ?? "";

  if (request.method === "GET") {
    if (!LESSON_IDS.has(lesson)) {
      return jsonResponse({ message: "找不到這堂課。" }, { status: 400 });
    }

    const comments = await getComments(lesson);
    return jsonResponse({ comments });
  }

  if (request.method !== "POST") {
    return jsonResponse({ message: "不支援的操作。" }, { status: 405 });
  }

  const body = await request.json().catch(() => null);
  const bodyLesson = cleanText(body?.lesson, 16);
  const generation = cleanText(body?.generation, 16);
  const name = cleanText(body?.name, 24);
  const message = cleanText(body?.message, 500);
  const captcha = cleanText(body?.captcha, 4);
  const captchaToken = cleanText(body?.captchaToken, 80);
  const website = cleanText(body?.website, 200);

  if (website) {
    return jsonResponse({ message: "留言已收到。" });
  }

  if (!LESSON_IDS.has(bodyLesson)) {
    return jsonResponse({ message: "找不到這堂課。" }, { status: 400 });
  }

  if (!generation || !name || !message) {
    return jsonResponse({ message: "請填寫屆數、名字與留言。" }, { status: 400 });
  }

  if (!(await verifyCaptcha(captchaToken, captcha))) {
    return jsonResponse({ message: "驗證碼不正確。" }, { status: 400 });
  }

  const comments = await getComments(bodyLesson);
  const nextComment: CommentRecord = {
    id: crypto.randomUUID(),
    lesson: bodyLesson,
    generation,
    name,
    message,
    createdAt: new Date().toISOString(),
  };
  const nextComments = [...comments, nextComment].slice(-80);

  const store = getCommentStore();
  await store.setJSON(`${bodyLesson}.json`, nextComments);

  return jsonResponse({ comments: nextComments }, { status: 201 });
};

export const config: Config = {
  path: "/api/comments",
};
