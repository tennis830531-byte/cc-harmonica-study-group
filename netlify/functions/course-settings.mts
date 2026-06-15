import { getDeployStore, getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";

export type LessonSetting = {
  id: string;
  date: string;
  location: string;
  videoUrl: string;
  calendarStart: string;
  calendarEnd: string;
};

export type CourseSettings = {
  heroDateLabel: string;
  lessons: LessonSetting[];
};

export const DEFAULT_SETTINGS: CourseSettings = {
  heroDateLabel: "第一堂共學團開課日期7/18（六）",
  lessons: [
    {
      id: "lesson-1",
      date: "7/18（六）14:00",
      location: "逢甲口琴社社辦(育樂館2F 213B)",
      videoUrl: "",
      calendarStart: "2026-07-18T14:00",
      calendarEnd: "2026-07-18T16:00",
    },
    { id: "lesson-2", date: "待確認！", location: "待確認！", videoUrl: "", calendarStart: "", calendarEnd: "" },
    { id: "lesson-3", date: "待確認！", location: "待確認！", videoUrl: "", calendarStart: "", calendarEnd: "" },
    { id: "lesson-4", date: "待確認！", location: "待確認！", videoUrl: "", calendarStart: "", calendarEnd: "" },
    { id: "lesson-5", date: "待確認！", location: "待確認！", videoUrl: "", calendarStart: "", calendarEnd: "" },
    { id: "lesson-6", date: "待確認！", location: "待確認！", videoUrl: "", calendarStart: "", calendarEnd: "" },
  ],
};

const STORE_NAME = "course-settings";
const SETTINGS_KEY = "settings.json";

declare const Netlify: {
  context?: {
    deploy?: {
      context?: string;
    };
  };
};

export function getSettingsStore() {
  if (Netlify.context?.deploy.context === "production") {
    return getStore(STORE_NAME, { consistency: "strong" });
  }

  return getDeployStore(STORE_NAME);
}

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
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

export function normalizeSettings(value: Partial<CourseSettings> | null | undefined): CourseSettings {
  const lessonsById = new Map(
    Array.isArray(value?.lessons)
      ? value.lessons.map((lesson) => [lesson.id, lesson])
      : [],
  );

  return {
    heroDateLabel: cleanText(value?.heroDateLabel, 80) || DEFAULT_SETTINGS.heroDateLabel,
    lessons: DEFAULT_SETTINGS.lessons.map((defaultLesson) => {
      const saved = lessonsById.get(defaultLesson.id);
      return {
        id: defaultLesson.id,
        date: cleanText(saved?.date, 40) || defaultLesson.date,
        location: cleanText(saved?.location, 80) || defaultLesson.location,
        videoUrl: cleanText(saved?.videoUrl, 300),
        calendarStart: cleanText(saved?.calendarStart, 32) || defaultLesson.calendarStart,
        calendarEnd: cleanText(saved?.calendarEnd, 32) || defaultLesson.calendarEnd,
      };
    }),
  };
}

export async function getCourseSettings() {
  const store = getSettingsStore();
  const settings = (await store.get(SETTINGS_KEY, { type: "json" })) as Partial<CourseSettings> | null;
  return normalizeSettings(settings);
}

export async function saveCourseSettings(settings: CourseSettings) {
  const store = getSettingsStore();
  await store.setJSON(SETTINGS_KEY, settings);
}

export default async (request: Request, _context: Context) => {
  if (request.method !== "GET") {
    return jsonResponse({ message: "不支援的操作。" }, { status: 405 });
  }

  return jsonResponse({ settings: await getCourseSettings() });
};

export const config: Config = {
  path: "/api/course-settings",
};
