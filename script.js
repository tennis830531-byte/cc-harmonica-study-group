const announcementModal = document.querySelector("[data-modal]");
const courseModal = document.querySelector("[data-course-modal]");
const courseModalTitle = document.querySelector("#course-modal-title");
const commentForm = document.querySelector("[data-comment-form]");
const commentStatus = document.querySelector("[data-comment-status]");
const commentsList = document.querySelector("[data-comments-list]");
const captchaCode = document.querySelector("[data-captcha-code]");
const captchaToken = document.querySelector("[data-captcha-token]");
const captchaRefresh = document.querySelector("[data-captcha-refresh]");
const calendarButtons = document.querySelectorAll(".calendar-button");
const openButton = document.querySelector("[data-modal-open]");
const closeButtons = document.querySelectorAll("[data-modal-close]");
const courseCards = document.querySelectorAll("[data-course-open]");
let activeLesson = "lesson-1";

function setCommentStatus(message, tone = "neutral") {
  if (!commentStatus) return;
  commentStatus.textContent = message;
  commentStatus.dataset.tone = tone;
}

function openModal(modal) {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeAllModals() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.hidden = true;
  });
  document.body.style.overflow = "";
}

openButton?.addEventListener("click", () => openModal(announcementModal));

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

function renderComments(comments) {
  if (!commentsList) return;

  if (!comments.length) {
    commentsList.innerHTML = '<p class="comments-empty">目前還沒有留言。</p>';
    return;
  }

  commentsList.innerHTML = comments
    .map((comment, index) => {
      const replies = Array.isArray(comment.replies) ? comment.replies : [];
      const repliesHtml = replies.length
        ? `
          <div class="comment-replies">
            ${replies
              .map(
                (reply) => `
                  <article class="comment-reply">
                    <div class="comment-reply__meta">
                      <span>${escapeHtml(reply.author ?? "CC小精靈")}</span>
                      <time datetime="${escapeHtml(reply.createdAt)}">${escapeHtml(formatDateTime(reply.createdAt))}</time>
                    </div>
                    <p>${escapeHtml(reply.message)}</p>
                  </article>
                `,
              )
              .join("")}
          </div>
        `
        : "";

      return `
        <article class="comment-item">
          <div class="comment-item__meta">
            <span>${index + 1}樓</span>
            <span>${escapeHtml(formatGeneration(comment.generation))}</span>
            <span>${escapeHtml(comment.name)}</span>
            <time datetime="${escapeHtml(comment.createdAt)}">${escapeHtml(formatDateTime(comment.createdAt))}</time>
          </div>
          <p>${escapeHtml(comment.message)}</p>
          ${repliesHtml}
        </article>
      `;
    })
    .join("");
}

async function loadComments(lesson) {
  if (!commentsList) return;
  commentsList.innerHTML = '<p class="comments-empty">留言載入中...</p>';
  setCommentStatus("");

  try {
    const response = await fetch(`/api/comments?lesson=${encodeURIComponent(lesson)}`);
    if (!response.ok) throw new Error("comments unavailable");
    const data = await response.json();
    renderComments(Array.isArray(data.comments) ? data.comments : []);
  } catch {
    commentsList.innerHTML =
      '<p class="comments-empty">留言板會在 Netlify 網址上啟用。</p>';
  }
}

async function loadCaptcha() {
  if (!captchaCode || !captchaToken) return;
  captchaCode.textContent = "載入中";
  captchaToken.value = "";

  try {
    const response = await fetch("/api/captcha");
    if (!response.ok) throw new Error("captcha unavailable");
    const data = await response.json();
    captchaCode.textContent = data.code ?? "----";
    captchaToken.value = data.token ?? "";
  } catch {
    captchaCode.textContent = "----";
  }
}

courseCards.forEach((card) => {
  card.addEventListener("click", (event) => {
    event.preventDefault();
    const number = card.querySelector(".course__number")?.textContent.trim() ?? "";
    const title = card.querySelector(".course__title")?.textContent.trim() ?? "";
    activeLesson = card.id;
    courseModalTitle.textContent = `${number} ${title}`;
    commentForm?.reset();
    openModal(courseModal);
    loadComments(activeLesson);
    loadCaptcha();
  });

  card.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    card.click();
  });
});

calendarButtons.forEach((button) => {
  button.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  button.addEventListener("keydown", (event) => {
    event.stopPropagation();
  });
});

captchaRefresh?.addEventListener("click", () => {
  const captchaInput = commentForm?.elements.captcha;
  if (captchaInput) captchaInput.value = "";
  loadCaptcha();
});

commentForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(commentForm);
  const payload = {
    lesson: activeLesson,
    generation: String(formData.get("generation") ?? "").trim(),
    name: String(formData.get("name") ?? "").trim(),
    message: String(formData.get("message") ?? "").trim(),
    captcha: String(formData.get("captcha") ?? "").trim(),
    captchaToken: String(formData.get("captchaToken") ?? "").trim(),
    website: String(formData.get("website") ?? "").trim(),
  };

  setCommentStatus("留言送出中...");

  try {
    const response = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message ?? "留言送出失敗，請稍後再試。");
    }

    commentForm.reset();
    setCommentStatus("留言已送出！", "success");
    renderComments(Array.isArray(data.comments) ? data.comments : []);
    loadCaptcha();
  } catch (error) {
    setCommentStatus(error.message || "留言板會在 Netlify 網址上啟用。", "error");
    loadCaptcha();
  }
});

closeButtons.forEach((button) => {
  button.addEventListener("click", closeAllModals);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllModals();
  }
});
