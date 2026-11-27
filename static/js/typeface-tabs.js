import "vanilla-framework/js/tabs";

document.addEventListener("DOMContentLoaded", () => {
  const tabList = document.querySelector(
    '[role="tablist"][aria-labelledby="typeface-download-heading"]',
  );
  if (!tabList) return;

  const tabs = tabList.querySelectorAll('[role="tab"]');

  // Keep only the selected tab in the keyboard tab order on Vanilla 4.59.
  const updateTabStops = () => {
    tabs.forEach((tab) => {
      tab.tabIndex = tab.getAttribute("aria-selected") === "true" ? 0 : -1;
    });
  };

  updateTabStops();
  new MutationObserver(updateTabStops).observe(tabList, {
    attributes: true,
    attributeFilter: ["aria-selected"],
    subtree: true,
  });
});
