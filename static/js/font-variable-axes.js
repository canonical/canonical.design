/**
 * Variable axes type tester.
 *
 * Drives every `.js-font-axes` section on the page independently, so a page can
 * embed more than one (for example Ubuntu variable and Ubuntu Mono). Each
 * section keeps its sliders, number fields and the editable specimen in sync.
 *
 * Rendering the markup already applies the starting axis values inline, so the
 * specimen is styled correctly before this script runs and if it never does.
 */
(function () {
  "use strict";

  function initInstance(root) {
    // The macro may emit this script once per instance; only wire each up once.
    if (root.dataset.fontAxesReady === "true") {
      return;
    }
    root.dataset.fontAxesReady = "true";

    const preview = root.querySelector(".js-font-axes-preview");
    const sliders = Array.from(root.querySelectorAll(".js-font-axis"));

    if (!preview || sliders.length === 0) {
      return;
    }

    function renderPreview() {
      preview.style.fontVariationSettings = sliders
        .map((slider) => `"${slider.dataset.axis}" ${slider.value}`)
        .join(", ");
    }

    // The specimen is display-sized, so a fixed-height box would either clip it
    // or leave the text stranded behind a scrollbar. Re-fit the box to its
    // content instead.
    function fitPreview() {
      preview.style.height = "auto";
      const borders = preview.offsetHeight - preview.clientHeight;

      preview.style.height = `${preview.scrollHeight + borders}px`;
    }

    // Chrome and Safari have no native equivalent of `::-moz-range-progress`,
    // so the filled portion of the track is drawn from this custom property.
    function paintTrack(slider) {
      const min = Number(slider.min);
      const max = Number(slider.max);
      const filled = ((Number(slider.value) - min) / (max - min)) * 100;

      slider.style.setProperty("--font-axes-progress", `${filled}%`);
    }

    sliders.forEach((slider) => {
      const field = root.querySelector(
        `.js-font-axis-value[data-axis="${slider.dataset.axis}"]`,
      );

      function update(value) {
        const clamped = Math.min(
          Number(slider.max),
          Math.max(Number(slider.min), value),
        );

        slider.value = clamped;
        field.value = clamped;
        paintTrack(slider);
        renderPreview();
        // Weight and width both change how the specimen wraps.
        fitPreview();
      }

      slider.addEventListener("input", () => update(Number(slider.value)));

      // While typing, ignore empty or partial input so the preview keeps the
      // last usable value instead of jumping around.
      field.addEventListener("input", () => {
        const typed = Number(field.value);

        if (field.value !== "" && !Number.isNaN(typed)) {
          update(typed);
        }
      });

      // Once the field is committed, clamp whatever is left in it back in range.
      field.addEventListener("change", () => {
        const typed = Number(field.value);

        update(
          field.value === "" || Number.isNaN(typed)
            ? Number(slider.value)
            : typed,
        );
      });

      paintTrack(slider);
    });

    preview.addEventListener("input", fitPreview);
    window.addEventListener("resize", fitPreview);

    renderPreview();
    fitPreview();

    // Metrics change once the webfont replaces the fallback, which changes how
    // many lines the specimen needs.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(fitPreview);
    }
  }

  function initAll() {
    document.querySelectorAll(".js-font-axes").forEach(initInstance);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAll);
  } else {
    initAll();
  }
})();
