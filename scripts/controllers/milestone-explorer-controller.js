/**
 * Explore daylight milestones in other cities without changing the active city.
 */

import { formatSuggestionLocation } from "../utils/location-utils.js";
import { scanCitiesForMilestones } from "../services/milestone-scanner-service.js";
import {
  cancelMilestoneExplorerScan,
  getMilestoneExplorerAbortController,
  isMilestoneExplorerOpen,
  setMilestoneExplorerAbortController,
  setMilestoneExplorerOpen,
} from "../state/app-state.js";

let dom = {};
let getDateParts = null;
let onSelectCity = null;

const setStatus = (message) => {
  if (dom.status) {
    dom.status.textContent = message;
  }
};

const closeMilestoneExplorer = () => {
  cancelMilestoneExplorerScan();
  setMilestoneExplorerOpen(false);
  if (dom.panel) dom.panel.hidden = true;
  if (dom.toggle) {
    dom.toggle.setAttribute("aria-expanded", "false");
    dom.toggle.textContent = "Explore milestones in other cities";
  }
  if (dom.results) dom.results.replaceChildren();
  if (dom.panel) dom.panel.removeAttribute("aria-busy");
  setStatus("");
};

const renderResults = (matches) => {
  dom.results?.replaceChildren();
  if (!matches.length) {
    setStatus("No milestones found in the cities checked.");
    return;
  }

  setStatus(
    `${matches.length} ${matches.length === 1 ? "city" : "cities"} with a milestone found.`
  );
  matches.forEach(({ city, milestone }) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    const cityName = document.createElement("span");
    const milestoneName = document.createElement("span");
    button.type = "button";
    button.className = "milestone-explorer-city";
    cityName.className = "milestone-explorer-city-name";
    cityName.textContent = formatSuggestionLocation(city);
    milestoneName.className = "milestone-explorer-milestone-name";
    milestoneName.textContent = milestone.title;
    button.append(cityName, milestoneName);
    button.addEventListener("click", () => {
      onSelectCity?.(city);
      closeMilestoneExplorer();
      dom.toggle?.focus();
    });
    item.appendChild(button);
    dom.results?.appendChild(item);
  });
};

/** Initialize the explorer with DOM elements and callbacks. */
export const initMilestoneExplorer = (elements, callbacks) => {
  dom = elements;
  getDateParts = callbacks.getDateParts;
  onSelectCity = callbacks.onSelectCity;
  closeMilestoneExplorer();
  dom.toggle?.addEventListener("click", () => {
    void toggleMilestoneExplorer();
  });
};

/** Close the explorer when the selected date or location changes. */
export const resetMilestoneExplorer = () => {
  closeMilestoneExplorer();
};

/** Toggle the in-place explorer and scan major cities when opened. */
export const toggleMilestoneExplorer = async () => {
  if (isMilestoneExplorerOpen()) {
    closeMilestoneExplorer();
    return;
  }

  setMilestoneExplorerOpen(true);
  if (dom.panel) {
    dom.panel.hidden = false;
    dom.panel.setAttribute("aria-busy", "true");
  }
  if (dom.toggle) {
    dom.toggle.setAttribute("aria-expanded", "true");
    dom.toggle.textContent = "Hide city milestones";
  }
  dom.results?.replaceChildren();
  setStatus("Scanning major cities for milestones…");

  const controller = new AbortController();
  setMilestoneExplorerAbortController(controller);
  try {
    const matches = await scanCitiesForMilestones(getDateParts, controller.signal);
    if (!controller.signal.aborted && isMilestoneExplorerOpen()) {
      renderResults(matches);
    }
  } catch (error) {
    if (!controller.signal.aborted && isMilestoneExplorerOpen()) {
      console.error("Milestone explorer scan failed:", error);
      setStatus("Could not check city milestones. Close and reopen to try again.");
    }
  } finally {
    if (getMilestoneExplorerAbortController() === controller) {
      setMilestoneExplorerAbortController(null);
      dom.panel?.removeAttribute("aria-busy");
    }
  }
};
