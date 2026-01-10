// features/event-coloring/core/colorPickerInjector.js
// Injects custom color picker UI into Google Calendar's color menus
// NOTE: This file is loaded as a content script, NOT as an ES6 module
// All dependencies are accessed via window globals set by other content scripts

// ========================================
// SELECTORS (inline definitions for content script use)
// ========================================
const COLOR_PICKER_SELECTORS = {
  COLOR_PICKER_CONTROLLERS: {
    EDITOR: '[jscontroller="kFFfqb"]',
    LIST: '[jscontroller="d5OhJe"]',
    CALENDARLIST: '.tB5Jxf-xl07Ob-XxIAqe',
    NEW_EVENT: '.tB5Jxf-xl07Ob-XxIAqe.GemzMd.KjAqB',
  },
  BUILT_IN_COLOR_GROUP: '.vbVGZb',
  GOOGLE_COLOR_BUTTON: 'div[jsname="Ly0WL"]',
  ALL_COLOR_BUTTONS: '[jsname="Ly0WL"]',
  MENU_DIALOG: '[role="menu"], [role="dialog"]',
  CHECKMARK_SELECTOR: 'i.google-material-icons',
  LABEL_ELEMENT: '.oMnJrf',
  CUSTOM_CLASSES: {
    SEPARATOR: 'cf-custom-separator',
    COLOR_DIV_GROUP: 'cf-colorDivGroup',
    CUSTOM_COLOR_BUTTON: 'cf-custom-color-button',
    CATEGORY_SECTION: 'cf-category-section',
    RECURRING_DIALOG: 'cf-recurring-dialog-container',
  },
  CONTEXT_MENU: {
    CONTAINER: '.ztKZ3d',
  },
};

const DATA_ATTRIBUTES = {
  EVENT_ID: 'data-eventid',
  COLOR_MODIFIED: 'data-cf-color-modified',
  CF_COLORED: 'data-cf-event-colored',
};

const EVENT_SELECTORS = {
  EVENT_CONTAINER: '[data-eventid]',
  TEXT: '.I0UMhf, .EWOIrf, .KcY3wb',
  TIME: '.lhydbb.gVNoLb.EiZ8Dd',
  EDITOR: {
    COLOR_SELECTOR: 'div[jsname="QPiGnd"].A1wrjc.kQuqUe',
    TITLE_INPUT: '[aria-label*="Event title"], input[aria-label*="Add title"]',
  },
  VIEWER: {
    DIALOG: '#xDetDlg',
    COLOR_INDICATOR: '.xnWuge',
  },
  CALENDAR_ROOT: 'div[jsname="KL7Kx"]',
  STYLE_PROPERTIES: {
    COLORS: ['backgroundColor', 'borderColor', 'borderLeftColor', 'borderRightColor'],
  },
  CHIP: {
    CONTAINER: '[data-eventchip]',
    DRAGGABLE: '[data-draggable-id]',
    VISUAL: '.FAxxKc',
  },
};

const Scenario = {
  EVENTEDIT: 'EVENTEDIT',
  LISTVIEW: 'LISTVIEW',
  EVENTVIEW: 'EVENTVIEW',
  NEWEVENT: 'NEWEVENT',
  CALENDARLIST: 'CALENDARLIST',
};

// Helper to get window dependencies
function getEventIdUtils() {
  return window.cfEventColoring?.EventIdUtils || window.EventIdUtils;
}

function getScenarioDetector() {
  return window.cfEventColoring?.ScenarioDetector || window.ScenarioDetector;
}

function getColorSwatchModal() {
  return window.ColorSwatchModal;
}

function getEventColorModal() {
  return window.EventColorModal;
}

function getColorPalettes() {
  return window.COLOR_PALETTES || [];
}

function showRecurringEventDialog(options) {
  // Use the window global if available, otherwise provide inline implementation
  if (window.cfEventColoring?.showRecurringEventDialog) {
    return window.cfEventColoring.showRecurringEventDialog(options);
  }
  if (window.cfRecurringEventDialog?.showRecurringEventDialog) {
    return window.cfRecurringEventDialog.showRecurringEventDialog(options);
  }
  // Fallback: just apply to this event only
  console.warn('[CF] showRecurringEventDialog not available, applying to single event');
  if (options.onApplyOne) {
    options.onApplyOne();
  }
  return Promise.resolve();
}

// ========================================
// GOOGLE COLOR SCHEME MAPPING
// Modern (saturated) vs Classic (pastel) color schemes
// ========================================

// Bidirectional mapping between Modern and Classic color schemes
const GOOGLE_COLOR_SCHEME_MAP = {
  // Modern → Classic
  '#d50000': '#dc2127',  // Tomato
  '#e67c73': '#ff887c',  // Flamingo
  '#f4511e': '#ffb878',  // Tangerine
  '#f6bf26': '#fbd75b',  // Banana
  '#33b679': '#7ae7bf',  // Sage
  '#0b8043': '#51b749',  // Basil
  '#039be5': '#46d6db',  // Peacock
  '#3f51b5': '#5484ed',  // Blueberry
  '#7986cb': '#a4bdfc',  // Lavender
  '#8e24aa': '#dbadff',  // Grape
  '#616161': '#e1e1e1',  // Graphite
  // Classic → Modern
  '#dc2127': '#d50000',  // Tomato
  '#ff887c': '#e67c73',  // Flamingo
  '#ffb878': '#f4511e',  // Tangerine
  '#fbd75b': '#f6bf26',  // Banana
  '#7ae7bf': '#33b679',  // Sage
  '#51b749': '#0b8043',  // Basil
  '#46d6db': '#039be5',  // Peacock
  '#5484ed': '#3f51b5',  // Blueberry
  '#a4bdfc': '#7986cb',  // Lavender
  '#dbadff': '#8e24aa',  // Grape
  '#e1e1e1': '#616161'   // Graphite
};

// Get the equivalent color in the other scheme
function getSchemeEquivalent(hex) {
  return GOOGLE_COLOR_SCHEME_MAP[hex.toLowerCase()] || null;
}

// ColorKit's own 11 default colors (matching Google's palette but under our control)
const COLORKIT_DEFAULT_COLORS = [
  { hex: '#d50000', name: 'Tomato' },
  { hex: '#e67c73', name: 'Flamingo' },
  { hex: '#f4511e', name: 'Tangerine' },
  { hex: '#f6bf26', name: 'Banana' },
  { hex: '#33b679', name: 'Sage' },
  { hex: '#0b8043', name: 'Basil' },
  { hex: '#039be5', name: 'Peacock' },
  { hex: '#3f51b5', name: 'Blueberry' },
  { hex: '#7986cb', name: 'Lavender' },
  { hex: '#8e24aa', name: 'Grape' },
  { hex: '#616161', name: 'Graphite' },
];

// Lazy-loaded references to other modules (set when first used)
let ScenarioDetector = null;
let EventIdUtils = null;

function ensureDependencies() {
  console.log('[CF] ensureDependencies called, cfEventColoring exists:', !!window.cfEventColoring);
  if (!ScenarioDetector) {
    ScenarioDetector = getScenarioDetector();
    console.log('[CF] ScenarioDetector loaded:', !!ScenarioDetector);
  }
  if (!EventIdUtils) {
    EventIdUtils = getEventIdUtils();
    console.log('[CF] EventIdUtils loaded:', !!EventIdUtils);
  }
}

/**
 * ColorPickerInjector - Handles injection of custom colors into Google Calendar
 */
class ColorPickerInjector {
  constructor(storageService) {
    this.storageService = storageService;
    this.observerId = 'colorPickerInjector';
    this.isInjecting = false;
    this.activeModal = null;
    this.cssInjected = false;
  }

  /**
   * Initialize the injector
   */
  init() {
    console.log('[CF] ColorPickerInjector initialized');
    ensureDependencies();
    this.injectModalCSS();
  }

