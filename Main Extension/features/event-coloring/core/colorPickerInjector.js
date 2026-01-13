// features/event-coloring/core/colorPickerInjector.js
// Injects custom color picker UI into Google Calendar's color menus

import {
  COLOR_PICKER_SELECTORS,
  DATA_ATTRIBUTES,
  EVENT_SELECTORS,
  Scenario,
} from '../selectors.js';
import EventIdUtils from '../utils/eventIdUtils.js';
import ScenarioDetector from '../utils/scenarioDetector.js';
import { showRecurringEventDialog } from '../components/RecurringEventDialog.js';
import { ColorSwatchModal, COLOR_PALETTES } from '../../../shared/components/ColorSwatchModal.js';
import { EventColorModal, createEventColorModal } from '../../../shared/components/EventColorModal.js';
import { EventColorPanel, createEventColorPanel } from '../components/EventColorPanel.js';

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

/**
 * ColorPickerInjector - Handles injection of custom colors into Google Calendar
 */
export class ColorPickerInjector {
  constructor(storageService) {
    this.storageService = storageService;
    this.observerId = 'colorPickerInjector';
    this.isInjecting = false;
    this.activeModal = null;
    this.activePanel = null;
    this.cssInjected = false;
  }

  /**
   * Initialize the injector
   */
  init() {
    console.log('[CF] ColorPickerInjector initialized');
    this.injectModalCSS();

    // Listen for requests to open full color modal from EventColorPanel
    window.addEventListener('cf-open-full-color-modal', (e) => {
      if (e.detail?.eventId) {
        this.openCustomColorModal(e.detail.eventId);
      }
    });
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

      // Open the full EventColorModal for quick custom color access
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
   * Open the new Event Color Panel with redesigned UI
   * @param {string} eventId - The event ID
   * @param {Object} options - Additional options
   * @param {Function} options.onCloseExtra - Extra callback to run on close
   */
  async openEventColorPanel(eventId, options = {}) {
    // Clean up any existing panel
    if (this.activePanel) {
      this.activePanel.close();
      this.activePanel = null;
    }

    // Close any open menus
    this.closeMenus();

    // Create and render the panel
    this.activePanel = new EventColorPanel({
      eventId,
      storageService: this.storageService,
      onClose: () => {
        this.activePanel = null;
        // Call extra close handler if provided
        options.onCloseExtra?.();
      },
      onColorApplied: () => {
        this.triggerColorUpdate();
      },
    });

    await this.activePanel.render();
    console.log('[CF] EventColorPanel opened for event:', eventId);
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
   * Injects our redesigned UI into Google's color picker
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

      // Check if already injected
      const existingSection = document.querySelector('.cf-injected-panel');
      if (existingSection) {
        this.isInjecting = false;
        return;
      }

      // Find the color picker container
      const editorContainer = document.querySelector(
        COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR
      );
      const listContainer = document.querySelector(
        COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST
      );
      const container = listContainer || editorContainer;

      if (!container) {
        this.isInjecting = false;
        return;
      }

      // Find scenario and event ID
      const scenario = ScenarioDetector.findColorPickerScenario();
      const eventId = ScenarioDetector.findEventIdByScenario(container, scenario);

      if (!eventId) {
        console.log('[CF] No event ID found');
        this.isInjecting = false;
        return;
      }

      // Load data and inject the new UI
      await this.injectRedesignedUI(container, scenario, eventId);

      // Update Google color labels
      await this.modifyGoogleColorLabels();
    } catch (error) {
      console.error('[CF] Error injecting color picker:', error);
    }

    this.isInjecting = false;
  }

