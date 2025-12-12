// features/event-coloring/selectors.js
// DOM selectors for Google Calendar color picker integration

/**
 * Color picker selectors - matches Google Calendar's DOM structure
 */
export const COLOR_PICKER_SELECTORS = {
  // Controllers that contain color picker UI
  COLOR_PICKER_CONTROLLERS: {
    EDITOR: '[jscontroller="kFFfqb"]',
    LIST: '[jscontroller="d5OhJe"]',
    CALENDARLIST: '.tB5Jxf-xl07Ob-XxIAqe',
    NEW_EVENT: '.tB5Jxf-xl07Ob-XxIAqe.GemzMd.KjAqB',
  },

  // Built-in Google color elements
  BUILT_IN_COLOR_GROUP: '.vbVGZb',
  GOOGLE_COLOR_BUTTON: 'div[jsname="Ly0WL"]',
  ALL_COLOR_BUTTONS: '[jsname="Ly0WL"]',

  // Menu/dialog containers
  MENU_DIALOG: '[role="menu"], [role="dialog"]',

  // Checkmark inside color buttons
  CHECKMARK_SELECTOR: 'i.google-material-icons',

  // Label element within color buttons
  LABEL_ELEMENT: '.oMnJrf',

  // Custom classes we add
  CUSTOM_CLASSES: {
    SEPARATOR: 'cf-custom-separator',
    COLOR_DIV_GROUP: 'cf-colorDivGroup',
    CUSTOM_COLOR_BUTTON: 'cf-custom-color-button',
    CATEGORY_SECTION: 'cf-category-section',
    RECURRING_DIALOG: 'cf-recurring-dialog-container',
  },

  // Context menu
  CONTEXT_MENU: {
    CONTAINER: '.ztKZ3d',
  },
};

/**
 * Data attributes for events
 */
export const DATA_ATTRIBUTES = {
  EVENT_ID: 'data-eventid',
  COLOR_MODIFIED: 'data-cf-color-modified',
  CF_COLORED: 'data-cf-event-colored',
};

/**
 * Event element selectors
 */
export const EVENT_SELECTORS = {
  // Container with event ID
  EVENT_CONTAINER: '[data-eventid]',

  // Text elements within events
  TEXT: '.I0UMhf, .EWOIrf, .KcY3wb',

  // Time elements within events
  TIME: '.lhydbb.gVNoLb.EiZ8Dd',

  // Event editor elements
  EDITOR: {
    COLOR_SELECTOR: 'div[jsname="QPiGnd"].A1wrjc.kQuqUe',
    TITLE_INPUT: '[aria-label*="Event title"], input[aria-label*="Add title"]',
  },

  // Event viewer (details popup)
  VIEWER: {
    DIALOG: '#xDetDlg',
    COLOR_INDICATOR: '.xnWuge',
  },

  // Calendar root
  CALENDAR_ROOT: 'div[jsname="KL7Kx"]',

  // Style properties to modify for coloring
  STYLE_PROPERTIES: {
    COLORS: ['backgroundColor', 'borderColor', 'borderLeftColor', 'borderRightColor'],
  },

  // Event chip classes
  CHIP: {
    CONTAINER: '[data-eventchip]',
    DRAGGABLE: '[data-draggable-id]',
    VISUAL: '.FAxxKc',
  },
};

/**
 * Scenarios for color picker context
 */
export const Scenario = {
  EVENTEDIT: 'EVENTEDIT',
  LISTVIEW: 'LISTVIEW',
  EVENTVIEW: 'EVENTVIEW',
  NEWEVENT: 'NEWEVENT',
  CALENDARLIST: 'CALENDARLIST',
};

// Make available globally for non-module scripts
if (typeof window !== 'undefined') {
  window.cfEventColorSelectors = {
    COLOR_PICKER_SELECTORS,
    DATA_ATTRIBUTES,
    EVENT_SELECTORS,
    Scenario,
  };
}
