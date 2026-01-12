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
    this.cssInjected = false;
  }

  /**
   * Initialize the injector
   */
  init() {
    console.log('[CF] ColorPickerInjector initialized');
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

      // Check if already injected
      const existingCustomSection = document.querySelector(
        '.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.COLOR_DIV_GROUP
      );
      const existingSeparator = document.querySelector(
        '.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.SEPARATOR
      );
      const existingCustomColorSection = document.querySelector('.cf-custom-color-section');

      if (existingCustomSection || existingSeparator || existingCustomColorSection) {
        this.isInjecting = false;
        return;
      }

      // Get categories from storage
      const categories = await this.storageService.getEventColorCategories?.();
      const categoryList = categories ? Object.values(categories) : [];

      // Inject categories (even if empty, we still inject the "+" button)
      this.injectColorCategories(categoryList);

      // Update checkmarks and Google color labels
      await this.hideCheckmarkAndModifyBuiltInColors();
    } catch (error) {
      console.error('[CF] Error injecting color picker:', error);
    }

    this.isInjecting = false;
  }

  /**
   * Inject color categories into the color picker
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

    // NOTE: We no longer add click handlers to Google color buttons.
    // When a user clicks a Google color, Google handles it entirely.
    // This separation prevents conflicts between Google colors and our custom colors.

    // Update checkmarks (only for our custom buttons, not Google's)
    this.updateCheckmarks(currentColor);

    // Modify Google color labels (this is safe - just changes display names)
    await this.modifyGoogleColorLabels();
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