  /**
   * Inject the redesigned UI into Google's color picker
   */
  async injectRedesignedUI(container, scenario, eventId) {
    // Load all required data
    const [eventColors, calendarDefaults, categories, templates] = await Promise.all([
      this.storageService.findEventColorFull?.(eventId) ||
        this.storageService.findEventColor?.(eventId) ||
        null,
      this.getCalendarDefaultColorsForEvent(eventId),
      this.storageService.getEventColorCategories?.() || {},
      this.storageService.getEventColorTemplates?.() || {},
    ]);

    // Determine current mode
    const isGoogleMode = eventColors?.useGoogleColors ||
      (!eventColors?.background && !eventColors?.text && !eventColors?.border &&
       !calendarDefaults?.background && !calendarDefaults?.text && !calendarDefaults?.border);

    const hasListColoring = !!(calendarDefaults?.background || calendarDefaults?.text || calendarDefaults?.border);
    const listColorEnabled = hasListColoring && !eventColors?.overrideDefaults && !eventColors?.useGoogleColors;

    // Get calendar name
    const calendarId = this.getCalendarIdForEvent(eventId);
    let calendarName = calendarId || 'Calendar';
    const calendarSelect = document.querySelector('[data-key="calendar"] select');
    if (calendarSelect?.selectedOptions?.[0]) {
      calendarName = calendarSelect.selectedOptions[0].textContent;
    }

    // Find the wrapper inside container
    const wrapper = container.querySelector('div');
    if (!wrapper) {
      console.log('[CF] No wrapper found in container');
      return;
    }

    // Hide Google's built-in color group
    const builtInColorGroup = wrapper.querySelector(COLOR_PICKER_SELECTORS.BUILT_IN_COLOR_GROUP);
    if (builtInColorGroup) {
      builtInColorGroup.style.display = 'none';
    }

    // Create our injected panel
    const panel = document.createElement('div');
    panel.className = 'cf-injected-panel';

    // Get current applied color for checkmark display
    const currentAppliedColor = eventColors?.background || calendarDefaults?.background || null;

    // Build the HTML
    panel.innerHTML = this.buildInjectedPanelHTML({
      eventId,
      isGoogleMode,
      hasListColoring,
      listColorEnabled,
      calendarName,
      calendarDefaults,
      currentAppliedColor,
      categories: Array.isArray(categories) ? categories : Object.values(categories || {}),
      templates: Array.isArray(templates) ? templates : Object.values(templates || {}),
    });

    // Insert at the beginning of wrapper
    wrapper.insertBefore(panel, wrapper.firstChild);

    // Style the wrapper for scrolling
    wrapper.style.cssText = `
      max-height: ${scenario === Scenario.EVENTEDIT ? '500px' : '400px'} !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      scrollbar-width: thin !important;
    `;

    // Attach event listeners
    this.attachInjectedPanelListeners(panel, container, scenario, eventId, {
      isGoogleMode,
      hasListColoring,
      listColorEnabled,
      calendarDefaults,
    });

    console.log('[CF] Redesigned UI injected');
  }

