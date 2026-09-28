/**
 * Glyph specimen.
 *
 * Renders the character set of the bundled Ubuntu faces. The markup for every
 * glyph is server-rendered; this script only switches families, applies
 * OpenType features, and keeps the preview in sync with the selection.
 *
 * Feature toggles are disabled rather than removed whenever the active face
 * cannot express them -- Ubuntu Mono has no small-caps or italic coverage, and
 * the italic subset has no small caps of its own. Withdrawing them would
 * reflow the row and shift the remaining switches under the pointer.
 *
 * Every lookup is scoped to a specimen root, so the section can be included on
 * any page, more than once, without the instances reaching into each other.
 */
(function () {
  "use strict";

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );

  function init(root) {
    var config = JSON.parse(
      root.querySelector(".js-glyph-specimen-config").textContent,
    );

    var specimen = root.querySelector(".js-glyph-specimen");
    var preview = root.querySelector(".js-glyph-preview");
    var figure = root.querySelector(".js-glyph-figure");
    var figureText = root.querySelector(".js-glyph-figure-text");
    var glyphSet = root.querySelector(".js-glyph-set");
    var familyButtons = Array.prototype.slice.call(
      root.querySelectorAll(".js-glyph-family"),
    );
    var familySelect = root.querySelector(".js-glyph-family-select");
    var viewButtons = Array.prototype.slice.call(
      root.querySelectorAll(".js-glyph-view"),
    );
    var featureInputs = Array.prototype.slice.call(
      root.querySelectorAll(".js-glyph-feature"),
    );
    var glyphButtons = Array.prototype.slice.call(
      root.querySelectorAll(".js-glyph"),
    );
    var groups = Array.prototype.slice.call(
      root.querySelectorAll(".p-glyph-specimen__group"),
    );

    var state = {
      family: config.families[0],
      smallCaps: false,
      italic: false,
      textFigures: false,
    };

    function findFamily(id) {
      for (var i = 0; i < config.families.length; i++) {
        if (config.families[i].id === id) {
          return config.families[i];
        }
      }
      return config.families[0];
    }

    /**
     * Which toggles the active face can actually render. Small caps are
     * unavailable in the italic subset, so enabling italics withdraws them.
     */
    function supportedFeatures() {
      var features = state.family.features;

      return {
        smallCaps:
          features.smallCaps &&
          !(state.italic && !config.italicFeatures.smallCaps),
        italic: features.italic,
        textFigures:
          features.textFigures &&
          (!state.italic || config.italicFeatures.textFigures),
      };
    }

    function fontFeatureSettings() {
      var settings = [];
      var supported = supportedFeatures();

      if (state.smallCaps && supported.smallCaps) {
        settings.push('"smcp" 1', '"c2sc" 1');
      }
      if (state.textFigures && supported.textFigures) {
        settings.push('"onum" 1');
      }

      return settings.join(", ");
    }

    /** Font styling shared by the preview and every cell in the grid. */
    function applyTypography() {
      var supported = supportedFeatures();
      var italic = state.italic && supported.italic;
      var features = fontFeatureSettings();

      [figure, glyphSet].forEach(function (target) {
        if (!target) {
          return;
        }
        target.style.fontFamily = state.family.stack;
        target.style.fontStyle = italic ? "italic" : "normal";
        target.style.fontFeatureSettings = features;
      });
    }

    /** Rescale the metric diagram to the active family's own metrics. */
    function applyMetrics() {
      var metrics = state.family.metrics;
      var descender = Math.abs(metrics.descender);

      specimen.style.setProperty("--glyph-ascender", metrics.ascender / 1000);
      specimen.style.setProperty(
        "--glyph-cap-height",
        metrics.capHeight / 1000,
      );
      specimen.style.setProperty("--glyph-x-height", metrics.xHeight / 1000);
      specimen.style.setProperty("--glyph-descender", descender / 1000);

      figure.setAttribute(
        "viewBox",
        ["-500", -metrics.ascender, "2000", metrics.ascender + descender].join(
          " ",
        ),
      );
    }

    /**
     * Toggles that rewrite particular glyphs rather than restyling the whole
     * face. `onum` reaches only 20 characters out of 1,091, so the grid is
     * narrowed to a feature's own scope while it is switched on -- otherwise
     * its effect is invisible among a thousand unchanged cells.
     */
    var SUBSTITUTION_FEATURES = ["smallCaps", "textFigures"];

    function activeFilters() {
      var supported = supportedFeatures();

      return SUBSTITUTION_FEATURES.filter(function (name) {
        return state[name] && supported[name];
      });
    }

    /**
     * Hide glyphs the active family has no outline for, narrow the grid to
     * the glyphs any active feature rewrites, and flag those that exist in
     * the roman face but not in the italic subset.
     */
    function applyCoverage() {
      var supported = supportedFeatures();
      var italic = state.italic && supported.italic;
      var isMono = state.family.id === "ubuntu-mono";
      var filters = activeFilters();

      glyphButtons.forEach(function (button) {
        var inFamily = button.dataset[isMono ? "mono" : "roman"] === "true";
        var missingItalic = italic && button.dataset.italic !== "true";
        // Any active feature, not all of them: small caps and text figures
        // touch disjoint sets, so intersecting them would empty the grid.
        var affected =
          filters.length === 0 ||
          filters.some(function (name) {
            return button.dataset[name] === "true";
          });

        button.hidden = !inFamily || !affected;
        button.classList.toggle("is-unavailable", inFamily && missingItalic);
        button.disabled = !inFamily || missingItalic;
      });

      // Collapse a script heading once none of its glyphs are left.
      groups.forEach(function (group) {
        group.hidden = !group.querySelector(".js-glyph:not([hidden])");
      });
    }

    /** Disable toggles the active face cannot support, resetting their state. */
    function applyFeatureAvailability() {
      var supported = supportedFeatures();

      featureInputs.forEach(function (input) {
        var wrapper = input.closest(".p-glyph-specimen__feature");
        var isSupported = supported[input.name];

        input.disabled = !isSupported;
        wrapper.classList.toggle("is-disabled", !isSupported);

        if (!isSupported && input.checked) {
          input.checked = false;
          state[input.name] = false;
        }
      });
    }

    function selectGlyph(button) {
      glyphButtons.forEach(function (other) {
        other.classList.remove("is-selected");
        other.setAttribute("aria-pressed", "false");
      });

      button.classList.add("is-selected");
      button.setAttribute("aria-pressed", "true");
      figureText.textContent = button.textContent;
    }

    /**
     * The view switcher only exists while the two halves are stacked. Ask the
     * layout rather than re-declaring the breakpoint here, so the two cannot
     * drift apart.
     */
    function viewsAreSeparate() {
      return viewButtons.some(function (button) {
        return button.offsetParent !== null;
      });
    }

    function setView(name) {
      specimen.dataset.view = name;

      viewButtons.forEach(function (button) {
        button.setAttribute(
          "aria-selected",
          String(button.dataset.view === name),
        );
      });
    }

    /**
     * Wherever the preview is not pinned alongside the character set, it has
     * scrolled out of sight by the time a glyph is picked. Bring it back.
     */
    function revealPreview() {
      if (window.getComputedStyle(preview).position === "sticky") {
        return;
      }

      if (viewsAreSeparate()) {
        setView("specimen");
      }

      preview.scrollIntoView({
        behavior: prefersReducedMotion.matches ? "auto" : "smooth",
        block: "start",
      });
    }

    /**
     * Keep a glyph on screen after a change of family or style. The current
     * selection is preferred; otherwise fall back to the first visible cell.
     */
    function ensureVisibleSelection() {
      var selected = root.querySelector(".js-glyph.is-selected");

      if (selected && !selected.hidden && !selected.disabled) {
        return;
      }

      var fallback = glyphButtons.find(function (button) {
        return !button.hidden && !button.disabled;
      });

      if (fallback) {
        selectGlyph(fallback);
      }
    }

    function render() {
      applyFeatureAvailability();
      applyMetrics();
      applyTypography();
      applyCoverage();
      ensureVisibleSelection();
    }

    /** Drive both the tab strip and the select from a single entry point. */
    function setFamily(id) {
      state.family = findFamily(id);

      familyButtons.forEach(function (button) {
        button.setAttribute(
          "aria-selected",
          String(button.dataset.family === state.family.id),
        );
      });

      if (familySelect) {
        familySelect.value = state.family.id;
      }

      render();
    }

    familyButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setFamily(button.dataset.family);
      });
    });

    if (familySelect) {
      familySelect.addEventListener("change", function () {
        setFamily(familySelect.value);
      });
    }

    viewButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setView(button.dataset.view);
      });
    });

    featureInputs.forEach(function (input) {
      input.addEventListener("change", function () {
        state[input.name] = input.checked;
        render();
      });
    });

    glyphButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        selectGlyph(button);
        revealPreview();
      });
    });

    render();
  }

  Array.prototype.forEach.call(
    document.querySelectorAll(".js-glyph-specimen-root"),
    function (root) {
      // The section carries its own script tag, so including it twice on one
      // page would otherwise bind every handler twice.
      if (root.dataset.glyphSpecimenReady) {
        return;
      }
      root.dataset.glyphSpecimenReady = "true";
      init(root);
    },
  );
})();
