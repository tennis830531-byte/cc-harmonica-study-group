import type { Config, Context } from "@netlify/functions";
import { getCourseSettings } from "./course-settings.mts";

const LESSON_TITLES = new Map([
  ["lesson-1", "C.C.樂團半音階口琴共學團 第1堂【奠定基石】基礎三要素"],
  ["lesson-2", "C.C.樂團半音階口琴共學團 第2堂【穿梭黑白鍵】按鍵與音階流暢度"],
  ["lesson-3", "C.C.樂團半音階口琴共學團 第3堂【節奏大師】複雜節奏技巧掌握"],
  ["lesson-4", "C.C.樂團半音階口琴共學團 第4堂【情感調色盤】圓滑奏與音量控制"],
  ["lesson-5", "C.C.樂團半音階口琴共學團 第5堂【風格解鎖】裝飾奏、振音與個人特色"],
  ["lesson-6", "C.C.樂團半音階口琴共學團 第6堂【合奏派對】音樂融合與默契培養"],
]);

function escapeIcs(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;")
    .replaceAll("\n", "\\n");
}

function toUtcIcsDate(value: string) {
  const trimmed = value.trim();
  const taipeiDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(trimmed)
    ? `${trimmed}:00+08:00`
    : trimmed;
  const date = new Date(taipeiDateTime);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export default async (request: Request, _context: Context) => {
  const url = new URL(request.url);
  const lessonId = url.searchParams.get("lesson") ?? "lesson-1";
  const settings = await getCourseSettings();
  const lesson = settings.lessons.find((item) => item.id === lessonId);

  if (!lesson) {
    return new Response("找不到這堂課。", { status: 404 });
  }

  const start = toUtcIcsDate(lesson.calendarStart);
  const end = toUtcIcsDate(lesson.calendarEnd);

  if (!start || !end) {
    return new Response("這堂課尚未設定可加入行事曆的時間。", { status: 400 });
  }

  const title = LESSON_TITLES.get(lesson.id) ?? "C.C.樂團半音階口琴共學團";
  const now = toUtcIcsDate(new Date().toISOString());
  const content = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//C.C. Harmonica Band//Study Group//ZH-TW",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:cc-harmonica-study-group-${lesson.id}@cc-harmonica-study-group.netlify.app`,
    `DTSTAMP:${now}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(title)}`,
    `LOCATION:${escapeIcs(lesson.location)}`,
    `DESCRIPTION:${escapeIcs(lesson.date)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  return new Response(content, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="cc-harmonica-${lesson.id}.ics"`,
    },
  });
};

export const config: Config = {
  path: "/api/calendar",
};