  /**
   * Inject CSS for the ColorSwatchModal into the page
   */
  injectModalCSS() {
    if (this.cssInjected) return;

    const styleId = 'cf-color-swatch-modal-css';
    if (document.getElementById(styleId)) {
      this.cssInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* ColorSwatchModal Styles - Injected */
      .csm-backdrop {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        z-index: 99999;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .csm-backdrop.active {
        display: block;
        opacity: 1;
      }
      .csm-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        z-index: 100000;
        width: 320px;
        max-width: 90vw;
        max-height: 80vh;
        overflow: hidden;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .csm-modal.open {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
      .csm-tabs {
        display: flex;
        gap: 4px;
        padding: 12px 12px 0;
        background: #f8f9fa;
        border-bottom: 1px solid #e8eaed;
      }
      .csm-tab {
        flex: 1;
        padding: 8px 12px;
        border: none;
        background: transparent;
        color: #5f6368;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border-radius: 6px 6px 0 0;
        transition: all 0.15s ease;
      }
      .csm-tab:hover {
        background: #e8eaed;
        color: #202124;
      }
      .csm-tab.active {
        background: #ffffff;
        color: #1a73e8;
        font-weight: 600;
      }
      .csm-content {
        padding: 16px;
        max-height: calc(80vh - 60px);
        overflow-y: auto;
      }
      .csm-helper {
        font-size: 12px;
        color: #5f6368;
        margin-bottom: 12px;
        line-height: 1.4;
      }
      .csm-hex-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 12px;
      }
      .csm-color-input {
        width: 60%;
        height: 32px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        padding: 0;
      }
      .csm-hex-input {
        flex: 1;
        height: 32px;
        padding: 0 8px;
        border: 1px solid #dadce0;
        border-radius: 6px;
        font-size: 12px;
        font-family: monospace;
        text-transform: uppercase;
        transition: border-color 0.15s ease;
      }
      .csm-hex-input:focus {
        outline: none;
        border-color: #1a73e8;
      }
      .csm-panel {
        display: none;
      }
      .csm-panel.active {
        display: block;
      }
      .csm-palette {
        display: grid;
        grid-template-columns: repeat(8, 1fr);
        gap: 6px;
      }
      .csm-swatch {
        width: 100%;
        aspect-ratio: 1;
        border-radius: 6px;
        cursor: pointer;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
        border: 2px solid transparent;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        position: relative;
      }
      .csm-swatch:hover {
        transform: scale(1.1);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        z-index: 1;
      }
      .csm-swatch.selected {
        border-color: #1a73e8;
        box-shadow: 0 0 0 2px #1a73e8;
      }
      .csm-swatch.selected::after {
        content: '\\2713';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 12px;
        font-weight: bold;
        color: white;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      }
      .csm-empty-state {
        text-align: center;
        padding: 24px 16px;
        color: #5f6368;
      }
      .csm-empty-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }
      .csm-empty-text {
        font-weight: 600;
        margin-bottom: 4px;
        color: #202124;
      }
      .csm-empty-subtext {
        font-size: 12px;
        color: #80868b;
      }
      /* Custom color button (+) */
      .cf-custom-color-btn {
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 2px dashed #9aa0a6;
        background: #f8f9fa;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        font-weight: 500;
        color: #5f6368;
        transition: all 0.15s ease;
      }
      .cf-custom-color-btn:hover {
        border-color: #1a73e8;
        background: #e8f0fe;
        color: #1a73e8;
        transform: scale(1.1);
      }

      /* Mode Toggle Styles */
      .cf-mode-section {
        padding: 12px 16px;
        border-bottom: 1px solid #e0e0e0;
      }
      .cf-mode-section:last-child {
        border-bottom: none;
      }
      .cf-toggle-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .cf-toggle-content {
        flex: 1;
        min-width: 0;
      }
      .cf-toggle-title {
        font-size: 13px;
        font-weight: 500;
        color: #202124;
        margin-bottom: 2px;
      }
      .cf-toggle-desc {
        font-size: 11px;
        color: #5f6368;
        line-height: 1.3;
      }
      .cf-switch {
        position: relative;
        width: 36px;
        height: 20px;
        background: #dadce0;
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.2s ease;
        flex-shrink: 0;
      }
      .cf-switch.active {
        background: #1a73e8;
      }
      .cf-switch::after {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        background: white;
        border-radius: 50%;
        top: 2px;
        left: 2px;
        transition: left 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
      }
      .cf-switch.active::after {
        left: 18px;
      }
      .cf-section-disabled {
        opacity: 0.5;
        pointer-events: none;
      }
      .cf-section-disabled .cf-switch {
        pointer-events: auto;
        opacity: 1;
      }

      /* Pro Badge */
      .cf-pro-badge {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-left: 6px;
        display: inline-block;
      }

      /* Section Label */
      .cf-section-label {
        font-size: 11px;
        font-weight: 600;
        color: #5f6368;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 12px 0 8px 0;
      }

      /* Delete Row */
      .cf-delete-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        cursor: pointer;
        transition: background 0.15s ease;
        border-radius: 6px;
        margin: 0 4px;
      }
      .cf-delete-row:hover {
        background: #fce8e6;
      }
      .cf-delete-icon {
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #5f6368;
      }
      .cf-delete-text {
        font-size: 13px;
        color: #5f6368;
      }

      /* Full Custom Coloring Row */
      .cf-full-custom-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        background: #f8f9fa;
        border: 1px solid #e8eaed;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        margin-top: 8px;
      }
      .cf-full-custom-row:hover {
        background: #e8f0fe;
        border-color: #1a73e8;
      }
      .cf-full-custom-icon {
        width: 32px;
        height: 32px;
        background: #e8eaed;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 18px;
        color: #5f6368;
      }
      .cf-full-custom-content {
        flex: 1;
      }
      .cf-full-custom-title {
        font-size: 13px;
        font-weight: 500;
        color: #202124;
      }
      .cf-full-custom-desc {
        font-size: 11px;
        color: #5f6368;
        margin-top: 2px;
      }

