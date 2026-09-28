const initNavigationSliding = () => {
  const ANIMATION_SNAP_DURATION = 100;
  const navigation = document.querySelector(
    ".p-navigation--sliding, .p-navigation--reduced",
  );
  const toggles = document.querySelectorAll(
    ".p-navigation__nav .p-navigation__link[aria-controls]:not(.js-back-button)",
  );
  const menuButton = document.querySelector(".js-menu-button");
  const dropdownNavLists = document.querySelectorAll(".js-dropdown-nav-list");
  const topNavList = [...dropdownNavLists].filter(
    (list) => !list.parentNode.closest(".js-dropdown-nav-list"),
  )[0];

  const closeAllDropdowns = () => {
    resetToggles();
    navigation.classList.remove("has-menu-open");
    menuButton.innerHTML = "Menu";
  };

  // The "Back" buttons are only rendered above the navigation breakpoint,
  // so their visibility tells us whether the sliding menu is in use.
  const isSlidingMenu = () => {
    const backButton = navigation.querySelector(
      ".p-navigation__item--dropdown-close",
    );
    return (
      !backButton || window.getComputedStyle(backButton).display !== "none"
    );
  };

  const keyPressHandler = (e) => {
    if (e.key === "Escape") {
      closeAllDropdowns();
      document.removeEventListener("keydown", keyPressHandler);
    }
  };

  menuButton.addEventListener("click", function (e) {
    e.preventDefault();
    if (navigation.classList.contains("has-menu-open")) {
      closeAllDropdowns();
    } else {
      navigation.classList.add("has-menu-open");
      e.target.innerHTML = "Close menu";
      setFocusable(topNavList);
      document.addEventListener("keydown", keyPressHandler);
    }
  });

  const resetToggles = (exception) => {
    toggles.forEach(function (toggle) {
      const target = document.getElementById(
        toggle.getAttribute("aria-controls"),
      );
      if (!target || target === exception) {
        return;
      }
      collapseDropdown(toggle, target);
    });
  };

  const setActiveDropdown = (dropdownToggleButton, isActive = true) => {
    // set active state of the dropdown toggle (to slide the panel into view)
    const dropdownToggleEl = dropdownToggleButton.closest(
      ".js-navigation-dropdown-toggle",
    );
    dropdownToggleEl?.classList.toggle("is-active", isActive);

    // set active state of the parent dropdown panel (to fade it out of view)
    const parentLevelDropdown = dropdownToggleEl.closest(
      ".js-navigation-sliding-panel",
    );
    parentLevelDropdown?.classList.toggle("is-active", isActive);
  };

  const collapseDropdown = (
    dropdownToggleButton,
    targetDropdown,
    animated = false,
  ) => {
    const closeHandler = () => {
      targetDropdown.setAttribute("aria-hidden", "true");
      setActiveDropdown(dropdownToggleButton, false);
    };

    targetDropdown.classList.add("is-collapsed");
    if (animated) {
      setTimeout(closeHandler, ANIMATION_SNAP_DURATION);
    } else {
      closeHandler();
    }
  };

  const expandDropdown = (
    dropdownToggleButton,
    targetDropdown,
    animated = false,
  ) => {
    setActiveDropdown(dropdownToggleButton);
    targetDropdown.setAttribute("aria-hidden", "false");

    if (animated) {
      // trigger the CSS transition
      requestAnimationFrame(() => {
        targetDropdown.classList.remove("is-collapsed");
      });
    } else {
      // make it appear immediately
      targetDropdown.classList.remove("is-collapsed");
    }

    setFocusable(targetDropdown);
  };

  // when clicking outside navigation, close all dropdowns
  document.addEventListener("click", function (event) {
    const target = event.target;
    if (target.closest) {
      if (
        !target.closest(
          ".p-navigation, .p-navigation--sliding, .p-navigation--reduced",
        )
      ) {
        closeAllDropdowns();
      }
    }
  });

  const setListFocusable = (list) => {
    // turn on focusability for all direct children in the target dropdown
    if (list) {
      for (const item of list.children) {
        item.children[0].setAttribute("tabindex", "0");
      }
    }
  };

  const setFocusable = (target) => {
    // turn off focusability for all dropdown lists in the navigation
    dropdownNavLists.forEach(function (list) {
      if (list != topNavList) {
        const elements = list.querySelectorAll("ul > li > a, ul > li > button");
        elements.forEach(function (element) {
          element.setAttribute("tabindex", "-1");
        });
      }
    });

    // if target dropdown is not a list, find the list in it
    const isList = target.classList.contains("js-dropdown-nav-list");
    if (!isList) {
      // find all lists in the target dropdown and make them focusable
      target
        .querySelectorAll(".js-dropdown-nav-list")
        .forEach(function (element) {
          setListFocusable(element);
        });
    } else {
      setListFocusable(target);
    }
  };

  toggles.forEach(function (toggle) {
    toggle.addEventListener("click", function (e) {
      // section items are links: above the navigation breakpoint they navigate
      // to their page instead of opening a dropdown
      if (toggle.tagName === "A" && !isSlidingMenu()) {
        return;
      }
      e.preventDefault();
      const target = document.getElementById(
        toggle.getAttribute("aria-controls"),
      );
      if (target) {
        // check if the toggled dropdown is child of another dropdown
        const isNested = !!target.parentNode.closest(".p-navigation__dropdown");
        if (!isNested) {
          resetToggles(target);
        }

        if (target.getAttribute("aria-hidden") === "true") {
          // only animate the dropdown if menu is not open, otherwise just switch the visible one
          expandDropdown(
            toggle,
            target,
            !navigation.classList.contains("has-menu-open"),
          );
          navigation.classList.add("has-menu-open");
        } else {
          collapseDropdown(toggle, target, true);
          navigation.classList.remove("has-menu-open");
        }
      }
    });
  });

  const goBackOneLevel = (e, backButton) => {
    e.preventDefault();
    const target = backButton.closest(".p-navigation__dropdown");
    target.setAttribute("aria-hidden", "true");
    setActiveDropdown(backButton, false);
    setFocusable(target.parentNode.parentNode);
  };

  dropdownNavLists.forEach(function (dropdown) {
    dropdown.children[1].addEventListener("keydown", function (e) {
      if (
        e.shiftKey &&
        e.key === "Tab" &&
        window.getComputedStyle(dropdown.children[0], null).display === "none"
      ) {
        goBackOneLevel(e, dropdown.children[1].children[0]);
        dropdown.parentNode.children[0].focus({
          preventScroll: true,
        });
      }
    });
  });

  document.querySelectorAll(".js-back-button").forEach(function (backButton) {
    backButton.addEventListener("click", function (e) {
      goBackOneLevel(e, backButton);
    });
  });

  // throttle util (for window resize event)
  var throttle = function (fn, delay) {
    var timer = null;
    return function () {
      var context = this,
        args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        fn.apply(context, args);
      }, delay);
    };
  };

  // hide side navigation drawer when screen is resized horizontally
  let previousWidth = window.innerWidth;
  window.addEventListener(
    "resize",
    throttle(function () {
      const currentWidth = window.innerWidth;
      if (currentWidth !== previousWidth) {
        closeAllDropdowns();
        previousWidth = currentWidth;
      }
    }, 10),
  );
};

initNavigationSliding();

// Chevrons in the side navigation mark parent pages and expand their children.
const initSideNavigationExpand = () => {
  document.querySelectorAll(".js-sidenav-expand").forEach((button) => {
    button.addEventListener("click", () => {
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      const label = button.getAttribute("aria-label") || "";
      button.setAttribute("aria-expanded", isExpanded ? "false" : "true");
      button.setAttribute(
        "aria-label",
        isExpanded
          ? label.replace(/^Hide/, "Show")
          : label.replace(/^Show/, "Hide"),
      );
    });
  });
};

initSideNavigationExpand();