  /**
   * Build the HTML for the redesigned injected panel
   */
  buildInjectedPanelHTML(data) {
    const {
      eventId,
      isGoogleMode,
      hasListColoring,
      listColorEnabled,
      calendarName,
      calendarDefaults,
      currentAppliedColor,
      categories,
      templates,
    } = data;

    const isColorKitMode = !isGoogleMode;
    const listBgColor = calendarDefaults?.background || '#039be5';

    // Helper to get contrasting text color
    const getContrastColor = (hex) => {
      if (!hex) return '#ffffff';
      const cleanHex = hex.replace('#', '');
      const r = parseInt(cleanHex.substr(0, 2), 16);
      const g = parseInt(cleanHex.substr(2, 2), 16);
      const b = parseInt(cleanHex.substr(4, 2), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.5 ? '#000000' : '#ffffff';
    };

    // Helper to check if a color is currently selected
    const isColorSelected = (color) => {
      if (!currentAppliedColor || !color) return false;
      return color.toLowerCase() === currentAppliedColor.toLowerCase();
    };

    // Helper to render a color swatch with checkmark
    const renderSwatch = (color, type, extraClass = '') => {
      const selected = isColorSelected(color);
      const checkColor = getContrastColor(color);
      return `<div class="cf-color-swatch ${extraClass} ${selected ? 'selected' : ''}" style="background:${color}; color:${color};" data-color="${color}" data-type="${type}"><span class="cf-swatch-check" style="color:${checkColor}">✓</span></div>`;
    };

    // Google's 12 default colors
    const googleColors = [
      '#d50000', '#e67c73', '#f4511e', '#f6bf26', '#33b679', '#0b8043',
      '#039be5', '#3f51b5', '#7986cb', '#8e24aa', '#616161', '#a79b8e'
    ];

    return `
      <style>
        .cf-injected-panel {
          padding: 8px 0;
          font-family: 'Google Sans', Roboto, sans-serif;
        }
        .cf-section {
          margin-bottom: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          transition: opacity 0.2s ease;
        }
        .cf-section.disabled {
          opacity: 0.45;
          pointer-events: none;
        }
        .cf-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .cf-section-title {
          font-size: 12px;
          font-weight: 600;
          color: #202124;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .cf-section-desc {
          font-size: 10px;
          color: #5f6368;
          margin-top: 2px;
        }
        .cf-toggle {
          width: 36px;
          height: 20px;
          background: #dadce0;
          border-radius: 10px;
          position: relative;
          cursor: pointer;
          transition: background 0.2s ease;
          flex-shrink: 0;
        }
        .cf-toggle.active {
          background: #1a73e8;
        }
        .cf-toggle::after {
          content: '';
          position: absolute;
          top: 2px;
          left: 2px;
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          transition: left 0.2s ease;
          box-shadow: 0 1px 3px rgba(0,0,0,0.2);
        }
        .cf-toggle.active::after {
          left: 18px;
        }
        .cf-pro-badge {
          background: linear-gradient(135deg, #8b5cf6, #7c3aed);
          color: white;
          padding: 1px 5px;
          border-radius: 3px;
          font-size: 8px;
          font-weight: 600;
          text-transform: uppercase;
        }
        .cf-color-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .cf-color-swatch {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: none;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.1s;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .cf-color-swatch:hover {
          transform: scale(1.15);
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
        }
        .cf-color-swatch .cf-swatch-check {
          display: none;
          font-size: 14px;
          font-weight: bold;
        }
        .cf-color-swatch.selected .cf-swatch-check {
          display: block;
        }
        .cf-color-swatch.selected {
          box-shadow: 0 0 0 2px white, 0 0 0 4px currentColor;
        }
        .cf-list-info {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 6px 0;
          padding: 6px 8px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        .cf-list-color {
          width: 28px;
          height: 28px;
          border-radius: 4px;
          flex-shrink: 0;
        }
        .cf-list-name {
          font-size: 11px;
          color: #202124;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .cf-full-custom-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 10px;
          background: #f8f9fa;
          border: 1.5px dashed #dadce0;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          margin-top: 8px;
        }
        .cf-full-custom-btn:hover {
          background: #e8f0fe;
          border-color: #1a73e8;
        }
        .cf-full-custom-icon {
          width: 24px;
          height: 24px;
          background: #e8eaed;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          color: #5f6368;
        }
        .cf-divider {
          display: flex;
          align-items: center;
          gap: 8px;
          margin: 12px 0 8px;
          font-size: 10px;
          font-weight: 600;
          color: #5f6368;
          text-transform: uppercase;
        }
        .cf-divider::before, .cf-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #e8eaed;
        }
        .cf-category-section {
          margin-bottom: 10px;
        }
        .cf-category-label {
          font-size: 10px;
          font-weight: 600;
          color: #5f6368;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .cf-templates-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 6px;
        }
        .cf-template-chip {
          padding: 4px 10px;
          border-radius: 12px;
          border: none;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: transform 0.1s, box-shadow 0.1s;
        }
        .cf-template-chip:hover {
          transform: scale(1.05);
          box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        }
        .cf-section-google {
          background: ${isGoogleMode ? 'linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 100%)' : '#f8f9fa'};
          border: 1px solid ${isGoogleMode ? '#1a73e8' : '#e8eaed'};
        }
        .cf-section-list {
          background: ${listColorEnabled ? 'linear-gradient(135deg, #e8f4fd 0%, #f0f7ff 100%)' : '#f8f9fa'};
          border: 1px solid ${listColorEnabled ? '#1a73e8' : '#e8eaed'};
        }
        .cf-section-colorkit {
          background: ${isColorKitMode ? 'linear-gradient(135deg, #f3e8ff 0%, #faf5ff 100%)' : '#f8f9fa'};
          border: 1px solid ${isColorKitMode ? '#8b5cf6' : '#e8eaed'};
        }
      </style>

      <!-- Google's Own Colors Section -->
      <div class="cf-section cf-section-google ${isGoogleMode ? '' : 'disabled'}" data-section="google">
        <div class="cf-section-header">
          <div>
            <div class="cf-section-title">Google's own colors</div>
            <div class="cf-section-desc">Use Google's built-in colors. Syncs across devices.</div>
          </div>
          <div class="cf-toggle ${isGoogleMode ? 'active' : ''}" data-toggle="google"></div>
        </div>
        <div class="cf-color-grid">
          ${googleColors.map(c => renderSwatch(c, 'google', 'cf-google-color')).join('')}
        </div>
      </div>

      <!-- ColorKit List Color Section -->
      <div class="cf-section cf-section-list ${isColorKitMode ? '' : 'disabled'}" data-section="list">
        <div class="cf-section-header">
          <div>
            <div class="cf-section-title">ColorKit List Color <span class="cf-pro-badge">PRO</span></div>
            <div class="cf-section-desc">Apply calendar's default color</div>
          </div>
          <div class="cf-toggle ${listColorEnabled ? 'active' : ''}" data-toggle="list"></div>
        </div>
        ${hasListColoring ? `
          <div class="cf-list-info">
            <div class="cf-list-color" style="background:${listBgColor}"></div>
            <div class="cf-list-name">${calendarName}</div>
          </div>
        ` : `
          <div class="cf-section-desc" style="margin-top:6px;font-style:italic;">No list color set for this calendar</div>
        `}
      </div>

      <!-- ColorKit's Colors Section -->
      <div class="cf-section cf-section-colorkit ${isColorKitMode ? '' : 'disabled'}" data-section="colorkit">
        <div class="cf-section-header">
          <div>
            <div class="cf-section-title">ColorKit's Colors</div>
            <div class="cf-section-desc">Use custom colors with text & border options.</div>
          </div>
          <div class="cf-toggle ${isColorKitMode ? 'active' : ''}" data-toggle="colorkit"></div>
        </div>

        <button class="cf-full-custom-btn" data-action="full-custom">
          <div class="cf-full-custom-icon">+</div>
          <div>
            <div style="font-size:12px;font-weight:500;color:#202124;">Full Custom Coloring</div>
            <div style="font-size:10px;color:#5f6368;">Background, Text and Border</div>
          </div>
        </button>
      </div>

      <!-- Background Colors Divider -->
      <div class="cf-divider">Background Colors</div>

      <!-- Google's Default Colors for Quick Pick (in ColorKit mode) -->
      <div class="cf-category-section ${isColorKitMode ? '' : 'disabled'}">
        <div class="cf-category-label">Google's Default Colors</div>
        <div class="cf-color-grid">
          ${googleColors.map(c => renderSwatch(c, 'colorkit')).join('')}
        </div>
      </div>

      <!-- Custom Categories -->
      ${categories.map(cat => `
        <div class="cf-category-section ${isColorKitMode ? '' : 'disabled'}">
          <div class="cf-category-label">${cat.name || 'Category'}</div>
          <div class="cf-color-grid">
            ${(cat.colors || []).map(colorObj => {
              const hex = typeof colorObj === 'string' ? colorObj : colorObj.hex;
              return renderSwatch(hex, 'colorkit');
            }).join('')}
          </div>
        </div>
      `).join('')}

      <!-- Templates -->
      ${templates.length > 0 ? `
        <div class="cf-category-section ${isColorKitMode ? '' : 'disabled'}">
          <div class="cf-category-label">
            <span style="display:inline-flex;align-items:center;gap:4px;">
              Templates <span class="cf-pro-badge">PRO</span>
            </span>
          </div>
          <div class="cf-templates-grid">
            ${templates.map(t => `
              <button class="cf-template-chip" data-template="${t.id}" style="
                background:${t.background || '#039be5'};
                color:${t.text || getContrastColor(t.background || '#039be5')};
                ${t.border ? `outline:2px solid ${t.border};outline-offset:-1px;` : ''}
              ">${t.name || 'Template'}</button>
            `).join('')}
          </div>
        </div>
      ` : ''}
    `;
  }

  /**
   * Attach event listeners to the injected panel
   */
  attachInjectedPanelListeners(panel, container, scenario, eventId, state) {
    const { isGoogleMode, hasListColoring, listColorEnabled, calendarDefaults } = state;

    // Toggle handlers
    panel.querySelectorAll('.cf-toggle').forEach(toggle => {
      toggle.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const toggleType = toggle.dataset.toggle;

        if (toggleType === 'google') {
          await this.handleSwitchToGoogleMode(eventId, container);
        } else if (toggleType === 'colorkit') {
          await this.handleSwitchToColorKitMode(eventId, container, hasListColoring);
        } else if (toggleType === 'list') {
          if (listColorEnabled) {
            // Disable list coloring - prompt for options
            this.showDisableListColorPrompt(eventId, container);
          } else if (hasListColoring) {
            // Enable list coloring
            await this.handleEnableListColoring(eventId, container);
          }
        }
      });
    });

