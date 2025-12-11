// ========================================
// EVENT COLORING FEATURE - Main Entry Point
// ========================================
// Provides custom color palettes for Google Calendar events
// Integrates with ColorKit extension architecture

(function () {
  'use strict';

  const feature = {
    id: 'eventColoring',
    name: 'Event Coloring',
    version: '1.0.0',

    // Internal state
    state: {
      settings: null,
      observer: null,
      initialized: false,
      messageHandler: null,
    },

    // ========================================
    // INITIALIZATION
    // ========================================

    /**
     * Initialize the feature
     * @param {Object} settings - Feature settings
     */
    init: async function (settings) {
      console.log('[Event Coloring] Initializing with settings:', settings);

      this.state.settings = settings || { enabled: true };
      console.log('[Event Coloring] Final settings:', this.state.settings);

      // Register message handler first (needed even when disabled)
      if (!this.state.messageHandler) {
        this.state.messageHandler = (message, sender, sendResponse) => {
          if (message.type === 'eventColoringChanged') {
            this.onSettingsChanged(message.settings);
            sendResponse({ success: true });
          } else if (message.type === 'eventColorChanged') {
            // Real-time color updates
            this.onColorChanged(message.eventId, message.color);
            sendResponse({ success: true });
          }
        };
        chrome.runtime.onMessage.addListener(this.state.messageHandler);
      }

      if (!this.state.settings.enabled) {
        console.log('[Event Coloring] Feature disabled, skipping initialization');
        this.cleanup();
        return;
      }

      console.log('[Event Coloring] Feature enabled, proceeding with initialization');

      try {
        // Initialize default palette
        console.log('[Event Coloring] Initializing default palette...');
        await window.eventColoringStorage.initializeDefaultPalette();

        // Load core modules
        console.log('[Event Coloring] Loading core modules...');
        await this.loadCoreModules();

        // Start DOM observation
        console.log('[Event Coloring] Starting DOM observer...');
        this.startObserver();

        // Apply existing colors
        console.log('[Event Coloring] Applying existing colors...');
        await this.applyExistingColors();

        this.state.initialized = true;
        console.log('[Event Coloring] ✅ Initialized successfully');
      } catch (error) {
        console.error('[Event Coloring] ❌ Initialization error:', error);
      }
    },

    /**
     * Load core modules
     */
    loadCoreModules: async function () {
      // Core modules are loaded via manifest content_scripts
      // Just verify they're available
      if (!window.eventColoringStorage) {
        throw new Error('Storage module not loaded');
      }
      if (!window.eventColoringSelectors) {
        throw new Error('Selectors module not loaded');
      }
      if (!window.eventColoringIdUtils) {
        throw new Error('ID utilities module not loaded');
      }

      console.log('[Event Coloring] Core modules verified');
    },

    // ========================================
    // DOM OBSERVATION
    // ========================================

    /**
     * Start observing DOM for color picker and event elements
     */
    startObserver: function () {
      if (this.state.observer) {
        this.state.observer.disconnect();
      }

      const selectors = window.eventColoringSelectors;

      // Debounced handlers
      let colorPickerTimeout = null;
      let eventRenderTimeout = null;

      this.state.observer = new MutationObserver((mutations) => {
        let shouldCheckColorPicker = false;
        let shouldRenderColors = false;

        for (const mutation of mutations) {
          if (mutation.addedNodes.length > 0) {
            for (const node of mutation.addedNodes) {
              if (node.nodeType === Node.ELEMENT_NODE) {
                // Check if color picker was added
                if (selectors.isColorPickerElement(node) || node.querySelector('[role="dialog"]')) {
                  shouldCheckColorPicker = true;
                }

                // Check if events were added
                if (
                  node.matches &&
                  (node.matches('[data-eventid]') || node.querySelector('[data-eventid]'))
                ) {
                  shouldRenderColors = true;
                }
              }
            }
          }
        }

        // Debounced color picker injection
        if (shouldCheckColorPicker) {
          if (colorPickerTimeout) clearTimeout(colorPickerTimeout);
          colorPickerTimeout = setTimeout(() => {
            this.injectColorPicker();
          }, 100);
        }

        // Debounced color rendering
        if (shouldRenderColors) {
          if (eventRenderTimeout) clearTimeout(eventRenderTimeout);
          eventRenderTimeout = setTimeout(() => {
            this.renderEventColors();
          }, 150);
        }
      });

      this.state.observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      // Initial injection attempt
      setTimeout(() => {
        this.injectColorPicker();
        this.renderEventColors();
      }, 500);

      console.log('[Event Coloring] DOM observer started');
    },

    // ========================================
    // COLOR PICKER INJECTION
    // ========================================

    /**
     * Inject custom color picker into Google Calendar
     */
    injectColorPicker: async function () {
      const selectors = window.eventColoringSelectors;

      // Check if already injected
      if (selectors.hasCustomColorsInjected()) {
        return;
      }

      // Detect scenario
      const scenario = selectors.detectScenario();
      if (scenario === selectors.Scenario.UNKNOWN) {
        return;
      }

      console.log('[Event Coloring] Injecting color picker for scenario:', scenario);

      // Find color picker container
      const container = selectors.findColorPickerContainer(scenario);
      if (!container) {
        console.warn('[Event Coloring] Color picker container not found');
        return;
      }

      // Get palettes
      const palettes = await window.eventColoringStorage.getAllPalettes();
      if (!palettes || Object.keys(palettes).length === 0) {
        console.warn('[Event Coloring] No palettes found');
        return;
      }

      // Find Google's color group
      const googleColorGroup = selectors.findBuiltInColorGroup();
      if (googleColorGroup) {
        googleColorGroup.style.marginBottom = '8px';
      }

      // Get the scrollable container
      const scrollContainer = container.querySelector('div');
      if (!scrollContainer) return;

      // Set max height and scroll for the container
      const maxHeight = scenario === selectors.Scenario.EVENTEDIT ? '600px' : '500px';
      scrollContainer.style.cssText = `
        max-height: ${maxHeight} !important;
        overflow-y: auto !important;
        overflow-x: hidden !important;
        padding-bottom: 12px !important;
        scrollbar-width: thin !important;
      `;

      // Add separator
      const separator = document.createElement('div');
      separator.className = selectors.COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.SEPARATOR;
      separator.style.cssText = `
        border-top: 1px solid #dadce0;
        margin: 8px 0;
      `;
      scrollContainer.appendChild(separator);

      // Sort palettes by order
      const sortedPalettes = Object.values(palettes).sort((a, b) => (a.order || 0) - (b.order || 0));

      // Inject each palette
      for (const palette of sortedPalettes) {
        const section = this.createPaletteSection(palette, scenario);
        if (section) {
          scrollContainer.appendChild(section);
        }
      }

      // Update checkmarks based on current event color
      const eventId = selectors.findEventIdByScenario(container, scenario);
      if (eventId) {
        const eventColor = await window.eventColoringStorage.getEventColor(eventId);
        if (eventColor) {
          this.updateCheckmarks(eventColor.hex);
        }
      }

      console.log('[Event Coloring] Color picker injected successfully');
    },

    /**
     * Create a palette section
     * @param {Object} palette - Palette data
     * @param {string} scenario - Current scenario
     * @returns {HTMLElement}
     */
    createPaletteSection: function (palette, scenario) {
      const selectors = window.eventColoringSelectors;

      // Create section container
      const section = document.createElement('div');
      section.style.marginTop = '16px';

      // Create category label
      const label = document.createElement('div');
      label.className = selectors.COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CATEGORY_LABEL;
      label.textContent = palette.name;
      label.style.cssText = `
        font-size: 12px;
        font-weight: 500;
        color: #202124;
        margin: 0 12px 12px 0;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      `;

      // Create color grid
      const grid = document.createElement('div');
      grid.className = selectors.COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.COLOR_DIV_GROUP;
      grid.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 4px;
        padding: 0 12px 0 0;
        width: 100%;
        box-sizing: border-box;
      `;

      // Add color buttons
      if (Array.isArray(palette.colors)) {
        palette.colors.forEach((color) => {
          const button = this.createColorButton(color, scenario);
          grid.appendChild(button);
        });
      }

      section.appendChild(label);
      section.appendChild(grid);

      return section;
    },

    /**
     * Create a color button
     * @param {Object} color - Color data {hex, name}
     * @param {string} scenario - Current scenario
     * @returns {HTMLElement}
     */
    createColorButton: function (color, scenario) {
      const selectors = window.eventColoringSelectors;

      const button = document.createElement('div');
      button.className = selectors.COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CUSTOM_COLOR_BUTTON;
      button.setAttribute('data-color', color.hex);
      button.setAttribute('aria-label', color.name || color.hex);
      button.setAttribute('role', 'button');
      button.setAttribute('tabindex', '0');

      button.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background-color: ${color.hex};
        cursor: pointer;
        position: relative;
        border: 2px solid transparent;
        transition: all 150ms ease;
      `;

      // Hover effect
      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
        button.style.borderColor = '#202124';
      });

      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
        button.style.borderColor = 'transparent';
      });

      // Click handler
      button.addEventListener('click', async () => {
        await this.handleColorSelection(color.hex, scenario);
      });

      return button;
    },

    /**
     * Handle color selection
     * @param {string} hex - Selected color hex
     * @param {string} scenario - Current scenario
     */
    handleColorSelection: async function (hex, scenario) {
      const selectors = window.eventColoringSelectors;
      const idUtils = window.eventColoringIdUtils;

      console.log('[Event Coloring] Color selected:', hex, 'Scenario:', scenario);

      try {
        if (scenario === selectors.Scenario.EVENTCREATE) {
          // New event - store temporarily
          idUtils.setTempColorSelection(hex);
          console.log('[Event Coloring] Temp color stored for new event');

          // TODO: Hook into save flow to apply color after event is created
        } else {
          // Existing event - get event ID and save
          const container = selectors.findColorPickerContainer(scenario);
          const eventId = selectors.findEventIdByScenario(container, scenario);

          if (!eventId) {
            console.warn('[Event Coloring] Event ID not found');
            return;
          }

          // Check if recurring
          const isRecurring = idUtils.isRecurringEvent(eventId);

          if (isRecurring) {
            // TODO: Show recurring event dialog
            console.log('[Event Coloring] Recurring event detected - dialog needed');
            // For now, just save as single event
            await window.eventColoringStorage.saveEventColor(eventId, hex, false);
          } else {
            // Save color
            await window.eventColoringStorage.saveEventColor(eventId, hex, false);
          }

          // Update checkmarks
          this.updateCheckmarks(hex);

          // Re-render colors
          await this.renderEventColors();
        }

        // Close color picker
        this.closeColorPicker();
      } catch (error) {
        console.error('[Event Coloring] Error handling color selection:', error);
      }
    },

    // ========================================
    // COLOR RENDERING
    // ========================================

    /**
     * Apply existing colors to calendar events
     */
    applyExistingColors: async function () {
      await this.renderEventColors();
    },

    /**
     * Render colors on event elements
     */
    renderEventColors: async function () {
      const selectors = window.eventColoringSelectors;
      const storage = window.eventColoringStorage;

      // Get all stored event colors
      const eventColors = await storage.getAllEventColors();
      if (!eventColors || Object.keys(eventColors).length === 0) {
        return;
      }

      // Find all event elements
      const eventElements = selectors.findAllEventElements();

      eventElements.forEach((element) => {
        const eventId = element.getAttribute('data-eventid');
        if (!eventId) return;

        const colorData = eventColors[eventId];
        if (!colorData) return;

        // Apply color
        this.applyColorToElement(element, colorData.hex);
      });
    },

    /**
     * Apply color to an event element
     * @param {HTMLElement} element - Event element
     * @param {string} hex - Color hex
     */
    applyColorToElement: function (element, hex) {
      if (!element || !hex) return;

      // Apply to background
      element.style.backgroundColor = hex;

      // Apply to border (common in Google Calendar)
      element.style.borderLeftColor = hex;

      // Adjust text color for contrast
      const brightness = this.getColorBrightness(hex);
      element.style.color = brightness > 128 ? '#000000' : '#FFFFFF';
    },

    /**
     * Get brightness of a color (0-255)
     * @param {string} hex - Color hex
     * @returns {number}
     */
    getColorBrightness: function (hex) {
      const rgb = this.hexToRgb(hex);
      if (!rgb) return 128;

      // Calculate perceived brightness
      return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    },

    /**
     * Convert hex to RGB
     * @param {string} hex - Color hex
     * @returns {Object|null}
     */
    hexToRgb: function (hex) {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result
        ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16),
          }
        : null;
    },

    // ========================================
    // CHECKMARK MANAGEMENT
    // ========================================

    /**
     * Update checkmarks to show selected color
     * @param {string} selectedHex - Currently selected color
     */
    updateCheckmarks: function (selectedHex) {
      const selectors = window.eventColoringSelectors;

      // Clear all checkmarks first
      selectors.clearAllCheckmarks();

      if (!selectedHex) return;

      // Find and mark the selected color button
      const allColorButtons = document.querySelectorAll(
        `[data-color], .${selectors.COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CUSTOM_COLOR_BUTTON}`
      );

      allColorButtons.forEach((button) => {
        const buttonColor = button.getAttribute('data-color');
        if (buttonColor && buttonColor.toLowerCase() === selectedHex.toLowerCase()) {
          selectors.toggleCheckmark(button, true);
        }
      });
    },

    /**
     * Close color picker (close dialog/menu)
     */
    closeColorPicker: function () {
      const dialogs = document.querySelectorAll('[role="menu"], [role="dialog"]');
      dialogs.forEach((dialog) => {
        // Only close if it's the color picker menu, not the main event dialog
        if (dialog.matches('[role="menu"]')) {
          dialog.remove();
        }
      });
    },

    // ========================================
    // EVENT HANDLERS
    // ========================================

    /**
     * Handle settings change
     * @param {Object} newSettings - New settings
     */
    onSettingsChanged: function (newSettings) {
      console.log('[Event Coloring] Settings changed:', newSettings);
      this.state.settings = newSettings;

      if (newSettings.enabled) {
        this.init(newSettings);
      } else {
        this.cleanup();
      }
    },

    /**
     * Handle color change event
     * @param {string} eventId - Event ID
     * @param {string} color - New color
     */
    onColorChanged: function (eventId, color) {
      console.log('[Event Coloring] Color changed:', eventId, color);

      // Re-render to apply new color
      this.renderEventColors();
    },

    // ========================================
    // CLEANUP
    // ========================================

    /**
     * Cleanup feature (when disabled)
     */
    cleanup: function () {
      if (this.state.observer) {
        this.state.observer.disconnect();
        this.state.observer = null;
      }

      // Remove injected elements
      const selectors = window.eventColoringSelectors;
      if (selectors) {
        const injected = document.querySelectorAll(
          `.${selectors.COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.COLOR_DIV_GROUP}, .${selectors.COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.SEPARATOR}`
        );
        injected.forEach((el) => el.remove());
      }

      this.state.initialized = false;
      console.log('[Event Coloring] Cleaned up');
    },

    /**
     * Disable feature
     */
    disable: function () {
      this.cleanup();

      if (this.state.messageHandler) {
        chrome.runtime.onMessage.removeListener(this.state.messageHandler);
        this.state.messageHandler = null;
      }

      console.log('[Event Coloring] Disabled');
    },
  };

  // Register feature
  if (window.cc3Features) {
    window.cc3Features.register(feature);
    console.log('[Event Coloring] Feature registered');
  } else {
    console.error('[Event Coloring] Feature registry not available');
  }
})();
