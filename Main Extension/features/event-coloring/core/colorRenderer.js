// features/event-coloring/core/colorRenderer.js
// Handles rendering/applying colors to Google Calendar events

import { DATA_ATTRIBUTES, EVENT_SELECTORS, COLOR_PICKER_SELECTORS, Scenario } from '../selectors.js';
import EventIdUtils from '../utils/eventIdUtils.js';
import ScenarioDetector from '../utils/scenarioDetector.js';

/**
 * ColorRenderer - Applies custom colors to calendar events
 */
export class ColorRenderer {
  constructor(storageService) {
    this.storageService = storageService;
    this.observerId = 'colorRenderer';
    this.isProcessing = false;
    this.processQueue = [];
  }

  /**
   * Initialize the renderer
   */
  init() {
    console.log('[CF] ColorRenderer initialized');
    this.updateAllEventColors();
  }

  /**
   * Update colors for all events from storage
   */
  async updateAllEventColors() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      // Check if custom colors are disabled
      const isDisabled = await this.storageService.getIsCustomColorsDisabled?.();
      if (isDisabled) {
        this.isProcessing = false;
        return;
      }

      // Get all event colors from storage
      const eventColors = await this.storageService.getAllEventColors();
      if (!eventColors || Object.keys(eventColors).length === 0) {
        this.isProcessing = false;
        return;
      }

      console.log('[CF] Retrieved event colors for rendering:', Object.keys(eventColors).length);

      // Separate recurring and non-recurring events
      const recurringEvents = [];
      const singleEvents = [];

      Object.entries(eventColors).forEach(([eventId, colorData]) => {
        const color = typeof colorData === 'string' ? colorData : colorData.hex;
        const isRecurring = typeof colorData === 'object' && colorData.isRecurring;

        if (isRecurring) {
          recurringEvents.push({ eventId, color, colorData });
        } else {
          singleEvents.push({ eventId, color, colorData });
        }
      });