    // Full custom button
    const fullCustomBtn = panel.querySelector('[data-action="full-custom"]');
    if (fullCustomBtn) {
      fullCustomBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.closeMenus();
        this.openCustomColorModal(eventId);
      });
    }

    // Google color swatches (when in Google section)
    panel.querySelectorAll('.cf-google-color').forEach(swatch => {
      swatch.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const color = swatch.dataset.color;
        // Click Google's actual color button to apply
        await this.clickGoogleColorButton(color, container);
      });
    });

    // ColorKit color swatches
    panel.querySelectorAll('.cf-color-swatch[data-type="colorkit"]').forEach(swatch => {
      swatch.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const color = swatch.dataset.color;
        await this.handleColorSelect(eventId, color);
        this.closeMenus();
      });
    });

    // Template chips
    panel.querySelectorAll('.cf-template-chip').forEach(chip => {
      chip.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const templateId = chip.dataset.template;
        await this.handleTemplateSelect(eventId, templateId);
        this.closeMenus();
      });
    });
  }

  /**
   * Handle switching to Google color mode
   */
  async handleSwitchToGoogleMode(eventId, container) {
    // Show confirmation
    if (!confirm('Switch to Google Colors?\n\nThis will remove any ColorKit styling and use Google\'s native colors.')) {
      return;
    }

    const parsed = EventIdUtils.fromEncoded(eventId);
    if (parsed.isRecurring) {
      showRecurringEventDialog({
        eventId,
        color: null,
        showColorPreview: false,
        dialogTitle: 'Switch to Google Colors',
        dialogMessage: 'Apply to:',
        onConfirm: async (applyToAll) => {
          if (applyToAll && this.storageService.markRecurringEventForGoogleColors) {
            await this.storageService.markRecurringEventForGoogleColors(eventId);
          } else {
            await this.storageService.markEventForGoogleColors(eventId);
          }
          this.closeMenus();
          window.location.reload();
        },
        onClose: () => {}
      });
    } else {
      await this.storageService.markEventForGoogleColors(eventId);
      this.closeMenus();
      window.location.reload();
    }
  }

  /**
   * Handle switching to ColorKit mode
   */
  async handleSwitchToColorKitMode(eventId, container, hasListColoring) {
    if (hasListColoring) {
      // Enable list coloring
      await this.handleEnableListColoring(eventId, container);
    } else {
      // Open full custom modal
      this.closeMenus();
      this.openCustomColorModal(eventId);
    }
  }

  /**
   * Handle enabling list coloring
   */
  async handleEnableListColoring(eventId, container) {
    const parsed = EventIdUtils.fromEncoded(eventId);
    if (parsed.isRecurring) {
      showRecurringEventDialog({
        eventId,
        color: null,
        dialogTitle: 'Apply List Color',
        dialogMessage: 'Apply calendar default to:',
        onConfirm: async (applyToAll) => {
          if (applyToAll && this.storageService.removeRecurringEventColors) {
            await this.storageService.removeRecurringEventColors(eventId);
          } else {
            await this.storageService.removeEventColor(eventId);
          }
          this.closeMenus();
          this.triggerColorUpdate();
        },
        onClose: () => {}
      });
    } else {
      await this.storageService.removeEventColor(eventId);
      this.closeMenus();
      this.triggerColorUpdate();
    }
  }

  /**
   * Show prompt when disabling list coloring
   */
  showDisableListColorPrompt(eventId, container) {
    const choice = confirm('Disable List Color?\n\nClick OK to use Google colors, or Cancel to set up custom coloring.');
    if (choice) {
      // Switch to Google mode
      this.handleSwitchToGoogleMode(eventId, container);
    } else {
      // Open full custom modal
      this.closeMenus();
      this.openCustomColorModal(eventId);
    }
  }

  /**
   * Click Google's actual color button to apply native color
   */
  async clickGoogleColorButton(color, container) {
    // Find Google's color button with this color
    const googleButtons = container.querySelectorAll(COLOR_PICKER_SELECTORS.GOOGLE_COLOR_BUTTON);
    for (const btn of googleButtons) {
      const btnColor = btn.getAttribute('data-color');
      if (btnColor && btnColor.toLowerCase() === color.toLowerCase()) {
        btn.click();
        return;
      }
    }
    console.warn('[CF] Could not find Google color button for:', color);
  }

  /**
   * Handle template selection
   */
  async handleTemplateSelect(eventId, templateId) {
    const templates = await this.storageService.getEventColorTemplates?.() || {};
    const template = templates[templateId];
    if (!template) return;

    const colors = {
      background: template.background || null,
      text: template.text || null,
      border: template.border || null,
      borderWidth: template.borderWidth || 2,
      overrideDefaults: true,
    };

    const parsed = EventIdUtils.fromEncoded(eventId);
    if (parsed.isRecurring) {
      showRecurringEventDialog({
        eventId,
        color: template.background,
        dialogTitle: 'Apply Template',
        dialogMessage: 'Apply to:',
        onConfirm: async (applyToAll) => {
          if (this.storageService.saveEventColorsFullAdvanced) {
            await this.storageService.saveEventColorsFullAdvanced(eventId, colors, { applyToAll });
          }
          this.triggerColorUpdate();
        },
        onClose: () => {}
      });
    } else {
      if (this.storageService.saveEventColorsFullAdvanced) {
        await this.storageService.saveEventColorsFullAdvanced(eventId, colors, { applyToAll: false });
      }
      this.triggerColorUpdate();
    }
  }

  /**
   * Inject color categories into the color picker (legacy method)
   */
  injectColorCategories(categories) {
    console.log('[CF] Injecting categories:', categories.length);

    const scenario = ScenarioDetector.findColorPickerScenario();
    if (scenario !== Scenario.EVENTEDIT && scenario !== Scenario.LISTVIEW) {
      console.log('[CF] Not injecting for scenario:', scenario);
      return;
    }

    // Find the color picker container
    const editorContainer = document.querySelector(
      COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR
    );
    const listContainer = document.querySelector(
      COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST
    );
    const container = listContainer || editorContainer;

    if (!container) {
      console.log('[CF] No color picker container found');
      return;
    }

    // Find the built-in color group
    const builtInColorGroup = container.querySelector(
      COLOR_PICKER_SELECTORS.BUILT_IN_COLOR_GROUP
    );
    console.log('[CF] Found built-in color group:', !!builtInColorGroup);

    // Find the scrollable wrapper
    const wrapper = container.querySelector('div');
    if (!wrapper) {
      console.log('[CF] No wrapper found');
      return;
    }

    // Style the wrapper for scrolling
    const innerGroup = wrapper.querySelector(COLOR_PICKER_SELECTORS.BUILT_IN_COLOR_GROUP);
    if (innerGroup) {
      innerGroup.style.marginBottom = '8px';
    }

    wrapper.style.cssText = `
      max-height: ${scenario === Scenario.EVENTEDIT ? '600px' : '500px'} !important;
      max-width: ${scenario === Scenario.EVENTEDIT ? '200px' : '300px'} !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding-bottom: 12px !important;
      scrollbar-width: none !important;
      -ms-overflow-style: none !important;
    `;

    // Add separator
    const separator = this.createSeparator();
    separator.classList.add(COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.SEPARATOR);
    wrapper.appendChild(separator);

    // Add each category
    categories.forEach((category) => {
      const categorySection = this.createCategorySection(category, container, scenario);
      if (categorySection) {
        wrapper.appendChild(categorySection);
      }
    });

    // Add "Custom Color" section with "+" button
    const customColorSection = this.createCustomColorSection(container, scenario);
    if (customColorSection) {
      wrapper.appendChild(customColorSection);
    }

    // Update checkmarks
    this.hideCheckmarkAndModifyBuiltInColors();
  }

  /**
   * Create the "Custom Color" section with ColorKit Options button and reset actions
   */
  createCustomColorSection(container, scenario) {
    const section = document.createElement('div');
    section.className = 'cf-custom-color-section';
    section.style.marginTop = '16px';

    // ColorKit Options Button - Main entry point for new UI
    const colorKitBtn = document.createElement('button');
    colorKitBtn.className = 'cf-colorkit-options-btn';
    colorKitBtn.style.cssText = `
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 12px 14px;
      background: linear-gradient(135deg, #f3e8ff 0%, #faf5ff 100%);
      border: 1.5px solid #8b5cf6;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.15s ease;
      text-align: left;
      margin-bottom: 12px;
    `;

    colorKitBtn.innerHTML = `
      <div style="
        width: 32px;
        height: 32px;
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      ">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 13px; font-weight: 600; color: #6d28d9; margin-bottom: 2px;">ColorKit Options</div>
        <div style="font-size: 11px; color: #7c3aed; line-height: 1.3;">Full color panel with modes, templates & more</div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" stroke-width="2" style="flex-shrink: 0;">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    `;

    // Hover effects
    colorKitBtn.addEventListener('mouseenter', () => {
      colorKitBtn.style.background = 'linear-gradient(135deg, #ede9fe 0%, #f5f3ff 100%)';
      colorKitBtn.style.borderColor = '#7c3aed';
      colorKitBtn.style.transform = 'translateY(-1px)';
      colorKitBtn.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.2)';
    });
    colorKitBtn.addEventListener('mouseleave', () => {
      colorKitBtn.style.background = 'linear-gradient(135deg, #f3e8ff 0%, #faf5ff 100%)';
      colorKitBtn.style.borderColor = '#8b5cf6';
      colorKitBtn.style.transform = 'translateY(0)';
      colorKitBtn.style.boxShadow = 'none';
    });

    // Click handler - open new EventColorPanel
    colorKitBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const eventId = ScenarioDetector.findEventIdByScenario(container, scenario);
      if (!eventId) {
        console.error('[CF] Could not find event ID for ColorKit options');
        return;
      }

      this.closeMenus();
      this.openEventColorPanel(eventId);
    });

    section.appendChild(colorKitBtn);

    // Custom section label and "+" button
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

    // Container for "+" button
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 4px;
      padding: 0 12px 0 0;
    `;

    // Add the "+" button (opens full color modal directly)
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

    // If event is marked to use Google colors, it has NO ColorKit properties
    // Don't show modal - just apply the new ColorKit color directly
    if (existingColors?.useGoogleColors) {
      return false;
    }

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

  /**
   * Update checkmarks and modify Google color labels
   * NOTE: We no longer intercept Google color buttons or hide their checkmarks.
   * Google colors are entirely handled by Google - we don't interfere.
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
    if (this.storageService.findEventColor) {
      const colorData = await this.storageService.findEventColor(eventId);
      currentColor = colorData?.hex;
    } else if (this.storageService.getEventColor) {
      const colorData = await this.storageService.getEventColor(eventId);
      currentColor = typeof colorData === 'string' ? colorData : colorData?.hex;
    }

    // Setup cleanup handlers: when user clicks Google color, remove our ColorKit color
    // This does NOT intercept Google's behavior - just cleans up our data
    this.setupGoogleColorCleanupHandlers(container, scenario, eventId);

    // Update checkmarks (only for our custom buttons, not Google's)
    this.updateCheckmarks(currentColor);

    // Modify Google color labels (this is safe - just changes display names)
    await this.modifyGoogleColorLabels();
  }

  /**
   * Setup handlers on Google color buttons to mark events for Google colors when clicked.
   * IMPORTANT: This does NOT prevent default or stop propagation.
   * Google's click handler still fires normally - we just mark the event.
   *
   * Uses markEventForGoogleColors() which sets useGoogleColors: true.
   * This tells mergeEventColors() to return null, bypassing:
   * - Individual event colors
   * - Calendar default colors (list coloring)
   * - Recurring series colors
   */
  setupGoogleColorCleanupHandlers(container, scenario, eventId) {
    const googleButtons = container.querySelectorAll(
      COLOR_PICKER_SELECTORS.GOOGLE_COLOR_BUTTON
    );

    googleButtons.forEach((button) => {
      // Only add handler once
      if (button.hasAttribute('data-cf-cleanup-handler')) return;
      button.setAttribute('data-cf-cleanup-handler', 'true');

      button.addEventListener('click', async () => {
        // Re-find event ID in case it changed
        const currentEventId = ScenarioDetector.findEventIdByScenario(container, scenario) || eventId;

        if (!currentEventId) return;

        console.log('[CF] Google color clicked - marking event for Google colors:', currentEventId);

        // Mark the event to use Google colors - this sets useGoogleColors: true
        // which bypasses BOTH individual colors AND calendar defaults (list coloring)
        if (this.storageService.markEventForGoogleColors) {
          await this.storageService.markEventForGoogleColors(currentEventId);
        } else {
          // Fallback to removeEventColor if markEventForGoogleColors not available
          console.warn('[CF] markEventForGoogleColors not available, falling back to removeEventColor');
          await this.storageService.removeEventColor(currentEventId);
        }

        // Trigger re-render - mergeEventColors will return null for this event
        this.triggerColorUpdate();
      });
    });
  }

  /**
   * Update checkmark visibility based on selected color
   * NOTE: We only manage checkmarks on OUR custom buttons, not Google's.
   */
  updateCheckmarks(selectedColor) {
    // Wait a bit for DOM to settle
    setTimeout(() => {
      // NOTE: We no longer hide Google's checkmarks.
      // Google manages their own checkmarks - we only manage ours.

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
    if (this.activePanel) {
      this.activePanel.close();
      this.activePanel = null;
    }
    if (this.activeModal) {
      this.activeModal.close();
      this.activeModal = null;
    }
  }
}

/**
 * Factory function
 */
export function createColorPickerInjector(storageService) {
  return new ColorPickerInjector(storageService);
}

// Make available globally
if (typeof window !== 'undefined') {
  window.cfColorPickerInjector = {
    ColorPickerInjector,
    createColorPickerInjector,
  };
}

export default ColorPickerInjector;
