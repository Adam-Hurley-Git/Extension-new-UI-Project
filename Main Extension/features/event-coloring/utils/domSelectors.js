// ========================================
// DOM SELECTOR UTILITIES
// ========================================
// Centralized selectors for Google Calendar DOM elements
// Handles different calendar UI scenarios

(function () {
  'use strict';

  // ========================================
  // SCENARIOS
  // ========================================

  const Scenario = {
    EVENTEDIT: 'EVENTEDIT', // Editing existing event
    EVENTCREATE: 'EVENTCREATE', // Creating new event
    LISTVIEW: 'LISTVIEW', // Calendar list view
    UNKNOWN: 'UNKNOWN',
  };

  // ========================================
  // COLOR PICKER SELECTORS
  // ========================================

  const COLOR_PICKER_SELECTORS = {
    // Color picker controllers (containers)
    CONTROLLERS: {
      EDITOR: '[role="dialog"] [data-event-color-picker]',
      LIST: '[role="menu"][aria-label*="color" i]',
      FALLBACK: '[role="dialog"] div[aria-label*="color" i]',
    },

    // Google's built-in color group
    BUILT_IN_COLOR_GROUP: '.vbVGZb', // Google's class for color container
    GOOGLE_COLOR_BUTTON: 'div[data-color]', // Individual color buttons

    // Custom classes (we add these)
    CUSTOM_CLASSES: {
      COLOR_DIV_GROUP: 'cc3-event-color-group',
      SEPARATOR: 'cc3-event-color-separator',
      CUSTOM_COLOR_BUTTON: 'cc3-event-color-button',
      CATEGORY_LABEL: 'cc3-event-category-label',
      CHECKMARK: 'cc3-event-color-checkmark',
    },
  };

  // ========================================
  // EVENT SELECTORS
  // ========================================

  const EVENT_SELECTORS = {
    // Event elements on calendar
    EVENT_ELEMENT: '[data-eventid]',
    EVENT_CHIP: '[data-draggable-id]',

    // Event attributes
    ATTRIBUTES: {
      EVENT_ID: 'data-eventid',
      EVENT_EID: 'data-eid',
      DRAGGABLE_ID: 'data-draggable-id',
    },

    // Event dialog/modal
    DIALOG: '[role="dialog"]',
    DIALOG_TITLE: '[role="dialog"] input[aria-label*="title" i]',
    DIALOG_SAVE_BUTTON: '[role="dialog"] button[aria-label*="save" i]',
    DIALOG_CLOSE_BUTTON: '[role="dialog"] button[aria-label*="close" i]',

    // Style properties that contain colors
    STYLE_PROPERTIES: {
      BACKGROUND: 'backgroundColor',
      BORDER: 'borderColor',
      BORDER_LEFT: 'borderLeftColor',
    },
  };

  // ========================================
  // SCENARIO DETECTION
  // ========================================

  /**
   * Detect which scenario we're in (edit existing, create new, list view)
   * @returns {string} Scenario type
   */
  function detectScenario() {
    // Check for dialog (event editor)
    const dialog = document.querySelector(EVENT_SELECTORS.DIALOG);
    if (!dialog) {
      // Check for list view color picker
      const listColorPicker = document.querySelector(COLOR_PICKER_SELECTORS.CONTROLLERS.LIST);
      if (listColorPicker) {
        return Scenario.LISTVIEW;
      }
      return Scenario.UNKNOWN;
    }

    // Dialog exists - determine if editing or creating
    const hasEventId = dialog.querySelector(`[${EVENT_SELECTORS.ATTRIBUTES.EVENT_ID}]`);

    if (hasEventId) {
      return Scenario.EVENTEDIT;
    }

    // No event ID = new event creation
    // Verify by checking for "Save" button (not "Save & close")
    const saveButton = dialog.querySelector('[aria-label="Save"]');
    if (saveButton) {
      return Scenario.EVENTCREATE;
    }

    return Scenario.EVENTEDIT; // Default to edit if unclear
  }

  /**
   * Find the color picker container based on scenario
   * @param {string} scenario - Scenario type
   * @returns {HTMLElement|null}
   */
  function findColorPickerContainer(scenario) {
    switch (scenario) {
      case Scenario.EVENTEDIT:
      case Scenario.EVENTCREATE:
        // Try specific editor selector first
        let container = document.querySelector(COLOR_PICKER_SELECTORS.CONTROLLERS.EDITOR);
        if (container) return container;

        // Fallback: Find any color picker in dialog
        const dialog = document.querySelector(EVENT_SELECTORS.DIALOG);
        if (dialog) {
          container = dialog.querySelector(COLOR_PICKER_SELECTORS.BUILT_IN_COLOR_GROUP);
          if (container) return container.parentElement;
        }
        break;

      case Scenario.LISTVIEW:
        return document.querySelector(COLOR_PICKER_SELECTORS.CONTROLLERS.LIST);

      default:
        return null;
    }

    return null;
  }

  /**
   * Find Google's built-in color group
   * @returns {HTMLElement|null}
   */
  function findBuiltInColorGroup() {
    return document.querySelector(COLOR_PICKER_SELECTORS.BUILT_IN_COLOR_GROUP);
  }

  /**
   * Find all Google color buttons
   * @returns {NodeList}
   */
  function findGoogleColorButtons() {
    return document.querySelectorAll(COLOR_PICKER_SELECTORS.GOOGLE_COLOR_BUTTON);
  }

  // ========================================
  // EVENT ID EXTRACTION
  // ========================================

  /**
   * Extract event ID from various sources
   * @param {HTMLElement} element - Element to extract from
   * @param {string} scenario - Current scenario
   * @returns {string|null}
   */
  function extractEventId(element, scenario) {
    if (!element) return null;

    // Try different attributes
    const eventId =
      element.getAttribute(EVENT_SELECTORS.ATTRIBUTES.EVENT_ID) ||
      element.getAttribute(EVENT_SELECTORS.ATTRIBUTES.EVENT_EID) ||
      element.getAttribute(EVENT_SELECTORS.ATTRIBUTES.DRAGGABLE_ID);

    if (eventId) return eventId;

    // For EVENTEDIT/LISTVIEW, try to find in parent dialog/menu
    if (scenario === Scenario.EVENTEDIT || scenario === Scenario.LISTVIEW) {
      const dialog = element.closest(EVENT_SELECTORS.DIALOG) || element.closest('[role="menu"]');
      if (dialog) {
        const eventElement = dialog.querySelector(`[${EVENT_SELECTORS.ATTRIBUTES.EVENT_ID}]`);
        if (eventElement) {
          return eventElement.getAttribute(EVENT_SELECTORS.ATTRIBUTES.EVENT_ID);
        }
      }
    }

    return null;
  }

  /**
   * Find event ID in color picker context
   * @param {HTMLElement} colorPickerElement - Color picker element
   * @param {string} scenario - Current scenario
   * @returns {string|null}
   */
  function findEventIdByScenario(colorPickerElement, scenario) {
    if (!colorPickerElement) return null;

    switch (scenario) {
      case Scenario.EVENTEDIT:
        // Find in dialog
        const dialog = colorPickerElement.closest(EVENT_SELECTORS.DIALOG);
        if (dialog) {
          const eventElement = dialog.querySelector(`[${EVENT_SELECTORS.ATTRIBUTES.EVENT_ID}]`);
          if (eventElement) {
            return eventElement.getAttribute(EVENT_SELECTORS.ATTRIBUTES.EVENT_ID);
          }
        }
        break;

      case Scenario.LISTVIEW:
        // Find in menu context
        const menu = colorPickerElement.closest('[role="menu"]');
        if (menu) {
          // Look for event ID in parent context or data attributes
          const eventId = menu.getAttribute('data-target-event-id');
          if (eventId) return eventId;
        }
        break;

      case Scenario.EVENTCREATE:
        // New events don't have IDs yet
        return null;

      default:
        return null;
    }

    return null;
  }

  // ========================================
  // EVENT ELEMENT QUERIES
  // ========================================

  /**
   * Find all event elements on the calendar
   * @returns {NodeList}
   */
  function findAllEventElements() {
    return document.querySelectorAll(EVENT_SELECTORS.EVENT_ELEMENT);
  }

  /**
   * Find event element by ID
   * @param {string} eventId - Event ID
   * @returns {HTMLElement|null}
   */
  function findEventElementById(eventId) {
    if (!eventId) return null;
    return document.querySelector(`[${EVENT_SELECTORS.ATTRIBUTES.EVENT_ID}="${eventId}"]`);
  }

  // ========================================
  // CHECKMARK MANAGEMENT
  // ========================================

  /**
   * Toggle checkmark on color button
   * @param {HTMLElement} button - Color button element
   * @param {boolean} show - Whether to show checkmark
   */
  function toggleCheckmark(button, show) {
    if (!button) return;

    let checkmark = button.querySelector(`.${COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CHECKMARK}`);

    if (show && !checkmark) {
      // Create checkmark
      checkmark = document.createElement('div');
      checkmark.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CHECKMARK;
      checkmark.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M13 4L6 11L3 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      checkmark.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        pointer-events: none;
      `;
      button.appendChild(checkmark);
    } else if (!show && checkmark) {
      // Remove checkmark
      checkmark.remove();
    }
  }

  /**
   * Clear all checkmarks
   */
  function clearAllCheckmarks() {
    const checkmarks = document.querySelectorAll(`.${COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CHECKMARK}`);
    checkmarks.forEach((checkmark) => checkmark.remove());
  }

  // ========================================
  // VALIDATION
  // ========================================

  /**
   * Check if custom colors are already injected
   * @returns {boolean}
   */
  function hasCustomColorsInjected() {
    return (
      !!document.querySelector(`.${COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.COLOR_DIV_GROUP}`) ||
      !!document.querySelector(`.${COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.SEPARATOR}`)
    );
  }

  /**
   * Check if element is a color picker
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  function isColorPickerElement(element) {
    if (!element) return false;

    return (
      element.querySelector(COLOR_PICKER_SELECTORS.BUILT_IN_COLOR_GROUP) !== null ||
      element.matches('[role="menu"][aria-label*="color" i]') ||
      element.matches('[data-event-color-picker]')
    );
  }

  // ========================================
  // EXPORT API
  // ========================================

  window.eventColoringSelectors = {
    // Scenario detection
    Scenario,
    detectScenario,

    // Color picker
    findColorPickerContainer,
    findBuiltInColorGroup,
    findGoogleColorButtons,
    hasCustomColorsInjected,
    isColorPickerElement,

    // Event ID extraction
    extractEventId,
    findEventIdByScenario,

    // Event elements
    findAllEventElements,
    findEventElementById,

    // Checkmarks
    toggleCheckmark,
    clearAllCheckmarks,

    // Selectors
    COLOR_PICKER_SELECTORS,
    EVENT_SELECTORS,
  };

  console.log('[Event Coloring] DOM selectors loaded');
})();