      // Process in animation frame for performance
      requestAnimationFrame(() => {
        try {
          // Process recurring events first (they affect multiple elements)
          recurringEvents.forEach(({ eventId, color, colorData }) => {
            this.applyRecurringEventColor(eventId, color);
          });

          // Process single events
          singleEvents.forEach(({ eventId, color }) => {
            this.applySingleEventColor(eventId, color);
          });

          // Update any open editor/viewer dialogs
          this.updateOpenDialogs(eventColors);
        } catch (error) {
          console.error('[CF] Error applying colors:', error);
        }

        this.isProcessing = false;
      });
    } catch (error) {
      console.error('[CF] Error updating event colors:', error);
      this.isProcessing = false;
    }
  }

  /**
   * Apply color to a single event
   */
  applySingleEventColor(eventId, color) {
    const element = document.querySelector(`[${DATA_ATTRIBUTES.EVENT_ID}="${eventId}"]`);
    if (element) {
      this.updateColorOfEventElement(element, color);
    }
  }

  /**
   * Apply color to all instances of a recurring event
   */
  applyRecurringEventColor(eventId, color) {
    try {
      const parsedSource = EventIdUtils.fromEncoded(eventId);
      if (parsedSource.type !== 'calendar') return;

      // Find all event elements
      const allEventElements = document.querySelectorAll(`[${DATA_ATTRIBUTES.EVENT_ID}]`);

      allEventElements.forEach(element => {
        const elementEventId = element.getAttribute(DATA_ATTRIBUTES.EVENT_ID);
        if (!elementEventId) return;

        try {
          const parsedElement = EventIdUtils.fromEncoded(elementEventId);
          if (parsedElement.type !== 'calendar') return;

          // Check if this element matches the recurring event (same base ID)
          if (EventIdUtils.matchesEvent(parsedElement, parsedSource)) {
            this.updateColorOfEventElement(element, color);
          }
        } catch (e) {
          // Skip elements with invalid IDs
        }
      });
    } catch (error) {
      console.error('[CF] Error applying recurring event color:', error);
    }
  }

  /**
   * Update the color of a single event element
   */
  updateColorOfEventElement(element, color) {
    if (!element || !color) return;

    // Mark as modified to prevent re-processing
    element.setAttribute(DATA_ATTRIBUTES.CF_COLORED, 'true');

    // Get all descendant elements that might have color styles
    const allElements = [element, ...Array.from(element.querySelectorAll('*'))];
    const colorProperties = EVENT_SELECTORS.STYLE_PROPERTIES.COLORS;

    allElements.forEach(el => {
      if (!(el instanceof HTMLElement)) return;

      const computedStyle = window.getComputedStyle(el);

      colorProperties.forEach(prop => {
        const currentValue = computedStyle.getPropertyValue(
          prop.replace(/([A-Z])/g, '-$1').toLowerCase()
        );

        // Only update if the element has a background or border color set
        if (currentValue && currentValue !== 'rgba(0, 0, 0, 0)' && currentValue !== 'transparent') {
          if (prop === 'backgroundColor') {
            el.style.backgroundColor = color;
          } else if (prop === 'borderColor') {
            el.style.borderColor = color;
          } else if (prop === 'borderLeftColor') {
            el.style.borderLeftColor = color;
          } else if (prop === 'borderRightColor') {
            el.style.borderRightColor = color;
          }
        }
      });
    });

    // Also update any color chip elements
    const chips = element.querySelectorAll(EVENT_SELECTORS.CHIP.VISUAL);
    chips.forEach(chip => {
      if (chip instanceof HTMLElement) {
        chip.style.backgroundColor = color;
      }
    });
  }

  /**
   * Update color selectors in any open dialogs
   */
  async updateOpenDialogs(eventColors) {
    // Update event editor color selector
    await this.updateEditorColorSelector(eventColors);

    // Update event viewer color indicator
    await this.updateViewerColorIndicator(eventColors);
  }

  /**
   * Update the color selector in the event editor
   */
  async updateEditorColorSelector(eventColors) {
    const scenario = ScenarioDetector.detectCurrentScenario();

    if (scenario === Scenario.EVENTEDIT) {
      const eventId = ScenarioDetector.findEventIdFromEditUrl();
      if (!eventId) return;

      // Find the color for this event
      const colorData = await this.findColorForEvent(eventId, eventColors);
      if (!colorData) return;

      const color = typeof colorData === 'string' ? colorData : colorData.hex;

      // Find and update the color selector
      const colorSelector = document.querySelector(EVENT_SELECTORS.EDITOR.COLOR_SELECTOR);
      if (colorSelector instanceof HTMLElement) {
        colorSelector.style.backgroundColor = color;
      }
    }
  }

  /**
   * Update the color indicator in the event viewer
   */
  async updateViewerColorIndicator(eventColors) {
    const viewerDialog = document.querySelector(EVENT_SELECTORS.VIEWER.DIALOG);
    if (!viewerDialog) return;

    const eventId = ScenarioDetector.findEventIdFromViewer();
    if (!eventId) return;

    const colorData = await this.findColorForEvent(eventId, eventColors);
    if (!colorData) return;

    const color = typeof colorData === 'string' ? colorData : colorData.hex;

    // Find and update color indicators in the viewer
    const colorIndicators = viewerDialog.querySelectorAll(EVENT_SELECTORS.VIEWER.COLOR_INDICATOR);
    colorIndicators.forEach(indicator => {
      if (indicator instanceof HTMLElement) {
        indicator.style.backgroundColor = color;
      }
    });
  }

  /**
   * Find the color for an event, considering recurring events
   */
  async findColorForEvent(eventId, eventColors = null) {
    if (!eventColors) {
      eventColors = await this.storageService.getAllEventColors();
    }

    // Direct match
    if (eventColors[eventId]) {
      return eventColors[eventId];
    }

    // Check for recurring event match
    const parsedEvent = EventIdUtils.fromEncoded(eventId);
    if (parsedEvent.type !== 'calendar') return null;

    // Look for a matching recurring event
    for (const [storedId, colorData] of Object.entries(eventColors)) {
      if (typeof colorData === 'object' && colorData.isRecurring) {
        const storedParsed = EventIdUtils.fromEncoded(storedId);
        if (EventIdUtils.matchesEvent(parsedEvent, storedParsed)) {
          return colorData;
        }
      }
    }

    return null;
  }

  /**
   * Update the small color swatch in Google's color picker
   * @param {string} eventId - The event ID
   * @param {string} color - The hex color
   */
  updateGoogleColorSwatch(eventId, color) {
    // Find the color picker container
    const container = ScenarioDetector.getColorPickerContainer();
    if (!container) return;

    // Toggle checkmarks - remove from Google colors, add to custom
    this.updateCheckmarks(container, color);
  }

  /**
   * Update checkmarks in the color picker
   */
  updateCheckmarks(container, selectedColor) {
    // Remove checkmarks from Google color buttons
    const googleButtons = container.querySelectorAll(COLOR_PICKER_SELECTORS.GOOGLE_COLOR_BUTTON);
    googleButtons.forEach(button => {
      this.toggleCheckmark(button, false);
    });

    // Add checkmark to matching custom color button
    const customButtons = container.querySelectorAll(
      '.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CUSTOM_COLOR_BUTTON
    );
    customButtons.forEach(button => {
      const buttonColor = button.getAttribute('data-color');
      const isSelected = buttonColor && buttonColor.toLowerCase() === selectedColor.toLowerCase();
      this.toggleCheckmark(button, isSelected);
    });
  }

  /**
   * Toggle checkmark visibility on a color button
   */
  toggleCheckmark(button, show) {
    if (!button) return;

    const checkmark = button.querySelector(COLOR_PICKER_SELECTORS.CHECKMARK_SELECTOR);
    if (checkmark) {
      checkmark.style.display = show ? 'block' : 'none';
    }
  }

  /**
   * Clean up
   */
  destroy() {
    this.isProcessing = false;
    this.processQueue = [];
  }
}

// Factory function
export function createColorRenderer(storageService) {
  return new ColorRenderer(storageService);
}

// Make available globally
if (typeof window !== 'undefined') {
  window.cfColorRenderer = {
    ColorRenderer,
    createColorRenderer,
  };
}

export default ColorRenderer;
