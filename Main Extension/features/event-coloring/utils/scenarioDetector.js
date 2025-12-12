// features/event-coloring/utils/scenarioDetector.js
// Detects the current Google Calendar context/scenario

import { COLOR_PICKER_SELECTORS, Scenario, EVENT_SELECTORS } from '../selectors.js';
import EventIdUtils from './eventIdUtils.js';

/**
 * ScenarioDetector - Determines the current Google Calendar context
 */
export const ScenarioDetector = {
  /**
   * Detect the current scenario based on URL and DOM state
   * @returns {string|null} The current scenario or null
   */
  detectCurrentScenario() {
    const url = window.location.href;

    // Check URL patterns first
    if (url.includes('/eventedit/')) {
      return Scenario.EVENTEDIT;
    }

    // Check for new event state parameter
    if (url.includes('state=') && url.includes('action=create')) {
      return Scenario.NEWEVENT;
    }

    // Check DOM for color picker controllers
    const editorController = document.querySelector(
      COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR
    );
    if (editorController) {
      return Scenario.EVENTEDIT;
    }

    const listController = document.querySelector(
      COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST
    );
    if (listController) {
      return Scenario.LISTVIEW;
    }

    // Check for event viewer dialog
    const eventViewer = document.querySelector(EVENT_SELECTORS.VIEWER.DIALOG);
    if (eventViewer) {
      return Scenario.EVENTVIEW;
    }

    // Check for calendar list (sidebar)
    const calendarList = document.querySelector(
      COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.CALENDARLIST
    );
    if (calendarList) {
      return Scenario.CALENDARLIST;
    }

    return null;
  },

  /**
   * Find the color picker scenario for a given container element
   * @param {Element} container - Optional container to search within
   * @returns {string|null} The scenario
   */
  findColorPickerScenario(container = document) {
    // Check for editor controller
    if (container.querySelector(COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR)) {
      return Scenario.EVENTEDIT;
    }

    // Check for list controller
    if (container.querySelector(COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST)) {
      return Scenario.LISTVIEW;
    }

    // Check URL as fallback
    if (window.location.href.includes('/eventedit/')) {
      return Scenario.EVENTEDIT;
    }

    return null;
  },

  /**
   * Find the event ID based on the current scenario
   * @param {Element} container - Container element to search within
   * @param {string} scenario - The current scenario
   * @returns {string|null} The event ID
   */
  findEventIdByScenario(container, scenario) {
    if (!container || !scenario) return null;

    switch (scenario) {
      case Scenario.EVENTEDIT:
        return this.findEventIdFromEditUrl() || this.findEventIdFromContainer(container);

      case Scenario.LISTVIEW:
        return this.findEventIdFromContainer(container);

      case Scenario.EVENTVIEW:
        return this.findEventIdFromViewer();

      case Scenario.NEWEVENT:
        // New events don't have an ID yet
        return null;

      default:
        return this.findEventIdFromContainer(container);
    }
  },

  /**
   * Extract event ID from the edit URL
   * @returns {string|null} The event ID
   */
  findEventIdFromEditUrl() {
    const url = window.location.href;
    const match = url.match(/\/eventedit\/([^/?]+)/);
    return match ? match[1] : null;
  },

  /**
   * Find event ID from a container element
   * @param {Element} container - The container element
   * @returns {string|null} The event ID
   */
  findEventIdFromContainer(container) {
    if (!container) return null;

    // Check container itself
    let eventId = container.getAttribute('data-eventid');
    if (eventId) return eventId;

    // Check ancestors
    const ancestor = container.closest('[data-eventid]');
    if (ancestor) {
      return ancestor.getAttribute('data-eventid');
    }

    // Check for event ID in parent elements
    let parent = container.parentElement;
    while (parent) {
      eventId = parent.getAttribute('data-eventid');
      if (eventId) return eventId;

      // Also check for event chip
      const chip = parent.querySelector('[data-eventchip]');
      if (chip) {
        const chipId = chip.getAttribute('data-eventchip');
        if (chipId) return chipId;
      }

      parent = parent.parentElement;
    }

    return null;
  },

  /**
   * Find event ID from the event viewer dialog
   * @returns {string|null} The event ID
   */
  findEventIdFromViewer() {
    const viewer = document.querySelector(EVENT_SELECTORS.VIEWER.DIALOG);
    if (!viewer) return null;

    // Try to find event ID in the viewer
    const eventElement = viewer.querySelector('[data-eventid]');
    if (eventElement) {
      return eventElement.getAttribute('data-eventid');
    }

    // Check URL for event ID in hash
    const hash = window.location.hash;
    const match = hash.match(/eid=([^&]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  },

  /**
   * Check if we're in an event editing context
   * @returns {boolean}
   */
  isEventEditContext() {
    const scenario = this.detectCurrentScenario();
    return scenario === Scenario.EVENTEDIT || scenario === Scenario.NEWEVENT;
  },

  /**
   * Get the color picker container for the current scenario
   * @returns {Element|null}
   */
  getColorPickerContainer() {
    const scenario = this.findColorPickerScenario();

    switch (scenario) {
      case Scenario.EVENTEDIT:
        return document.querySelector(COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR);

      case Scenario.LISTVIEW:
        return document.querySelector(COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST);

      default:
        return null;
    }
  },
};

// Make available globally
if (typeof window !== 'undefined') {
  window.cfScenarioDetector = ScenarioDetector;
}

export default ScenarioDetector;
