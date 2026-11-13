// Previous/next controls for the carousels, which otherwise scroll natively.
// The carousel wraps around at both ends.
document.querySelectorAll(".js-carousel").forEach((carousel) => {
  const controls = document.querySelector(
    `.js-carousel-controls[data-carousel="${carousel.id}"]`,
  );

  if (!controls) {
    return;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const scrollTo = (left) => {
    carousel.scrollTo({
      left,
      behavior: reducedMotion.matches ? "auto" : "smooth",
    });
  };

  const step = () => {
    const cells = carousel.children;

    // the distance between two cells includes the gap between them
    return cells.length > 1
      ? cells[1].offsetLeft - cells[0].offsetLeft
      : carousel.clientWidth;
  };

  const maxScroll = () => carousel.scrollWidth - carousel.clientWidth;

  controls.querySelector(".js-carousel-next").addEventListener("click", () => {
    const atEnd = carousel.scrollLeft >= maxScroll() - 1;

    scrollTo(atEnd ? 0 : carousel.scrollLeft + step());
  });

  controls
    .querySelector(".js-carousel-previous")
    .addEventListener("click", () => {
      const atStart = carousel.scrollLeft <= 1;

      scrollTo(atStart ? maxScroll() : carousel.scrollLeft - step());
    });

  controls.classList.add("is-ready");
});

// Switches that swap an image for its dark mode version.
document.querySelectorAll(".js-dark-mode-switch").forEach((toggle) => {
  const target = document.getElementById(toggle.getAttribute("aria-controls"));

  if (!target) {
    return;
  }

  const update = () => {
    target.querySelector("[data-mode='light']").hidden = toggle.checked;
    target.querySelector("[data-mode='dark']").hidden = !toggle.checked;
  };

  toggle.addEventListener("change", update);
  toggle.disabled = false;
  update();
});
