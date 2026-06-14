const modal = document.querySelector("[data-modal]");
const openButton = document.querySelector("[data-modal-open]");
const closeButtons = document.querySelectorAll("[data-modal-close]");

function openModal() {
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeModal() {
  modal.hidden = true;
  document.body.style.overflow = "";
}

openButton?.addEventListener("click", openModal);

closeButtons.forEach((button) => {
  button.addEventListener("click", closeModal);
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !modal.hidden) {
    closeModal();
  }
});
