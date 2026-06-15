const loginForm = document.querySelector("[data-admin-login]");
const statusEl = document.querySelector("[data-admin-status]");
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
  const response = await fetch("/api/admin/comments", {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "x-admin-password": adminPassword,
      ...(options.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.message ?? "管理操作失敗。");
  }

  return data;
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

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);
  adminPassword = String(formData.get("password") ?? "").trim();
  sessionStorage.setItem("ccAdminPassword", adminPassword);

  try {
    await loadAdminComments();
  } catch (error) {
    setStatus(error.message || "管理密碼不正確。", "error");
    sessionStorage.removeItem("ccAdminPassword");
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
  loadAdminComments().catch(() => {
    sessionStorage.removeItem("ccAdminPassword");
  });
}