      /* Confirmation Modal */
      .cf-confirm-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.4);
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .cf-confirm-backdrop.active {
        opacity: 1;
      }
      .cf-confirm-modal {
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 360px;
        width: 90%;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        transform: scale(0.95);
        transition: transform 0.2s ease;
      }
      .cf-confirm-backdrop.active .cf-confirm-modal {
        transform: scale(1);
      }
      .cf-confirm-title {
        font-size: 16px;
        font-weight: 600;
        color: #202124;
        margin: 0 0 12px 0;
      }
      .cf-confirm-message {
        font-size: 14px;
        color: #5f6368;
        line-height: 1.5;
        margin: 0 0 16px 0;
      }
      .cf-confirm-checkbox {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 20px;
        cursor: pointer;
      }
      .cf-confirm-checkbox input {
        width: 16px;
        height: 16px;
        cursor: pointer;
      }
      .cf-confirm-checkbox label {
        font-size: 13px;
        color: #5f6368;
        cursor: pointer;
      }
      .cf-confirm-buttons {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }
      .cf-confirm-btn {
        padding: 8px 16px;
        border-radius: 6px;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .cf-confirm-btn-cancel {
        background: transparent;
        border: 1px solid #dadce0;
        color: #5f6368;
      }
      .cf-confirm-btn-cancel:hover {
        background: #f8f9fa;
      }
      .cf-confirm-btn-confirm {
        background: #1a73e8;
        border: none;
        color: white;
      }
      .cf-confirm-btn-confirm:hover {
        background: #1557b0;
      }
      .cf-confirm-btn-danger {
        background: #d93025;
      }
      .cf-confirm-btn-danger:hover {
        background: #b3261e;
      }

      /* Templates Section */
      .cf-templates-section {
        margin-top: 12px;
      }
      .cf-templates-label {
        display: flex;
        align-items: center;
        font-size: 11px;
        font-weight: 600;
        color: #5f6368;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin-bottom: 8px;
      }
      .cf-template-item {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 16px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.15s ease;
        margin: 2px;
        border: 2px solid transparent;
      }
      .cf-template-item:hover {
        transform: scale(1.05);
      }
      .cf-template-item.selected {
        border-color: #1a73e8;
      }

      /* Default Colors Grid */
      .cf-default-colors-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }
    `;
    document.head.appendChild(style);
    this.cssInjected = true;
    console.log('[CF] Modal CSS injected');
  }

  /**
   * Create the "+" button for opening custom color picker
   * @param {HTMLElement} container - Color picker container
   * @param {string} scenario - Current scenario (EVENTEDIT or LISTVIEW)
   * @returns {HTMLElement} The button element
   */
  createCustomColorButton(container, scenario) {
    const button = document.createElement('div');
    button.className = 'cf-custom-color-btn';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', 'Choose custom color');
    button.setAttribute('title', 'Choose custom color');
    button.textContent = '+';

    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const eventId = ScenarioDetector.findEventIdByScenario(container, scenario);
      if (!eventId) {
        console.error('[CF] Could not find event ID for custom color');
        return;
      }

      // Close existing menus first
      this.closeMenus();

      // Open the color swatch modal
      this.openCustomColorModal(eventId);
    });

    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        button.click();
      }
    });

    return button;
  }

  /**
   * Open the custom color swatch modal (with bg/text/border tabs)
   * @param {string} eventId - The event ID to apply color to
   */
  async openCustomColorModal(eventId) {
    // Clean up any orphaned backdrop/modal elements from previous instances
    // This prevents the UI from becoming unclickable due to stale backdrops
    document.querySelectorAll('.ecm-backdrop, .csm-backdrop').forEach(el => el.remove());
    document.querySelectorAll('.ecm-modal, .csm-modal').forEach(el => el.remove());

    // Close any existing modal instance
    if (this.activeModal) {
      this.activeModal.close();
      this.activeModal = null;
    }

    // Get current colors for this event (use new full format)
    const getColors = this.storageService.findEventColorFull || this.storageService.findEventColor;
    const colorData = await getColors?.(eventId);

    // Also get calendar default colors to merge with event colors
    const calendarColors = await this.storageService.getEventCalendarColors?.();
    const calendarId = this.getCalendarIdForEvent(eventId);
    const calendarDefaults = calendarId ? calendarColors?.[calendarId] : null;

    // Merge: event colors take precedence, calendar colors fill in gaps
    const currentColors = {
      background: colorData?.background || colorData?.hex || null,
      text: colorData?.text || null,
      border: colorData?.border || null,
      // Use event borderWidth, fall back to calendar borderWidth, then default to 2
      borderWidth: colorData?.borderWidth || calendarDefaults?.borderWidth || 2,
    };

    // Get colors from DOM (bypasses cache to get Google's actual current colors)
    // Find event element in calendar (prefer calendar over dialog since dialog may not have stripe)
    const allEventElements = document.querySelectorAll(`[data-eventid="${eventId}"]`);
    let calendarEventElement = null;
    let dialogEventElement = null;
    for (const el of allEventElements) {
      if (!el.closest('[role="dialog"]')) {
        calendarEventElement = el;
        break;  // Prefer calendar element (has stripe)
      } else if (!dialogEventElement) {
        dialogEventElement = el;  // Keep as fallback
      }
    }

    const eventElement = calendarEventElement || dialogEventElement;

    // IMPORTANT: Read stripe and background SEPARATELY
    // - Stripe (.jSrjCf) = calendar's default color (doesn't change with Google's 12-color picker)
    // - Event background = actual event color (changes when user picks from Google's 12 colors)
    const currentStripeColor = this.getStripeOnlyFromDOM(eventElement);
    const currentEventBackground = this.getEventBackgroundFromDOM(eventElement);
    const currentTextColor = this.getTextColorFromDOM(eventElement);

    // Get event title from DOM
    let eventTitle = 'Sample Event';
    if (eventElement) {
      const titleEl = eventElement.querySelector('.I0UMhf') || eventElement.querySelector('.lhydbb');
      if (titleEl) {
        eventTitle = titleEl.textContent?.trim() || 'Sample Event';
      }
    }

    // Build originalColors for preview fallback:
    // - Background: list coloring > event's actual background (Google's 12-color) > stripe > default
    // - Text: list coloring > DOM text color (Google's auto black/white) > null (let modal calculate)
    // - stripeColor: stripe element's color (calendar's default, doesn't change with Google's 12-color)
    const originalColors = {
      background: calendarDefaults?.background || currentEventBackground || currentStripeColor || '#039be5',
      text: calendarDefaults?.text || currentTextColor || null,  // Include Google's auto text color
      border: calendarDefaults?.border || null,
      stripeColor: currentStripeColor || currentEventBackground || '#039be5',
    };

    console.log('[CF] Opening EventColorModal with colors:', currentColors, 'originalColors:', originalColors, 'calendarDefaults:', calendarDefaults);
    console.log('[CF] DOM colors - stripe:', currentStripeColor, 'eventBg:', currentEventBackground, 'text:', currentTextColor);

    this.activeModal = new EventColorModal({
      id: `cf-event-color-modal-${Date.now()}`,
      currentColors,
      originalColors,
      eventTitle,
      eventId,  // For freemium gating
      onApply: async (colors) => {
        console.log('[CF] Event colors applied:', colors);
        await this.handleFullColorSelect(eventId, colors);
      },
      onClose: () => {
        this.activeModal = null;
      },
    });

    this.activeModal.open();
  }

  /**
   * Get ONLY the stripe color from the DOM (calendar's default color).
   * The stripe (.jSrjCf) represents the calendar's color, which doesn't change
   * when user picks from Google's 12-color event picker.
   * @param {HTMLElement} element - The event element
   * @returns {string|null} - The stripe hex color or null
   */
  getStripeOnlyFromDOM(element) {
    if (!element) return null;

    // Read ONLY from the sidebar stripe element
    const sidebarStripe = element.querySelector('.jSrjCf');
    if (sidebarStripe) {
      const stripeStyle = window.getComputedStyle(sidebarStripe);
      const stripeColor = stripeStyle.backgroundColor;
      if (stripeColor && stripeColor !== 'rgba(0, 0, 0, 0)' && stripeColor !== 'transparent') {
        return this.rgbToHex(stripeColor);
      }
    }

    return null;
  }

  /**
   * Get the event's actual BACKGROUND color from the DOM.
   * This is the color that changes when user picks from Google's 12-color picker.
   * Reads from the event element itself, NOT the stripe.
   * @param {HTMLElement} element - The event element
   * @returns {string|null} - The event background hex color or null
   */
  getEventBackgroundFromDOM(element) {
    if (!element) return null;

    // Read directly from the event element's background (not stripe)
    const computedStyle = window.getComputedStyle(element);
    const bgColor = computedStyle.backgroundColor;
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
      return this.rgbToHex(bgColor);
    }

    return null;
  }

  /**
   * Get the text color from the DOM (Google's auto black/white).
   * Reads from the title element inside the event.
   * @param {HTMLElement} element - The event element
   * @returns {string|null} - The text hex color or null
   */
  getTextColorFromDOM(element) {
    if (!element) return null;

    // Read from the title element (same selectors as used elsewhere)
    const titleEl = element.querySelector('.I0UMhf') || element.querySelector('.lhydbb');
    if (titleEl) {
      const titleStyle = window.getComputedStyle(titleEl);
      const textColor = titleStyle.color;
      if (textColor && textColor !== 'rgba(0, 0, 0, 0)' && textColor !== 'transparent') {
        return this.rgbToHex(textColor);
      }
    }

    return null;
  }

  /**
   * Convert RGB string to hex
   * @param {string} rgb - RGB color string like "rgb(255, 0, 0)"
   * @returns {string|null} - Hex color like "#ff0000" or null
   */
  rgbToHex(rgb) {
    if (!rgb) return null;
    if (rgb.startsWith('#')) return rgb;

    const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (!match) return null;

    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');

    return `#${r}${g}${b}`;
  }

  /**
   * Get calendar ID for an event
   * @param {string} eventId - Encoded event ID
   * @returns {string|null} Calendar ID (email) or null
   */
  getCalendarIdForEvent(eventId) {
    try {
      const parsed = EventIdUtils.fromEncoded(eventId);
      return parsed.emailSuffix || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Main injection method - called when DOM changes detected
   */
  async injectColorPicker() {
    if (this.isInjecting) return;
    this.isInjecting = true;

    try {
      // Check if custom colors are disabled
      const isDisabled = await this.storageService.getIsCustomColorsDisabled?.();
      if (isDisabled) {
        await this.modifyGoogleColorLabels();
        this.isInjecting = false;
        return;
      }

      // Check if already injected (check for new redesigned container first)
      const existingPickerContainer = document.querySelector('.cf-picker-container');
      const existingCustomSection = document.querySelector(
        '.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.COLOR_DIV_GROUP
      );
      const existingSeparator = document.querySelector(
        '.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.SEPARATOR
      );
      const existingCustomColorSection = document.querySelector('.cf-custom-color-section');

      if (existingPickerContainer || existingCustomSection || existingSeparator || existingCustomColorSection) {
        this.isInjecting = false;
        return;
      }

      // Get categories from storage
      const categories = await this.storageService.getEventColorCategories?.();
      const categoryList = categories ? Object.values(categories) : [];

      // Inject categories (even if empty, we still inject the "+" button)
      // NOTE: Must await since injectColorCategories is now async
      await this.injectColorCategories(categoryList);

      // Update checkmarks and Google color labels
      await this.hideCheckmarkAndModifyBuiltInColors();
    } catch (error) {
      console.error('[CF] Error injecting color picker:', error);
    }

    this.isInjecting = false;
  }

  /**
   * Inject color categories into the color picker
   * Redesigned with binary ownership model: Google Mode vs ColorKit Mode
   * @returns {Promise<boolean>} true if injection succeeded, false if failed
   */
  async injectColorCategories(categories) {
    console.log('[CF] Injecting categories (redesigned):', categories?.length || 0);

    // Ensure dependencies are loaded
    ensureDependencies();

    if (!ScenarioDetector) {
      console.error('[CF] ScenarioDetector not available!');
      return false;
    }

    try {
      console.log('[CF] Finding scenario...');
      const scenario = ScenarioDetector.findColorPickerScenario();
      console.log('[CF] Scenario found:', scenario);

    if (scenario !== Scenario.EVENTEDIT && scenario !== Scenario.LISTVIEW) {
      console.log('[CF] Not injecting for scenario:', scenario);
      return false;
    }

    // Find the color picker container
    console.log('[CF] Looking for color picker container...');
    const editorContainer = document.querySelector(
      COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR
    );
    const listContainer = document.querySelector(
      COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST
    );
    console.log('[CF] Editor container:', !!editorContainer, 'List container:', !!listContainer);
    const container = listContainer || editorContainer;

    if (!container) {
      console.log('[CF] No color picker container found');
      return false;
    }

    // Get event ID
    console.log('[CF] Finding event ID...');
    const eventId = ScenarioDetector.findEventIdByScenario(container, scenario);
    console.log('[CF] Event ID:', eventId ? eventId.slice(0, 30) + '...' : null);
    if (!eventId) {
      console.log('[CF] No event ID found');
      return false;
    }

    // Detect current mode (google or colorkit)
    let currentMode = 'google';
    if (window.cfEventColoring?.detectCurrentMode) {
      currentMode = await window.cfEventColoring.detectCurrentMode(eventId);
    } else {
      // Fallback: check if we have ColorKit colors
      const colorData = await this.storageService.findEventColorFull?.(eventId);
      if (colorData && !colorData.useGoogleColors) {
        currentMode = 'colorkit';
      }
    }
    console.log('[CF] Current mode:', currentMode);

    // Get current color for this event
    let currentColor = null;
    const colorData = await this.storageService.findEventColorFull?.(eventId);
    if (colorData) {
      currentColor = colorData.background || colorData.hex;
    }

    // Find the scrollable wrapper
    const wrapper = container.querySelector('div');
    if (!wrapper) {
      console.log('[CF] No wrapper found');
      return false;
    }

    // Hide Google's built-in color group - we'll provide our own UI
    const innerGroup = wrapper.querySelector(COLOR_PICKER_SELECTORS.BUILT_IN_COLOR_GROUP);
    if (innerGroup) {
      innerGroup.style.display = 'none';
    }

    // Style the wrapper for scrolling
    wrapper.style.cssText = `
      max-height: ${scenario === Scenario.EVENTEDIT ? '600px' : '500px'} !important;
      max-width: ${scenario === Scenario.EVENTEDIT ? '240px' : '300px'} !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding-bottom: 12px !important;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    `;

    // Create our redesigned UI container
    const cfContainer = document.createElement('div');
    cfContainer.className = 'cf-picker-container';

    // ========================================
    // 1. DELETE ROW (at top)
    // ========================================
    const deleteRow = this.createDeleteRow(container, scenario);
    cfContainer.appendChild(deleteRow);

    // Add separator
    cfContainer.appendChild(this.createSeparator());

    // ========================================
    // 2. GOOGLE'S OWN COLORS TOGGLE SECTION
    // ========================================
    const googleSection = this.createToggleSection({
      title: "Googles own colors",
      description: "Use Google's built-in colors. Syncs across devices.",
      isActive: currentMode === 'google',
      onChange: (isActive) => {
        if (isActive && currentMode !== 'google') {
          this.handleModeSwitch('google', eventId, container);
        }
      },
    });

    // Add Google's 11 color buttons below the toggle (visible when in Google mode)
    const googleColorsContent = document.createElement('div');
    googleColorsContent.className = 'cf-google-colors-content';
    googleColorsContent.style.cssText = 'padding: 12px 16px 0; display: flex; flex-wrap: wrap; gap: 6px;';

    // Create Google color buttons
    COLORKIT_DEFAULT_COLORS.forEach((colorObj) => {
      const button = this.createColorButton(colorObj, container, scenario);
      button.style.width = '22px';
      button.style.height = '22px';
      googleColorsContent.appendChild(button);
    });

    googleSection.appendChild(googleColorsContent);
    cfContainer.appendChild(googleSection);

    // ========================================
    // 3. COLORKIT LIST COLOR TOGGLE SECTION
    // ========================================
    const calendarId = this.getCalendarIdForEvent(eventId);
    const calendarDefaults = await this.storageService.getEventCalendarColor?.(calendarId);
    const hasListColor = !!(calendarDefaults?.background || calendarDefaults?.text || calendarDefaults?.border);

    const listColorSection = this.createToggleSection({
      title: "ColorKit List Color",
      description: "Choose to use calendar default or completely custom coloring below",
      isActive: hasListColor && currentMode === 'colorkit',
      disabled: currentMode !== 'colorkit',
      proBadge: true,
      onChange: async (isActive) => {
        if (isActive && hasListColor) {
          // Apply list color
          await this.handleResetToListDefaults(eventId);
        }
      },
    });

    // Add calendar preview if available
    if (calendarId) {
      const previewContainer = document.createElement('div');
      previewContainer.style.cssText = 'padding: 8px 16px; display: flex; align-items: center; gap: 8px;';

      const stripeColor = window.cfEventColoring?.getStripeColorForCalendar?.(calendarId) || '#039be5';
      const stripePreview = document.createElement('div');
      stripePreview.style.cssText = `width: 4px; height: 24px; background: ${stripeColor}; border-radius: 2px;`;

      const calendarLabel = document.createElement('span');
      calendarLabel.style.cssText = 'font-size: 12px; color: #5f6368;';
      calendarLabel.textContent = calendarId.split('@')[0] || 'Google Calendar';

      previewContainer.appendChild(stripePreview);
      previewContainer.appendChild(calendarLabel);
      listColorSection.appendChild(previewContainer);
    }

    cfContainer.appendChild(listColorSection);

    // ========================================
    // 4. COLORKITS COLORS TOGGLE SECTION
    // ========================================
    const colorKitSection = this.createToggleSection({
      title: "ColorKits Colors",
      description: "Use custom colors with text & border options.",
      isActive: currentMode === 'colorkit',
      onChange: (isActive) => {
        if (isActive && currentMode !== 'colorkit') {
          this.handleModeSwitch('colorkit', eventId, container);
        }
      },
    });

    // ColorKit content container (visible when ColorKit mode is active)
    const colorKitContent = document.createElement('div');
    colorKitContent.className = 'cf-colorkit-content';
    colorKitContent.style.cssText = 'padding: 8px 16px;';

    // Full Custom Coloring row
    const fullCustomRow = this.createFullCustomRow(container, scenario);
    colorKitContent.appendChild(fullCustomRow);

    colorKitSection.appendChild(colorKitContent);
    cfContainer.appendChild(colorKitSection);

    // Add separator
    cfContainer.appendChild(this.createSeparator());

    // ========================================
    // 5. BACKGROUND COLORS SECTION
    // ========================================
    const bgColorsSection = document.createElement('div');
    bgColorsSection.className = 'cf-bg-colors-section cf-mode-section';
    bgColorsSection.style.padding = '12px 16px';

    // "Googles Default Colors" label
    const defaultColorsLabel = document.createElement('div');
    defaultColorsLabel.className = 'cf-section-label';
    defaultColorsLabel.textContent = 'Googles Default Colors';
    bgColorsSection.appendChild(defaultColorsLabel);

    // Default colors grid
    const defaultColorsGrid = this.createDefaultColorsGrid(container, scenario, currentColor);
    bgColorsSection.appendChild(defaultColorsGrid);

    // Add user categories
    if (categories.length > 0) {
      categories.forEach((category) => {
        const categorySection = this.createCategorySection(category, container, scenario);
        if (categorySection) {
          categorySection.style.marginTop = '16px';
          bgColorsSection.appendChild(categorySection);
        }
      });
    }

    // Templates section
    const templates = await this.storageService.getEventColorTemplates?.();
    const templatesList = templates ? Object.values(templates) : [];

    if (templatesList.length > 0) {
      const templatesSection = document.createElement('div');
      templatesSection.className = 'cf-templates-section';

      const templatesLabel = document.createElement('div');
      templatesLabel.className = 'cf-templates-label';
      templatesLabel.innerHTML = `<span>TEMPLATES</span><span class="cf-pro-badge">PRO</span>`;
      templatesSection.appendChild(templatesLabel);

      const templatesGrid = document.createElement('div');
      templatesGrid.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';

      templatesList.forEach((template) => {
        const templateBtn = document.createElement('div');
        templateBtn.className = 'cf-template-item';
        templateBtn.style.cssText = `
          background: ${template.background || '#e8eaed'};
          color: ${template.text || this.getContrastColor(template.background || '#e8eaed')};
          ${template.border ? `border: 2px solid ${template.border};` : ''}
        `;
        templateBtn.textContent = template.name;
        templateBtn.addEventListener('click', async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await this.handleTemplateClick(eventId, template);
        });
        templatesGrid.appendChild(templateBtn);
      });

      templatesSection.appendChild(templatesGrid);
      bgColorsSection.appendChild(templatesSection);
    }

    cfContainer.appendChild(bgColorsSection);

    // Add our container to the wrapper
    wrapper.appendChild(cfContainer);

    // ========================================
    // 6. UPDATE SECTION STATES
    // ========================================
    this.updateSectionStates(currentMode, {
      googleSection,
      colorKitSection,
      listColorSection,
    });

    // Apply disabled state to background colors when in Google mode
    if (currentMode === 'google') {
      bgColorsSection.classList.add('cf-section-disabled');
    }

    // Update Google color labels
    await this.modifyGoogleColorLabels();

    console.log('[CF] Color picker UI injection completed');
    return true;
    } catch (error) {
      console.error('[CF] Error injecting color categories:', error);
      return false;
    }
  }

  /**
   * Handle template click
   * @param {string} eventId - Event ID
   * @param {Object} template - Template object
   */
  async handleTemplateClick(eventId, template) {
    const parsed = EventIdUtils.fromEncoded(eventId);

    // Check for premium features
    const hasPremiumFeatures = template.text || template.border;
    if (hasPremiumFeatures && window.cc3FeatureAccess?.usesPremiumEventColorFeatures) {
      const canUse = await window.cc3FeatureAccess.usesPremiumEventColorFeatures();
      if (!canUse) {
        // Show upgrade modal
        if (window.cc3FeatureAccess?.showUpgradeModal) {
          window.cc3FeatureAccess.showUpgradeModal('event-coloring-templates');
        }
        return;
      }
    }

    // Get stripe color
    let stripeColor = '#039be5';
    if (window.cfEventColoring?.getStripeColorForEvent) {
      stripeColor = window.cfEventColoring.getStripeColorForEvent(eventId);
    }

    const colors = {
      background: template.background,
      text: template.text || null,
      border: template.border || null,
      borderWidth: template.borderWidth || 2,
      stripeColor,
    };

    if (parsed.isRecurring) {
      showRecurringEventDialog({
        eventId,
        color: colors.background,
        onConfirm: async (applyToAll) => {
          await this.storageService.saveEventColorsFullAdvanced(eventId, colors, { applyToAll });
          this.closeMenus();
          this.triggerColorUpdate();
        },
        onClose: () => {},
      });
    } else {
      await this.storageService.saveEventColorsFullAdvanced(eventId, colors, { applyToAll: false });
      this.closeMenus();
      this.triggerColorUpdate();
    }
  }

  /**
   * Get contrasting text color for a background
   * @param {string} bgColor - Background hex color
   * @returns {string} - Black or white hex color
   */
  getContrastColor(bgColor) {
    if (!bgColor) return '#000000';
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  /**
   * Create the "Custom Color" section with the "+" button and reset actions
   */
  createCustomColorSection(container, scenario) {
    const section = document.createElement('div');
    section.className = 'cf-custom-color-section';
    section.style.marginTop = '16px';

    // Label
    const label = document.createElement('div');
    label.className = 'color-category-label';
    label.textContent = 'Custom';
    label.style.cssText = `
      font-size: 12px;
      font-weight: 500;
      color: #202124;
      margin: 0 12px 12px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    `;

    // Container for button
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
      padding: 0 12px 0 0;
    `;

    // Add the "+" button
    const customButton = this.createCustomColorButton(container, scenario);
    buttonContainer.appendChild(customButton);

    section.appendChild(label);
    section.appendChild(buttonContainer);

    // Add Reset Actions section
    const resetSection = this.createResetActionsSection(container, scenario);
    section.appendChild(resetSection);

    return section;
  }

  /**
   * Create the Reset Actions section with "Remove all coloring" and "Reset to list defaults" buttons
   */
  createResetActionsSection(container, scenario) {
    const section = document.createElement('div');
    section.className = 'cf-reset-actions-section';
    section.style.cssText = `
      margin-top: 16px;
      border-top: 1px solid #e8eaed;
      padding-top: 12px;
    `;

    // Label
    const label = document.createElement('div');
    label.textContent = 'Reset Options';
    label.style.cssText = `
      font-size: 11px;
      font-weight: 500;
      color: #5f6368;
      margin: 0 0 10px 0;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    `;

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 6px;
    `;

    // "Remove all coloring" button
    const removeAllBtn = this.createResetButton(
      'Remove all coloring',
      'Return to Google Calendar colors',
      container,
      scenario,
      'removeAll'
    );

    // "Reset to list defaults" button
    const resetToListBtn = this.createResetButton(
      'Reset to list defaults',
      'Apply calendar list colors',
      container,
      scenario,
      'resetToList'
    );

    buttonsContainer.appendChild(removeAllBtn);
    buttonsContainer.appendChild(resetToListBtn);

    section.appendChild(label);
    section.appendChild(buttonsContainer);

    return section;
  }

  /**
   * Create a reset action button
   * @param {string} title - Button title
   * @param {string} subtitle - Helper text
   * @param {HTMLElement} container - Color picker container
   * @param {string} scenario - Current scenario
   * @param {string} action - 'removeAll' or 'resetToList'
   */
  createResetButton(title, subtitle, container, scenario, action) {
    const button = document.createElement('button');
    button.className = `cf-reset-btn cf-reset-${action}`;
    button.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
      padding: 8px 12px;
      background: #f8f9fa;
      border: 1px solid #dadce0;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
    `;

    const titleEl = document.createElement('span');
    titleEl.textContent = title;
    titleEl.style.cssText = `
      font-size: 13px;
      font-weight: 500;
      color: #202124;
      line-height: 1.3;
    `;

    const subtitleEl = document.createElement('span');
    subtitleEl.textContent = subtitle;
    subtitleEl.style.cssText = `
      font-size: 11px;
      color: #5f6368;
      margin-top: 2px;
    `;

    button.appendChild(titleEl);
    button.appendChild(subtitleEl);

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.background = '#e8eaed';
      button.style.borderColor = '#c6c6c6';
    });

    button.addEventListener('mouseleave', () => {
      button.style.background = '#f8f9fa';
      button.style.borderColor = '#dadce0';
    });

    // Click handler
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const eventId = ScenarioDetector.findEventIdByScenario(container, scenario);
      if (!eventId) {
        console.error('[CF] Could not find event ID for reset action');
        return;
      }

      if (action === 'removeAll') {
        await this.handleRemoveAllColoring(eventId);
      } else if (action === 'resetToList') {
        await this.handleResetToListDefaults(eventId);
      }
    });

    return button;
  }

  /**
   * Remove all custom coloring from an event, returning it to Google's native colors
   * For recurring events, removes ALL instance colors
   * Uses markEventForGoogleColors to store a flag that bypasses list defaults
   * @param {string} eventId - Event ID
   */
  async handleRemoveAllColoring(eventId) {
    const parsed = EventIdUtils.fromEncoded(eventId);

    if (parsed.isRecurring) {
      // Show recurring event dialog with custom options for removal
      showRecurringEventDialog({
        eventId,
        color: null,
        showColorPreview: false,
        dialogTitle: 'Remove Coloring',
        dialogMessage: 'This is a recurring event. Remove coloring from:',
        allEventsLabel: 'All events in series',
        thisOnlyLabel: 'This event only',
        onConfirm: async (applyToAll) => {
          console.log('[CF] Remove coloring confirmed, applyToAll:', applyToAll);

          if (applyToAll) {
            // Mark ALL events in series to use Google colors (bypasses list defaults)
            if (this.storageService.markRecurringEventForGoogleColors) {
              await this.storageService.markRecurringEventForGoogleColors(eventId);
            } else {
              // Fallback: mark just this event
              await this.storageService.markEventForGoogleColors(eventId);
            }
          } else {
            // Mark only this instance to use Google colors
            await this.storageService.markEventForGoogleColors(eventId);
          }

          this.closeMenus();
          // Force reload to ensure Google's colors are re-applied
          window.location.reload();
        },
        onClose: () => {
          console.log('[CF] Remove coloring dialog closed');
        },
      });
    } else {
      // Single event - mark to use Google colors (bypasses list defaults)
      await this.storageService.markEventForGoogleColors(eventId);
      this.closeMenus();
      window.location.reload();
    }
  }

  /**
   * Reset event to calendar list default colors
   * This removes custom colors so calendar defaults apply via mergeEventColors
   * @param {string} eventId - Event ID
   */
  async handleResetToListDefaults(eventId) {
    const parsed = EventIdUtils.fromEncoded(eventId);

    // Get calendar defaults for this event
    const calendarId = this.getCalendarIdForEvent(eventId);
    const calendarDefaults = await this.storageService.getEventCalendarColor?.(calendarId);

    // If no calendar defaults exist, inform user
    if (!calendarDefaults || (!calendarDefaults.background && !calendarDefaults.text && !calendarDefaults.border)) {
      this.showNoListDefaultsDialog(eventId, parsed.isRecurring);
      return;
    }

    if (parsed.isRecurring) {
      showRecurringEventDialog({
        eventId,
        color: calendarDefaults.background,
        dialogTitle: 'Reset to List Defaults',
        dialogMessage: 'This is a recurring event. Apply list defaults to:',
        allEventsLabel: 'All events in series',
        thisOnlyLabel: 'This event only',
        onConfirm: async (applyToAll) => {
          console.log('[CF] Reset to list defaults confirmed, applyToAll:', applyToAll);

          // Remove existing custom colors to let list defaults apply
          if (applyToAll) {
            if (this.storageService.removeRecurringEventColors) {
              await this.storageService.removeRecurringEventColors(eventId);
            } else {
              await this.storageService.removeEventColor(eventId);
            }
          } else {
            await this.storageService.removeEventColor(eventId);
          }

          this.closeMenus();
          this.triggerColorUpdate();
        },
        onClose: () => {},
      });
    } else {
      // Single event - just remove custom color to let list defaults apply
      await this.storageService.removeEventColor(eventId);
      this.closeMenus();
      this.triggerColorUpdate();
    }
  }

  /**
   * Show dialog when no list defaults exist for calendar
   */
  showNoListDefaultsDialog(eventId, isRecurring) {
    // Remove existing dialogs
    document.querySelectorAll('.cf-no-defaults-dialog').forEach(el => el.remove());

    const container = document.createElement('div');
    container.className = 'cf-no-defaults-dialog';
    container.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
    `;

    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: relative;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      padding: 24px;
      max-width: 380px;
      z-index: 1;
      text-align: center;
    `;

    const title = document.createElement('h3');
    title.textContent = 'No List Defaults Set';
    title.style.cssText = 'margin: 0 0 12px; font-size: 16px; color: #202124;';

    const message = document.createElement('p');
    message.textContent = 'This calendar has no default colors configured. You can set list defaults in the extension popup under "Calendar List Colors".';
    message.style.cssText = 'margin: 0 0 20px; font-size: 14px; color: #5f6368; line-height: 1.5;';

    const removeInsteadBtn = document.createElement('button');
    removeInsteadBtn.textContent = 'Remove custom coloring instead';
    removeInsteadBtn.style.cssText = `
      background: #1a73e8;
      color: white;
      border: none;
      border-radius: 6px;
      padding: 10px 16px;
      font-size: 14px;
      cursor: pointer;
      width: 100%;
      margin-bottom: 8px;
    `;
    removeInsteadBtn.addEventListener('click', async () => {
      container.remove();
      await this.handleRemoveAllColoring(eventId);
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #5f6368;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
    `;
    cancelBtn.addEventListener('click', () => container.remove());

    overlay.addEventListener('click', () => container.remove());

    dialog.appendChild(title);
    dialog.appendChild(message);
    dialog.appendChild(removeInsteadBtn);
    dialog.appendChild(cancelBtn);
    container.appendChild(overlay);
    container.appendChild(dialog);
    document.body.appendChild(container);
  }

  /**
   * Create a separator line
   */
  createSeparator() {
    const separator = document.createElement('div');
    separator.style.cssText = `
      border-top: 1px solid #dadce0;
      margin: 8px 0;
    `;
    return separator;
  }

  /**
   * Create a category section with color buttons
   */
  createCategorySection(category, container, scenario) {
    console.log('[CF] Creating category section:', category.name);

    const section = document.createElement('div');
    section.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CATEGORY_SECTION;
    section.style.marginTop = '16px';

    // Category label
    const label = document.createElement('div');
    label.className = 'color-category-label';
    label.textContent = category.name;
    label.style.cssText = `
      font-size: 12px;
      font-weight: 500;
      color: #202124;
      margin: 0 12px 12px 0;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    `;

    // Colors container
    const colorsContainer = document.createElement('div');
    colorsContainer.className = `vbVGZb ${COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.COLOR_DIV_GROUP}`;
    colorsContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
      padding: 0 12px 0 0;
      width: 100%;
      box-sizing: border-box;
    `;

    // Add color buttons
    if (Array.isArray(category.colors)) {
      console.log('[CF] Adding', category.colors.length, 'colors for', category.name);

      category.colors.forEach((colorObj) => {
        const colorButton = this.createColorButton(colorObj, container, scenario);
        colorsContainer.appendChild(colorButton);
      });
    }

    section.appendChild(label);
    section.appendChild(colorsContainer);

    return section;
  }

  /**
   * Create a single color button
   */
  createColorButton(colorObj, container, scenario) {
    const hex = typeof colorObj === 'string' ? colorObj : colorObj.hex;
    const name = typeof colorObj === 'object' ? colorObj.name : hex;

    const button = document.createElement('div');
    button.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CUSTOM_COLOR_BUTTON;
    button.setAttribute('data-color', hex);
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', name || hex);

    button.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background-color: ${hex};
      cursor: pointer;
      position: relative;
      transition: transform 0.1s, box-shadow 0.1s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    `;

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      button.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
    });

    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)';
    });

    // Click handler
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const eventId = ScenarioDetector.findEventIdByScenario(container, scenario);
      if (eventId) {
        await this.handleColorSelect(eventId, hex);
      }

      // Close menus
      this.closeMenus();
    });

    // Keyboard support
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        button.click();
      }
    });

    // Add checkmark (hidden by default)
    const checkmark = document.createElement('i');
    checkmark.className = 'google-material-icons';
    checkmark.textContent = 'check';
    checkmark.style.cssText = `
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 16px;
      color: white;
      display: none;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    `;
    button.appendChild(checkmark);

    return button;
  }

  /**
   * Check if event has non-background properties that would be lost
   */
  hasNonBackgroundProperties(existingColors, calendarDefaults) {
    if (!existingColors && !calendarDefaults) return false;

    // Check event-level properties first
    const hasEventText = !!existingColors?.text;
    const hasEventBorder = !!existingColors?.border;
    const hasEventBorderWidth = existingColors?.borderWidth != null && existingColors?.borderWidth !== 2;

    // If event has overrideDefaults, calendar defaults aren't actually applied to this event
    // So we should only check event-level properties, not calendar defaults
    if (existingColors?.overrideDefaults) {
      return hasEventText || hasEventBorder || hasEventBorderWidth;
    }

    // Check calendar-level properties (only if event doesn't have overrideDefaults)
    const hasCalendarText = !!calendarDefaults?.text;
    const hasCalendarBorder = !!calendarDefaults?.border;
    const hasCalendarBorderWidth = calendarDefaults?.borderWidth != null && calendarDefaults?.borderWidth !== 2;

    return hasEventText || hasEventBorder || hasEventBorderWidth ||
           hasCalendarText || hasCalendarBorder || hasCalendarBorderWidth;
  }

  /**
   * Get calendar default colors for an event
   */
  async getCalendarDefaultColorsForEvent(eventId) {
    const calendarId = this.getCalendarIdForEvent(eventId);
    if (!calendarId) return null;

    const calendarColors = await this.storageService.getEventCalendarColors?.();
    return calendarColors?.[calendarId] || null;
  }

  /**
   * Handle color selection (legacy single color)
   */
  async handleColorSelect(eventId, color) {
    try {
      const scenario = ScenarioDetector.findColorPickerScenario();
      console.log('[CF] handleColorSelect:', { scenario, eventId, color });

      // Get existing colors and calendar defaults
      const getColors = this.storageService.findEventColorFull || this.storageService.findEventColor;
      const existingColors = await getColors?.(eventId) || {};
      const calendarDefaults = await this.getCalendarDefaultColorsForEvent(eventId) || {};

      // Get event title for preview
      const eventElement = document.querySelector(`[data-eventid="${eventId}"]`);
      const eventTitle = eventElement?.querySelector('.I0UMhf, .lhydbb')?.textContent?.trim() || 'Event';

      // Check if event has non-background properties that would be lost
      if (this.hasNonBackgroundProperties(existingColors, calendarDefaults)) {
        console.log('[CF] Event has non-background properties, showing dialog');

        // Show existing properties dialog
        this.showExistingPropertiesDialog({
          eventId,
          newBackground: color,
          existingColors,
          calendarDefaults,
          eventTitle,
          onKeepExisting: async () => {
            // Merge: keep existing properties, just update background
            const mergedColors = {
              background: color,
              text: existingColors.text || calendarDefaults.text || null,
              border: existingColors.border || calendarDefaults.border || null,
              borderWidth: existingColors.borderWidth ?? calendarDefaults.borderWidth ?? null,
            };
            console.log('[CF] Keeping existing, merged colors:', mergedColors);
            await this.applyBackgroundWithMerge(eventId, mergedColors);
          },
          onReplaceAll: async () => {
            // Replace: clear all properties, just use background
            console.log('[CF] Replacing all with background only');
            await this.applyBackgroundOnly(eventId, color);
          },
          onOpenFullModal: () => {
            // Open full modal prefilled with new background + existing properties
            console.log('[CF] Opening full modal');
            this.closeMenus();
            this.openCustomColorModalPrefilled(eventId, color, existingColors, calendarDefaults);
          },
          onClose: () => {
            console.log('[CF] Existing properties dialog closed');
          },
        });
      } else {
        // No other properties, apply background only (current behavior)
        await this.applyBackgroundOnly(eventId, color);
      }
    } catch (error) {
      console.error('[CF] Error handling color select:', error);
    }
  }

  /**
   * Apply background color with merged properties (keeps existing text/border)
   */
  async applyBackgroundWithMerge(eventId, colors) {
    const parsed = EventIdUtils.fromEncoded(eventId);

    if (parsed.isRecurring) {
      showRecurringEventDialog({
        eventId,
        color: colors.background,
        onConfirm: async (applyToAll) => {
          if (this.storageService.saveEventColorsFullAdvanced) {
            await this.storageService.saveEventColorsFullAdvanced(eventId, colors, { applyToAll });
          }
          this.closeMenus();
          this.triggerColorUpdate();
        },
        onClose: () => {},
      });
    } else {
      if (this.storageService.saveEventColorsFullAdvanced) {
        await this.storageService.saveEventColorsFullAdvanced(eventId, colors, { applyToAll: false });
      }
      this.closeMenus();
      this.triggerColorUpdate();
    }
  }

  /**
   * Apply background color only (clears other properties)
   * Uses overrideDefaults flag to ensure calendar defaults are not merged in
   */
  async applyBackgroundOnly(eventId, color) {
    const parsed = EventIdUtils.fromEncoded(eventId);

    // Create colors object that explicitly overrides calendar defaults
    const colors = {
      background: color,
      text: null,
      border: null,
      borderWidth: 2, // Reset to default
      overrideDefaults: true, // Flag to indicate this should override calendar defaults
    };

    if (parsed.isRecurring) {
      showRecurringEventDialog({
        eventId,
        color,
        onConfirm: async (applyToAll) => {
          console.log('[CF] Recurring dialog confirmed (background only), applyToAll:', applyToAll);

          // Save full colors with overrideDefaults flag
          if (this.storageService.saveEventColorsFullAdvanced) {
            await this.storageService.saveEventColorsFullAdvanced(eventId, colors, { applyToAll });
          } else if (this.storageService.saveEventColorAdvanced) {
            await this.storageService.saveEventColorAdvanced(eventId, color, { applyToAll });
          } else {
            await this.storageService.saveEventColor(eventId, color, applyToAll);
          }

          // Trigger re-render
          this.triggerColorUpdate();
        },
        onClose: () => {
          console.log('[CF] Recurring dialog closed');
        },
      });
    } else {
      // Single event - save full colors with overrideDefaults flag
      if (this.storageService.saveEventColorsFullAdvanced) {
        await this.storageService.saveEventColorsFullAdvanced(eventId, colors, { applyToAll: false });
      } else {
        await this.storageService.saveEventColor(eventId, color, false);
      }

      // Close menus
      this.closeMenus();

      // Trigger re-render
      this.triggerColorUpdate();
    }
  }

  /**
   * Open custom color modal prefilled with new background and existing properties
   */
  openCustomColorModalPrefilled(eventId, newBackground, existingColors, calendarDefaults) {
    // Prefilled colors: new background + existing/calendar text/border
    const prefilledColors = {
      background: newBackground,
      text: existingColors.text || calendarDefaults.text || null,
      border: existingColors.border || calendarDefaults.border || null,
      borderWidth: existingColors.borderWidth ?? calendarDefaults.borderWidth ?? 2,
    };

    // Get original colors for preview
    const originalColors = {
      background: existingColors.background || calendarDefaults.background || '#039be5',
      text: existingColors.text || calendarDefaults.text || null,
      border: existingColors.border || calendarDefaults.border || null,
      stripeColor: existingColors.background || calendarDefaults.background || '#039be5',
    };

    // Get event title
    const eventElement = document.querySelector(`[data-eventid="${eventId}"]`);
    const eventTitle = eventElement?.querySelector('.I0UMhf, .lhydbb')?.textContent?.trim() || 'Event';

    // Use window.cfEventColoring if available (from index.js)
    if (window.cfEventColoring?.openCustomColorModal) {
      window.cfEventColoring.openCustomColorModal(eventId, prefilledColors, originalColors, eventTitle);
    } else {
      // Fallback to our own modal
      this.openCustomColorModal(eventId);
    }
  }

  /**
   * Show existing properties dialog
   */
  showExistingPropertiesDialog(options) {
    const {
      eventId,
      newBackground,
      existingColors,
      calendarDefaults,
      eventTitle,
      onKeepExisting,
      onReplaceAll,
      onOpenFullModal,
      onClose
    } = options;

    // Remove existing dialogs
    document.querySelectorAll('.cf-existing-props-dialog-container').forEach(el => el.remove());

    // Get contrasting text color helper
    const getContrastingTextColor = (bgColor) => {
      if (!bgColor) return '#ffffff';
      const hex = bgColor.replace('#', '');
      const r = parseInt(hex.substr(0, 2), 16);
      const g = parseInt(hex.substr(2, 2), 16);
      const b = parseInt(hex.substr(4, 2), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? '#000000' : '#ffffff';
    };

    // Create container
    const container = document.createElement('div');
    container.className = 'cf-existing-props-dialog-container';
    container.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.5);
    `;
    overlay.addEventListener('click', close);

    // Dialog
    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.style.cssText = `
      position: relative;
      background: white;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      padding: 24px;
      min-width: 380px;
      max-width: 440px;
      z-index: 1;
    `;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Additional Styling Detected';
    title.style.cssText = `
      margin: 0 0 12px;
      font-size: 18px;
      font-weight: 500;
      color: #202124;
      text-align: center;
    `;

    // Description
    const description = document.createElement('p');
    description.textContent = 'This event has custom text, border, or width styling. How would you like to apply the new background color?';
    description.style.cssText = `
      margin: 0 0 20px;
      font-size: 14px;
      color: #5f6368;
      text-align: center;
      line-height: 1.5;
    `;

    // Preview section
    const previewSection = createPreviewSection();

    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 20px;';

    const keepBtn = createActionButton(
      'Keep existing styling',
      'Apply new background, keep text/border settings',
      () => { if (onKeepExisting) onKeepExisting(); close(); },
      '#1a73e8', 'white'
    );

    const replaceBtn = createActionButton(
      'Replace all styling',
      'Use only the new background color',
      () => { if (onReplaceAll) onReplaceAll(); close(); },
      'white', '#1a73e8', true
    );

    const fullModalBtn = createActionButton(
      'Customize in full editor',
      'Fine-tune all color properties',
      () => { close(); if (onOpenFullModal) onOpenFullModal(); },
      '#f1f3f4', '#202124'
    );

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #5f6368;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      margin-top: 4px;
    `;
    cancelBtn.addEventListener('click', close);

    function createPreviewSection() {
      const section = document.createElement('div');
      section.style.cssText = 'display: flex; gap: 12px; justify-content: center; margin: 16px 0;';

      const currentBg = existingColors?.background || calendarDefaults?.background || '#039be5';
      const currentText = existingColors?.text || calendarDefaults?.text;
      const currentBorder = existingColors?.border || calendarDefaults?.border;
      const currentBorderWidth = existingColors?.borderWidth ?? calendarDefaults?.borderWidth ?? 2;

      section.appendChild(createPreviewItem('Current', currentBg, currentText, currentBorder, currentBorderWidth));

      const arrow = document.createElement('div');
      arrow.textContent = '→';
      arrow.style.cssText = 'display: flex; align-items: center; font-size: 18px; color: #5f6368;';
      section.appendChild(arrow);

      section.appendChild(createPreviewItem('Keep', newBackground, currentText, currentBorder, currentBorderWidth));
      section.appendChild(createPreviewItem('Replace', newBackground, null, null, 2));

      return section;
    }

    function createPreviewItem(label, bg, textColor, borderColor, borderWidth) {
      const item = document.createElement('div');
      item.style.cssText = 'display: flex; flex-direction: column; align-items: center; gap: 4px;';

      const labelEl = document.createElement('div');
      labelEl.textContent = label;
      labelEl.style.cssText = 'font-size: 10px; font-weight: 500; color: #5f6368; text-transform: uppercase;';

      const chip = document.createElement('div');
      const effectiveText = textColor || getContrastingTextColor(bg);
      chip.style.cssText = `
        width: 60px; height: 24px;
        border-radius: 4px;
        background-color: ${bg || '#039be5'};
        color: ${effectiveText};
        font-size: 10px; font-weight: 500;
        display: flex; align-items: center; justify-content: center;
        ${borderColor ? `outline: ${borderWidth || 2}px solid ${borderColor}; outline-offset: -${Math.round((borderWidth || 2) * 0.3)}px;` : ''}
      `;
      chip.textContent = (eventTitle || 'Event').substring(0, 6);

      item.appendChild(labelEl);
      item.appendChild(chip);
      return item;
    }

    function createActionButton(text, subtitle, onClick, bgColor, textColor, hasBorder = false) {
      const btn = document.createElement('button');
      btn.style.cssText = `
        background: ${bgColor};
        color: ${textColor};
        border: ${hasBorder ? '1px solid #1a73e8' : 'none'};
        border-radius: 6px;
        padding: 12px 20px;
        font-size: 14px;
        cursor: pointer;
        text-align: left;
      `;

      const mainText = document.createElement('div');
      mainText.textContent = text;
      mainText.style.cssText = 'font-weight: 500;';

      const subText = document.createElement('div');
      subText.textContent = subtitle;
      subText.style.cssText = 'font-size: 12px; opacity: 0.8; margin-top: 2px;';

      btn.appendChild(mainText);
      btn.appendChild(subText);
      btn.addEventListener('click', onClick);
      return btn;
    }

    function close() {
      container.remove();
      if (onClose) onClose();
    }

    // Handle escape
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);

    buttonsContainer.appendChild(keepBtn);
    buttonsContainer.appendChild(replaceBtn);
    buttonsContainer.appendChild(fullModalBtn);
    buttonsContainer.appendChild(cancelBtn);

    dialog.appendChild(title);
    dialog.appendChild(description);
    dialog.appendChild(previewSection);
    dialog.appendChild(buttonsContainer);

    container.appendChild(overlay);
    container.appendChild(dialog);
    document.body.appendChild(container);
  }

  /**
   * Handle full color selection with background/text/border
   * @param {string} eventId - Event ID
   * @param {Object} colors - { background, text, border }
   */
  async handleFullColorSelect(eventId, colors) {
    try {
      console.log('[CF] handleFullColorSelect:', { eventId, colors });

      // Check if all colors are cleared (all null)
      const allColorsCleared = !colors.background && !colors.text && !colors.border;

      // Check if this is a recurring event
      const parsed = EventIdUtils.fromEncoded(eventId);

      if (allColorsCleared) {
        console.log('[CF] All colors cleared, removing event color');

        if (parsed.isRecurring) {
          // For recurring events, show dialog to choose clear scope
          showRecurringEventDialog({
            eventId,
            color: null, // No color for display (clearing)
            onConfirm: async (applyToAll) => {
              console.log('[CF] Recurring clear confirmed, applyToAll:', applyToAll);
              // Remove the event color from storage
              await this.storageService.removeEventColor(eventId);

              // Close modal and menus
              if (this.activeModal) {
                this.activeModal.close();
                this.activeModal = null;
              }
              this.closeMenus();

              // Force page refresh to show cleared state
              window.location.reload();
            },
            onClose: () => {
              console.log('[CF] Recurring clear dialog closed');
            },
          });
        } else {
          // Single event - remove color and refresh
          await this.storageService.removeEventColor(eventId);

          // Close modal and menus
          if (this.activeModal) {
            this.activeModal.close();
            this.activeModal = null;
          }
          this.closeMenus();

          // Force page refresh to show cleared state
          window.location.reload();
        }
        return;
      }

      if (parsed.isRecurring) {
        // Show recurring event dialog with custom message for full colors
        showRecurringEventDialog({
          eventId,
          color: colors.background, // For display purposes
          onConfirm: async (applyToAll) => {
            console.log('[CF] Recurring dialog confirmed for full colors, applyToAll:', applyToAll);

            // Save with new full color storage method
            if (this.storageService.saveEventColorsFullAdvanced) {
              await this.storageService.saveEventColorsFullAdvanced(eventId, colors, { applyToAll });
            } else if (this.storageService.saveEventColorAdvanced) {
              // Fallback to old method with just background color
              await this.storageService.saveEventColorAdvanced(eventId, colors.background, { applyToAll });
            }

            // Trigger re-render
            this.triggerColorUpdate();
          },
          onClose: () => {
            console.log('[CF] Recurring dialog closed');
          },
        });
      } else {
        // Single event - save directly with full colors
        if (this.storageService.saveEventColorsFullAdvanced) {
          await this.storageService.saveEventColorsFullAdvanced(eventId, colors, { applyToAll: false });
        } else {
          // Fallback to old method
          await this.storageService.saveEventColor(eventId, colors.background, false);
        }

        // Close menus
        this.closeMenus();

        // Trigger re-render
        this.triggerColorUpdate();
      }
    } catch (error) {
      console.error('[CF] Error handling full color select:', error);
    }
  }

  /**
   * Close color picker menus
   */
  closeMenus() {
    document.querySelectorAll('[role="menu"], [role="dialog"]').forEach((el) => {
      // Don't close our recurring dialog
      if (!el.closest('.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.RECURRING_DIALOG)) {
        el.remove();
      }
    });
  }

  /**
   * Trigger a color update event
   */
  triggerColorUpdate() {
    // Dispatch custom event for color renderer to pick up
    window.dispatchEvent(new CustomEvent('cf-event-color-changed'));
  }

  // ========================================
  // MODE TOGGLE UI COMPONENTS
  // ========================================

  /**
   * Create a toggle section with title, description, and switch
   * @param {Object} options - { title, description, isActive, onChange }
   * @returns {HTMLElement} The toggle section element
   */
  createToggleSection(options) {
    const { title, description, isActive, onChange, disabled = false, proBadge = false } = options;

    const section = document.createElement('div');
    section.className = `cf-mode-section${disabled ? ' cf-section-disabled' : ''}`;

    const row = document.createElement('div');
    row.className = 'cf-toggle-row';

    const content = document.createElement('div');
    content.className = 'cf-toggle-content';

    const titleEl = document.createElement('div');
    titleEl.className = 'cf-toggle-title';
    titleEl.textContent = title;
    if (proBadge) {
      const badge = document.createElement('span');
      badge.className = 'cf-pro-badge';
      badge.textContent = 'PRO';
      titleEl.appendChild(badge);
    }

    const descEl = document.createElement('div');
    descEl.className = 'cf-toggle-desc';
    descEl.textContent = description;

    content.appendChild(titleEl);
    content.appendChild(descEl);

    const toggle = document.createElement('div');
    toggle.className = `cf-switch${isActive ? ' active' : ''}`;
    toggle.setAttribute('role', 'switch');
    toggle.setAttribute('aria-checked', isActive ? 'true' : 'false');
    toggle.setAttribute('tabindex', '0');

    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const newState = !toggle.classList.contains('active');
      toggle.classList.toggle('active', newState);
      toggle.setAttribute('aria-checked', newState ? 'true' : 'false');
      if (onChange) onChange(newState);
    });

    toggle.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle.click();
      }
    });

    row.appendChild(content);
    row.appendChild(toggle);
    section.appendChild(row);

    // Store reference to the toggle for external control
    section._toggle = toggle;
    section._setDisabled = (isDisabled) => {
      section.classList.toggle('cf-section-disabled', isDisabled);
    };

    return section;
  }

  /**
   * Show mode switch confirmation modal
   * @param {Object} options - { type: 'google'|'colorkit', eventId, isRecurring, onConfirm, onCancel }
   */
  async showModeSwitchConfirmation(options) {
    const { type, eventId, isRecurring, onConfirm, onCancel } = options;

    // Check if user has disabled this warning
    const hideWarning = type === 'google'
      ? await this.storageService.getHideGoogleSwitchWarning?.()
      : await this.storageService.getHideColorKitSwitchWarning?.();

    if (hideWarning) {
      // Skip confirmation and proceed
      if (onConfirm) onConfirm(false);
      return;
    }

    // Build modal content based on type
    const config = type === 'google' ? {
      title: 'Switch to Google Colors',
      message: 'This will remove all ColorKit styling from this event. Google Calendar will control the event color.',
      confirmText: 'Switch to Google',
      isDanger: true,
    } : {
      title: 'Switch to ColorKit',
      message: 'ColorKit will now control this event\'s colors. You can customize the background, text, and border.',
      confirmText: 'Use ColorKit',
      isDanger: false,
    };

    // Remove existing modals
    document.querySelectorAll('.cf-confirm-backdrop').forEach(el => el.remove());

    // Create modal
    const backdrop = document.createElement('div');
    backdrop.className = 'cf-confirm-backdrop';

    const modal = document.createElement('div');
    modal.className = 'cf-confirm-modal';

    const title = document.createElement('h3');
    title.className = 'cf-confirm-title';
    title.textContent = config.title;

    const message = document.createElement('p');
    message.className = 'cf-confirm-message';
    message.textContent = config.message;

    // Don't show again checkbox
    const checkboxContainer = document.createElement('div');
    checkboxContainer.className = 'cf-confirm-checkbox';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'cf-dont-show-again';

    const checkboxLabel = document.createElement('label');
    checkboxLabel.htmlFor = 'cf-dont-show-again';
    checkboxLabel.textContent = "Don't show this again";

    checkboxContainer.appendChild(checkbox);
    checkboxContainer.appendChild(checkboxLabel);

    // Buttons
    const buttons = document.createElement('div');
    buttons.className = 'cf-confirm-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cf-confirm-btn cf-confirm-btn-cancel';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => {
      backdrop.classList.remove('active');
      setTimeout(() => backdrop.remove(), 200);
      if (onCancel) onCancel();
    });

    const confirmBtn = document.createElement('button');
    confirmBtn.className = `cf-confirm-btn cf-confirm-btn-confirm${config.isDanger ? ' cf-confirm-btn-danger' : ''}`;
    confirmBtn.textContent = config.confirmText;
    confirmBtn.addEventListener('click', async () => {
      // Save preference if checkbox is checked
      if (checkbox.checked) {
        if (type === 'google') {
          await this.storageService.setHideGoogleSwitchWarning?.(true);
        } else {
          await this.storageService.setHideColorKitSwitchWarning?.(true);
        }
      }
      backdrop.classList.remove('active');
      setTimeout(() => backdrop.remove(), 200);
      if (onConfirm) onConfirm(checkbox.checked);
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(confirmBtn);

    modal.appendChild(title);
    modal.appendChild(message);
    modal.appendChild(checkboxContainer);
    modal.appendChild(buttons);
    backdrop.appendChild(modal);

    // Handle escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        cancelBtn.click();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Handle backdrop click
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) {
        cancelBtn.click();
      }
    });

    document.body.appendChild(backdrop);

    // Trigger animation
    requestAnimationFrame(() => {
      backdrop.classList.add('active');
    });
  }

  /**
   * Handle mode switch between Google and ColorKit
   * @param {string} newMode - 'google' or 'colorkit'
   * @param {string} eventId - Event ID
   * @param {HTMLElement} container - Color picker container
   */
  async handleModeSwitch(newMode, eventId, container) {
    const parsed = EventIdUtils.fromEncoded(eventId);

    if (newMode === 'google') {
      // Switch to Google mode - remove ColorKit colors
      this.showModeSwitchConfirmation({
        type: 'google',
        eventId,
        isRecurring: parsed.isRecurring,
        onConfirm: async () => {
          if (parsed.isRecurring) {
            if (this.storageService.markRecurringEventForGoogleColors) {
              await this.storageService.markRecurringEventForGoogleColors(eventId);
            } else {
              await this.storageService.markEventForGoogleColors(eventId);
            }
          } else {
            await this.storageService.markEventForGoogleColors(eventId);
          }

          // Clear ColorKit styling from DOM
          if (window.cfEventColoring?.clearColorKitStyling) {
            window.cfEventColoring.clearColorKitStyling(eventId);
          }

          this.closeMenus();
          // Force refresh to show Google's colors
          window.location.reload();
        },
      });
    } else {
      // Switch to ColorKit mode - apply default ColorKit color
      this.showModeSwitchConfirmation({
        type: 'colorkit',
        eventId,
        isRecurring: parsed.isRecurring,
        onConfirm: async () => {
          // Get stripe color for this event's calendar
          let stripeColor = '#039be5';
          if (window.cfEventColoring?.getStripeColorForEvent) {
            stripeColor = window.cfEventColoring.getStripeColorForEvent(eventId);
          }

          // Apply default ColorKit color (Peacock blue as default)
          const defaultColor = {
            background: '#039be5',
            text: null,
            border: null,
            borderWidth: 2,
            stripeColor,
          };

          if (parsed.isRecurring) {
            showRecurringEventDialog({
              eventId,
              color: defaultColor.background,
              onConfirm: async (applyToAll) => {
                await this.storageService.saveEventColorsFullAdvanced(eventId, defaultColor, { applyToAll });
                this.closeMenus();
                this.triggerColorUpdate();
              },
              onClose: () => {},
            });
          } else {
            await this.storageService.saveEventColorsFullAdvanced(eventId, defaultColor, { applyToAll: false });
            this.closeMenus();
            this.triggerColorUpdate();
          }
        },
      });
    }
  }

  /**
   * Update section visual states based on current mode
   * @param {string} mode - 'google' or 'colorkit'
   * @param {Object} sections - { googleSection, colorKitSection, listColorSection }
   */
  updateSectionStates(mode, sections) {
    if (sections.googleSection) {
      const isGoogle = mode === 'google';
      sections.googleSection.classList.toggle('cf-section-disabled', !isGoogle);
      if (sections.googleSection._toggle) {
        sections.googleSection._toggle.classList.toggle('active', isGoogle);
        sections.googleSection._toggle.setAttribute('aria-checked', isGoogle ? 'true' : 'false');
      }
    }

    if (sections.colorKitSection) {
      const isColorKit = mode === 'colorkit';
      sections.colorKitSection.classList.toggle('cf-section-disabled', !isColorKit);
      if (sections.colorKitSection._toggle) {
        sections.colorKitSection._toggle.classList.toggle('active', isColorKit);
        sections.colorKitSection._toggle.setAttribute('aria-checked', isColorKit ? 'true' : 'false');
      }
    }

    if (sections.listColorSection) {
      // List color section is only enabled when in ColorKit mode
      sections.listColorSection.classList.toggle('cf-section-disabled', mode !== 'colorkit');
    }
  }

  /**
   * Create the delete row (trash icon + "Delete" text)
   * @param {HTMLElement} container - Color picker container
   * @param {string} scenario - Current scenario
   * @returns {HTMLElement} The delete row element
   */
  createDeleteRow(container, scenario) {
    const row = document.createElement('div');
    row.className = 'cf-delete-row';

    const icon = document.createElement('div');
    icon.className = 'cf-delete-icon';
    icon.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`;

    const text = document.createElement('span');
    text.className = 'cf-delete-text';
    text.textContent = 'Delete';

    row.appendChild(icon);
    row.appendChild(text);

    row.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const eventId = ScenarioDetector.findEventIdByScenario(container, scenario);
      if (!eventId) return;

      await this.handleRemoveAllColoring(eventId);
    });

    return row;
  }

  /**
   * Create the "Full Custom Coloring" row
   * @param {HTMLElement} container - Color picker container
   * @param {string} scenario - Current scenario
   * @returns {HTMLElement} The full custom row element
   */
  createFullCustomRow(container, scenario) {
    const row = document.createElement('div');
    row.className = 'cf-full-custom-row';

    const icon = document.createElement('div');
    icon.className = 'cf-full-custom-icon';
    icon.textContent = '+';

    const content = document.createElement('div');
    content.className = 'cf-full-custom-content';

    const title = document.createElement('div');
    title.className = 'cf-full-custom-title';
    title.textContent = 'Full Custom Coloring';

    const desc = document.createElement('div');
    desc.className = 'cf-full-custom-desc';
    desc.textContent = 'Full picker - Any color for your background, Text and Border';

    content.appendChild(title);
    content.appendChild(desc);
    row.appendChild(icon);
    row.appendChild(content);

    row.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const eventId = ScenarioDetector.findEventIdByScenario(container, scenario);
      if (!eventId) return;

      this.closeMenus();
      this.openCustomColorModal(eventId);
    });

    return row;
  }

  /**
   * Create default colors grid (ColorKit's 11 Google-equivalent colors)
   * @param {HTMLElement} container - Color picker container
   * @param {string} scenario - Current scenario
   * @param {string|null} currentColor - Currently selected color
   * @returns {HTMLElement} The colors grid element
   */
  createDefaultColorsGrid(container, scenario, currentColor) {
    const grid = document.createElement('div');
    grid.className = 'cf-default-colors-grid';

    COLORKIT_DEFAULT_COLORS.forEach((colorObj) => {
      const button = this.createColorButton(colorObj, container, scenario);
      if (currentColor && colorObj.hex.toLowerCase() === currentColor.toLowerCase()) {
        this.toggleCheckmark(button, true);
      }
      grid.appendChild(button);
    });

    return grid;
  }

  /**
   * Hide checkmarks on Google colors and show on custom when appropriate
   * NOTE: With the redesign, we hide Google's built-in color group and use our own UI,
   * so we no longer intercept Google button clicks. This method now just updates
   * checkmarks on our custom color buttons.
   */
  async hideCheckmarkAndModifyBuiltInColors() {
    const listContainer = document.querySelector(
      COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST
    );
    const editorContainer = document.querySelector(
      COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR
    );
    const container = listContainer || editorContainer;

    if (!container) return;

    const scenario = ScenarioDetector.findColorPickerScenario();
    const eventId = ScenarioDetector.findEventIdByScenario(container, scenario);

    if (!eventId) return;

    // Get the current color for this event
    let currentColor = null;
    if (this.storageService.findEventColorFull) {
      const colorData = await this.storageService.findEventColorFull(eventId);
      currentColor = colorData?.background || colorData?.hex;
    } else if (this.storageService.findEventColor) {
      const colorData = await this.storageService.findEventColor(eventId);
      currentColor = colorData?.hex;
    }

    // NOTE: With the redesign, we hide Google's built-in colors and provide our own UI.
    // We no longer need to intercept Google button clicks since Google's color group is hidden.
    // The binary ownership model means:
    // - Google Mode: We don't touch Google's colors at all
    // - ColorKit Mode: Our buttons handle everything

    // Update checkmarks on our custom color buttons
    this.updateCheckmarks(currentColor);

    // Modify Google color labels (still useful if Google's colors are shown elsewhere)
    await this.modifyGoogleColorLabels();
  }

  /**
   * Update checkmark visibility based on selected color
   */
  updateCheckmarks(selectedColor) {
    // Wait a bit for DOM to settle
    setTimeout(() => {
      // Remove checkmarks from Google colors if we have a custom color
      if (selectedColor) {
        const googleButtons = document.querySelectorAll(
          COLOR_PICKER_SELECTORS.GOOGLE_COLOR_BUTTON
        );
        googleButtons.forEach((button) => {
          this.toggleCheckmark(button, false);
        });
      }

      // Update custom color button checkmarks
      const customButtons = document.querySelectorAll(
        '.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CUSTOM_COLOR_BUTTON
      );

      customButtons.forEach((button) => {
        const buttonColor = button.getAttribute('data-color');
        const isSelected =
          selectedColor &&
          buttonColor &&
          buttonColor.toLowerCase() === selectedColor.toLowerCase();
        this.toggleCheckmark(button, isSelected);
      });
    }, 50);
  }

  /**
   * Toggle checkmark visibility on a button
   */
  toggleCheckmark(button, show) {
    if (!button) return;

    const checkmark = button.querySelector(COLOR_PICKER_SELECTORS.CHECKMARK_SELECTOR);
    if (checkmark) {
      checkmark.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Modify Google's built-in color labels with custom names
   * Handles both Modern and Classic color schemes by checking the equivalent color
   */
  async modifyGoogleColorLabels() {
    console.log('[CF] Modifying Google color labels');

    // Check if we have any custom labels
    const hasCustomLabels = await this.storageService.hasAnyCustomLabelsForGoogleColors?.();
    if (!hasCustomLabels) {
      console.log('[CF] No custom labels found for Google colors');
      return;
    }

    const googleButtons = document.querySelectorAll(
      COLOR_PICKER_SELECTORS.GOOGLE_COLOR_BUTTON
    );

    console.log('[CF] Found', googleButtons.length, 'Google color buttons');

    const allLabels = this.storageService.getGoogleColorLabels?.() || {};

    for (const button of googleButtons) {
      const labelElement = button.querySelector(COLOR_PICKER_SELECTORS.LABEL_ELEMENT);
      if (!labelElement) continue;

      const colorAttr = button.getAttribute('data-color');
      if (!colorAttr) continue;

      const normalizedColor = colorAttr.toLowerCase();

      // Try direct lookup first
      let customName = allLabels[normalizedColor];

      // If not found, try the equivalent color from the other scheme
      // This handles users who set labels in one scheme but are viewing in another
      if (!customName) {
        const equivalentColor = getSchemeEquivalent(normalizedColor);
        if (equivalentColor) {
          customName = allLabels[equivalentColor];
          if (customName) {
            console.log('[CF] Label found via scheme mapping:', normalizedColor, '→', equivalentColor);
          }
        }
      }

      if (!customName) continue;

      button.setAttribute('aria-label', customName);
      labelElement.setAttribute('data-text', customName);
      console.log('[CF] Modified label for', colorAttr, 'to', customName);
    }
  }

  /**
   * Clean up
   */
  destroy() {
    this.isInjecting = false;
  }
}

/**
 * Factory function
 */
function createColorPickerInjector(storageService) {
  return new ColorPickerInjector(storageService);
}

// Make available globally for content scripts
if (typeof window !== 'undefined') {
  window.cfColorPickerInjector = {
    ColorPickerInjector,
    createColorPickerInjector,
  };
  console.log('[CF] ColorPickerInjector available at window.cfColorPickerInjector');
}
