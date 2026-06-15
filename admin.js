const loginForm = document.querySelector("[data-admin-login]");
const statusEl = document.querySelector("[data-admin-status]");
const settingsEl = document.querySelector("[data-admin-settings]");
const commentsEl = document.querySelector("[data-admin-comments]");
let adminPassword = sessionStorage.getItem("ccAdminPassword") ?? "";

function setStatus(message, tone = "neutral") {
  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function formatDateTime(value) {
  try {
    return new Intl.DateTimeFormat("zh-TW", {
      dateStyle: "medium",
      timeStyle: "short",
      hour12: false,
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatGeneration(value) {
  const text = String(value ?? "").trim();
  return text.endsWith("屆") ? text : `${text}屆`;
}

async function adminFetch(options = {}) {
  const { endpoint = "/api/admin/comments", ...fetchOptions } = options;
  const response = await fetch(endpoint, {
    ...fetchOptions,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword,
      ...(fetchOptions.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message ?? "管理操作失敗。");
  }

  return data;
}

async function adminSettingsFetch(options = {}) {
  return adminFetch({
    ...options,
    endpoint: "/api/admin/course-settings",
  });
}

function renderSettings(settings) {
  if (!settingsEl) return;

  const lessons = Array.isArray(settings?.lessons) ? settings.lessons : [];
  settingsEl.hidden = false;
  settingsEl.innerHTML = `
    <form class="admin-settings-form" data-admin-settings-form>
      <div class="admin-settings__header">
        <div>
          <p class="article-kicker">Course Settings</p>
          <h2>課程設定</h2>
        </div>
        <button type="submit">儲存課程設定</button>
      </div>
      <label class="admin-settings__wide">
        <span>首頁第一堂開課標籤</span>
        <input name="heroDateLabel" type="text" maxlength="80" value="${escapeHtml(settings?.heroDateLabel ?? "")}" />
      </label>
      <div class="admin-settings-lessons">
        ${lessons
          .map(
            (lesson, index) => `
              <section class="admin-setting-card" data-setting-lesson="${escapeHtml(lesson.id)}">
                <h3>第 ${index + 1} 堂</h3>
                <div class="admin-setting-grid">
                  <label>
                    <span>日期</span>
                    <input name="date" type="text" maxlength="40" value="${escapeHtml(lesson.date ?? "")}" />
                  </label>
                  <label>
                    <span>地點</span>
                    <input name="location" type="text" maxlength="80" value="${escapeHtml(lesson.location ?? "")}" />
                  </label>
                  <label>
                    <span>YouTube 影片連結</span>
                    <input name="videoUrl" type="url" maxlength="300" value="${escapeHtml(lesson.videoUrl ?? "")}" placeholder="https://www.youtube.com/watch?v=..." />
                  </label>
                  <label>
                    <span>行事曆開始時間</span>
                    <input name="calendarStart" type="datetime-local" value="${escapeHtml(lesson.calendarStart ?? "")}" />
                  </label>
                  <label>
                    <span>行事曆結束時間</span>
                    <input name="calendarEnd" type="datetime-local" value="${escapeHtml(lesson.calendarEnd ?? "")}" />
                  </label>
                </div>
              </section>
            `,
          )
          .join("")}
      </div>
    </form>
  `;
}

function renderLessons(lessons) {
  commentsEl.hidden = false;
  commentsEl.innerHTML = lessons
    .map((lesson) => {
      const comments = Array.isArray(lesson.comments) ? lesson.comments : [];
      const body = comments.length
        ? comments
            .map((comment, index) => {
              const replies = Array.isArray(comment.replies) ? comment.replies : [];
              const repliesHtml = replies.length
                ? `
                  <div class="admin-replies">
                    ${replies
                      .map(
                        (reply) => `
                          <article class="comment-reply">
                            <div class="comment-reply__meta">
                              <span>${escapeHtml(reply.author ?? "CC小精靈")}</span>
                              <time datetime="${escapeHtml(reply.createdAt)}">${escapeHtml(formatDateTime(reply.createdAt))}</time>
                            </div>
                            <p>${escapeHtml(reply.message)}</p>
                            <button
                              class="admin-reply-delete"
                              type="button"
                              data-delete-reply
                              data-lesson="${escapeHtml(lesson.id)}"
                              data-id="${escapeHtml(comment.id)}"
                              data-reply-id="${escapeHtml(reply.id)}"
                            >
                              刪除回覆
                            </button>
                          </article>
                        `,
                      )
                      .join("")}
                  </div>
                `
                : "";

              return `
                <article class="admin-comment">
                  <div class="admin-comment__meta">
                    <span>${index + 1}樓</span>
                    <span>${escapeHtml(formatGeneration(comment.generation))}</span>
                    <span>${escapeHtml(comment.name)}</span>
                    <time datetime="${escapeHtml(comment.createdAt)}">${escapeHtml(formatDateTime(comment.createdAt))}</time>
                  </div>
                  <p>${escapeHtml(comment.message)}</p>
                  ${repliesHtml}
                  <form class="admin-reply-form" data-reply-comment data-lesson="${escapeHtml(lesson.id)}" data-id="${escapeHtml(comment.id)}">
                    <label>
                      <span>CC小精靈回覆</span>
                      <textarea name="message" rows="2" maxlength="500" required></textarea>
                    </label>
                    <button type="submit">送出回覆</button>
                  </form>
                  <button class="admin-delete-button" type="button" data-delete-comment data-lesson="${escapeHtml(lesson.id)}" data-id="${escapeHtml(comment.id)}">
                    刪除留言
                  </button>
                </article>
              `;
            })
            .join("")
        : '<p class="comments-empty">目前沒有留言。</p>';

      return `
        <section class="admin-lesson">
          <h2>${escapeHtml(lesson.label)}</h2>
          ${body}
        </section>
      `;
    })
    .join("");
}

async function loadAdminComments() {
  setStatus("留言讀取中...");
  const data = await adminFetch();
  renderLessons(Array.isArray(data.lessons) ? data.lessons : []);
  setStatus("已載入留言。", "success");
}

async function loadAdminSettings() {
  const data = await adminSettingsFetch();
  renderSettings(data.settings);
}

async function loadAdmin() {
  setStatus("後台資料讀取中...");
  const [settingsData, commentsData] = await Promise.all([
    adminSettingsFetch(),
    adminFetch(),
  ]);
  renderSettings(settingsData.settings);
  renderLessons(Array.isArray(commentsData.lessons) ? commentsData.lessons : []);
  setStatus("已載入後台資料。", "success");
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  adminPassword = String(formData.get("password") ?? "").trim();
  sessionStorage.setItem("ccAdminPassword", adminPassword);

  try {
    await loadAdmin();
  } catch (error) {
    setStatus(error.message || "管理密碼不正確。", "error");
    sessionStorage.removeItem("ccAdminPassword");
  }
});

settingsEl?.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-admin-settings-form]");
  if (!form) return;
  event.preventDefault();

  const lessons = Array.from(form.querySelectorAll("[data-setting-lesson]")).map((section) => ({
    id: section.dataset.settingLesson ?? "",
    date: section.querySelector('[name="date"]')?.value.trim() ?? "",
    location: section.querySelector('[name="location"]')?.value.trim() ?? "",
    videoUrl: section.querySelector('[name="videoUrl"]')?.value.trim() ?? "",
    calendarStart: section.querySelector('[name="calendarStart"]')?.value.trim() ?? "",
    calendarEnd: section.querySelector('[name="calendarEnd"]')?.value.trim() ?? "",
  }));

  const settings = {
    heroDateLabel: form.elements.heroDateLabel.value.trim(),
    lessons,
  };

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  setStatus("正在儲存課程設定...");

  try {
    const data = await adminSettingsFetch({
      method: "POST",
      body: JSON.stringify({ settings }),
    });
    renderSettings(data.settings);
    setStatus("課程設定已儲存。", "success");
  } catch (error) {
    button.disabled = false;
    setStatus(error.message || "課程設定儲存失敗。", "error");
  }
});

commentsEl?.addEventListener("click", async (event) => {
  const replyButton = event.target.closest("[data-delete-reply]");
  const commentButton = event.target.closest("[data-delete-comment]");
  const button = replyButton || commentButton;
  if (!button) return;

  const lesson = button.dataset.lesson ?? "";
  const id = button.dataset.id ?? "";
  const replyId = button.dataset.replyId ?? "";
  const isReply = Boolean(replyButton);
  const confirmed = window.confirm(isReply ? "確定要刪除這則回覆嗎？" : "確定要刪除這則留言嗎？");
  if (!confirmed) return;

  button.disabled = true;
  setStatus(isReply ? "正在刪除回覆..." : "正在刪除留言...");

  try {
    const data = await adminFetch({
      method: "DELETE",
      body: JSON.stringify({
        lesson,
        id,
        kind: isReply ? "reply" : "comment",
        replyId,
      }),
    });
    renderLessons(Array.isArray(data.lessons) ? data.lessons : []);
    setStatus(isReply ? "回覆已刪除。" : "留言已刪除。", "success");
  } catch (error) {
    button.disabled = false;
    setStatus(error.message || "刪除失敗，請稍後再試。", "error");
  }
});

commentsEl?.addEventListener("submit", async (event) => {
  const form = event.target.closest("[data-reply-comment]");
  if (!form) return;
  event.preventDefault();

  const formData = new FormData(form);
  const lesson = form.dataset.lesson ?? "";
  const id = form.dataset.id ?? "";
  const message = String(formData.get("message") ?? "").trim();

  if (!message) {
    setStatus("請輸入回覆內容。", "error");
    return;
  }

  const button = form.querySelector("button");
  button.disabled = true;
  setStatus("正在送出回覆...");

  try {
    const data = await adminFetch({
      method: "POST",
      body: JSON.stringify({ lesson, id, message }),
    });
    renderLessons(Array.isArray(data.lessons) ? data.lessons : []);
    setStatus("回覆已送出。", "success");
  } catch (error) {
    button.disabled = false;
    setStatus(error.message || "回覆失敗，請稍後再試。", "error");
  }
});

if (adminPassword) {
  loadAdmin().catch(() => {
    sessionStorage.removeItem("ccAdminPassword");
  });
}
