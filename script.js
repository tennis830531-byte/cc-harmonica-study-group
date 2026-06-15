const announcementModal = document.querySelector("[data-modal]");
const courseModal = document.querySelector("[data-course-modal]");
const courseModalTitle = document.querySelector("#course-modal-title");
const openButton = document.querySelector("[data-modal-open]");
const closeButtons = document.querySelectorAll("[data-modal-close]");
const courseCards = document.querySelectorAll("[data-course-open]");

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

courseCards.forEach((card) => {
  card.addEventListener("click", (event) => {
    event.preventDefault();
    const number = card.querySelector(".course__number")?.textContent.trim() ?? "";
    const title = card.querySelector(".course__title")?.textContent.trim() ?? "";
    courseModalTitle.textContent = `${number} ${title}`;
    openModal(courseModal);
  });
});

closeButtons.forEach((button) => {
  button.addEventListener("click", closeAllModals);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeAllModals();
  }
});
