// features/event-coloring/index.js
// Event Coloring Feature - Enhanced with Color Extension functionality
// Supports recurring events, proper color swatch updates, and improved DOM handling

(async function () {
  console.log('[EventColoring] Feature loading (enhanced version)...');

  // ========================================
  // IMPORTS (loaded dynamically since we're not using bundler)
  // ========================================

  // Load selectors
  const {
    COLOR_PICKER_SELECTORS,
    DATA_ATTRIBUTES,
    EVENT_SELECTORS,
    Scenario,
  } = await loadModule('./selectors.js');

  // ========================================
  // STATE
  // ========================================
  let settings = {};
  let eventColors = {};
  let categories = {};
  let templates = {}; // Color templates: templateId → { id, name, background, text, border, borderWidth, categoryId }
  let calendarColors = {}; // Cache: calendarId → { backgroundColor, foregroundColor } (from Google API)
  let calendarDefaultColors = {}; // User-defined per-calendar colors: calendarId → { background, text, border }
  let isEnabled = false;
  let colorPickerObserver = null;
  let colorRenderObserver = null;
  let lastClickedEventId = null;
  let lastClickedIsTask = false; // Track if last clicked element was a task
  let isInjecting = false;

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

  // Modern color hex values (canonical keys for storage)
  const MODERN_COLORS = [
    '#d50000', '#e67c73', '#f4511e', '#f6bf26', '#33b679',
    '#0b8043', '#039be5', '#3f51b5', '#7986cb', '#8e24aa', '#616161'
  ];

  // Classic color hex values
  const CLASSIC_COLORS = [
    '#dc2127', '#ff887c', '#ffb878', '#fbd75b', '#7ae7bf',
    '#51b749', '#46d6db', '#5484ed', '#a4bdfc', '#dbadff', '#e1e1e1'
  ];

  // Check if a color is a Modern scheme color
  function isModernColor(hex) {
    return MODERN_COLORS.includes(hex.toLowerCase());
  }

  // Check if a color is a Classic scheme color
  function isClassicColor(hex) {
    return CLASSIC_COLORS.includes(hex.toLowerCase());
  }

  // Get the Modern equivalent of any Google color (for consistent label lookup)
  function getModernEquivalent(hex) {
    const normalizedHex = hex.toLowerCase();
    if (isModernColor(normalizedHex)) {
      return normalizedHex;
    }
    // If it's a Classic color, map it to Modern
    return GOOGLE_COLOR_SCHEME_MAP[normalizedHex] || normalizedHex;
  }

  // Get the equivalent color in the other scheme
  function getSchemeEquivalent(hex) {
    return GOOGLE_COLOR_SCHEME_MAP[hex.toLowerCase()] || null;
  }

  // ========================================
  // MODULE LOADER
  // ========================================

  async function loadModule(path) {
    // For content scripts, we use the window globals set by the modules
    // The modules are loaded via manifest.json content_scripts
    return {
      COLOR_PICKER_SELECTORS: {
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
      },
      DATA_ATTRIBUTES: {
        EVENT_ID: 'data-eventid',
        COLOR_MODIFIED: 'data-cf-color-modified',
        CF_COLORED: 'data-cf-event-colored',
      },
      EVENT_SELECTORS: {
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
        STYLE_PROPERTIES: {
          COLORS: ['backgroundColor', 'borderColor', 'borderLeftColor', 'borderRightColor'],
        },
        CHIP: {
          CONTAINER: '[data-eventchip]',
          DRAGGABLE: '[data-draggable-id]',
          VISUAL: '.FAxxKc',
        },
      },
      Scenario: {
        EVENTEDIT: 'EVENTEDIT',
        LISTVIEW: 'LISTVIEW',
        EVENTVIEW: 'EVENTVIEW',
        NEWEVENT: 'NEWEVENT',
        CALENDARLIST: 'CALENDARLIST',
      },
    };
  }

  // ========================================
  // EVENT ID UTILITIES (from Color Extension)
  // ========================================

  const EventIdUtils = {
    fromEncoded(encodedId) {
      try {
        if (!encodedId) {
          return { type: 'invalid', isRecurring: false };
        }

        let decoded;
        try {
          decoded = atob(encodedId);
        } catch (e) {
          return {
            type: 'calendar',
            encodedId,
            decodedId: encodedId,
            isRecurring: false,
            emailSuffix: '',
          };
        }

        const emailMatch = decoded.match(/\s+(\S+@\S+)$/);
        const emailSuffix = emailMatch ? emailMatch[1] : '';
        const eventPart = emailSuffix
          ? decoded.substring(0, decoded.length - emailSuffix.length).trim()
          : decoded;

        // Recurring events have instance date suffix like _20231215T100000Z
        const recurringMatch = eventPart.match(/^(.+?)(_\d{8}T\d{6}Z)?$/);
        const baseId = recurringMatch ? recurringMatch[1] : eventPart;
        const instanceDate = recurringMatch && recurringMatch[2] ? recurringMatch[2] : null;

        return {
          type: 'calendar',
          encodedId,
          decodedId: baseId,
          instanceDate,
          isRecurring: !!instanceDate,
          emailSuffix,
          fullDecoded: decoded,
        };
      } catch (error) {
        return { type: 'invalid', encodedId, isRecurring: false };
      }
    },

    toEncodedEventId(decodedId, emailSuffix) {
      try {
        const combined = emailSuffix ? `${decodedId} ${emailSuffix}` : decodedId;
        return btoa(combined);
      } catch (error) {
        return decodedId;
      }
    },

    matchesEvent(event1, event2) {
      if (!event1 || !event2) return false;
      if (event1.type !== 'calendar' || event2.type !== 'calendar') return false;
      return event1.decodedId === event2.decodedId;
    },
  };

  // ========================================
  // SCENARIO DETECTOR (from Color Extension)
  // ========================================

  const ScenarioDetector = {
    findColorPickerScenario(container = document) {
      if (container.querySelector(COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR)) {
        return Scenario.EVENTEDIT;
      }
      if (container.querySelector(COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST)) {
        return Scenario.LISTVIEW;
      }
      if (window.location.href.includes('/eventedit/')) {
        return Scenario.EVENTEDIT;
      }
      return null;
    },

    findEventIdByScenario(container, scenario) {
      if (!container || !scenario) return null;

      switch (scenario) {
        case Scenario.EVENTEDIT:
          return this.findEventIdFromEditUrl() || this.findEventIdFromContainer(container);
        case Scenario.LISTVIEW:
          return this.findEventIdFromContainer(container);
        default:
          return this.findEventIdFromContainer(container);
      }
    },

    findEventIdFromEditUrl() {
      const url = window.location.href;
      const match = url.match(/\/eventedit\/([^/?]+)/);
      return match ? match[1] : null;
    },

    findEventIdFromContainer(container) {
      if (!container) return null;

      let eventId = container.getAttribute('data-eventid');
      if (eventId) return eventId;

      const ancestor = container.closest('[data-eventid]');
      if (ancestor) {
        return ancestor.getAttribute('data-eventid');
      }

      let parent = container.parentElement;
      while (parent) {
        eventId = parent.getAttribute('data-eventid');
        if (eventId) return eventId;
        parent = parent.parentElement;
      }

      return null;
    },
  };

  // ========================================
  // RECURRING EVENT DIALOG (from Color Extension)
  // ========================================

  function showRecurringEventDialog(options) {
    const { eventId, color, onConfirm, onClose } = options;

    // Remove existing dialogs
    document.querySelectorAll('.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.RECURRING_DIALOG)
      .forEach(el => el.remove());

    // Create container
    const container = document.createElement('div');
    container.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.RECURRING_DIALOG;
    container.style.cssText = `
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 10000;
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
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      padding: 24px;
      min-width: 320px;
      max-width: 400px;
      z-index: 1;
    `;

    // Color preview
    const colorPreview = document.createElement('div');
    colorPreview.style.cssText = `
      width: 40px; height: 40px;
      border-radius: 50%;
      background-color: ${color};
      margin: 0 auto 16px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    `;

    // Title
    const title = document.createElement('h2');
    title.textContent = 'Recurring Event';
    title.style.cssText = `
      margin: 0 0 8px;
      font-size: 18px;
      font-weight: 500;
      color: #202124;
      text-align: center;
    `;

    // Description
    const description = document.createElement('p');
    description.textContent = 'This is a recurring event. Would you like to apply this color to:';
    description.style.cssText = `
      margin: 0 0 20px;
      font-size: 14px;
      color: #5f6368;
      text-align: center;
      line-height: 1.5;
    `;

    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    const allEventsBtn = createDialogButton('All events in series', true);
    const thisOnlyBtn = createDialogButton('This event only', false);
    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.style.cssText = `
      background: transparent;
      border: none;
      color: #5f6368;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      margin-top: 8px;
    `;
    cancelBtn.addEventListener('click', close);

    function createDialogButton(text, applyToAll) {
      const btn = document.createElement('button');
      btn.textContent = text;
      btn.style.cssText = `
        background: ${applyToAll ? '#1a73e8' : 'white'};
        color: ${applyToAll ? 'white' : '#1a73e8'};
        border: ${applyToAll ? 'none' : '1px solid #1a73e8'};
        border-radius: 4px;
        padding: 12px 24px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
      `;
      btn.addEventListener('click', () => {
        if (onConfirm) onConfirm(applyToAll);
        close();
      });
      return btn;
    }

    function close() {
      container.remove();
      document.querySelectorAll('[role="menu"], [role="dialog"]').forEach(el => {
        if (!el.closest('.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.RECURRING_DIALOG)) {
          el.remove();
        }
      });
      if (onClose) onClose();
    }

    // Handle escape
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', handleKeyDown);

    buttonsContainer.appendChild(allEventsBtn);
    buttonsContainer.appendChild(thisOnlyBtn);
    buttonsContainer.appendChild(cancelBtn);

    dialog.appendChild(colorPreview);
    dialog.appendChild(title);
    dialog.appendChild(description);
    dialog.appendChild(buttonsContainer);

    container.appendChild(overlay);
    container.appendChild(dialog);
    document.body.appendChild(container);
  }

  // ========================================
  // CALENDAR COLORS API
  // ========================================

  /**
   * Fetch all calendar colors from background (single API call, cached)
   */
  async function fetchCalendarColors() {
    try {
      const colors = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_CALENDAR_COLORS' }, (response) => {
          resolve(response || {});
        });
      });
      calendarColors = colors;
      console.log('[EventColoring] Fetched colors for', Object.keys(calendarColors).length, 'calendars:',
        Object.entries(calendarColors).map(([id, c]) => `${id}=${c.backgroundColor}`).join(', '));
    } catch (error) {
      console.error('[EventColoring] Failed to fetch calendar colors:', error);
      calendarColors = {};
    }
  }

  /**
   * Get calendar color for an event by its encoded event ID
   * @param {string} encodedEventId - The data-eventid value
   * @returns {string|null} Background color hex or null
   */
  function getCalendarColorForEvent(encodedEventId) {
    if (!encodedEventId || Object.keys(calendarColors).length === 0) {
      return null;
    }

    try {
      let partialCalendarId = null;

      if (encodedEventId.startsWith('ttb_')) {
        // TTB format: decode base64 after prefix
        const base64Part = encodedEventId.slice(4);
        const decoded = atob(base64Part);
        const spaceIndex = decoded.indexOf(' ');
        if (spaceIndex > 0) {
          partialCalendarId = decoded.substring(spaceIndex + 1);
        }
      } else {
        // Standard format: base64 encoded with email suffix
        try {
          const decoded = atob(encodedEventId);
          const spaceIndex = decoded.indexOf(' ');
          if (spaceIndex > 0) {
            partialCalendarId = decoded.substring(spaceIndex + 1);
          }
        } catch (e) {
          // Not base64, might be plain ID
        }
      }

      if (partialCalendarId) {
        // First try exact match
        if (calendarColors[partialCalendarId]) {
          console.log('[EventColoring] Calendar color found (exact match):', partialCalendarId);
          return calendarColors[partialCalendarId].backgroundColor;
        }

        // The event ID often has truncated email (e.g., "adam.hurley.private@m" instead of full "@gmail.com")
        // Extract the username part (before @) to match against full calendar IDs
        const atIndex = partialCalendarId.indexOf('@');
        if (atIndex > 0) {
          const usernamePrefix = partialCalendarId.substring(0, atIndex);

          for (const calendarId of Object.keys(calendarColors)) {
            // Check if the calendar ID starts with the same username
            if (calendarId.startsWith(usernamePrefix + '@')) {
              console.log('[EventColoring] Calendar color found (username match):', calendarId, 'from partial:', partialCalendarId);
              return calendarColors[calendarId].backgroundColor;
            }
          }
        }

        console.log('[EventColoring] No calendar color found for:', partialCalendarId, 'Available calendars:', Object.keys(calendarColors));
      }

      return null;
    } catch (error) {
      console.error('[EventColoring] Failed to get calendar color for event:', error);
      return null;
    }
  }

  /**
   * Get the calendar ID for an event (for looking up user-defined calendar default colors)
   * @param {string} encodedEventId - The data-eventid value
   * @returns {string|null} Calendar ID or null
   */
  function getCalendarIdForEvent(encodedEventId) {
    if (!encodedEventId) return null;

    try {
      let partialCalendarId = null;

      if (encodedEventId.startsWith('ttb_')) {
        // TTB format: decode base64 after prefix
        const base64Part = encodedEventId.slice(4);
        const decoded = atob(base64Part);
        const spaceIndex = decoded.indexOf(' ');
        if (spaceIndex > 0) {
          partialCalendarId = decoded.substring(spaceIndex + 1);
        }
      } else {
        // Standard format: base64 encoded with email suffix
        try {
          const decoded = atob(encodedEventId);
          const spaceIndex = decoded.indexOf(' ');
          if (spaceIndex > 0) {
            partialCalendarId = decoded.substring(spaceIndex + 1);
          }
        } catch (e) {
          // Not base64, might be plain ID
        }
      }

      if (partialCalendarId) {
        // First try exact match in calendarDefaultColors
        if (calendarDefaultColors[partialCalendarId]) {
          return partialCalendarId;
        }

        // Try username prefix matching
        const atIndex = partialCalendarId.indexOf('@');
        if (atIndex > 0) {
          const usernamePrefix = partialCalendarId.substring(0, atIndex);

          for (const calendarId of Object.keys(calendarDefaultColors)) {
            if (calendarId.startsWith(usernamePrefix + '@')) {
              return calendarId;
            }
          }
        }

        // Also check against calendarColors (Google API cache) for full calendar ID resolution
        if (calendarColors[partialCalendarId]) {
          return partialCalendarId;
        }

        if (atIndex > 0) {
          const usernamePrefix = partialCalendarId.substring(0, atIndex);
          for (const calendarId of Object.keys(calendarColors)) {
            if (calendarId.startsWith(usernamePrefix + '@')) {
              // Return the full calendar ID for use in looking up default colors
              return calendarId;
            }
          }
        }
      }

      return null;
    } catch (error) {
      console.error('[EventColoring] Failed to get calendar ID for event:', error);
      return null;
    }
  }

  /**
   * Get user-defined calendar default colors for an event
   * @param {string} encodedEventId - The data-eventid value
   * @returns {Object|null} { background, text, border } or null
   */
  function getCalendarDefaultColorsForEvent(encodedEventId) {
    const calendarId = getCalendarIdForEvent(encodedEventId);
    if (!calendarId) return null;

    const colors = calendarDefaultColors[calendarId];
    if (!colors) return null;

    // Only return if at least one color is set
    if (colors.background || colors.text || colors.border) {
      return colors;
    }

    return null;
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  async function init(featureSettings) {
    settings = featureSettings || {};

    // Ensure settings are fully loaded from storage
    if (!settings.googleColorLabels || !settings.categories) {
      console.log('[EventColoring] Settings incomplete, reloading from storage...');
      const fullSettings = await window.cc3Storage.getEventColoringSettings();
      settings = { ...settings, ...fullSettings };
    }

    isEnabled = settings.enabled !== false;
    categories = settings.categories || {};
    templates = settings.templates || {};

    console.log('[EventColoring] Initializing (enhanced)...', {
      isEnabled,
      categoriesCount: Object.keys(categories).length,
      templatesCount: Object.keys(templates).length,
      googleColorLabelsCount: Object.keys(settings.googleColorLabels || {}).length,
      disableCustomColors: settings.disableCustomColors || false,
    });

    if (!isEnabled) {
      console.log('[EventColoring] Feature disabled');
      return;
    }

    // Load event colors from storage
    eventColors = await window.cc3Storage.getAllEventColors();
    console.log('[EventColoring] Loaded', Object.keys(eventColors).length, 'event colors');

    // Load calendar default colors (user-defined per-calendar colors)
    calendarDefaultColors = await window.cc3Storage.getEventCalendarColors();
    console.log('[EventColoring] Loaded calendar default colors for', Object.keys(calendarDefaultColors).length, 'calendars');

    // Fetch calendar colors from API (single call, cached in background)
    await fetchCalendarColors();

    // Start observers
    startColorPickerObserver();
    startColorRenderObserver();

    // Apply stored colors
    applyStoredColors();

    // Capture event clicks
    setupEventClickCapture();

    // Listen for color change events
    window.addEventListener('cf-event-color-changed', () => {
      console.log('[EventColoring] Color changed event received');
      refreshColors();
    });

    console.log('[EventColoring] Initialized successfully (enhanced)');
  }

  // ========================================
  // COLOR PICKER OBSERVER
  // ========================================

  function startColorPickerObserver() {
    if (colorPickerObserver) {
      colorPickerObserver.disconnect();
    }

    colorPickerObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.matches) {
              const colorPicker = node.matches('[role="menu"]')
                ? node
                : node.querySelector('[role="menu"]');
              if (colorPicker && isColorPicker(colorPicker) && !colorPicker.dataset.cfEventColorModified) {
                console.log('[EventColoring] Color picker detected');
                injectCustomCategories(colorPicker);
              }
            }
          });
        }
      }
    });

    colorPickerObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    console.log('[EventColoring] Color picker observer started');
  }

  function startColorRenderObserver() {
    if (colorRenderObserver) {
      colorRenderObserver.disconnect();
    }

    // Debounce color updates
    let renderTimeout = null;

    colorRenderObserver = new MutationObserver(() => {
      if (renderTimeout) clearTimeout(renderTimeout);
      renderTimeout = setTimeout(() => {
        applyStoredColors();
      }, 100);
    });

    colorRenderObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-eventid'],
    });

    console.log('[EventColoring] Color render observer started');
  }

  function isColorPicker(element) {
    // Check for Google Calendar's specific color picker structure
    const hasLy0WLButtons = element.querySelector('div[jsname="Ly0WL"]');
    if (hasLy0WLButtons) {
      return true;
    }

    // Fallback check
    const hasDataColorButtons = element.querySelectorAll('[data-color]').length >= 8;
    const isMenu = element.getAttribute('role') === 'menu';
    return isMenu && hasDataColorButtons;
  }

  // ========================================
  // COLOR PICKER INJECTION
  // ========================================

  function injectCustomCategories(colorPickerElement) {
    if (colorPickerElement.dataset.cfEventColorModified || isInjecting) {
      return;
    }

    // Skip injection for task elements - tasks should not have color picker customization
    if (lastClickedIsTask) {
      console.log('[EventColoring] Skipping color picker injection for task');
      return;
    }

    isInjecting = true;
    colorPickerElement.dataset.cfEventColorModified = 'true';
    console.log('[EventColoring] Injecting custom categories');

    // Always update Google color labels first
    updateGoogleColorLabels(colorPickerElement);
    updateCheckmarks(colorPickerElement);

    // Check if custom colors are disabled
    if (settings.disableCustomColors) {
      console.log('[EventColoring] Custom colors disabled');
      isInjecting = false;
      return;
    }

    // Find container
    const builtInColorGroup = findBuiltInColorGroup(colorPickerElement);
    if (!builtInColorGroup) {
      console.warn('[EventColoring] Could not find built-in color group');
      isInjecting = false;
      return;
    }

    const parentContainer = builtInColorGroup.parentElement;
    if (!parentContainer) {
      isInjecting = false;
      return;
    }

    // Detect scenario for proper sizing
    const scenario = ScenarioDetector.findColorPickerScenario();

    // Style parent for scrolling
    parentContainer.style.cssText = `
      max-height: ${scenario === Scenario.EVENTEDIT ? '600px' : '500px'} !important;
      max-width: ${scenario === Scenario.EVENTEDIT ? '200px' : '300px'} !important;
      overflow-y: auto !important;
      overflow-x: hidden !important;
      padding-bottom: 12px !important;
      scrollbar-width: thin !important;
    `;

    builtInColorGroup.style.marginBottom = '8px';

    // Add separator
    const separator = document.createElement('div');
    separator.style.cssText = 'border-top: 1px solid #dadce0; margin: 8px 12px;';
    separator.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.SEPARATOR;
    parentContainer.appendChild(separator);

    // Add categories
    const categoriesArray = Object.values(categories).sort((a, b) => (a.order || 0) - (b.order || 0));

    // Get templates assigned to each category
    const getTemplatesForCategory = (categoryId) => {
      return Object.values(templates)
        .filter(t => t.categoryId === categoryId)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
    };

    // Get unassigned templates (not assigned to any category)
    const unassignedTemplates = Object.values(templates)
      .filter(t => !t.categoryId)
      .sort((a, b) => (a.order || 0) - (b.order || 0));

    const hasContent = categoriesArray.length > 0 || unassignedTemplates.length > 0;

    if (!hasContent) {
      const emptyState = document.createElement('div');
      emptyState.style.cssText = `
        padding: 20px;
        text-align: center;
        color: #64748b;
        font-size: 12px;
        line-height: 1.5;
      `;
      emptyState.innerHTML = `
        <div style="font-weight: 600; margin-bottom: 4px;">No Custom Colors Yet</div>
        <div>Open the extension popup to create color categories or templates</div>
      `;
      parentContainer.appendChild(emptyState);
    } else {
      // Add categories first
      categoriesArray.forEach((category) => {
        const categoryTemplates = getTemplatesForCategory(category.id);
        const section = createCategorySection(category, categoryTemplates, colorPickerElement, scenario);
        if (section) {
          parentContainer.appendChild(section);
        }
      });

      // Add unassigned templates section at the bottom (after categories)
      if (unassignedTemplates.length > 0) {
        const templatesSection = createTemplatesSection(unassignedTemplates, colorPickerElement, scenario);
        if (templatesSection) {
          parentContainer.appendChild(templatesSection);
        }
      }
    }

    // Add "Custom Color" section with "+" button for full color picker
    const customColorSection = createCustomColorSection(colorPickerElement, scenario);
    if (customColorSection) {
      parentContainer.appendChild(customColorSection);
    }

    // Add click handlers to Google color buttons (to clear custom colors)
    setupGoogleColorButtonHandlers(colorPickerElement);

    isInjecting = false;
  }

  function findBuiltInColorGroup(pickerElement) {
    // Strategy 1: Look for vbVGZb class (Google's color group)
    const vbVGZb = pickerElement.querySelector('.vbVGZb');
    if (vbVGZb) return vbVGZb;

    // Strategy 2: Look for container with multiple colored children
    const colorGroups = pickerElement.querySelectorAll('div[role="presentation"]');
    for (const group of colorGroups) {
      const coloredChildren = group.querySelectorAll('div[style*="background"]');
      if (coloredChildren.length >= 8) {
        return group;
      }
    }

    // Strategy 3: Find parent of first color button
    const firstColorBtn = pickerElement.querySelector('div[jsname="Ly0WL"]');
    if (firstColorBtn && firstColorBtn.parentElement) {
      return firstColorBtn.parentElement;
    }

    return pickerElement.querySelector('div');
  }

  // Create templates section for unassigned templates
  function createTemplatesSection(templatesArray, pickerElement, scenario) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 12px; padding: 0 12px;';
    section.className = 'cf-templates-section';

    // Label with icon
    const label = document.createElement('div');
    label.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: #8b5cf6;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 4px;
    `;
    label.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/>
      </svg>
      Templates
    `;

    // Templates container - compact grid layout
    const templatesContainer = document.createElement('div');
    templatesContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px;';

    templatesArray.forEach((template) => {
      const button = createTemplateButton(template, pickerElement, scenario);
      templatesContainer.appendChild(button);
    });

    section.appendChild(label);
    section.appendChild(templatesContainer);

    return section;
  }

  // Create template button (compact pill style)
  function createTemplateButton(template, pickerElement, scenario) {
    const button = document.createElement('div');
    button.className = 'cf-template-button';
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', template.name);
    button.dataset.templateId = template.id;

    // Compact pill button styled with the template colors
    button.style.cssText = `
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      border-radius: 12px;
      background: ${template.background};
      color: ${template.text};
      outline: ${template.borderWidth}px solid ${template.border};
      outline-offset: -${Math.round(template.borderWidth * 0.3)}px;
      font-size: 10px;
      font-weight: 500;
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.1s;
      white-space: nowrap;
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
    `;

    button.textContent = template.name;

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.05)';
      button.style.boxShadow = '0 2px 6px rgba(0, 0, 0, 0.2)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.boxShadow = 'none';
    });

    // Click handler - apply template colors
    button.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const container = pickerElement.closest(
        COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR + ', ' +
        COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST
      ) || pickerElement;

      const eventId = ScenarioDetector.findEventIdByScenario(container, scenario) ||
                     lastClickedEventId ||
                     getEventIdFromContext();

      if (eventId) {
        // Get existing colors for this event to merge with template
        const existingColors = findColorForEvent(eventId) || {};
        const calendarDefaults = getCalendarDefaultColorsForEvent(eventId) || {};

        // Merge: template values override existing, but only if template value is set (not null)
        // If template value is null, keep the existing value
        const colors = {
          background: template.background !== null ? template.background : (existingColors.background || calendarDefaults.background || null),
          text: template.text !== null ? template.text : (existingColors.text || calendarDefaults.text || null),
          border: template.border !== null ? template.border : (existingColors.border || calendarDefaults.border || null),
          borderWidth: template.borderWidth !== null ? template.borderWidth : (existingColors.borderWidth ?? calendarDefaults.borderWidth ?? null)
        };

        console.log('[EventColoring] Applying template with merge:', { template: template.name, existingColors, calendarDefaults, mergedColors: colors });
        await handleFullColorSelection(eventId, colors);
      } else {
        console.warn('[EventColoring] Could not determine event ID for template');
      }
    });

    // Keyboard support
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        button.click();
      }
    });

    return button;
  }

  function createCategorySection(category, categoryTemplates, pickerElement, scenario) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 16px; padding: 0 12px;';
    section.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CATEGORY_SECTION;

    // Label
    const label = document.createElement('div');
    label.textContent = category.name;
    label.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: #5f6368;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    section.appendChild(label);

    // Add color swatches first
    const colors = category.colors || [];
    if (colors.length > 0) {
      const colorGrid = document.createElement('div');
      colorGrid.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.COLOR_DIV_GROUP;
      colorGrid.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 8px;
      `;

      colors.forEach((color) => {
        const button = createColorButton(color, pickerElement, scenario);
        colorGrid.appendChild(button);
      });

      section.appendChild(colorGrid);
    }

    // Add templates below colors (if any assigned to this category)
    if (categoryTemplates && categoryTemplates.length > 0) {
      const templatesContainer = document.createElement('div');
      templatesContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;';

      categoryTemplates.forEach((template) => {
        const button = createTemplateButton(template, pickerElement, scenario);
        templatesContainer.appendChild(button);
      });

      section.appendChild(templatesContainer);
    }

    // Show empty state only if no colors AND no templates
    if (colors.length === 0 && (!categoryTemplates || categoryTemplates.length === 0)) {
      const emptyNote = document.createElement('div');
      emptyNote.textContent = 'No colors or templates in this category';
      emptyNote.style.cssText = 'font-size: 11px; color: #9aa0a6; font-style: italic;';
      section.appendChild(emptyNote);
    }

    return section;
  }

  function createColorButton(color, pickerElement, scenario) {
    const button = document.createElement('div');
    button.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CUSTOM_COLOR_BUTTON;
    button.setAttribute('data-color', color.hex);
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('aria-label', color.label || color.hex);
    button.title = color.label || color.hex;

    button.style.cssText = `
      width: 18px;
      height: 18px;
      border-radius: 50%;
      background-color: ${color.hex};
      cursor: pointer;
      position: relative;
      transition: transform 0.1s, box-shadow 0.1s;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Checkmark (hidden by default)
    const checkmark = document.createElement('i');
    checkmark.className = 'google-material-icons cf-checkmark';
    checkmark.textContent = 'check';
    checkmark.style.cssText = `
      font-size: 12px;
      color: white;
      display: none;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    `;
    button.appendChild(checkmark);

    // Hover effects
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.15)';
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

      const container = pickerElement.closest(
        COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR + ', ' +
        COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST
      ) || pickerElement;

      const eventId = ScenarioDetector.findEventIdByScenario(container, scenario) ||
                     lastClickedEventId ||
                     getEventIdFromContext();

      if (eventId) {
        await handleColorSelection(eventId, color.hex);
      } else {
        console.warn('[EventColoring] Could not determine event ID');
      }
    });

    // Keyboard support
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        button.click();
      }
    });

    return button;
  }

  /**
   * Create the "Custom Color" section with the "+" button for full color picker
   */
  function createCustomColorSection(pickerElement, scenario) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 16px; padding: 0 12px;';
    section.className = 'cf-custom-color-section';

    // Label
    const label = document.createElement('div');
    label.textContent = 'Custom';
    label.style.cssText = `
      font-size: 11px;
      font-weight: 600;
      color: #5f6368;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    `;

    // Container for button
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    `;

    // Create the "+" button
    const customButton = document.createElement('div');
    customButton.className = 'cf-custom-color-btn';
    customButton.setAttribute('role', 'button');
    customButton.setAttribute('tabindex', '0');
    customButton.setAttribute('aria-label', 'Choose custom color');
    customButton.title = 'Choose any color';
    customButton.textContent = '+';
    customButton.style.cssText = `
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
    `;

    customButton.addEventListener('mouseenter', () => {
      customButton.style.borderColor = '#1a73e8';
      customButton.style.background = '#e8f0fe';
      customButton.style.color = '#1a73e8';
      customButton.style.transform = 'scale(1.1)';
    });

    customButton.addEventListener('mouseleave', () => {
      customButton.style.borderColor = '#9aa0a6';
      customButton.style.background = '#f8f9fa';
      customButton.style.color = '#5f6368';
      customButton.style.transform = 'scale(1)';
    });

    customButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      const container = pickerElement.closest(
        COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR + ', ' +
        COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST
      ) || pickerElement;

      const eventId = ScenarioDetector.findEventIdByScenario(container, scenario) ||
                     lastClickedEventId ||
                     getEventIdFromContext();

      if (!eventId) {
        console.error('[EventColoring] Could not find event ID for custom color');
        return;
      }

      // Close color picker menus
      closeColorPickerMenus();

      // Open the color swatch modal
      openCustomColorModal(eventId);
    });

    customButton.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        customButton.click();
      }
    });

    buttonContainer.appendChild(customButton);
    section.appendChild(label);
    section.appendChild(buttonContainer);

    return section;
  }

  /**
   * Close color picker menus
   */
  function closeColorPickerMenus() {
    document.querySelectorAll('[role="menu"], [role="dialog"]').forEach((el) => {
      // Don't close our custom dialogs
      if (!el.closest('.cf-recurring-dialog-container') && !el.closest('.csm-modal')) {
        el.remove();
      }
    });
  }

  /**
   * Get the original colors of an event from the DOM
   * @param {string} eventId - The event ID
   * @returns {Object} - { background, text, border, title }
   */
  function getEventColorsFromDOM(eventId) {
    const element = document.querySelector(`[data-eventid="${eventId}"]`);
    if (!element) {
      return { background: '#039be5', text: '#ffffff', border: null, title: 'Sample Event' };
    }

    // Get computed styles
    const computedStyle = window.getComputedStyle(element);

    // Get background color
    let background = computedStyle.backgroundColor;
    if (background === 'rgba(0, 0, 0, 0)' || background === 'transparent') {
      background = '#039be5'; // Default calendar blue
    } else {
      // Convert rgb to hex
      background = rgbToHex(background);
    }

    // Get text color from the title element
    const titleEl = element.querySelector('.I0UMhf') || element.querySelector('.lhydbb');
    let text = '#ffffff';
    let title = 'Sample Event';
    if (titleEl) {
      const titleStyle = window.getComputedStyle(titleEl);
      text = rgbToHex(titleStyle.color) || '#ffffff';
      title = titleEl.textContent?.trim() || 'Sample Event';
    }

    // Get border/outline color if actually set (check style and width too)
    let border = null;
    const outlineStyle = computedStyle.outlineStyle;
    const outlineWidth = computedStyle.outlineWidth;
    const outlineColor = computedStyle.outlineColor;

    // Only consider it a border if outline-style is not 'none' and width > 0
    if (outlineStyle && outlineStyle !== 'none' && outlineWidth && outlineWidth !== '0px') {
      if (outlineColor && outlineColor !== 'rgb(0, 0, 0)' && outlineColor !== 'rgba(0, 0, 0, 0)') {
        border = rgbToHex(outlineColor);
      }
    }

    return { background, text, border, title };
  }

  /**
   * Convert RGB string to hex
   */
  function rgbToHex(rgb) {
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
   * Open the custom color swatch modal (with bg/text/border tabs)
   */
  let activeColorModal = null;

  function openCustomColorModal(eventId) {
    // Close any existing modal
    if (activeColorModal) {
      activeColorModal.close();
      activeColorModal = null;
    }

    // Inject modal CSS if not already done
    injectModalCSS();

    // Get current custom colors for this event (support new format)
    const colorData = findColorForEvent(eventId);

    // Get calendar default colors to merge with event colors
    // This ensures we inherit borderWidth from calendar if event doesn't have one
    const calendarDefaults = getCalendarDefaultColorsForEvent(eventId);

    // Merge: event colors take precedence, calendar colors fill in gaps
    // This is critical for borderWidth - if user hasn't set a manual borderWidth,
    // we should show the calendar's borderWidth, not the default 2px
    const currentColors = {
      background: colorData?.background || colorData?.hex || null,
      text: colorData?.text || null,
      border: colorData?.border || null,
      // Use event borderWidth, fall back to calendar borderWidth, then default to 2
      borderWidth: colorData?.borderWidth ?? calendarDefaults?.borderWidth ?? 2,
    };

    console.log('[EventColoring] openCustomColorModal - colorData:', colorData);
    console.log('[EventColoring] openCustomColorModal - calendarDefaults:', calendarDefaults);
    console.log('[EventColoring] openCustomColorModal - currentColors to pass to modal:', currentColors);

    // Get original event colors from DOM for accurate preview
    const domColors = getEventColorsFromDOM(eventId);
    const originalColors = {
      background: domColors.background,
      text: domColors.text,
      border: domColors.border,
    };
    const eventTitle = domColors.title;

    // Check if EventColorModal is available (preferred), fallback to ColorSwatchModal
    if (typeof window.EventColorModal === 'function') {
      console.log('[EventColoring] Opening EventColorModal with colors:', currentColors, 'original:', originalColors);

      activeColorModal = new window.EventColorModal({
        id: `cf-event-color-modal-${Date.now()}`,
        currentColors,
        originalColors,
        eventTitle,
        onApply: async (colors) => {
          console.log('[EventColoring] Event colors applied:', colors);
          await handleFullColorSelection(eventId, colors);
        },
        onClose: () => {
          activeColorModal = null;
        },
      });

      activeColorModal.open();
    } else if (typeof window.ColorSwatchModal === 'function') {
      // Fallback to old single-color modal
      console.log('[EventColoring] Falling back to ColorSwatchModal');

      activeColorModal = new window.ColorSwatchModal({
        id: `cf-event-color-modal-${Date.now()}`,
        currentColor: currentColors.background || '#4285f4',
        helperText: 'Choose a custom color for this event',
        onColorSelect: async (color) => {
          console.log('[EventColoring] Custom color selected:', color);
          await handleColorSelection(eventId, color);
          activeColorModal?.close();
          activeColorModal = null;
        },
        onClose: () => {
          activeColorModal = null;
        },
      });

      activeColorModal.open();
    } else {
      console.error('[EventColoring] No color modal available');
    }
  }

  /**
   * Handle full color selection with background/text/border
   */
  async function handleFullColorSelection(eventId, colors) {
    console.log('[EventColoring] handleFullColorSelection called:', { eventId, colors });
    console.log('[EventColoring] borderWidth from modal:', colors.borderWidth, 'type:', typeof colors.borderWidth);

    // Check if all colors are cleared (all null AND borderWidth is default 2)
    // If borderWidth is anything other than 2, the user has explicitly set it,
    // so we should save it (even if bg/text/border are null)
    // Also, if there's an inherited border from calendar, we need to save the borderWidth
    // to allow the user to override the calendar's thickness
    const calendarDefaults = getCalendarDefaultColorsForEvent(eventId);
    const hasBorderFromCalendar = !!calendarDefaults?.border;
    const hasCustomBorderWidth = colors.borderWidth != null;

    // Only treat as "all cleared" if:
    // 1. No bg/text/border colors are set AND
    // 2. No custom borderWidth is being applied (or there's no calendar border to apply it to)
    const allColorsCleared = !colors.background && !colors.text && !colors.border &&
                             (!hasCustomBorderWidth || !hasBorderFromCalendar);

    console.log('[EventColoring] calendarDefaults:', calendarDefaults);
    console.log('[EventColoring] hasBorderFromCalendar:', hasBorderFromCalendar, 'hasCustomBorderWidth:', hasCustomBorderWidth, 'allColorsCleared:', allColorsCleared);

    // Check if recurring event
    const parsed = EventIdUtils.fromEncoded(eventId);

    if (allColorsCleared) {
      console.log('[EventColoring] All colors cleared, removing event color');

      if (parsed.isRecurring) {
        // For recurring events, show dialog to choose clear scope
        showRecurringEventDialog({
          eventId,
          color: null, // No color for display (clearing)
          onConfirm: async (applyToAll) => {
            console.log('[EventColoring] Recurring clear confirmed, applyToAll:', applyToAll);
            // Remove the event color from storage
            await window.cc3Storage.removeEventColor(eventId);
            delete eventColors[eventId];

            // Close modal and color picker
            if (activeColorModal) {
              activeColorModal.close();
              activeColorModal = null;
            }
            closeColorPicker();

            // Force page refresh to show cleared state
            window.location.reload();
          },
          onClose: () => {
            console.log('[EventColoring] Recurring clear dialog closed');
          },
        });
      } else {
        // Single event - remove color and refresh
        await window.cc3Storage.removeEventColor(eventId);
        delete eventColors[eventId];

        // Close the modal first
        if (activeColorModal) {
          activeColorModal.close();
          activeColorModal = null;
        }

        closeColorPicker();

        // Force page refresh to show cleared state
        window.location.reload();
      }
      return;
    }

    if (parsed.isRecurring) {
      // Show recurring event dialog
      showRecurringEventDialog({
        eventId,
        color: colors.background, // For display
        onConfirm: async (applyToAll) => {
          console.log('[EventColoring] Recurring confirmed for full colors, applyToAll:', applyToAll);
          await saveFullColorsWithRecurringSupport(eventId, colors, applyToAll);

          // Update the Google color swatch before closing
          if (colors.background) {
            updateGoogleColorSwatch(eventId, colors.background);
          }

          closeColorPicker();
          refreshColors();
        },
        onClose: () => {
          console.log('[EventColoring] Recurring dialog closed');
        },
      });
    } else {
      // Single event - save with full colors
      await saveFullColors(eventId, colors);

      // Update the Google color swatch
      if (colors.background) {
        updateGoogleColorSwatch(eventId, colors.background);
      }

      closeColorPicker();
      applyFullColorsToEvent(eventId, colors);
    }

    // Close the modal
    if (activeColorModal) {
      activeColorModal.close();
      activeColorModal = null;
    }
  }

  /**
   * Save full colors (bg/text/border/borderWidth) for a single event
   */
  async function saveFullColors(eventId, colors) {
    console.log('[EventColoring] saveFullColors called:', { eventId, colors });
    console.log('[EventColoring] colors.borderWidth:', colors.borderWidth, 'type:', typeof colors.borderWidth);

    const colorData = {
      background: colors.background || null,
      text: colors.text || null,
      border: colors.border || null,
      // Use null-coalescing to preserve the borderWidth value (even if it's falsy like 0)
      // Only fall back to null if it's truly undefined/null
      borderWidth: colors.borderWidth ?? null,
      hex: colors.background || null, // Backward compatibility
      isRecurring: false,
      appliedAt: Date.now(),
    };

    console.log('[EventColoring] colorData to save:', colorData);

    // IMPORTANT: Update local cache FIRST for immediate effect
    // This prevents race conditions where MutationObserver fires before storage save completes
    eventColors[eventId] = colorData;
    console.log('[EventColoring] Updated local cache FIRST for event:', eventId.slice(0, 30) + '...', 'borderWidth:', colorData.borderWidth);

    // Then save to storage (async, can complete in background)
    if (window.cc3Storage.saveEventColorsFullAdvanced) {
      await window.cc3Storage.saveEventColorsFullAdvanced(eventId, colors, { applyToAll: false });
      console.log('[EventColoring] Saved to storage via saveEventColorsFullAdvanced');
    } else {
      // Fallback: save as single color
      await window.cc3Storage.saveEventColor(eventId, colors.background, false);
    }
  }

  /**
   * Save full colors with recurring event support
   */
  async function saveFullColorsWithRecurringSupport(eventId, colors, applyToAll) {
    const parsed = EventIdUtils.fromEncoded(eventId);

    const colorData = {
      background: colors.background || null,
      text: colors.text || null,
      border: colors.border || null,
      // Use null-coalescing to preserve the borderWidth value
      borderWidth: colors.borderWidth ?? null,
      hex: colors.background || null,
      isRecurring: applyToAll && parsed.isRecurring,
      appliedAt: Date.now(),
    };

    // Update local cache FIRST for immediate effect (before async storage operations)
    if (applyToAll && parsed.isRecurring) {
      const baseStorageId = EventIdUtils.toEncodedEventId(parsed.decodedId, parsed.emailSuffix);
      eventColors[baseStorageId] = colorData;
    } else {
      eventColors[eventId] = colorData;
    }

    if (applyToAll && parsed.isRecurring) {
      const baseStorageId = EventIdUtils.toEncodedEventId(parsed.decodedId, parsed.emailSuffix);

      if (window.cc3Storage.saveEventColorsFullAdvanced) {
        await window.cc3Storage.saveEventColorsFullAdvanced(eventId, colors, { applyToAll: true });
      } else if (window.cc3Storage.saveEventColorAdvanced) {
        await window.cc3Storage.saveEventColorAdvanced(eventId, colors.background, { applyToAll: true });
      }

      // Clean up individual instance colors (cache was already updated at function start)
      Object.keys(eventColors).forEach((storedId) => {
        try {
          const storedParsed = EventIdUtils.fromEncoded(storedId);
          if (storedParsed.decodedId === parsed.decodedId && storedId !== baseStorageId) {
            delete eventColors[storedId];
          }
        } catch (e) {}
      });
    } else {
      await saveFullColors(eventId, colors);
    }
  }

  /**
   * Apply full colors to an event element
   * Merges with calendar defaults to ensure inherited properties (like border) are applied
   */
  function applyFullColorsToEvent(eventId, colors) {
    console.log('[EventColoring] applyFullColorsToEvent called:', { eventId, colors });

    // Get calendar default colors and merge - this ensures that if the user
    // only changed borderWidth but not border color, we still apply the
    // inherited border color from the calendar
    const calendarDefaults = getCalendarDefaultColorsForEvent(eventId);
    console.log('[EventColoring] calendarDefaults for event:', calendarDefaults);

    const mergedColors = mergeEventColors(colors, calendarDefaults);
    console.log('[EventColoring] mergedColors result:', mergedColors);

    const elements = document.querySelectorAll(`[data-eventid="${eventId}"]`);
    console.log('[EventColoring] Found', elements.length, 'elements to apply colors to');

    elements.forEach((element) => {
      if (!element.closest('[role="dialog"]')) {
        applyFullColorsToElement(element, mergedColors || colors);
      }
    });
  }

  /**
   * Apply full colors (bg/text/border/borderWidth) to a single element
   */
  function applyFullColorsToElement(element, colors) {
    if (!element) return;

    // Skip task elements - tasks should not receive event coloring
    if (isTaskElement(element)) return;

    const { background, text, border, borderWidth = 2 } = colors;
    const eventId = element.getAttribute('data-eventid');
    const isEventChip = element.matches('[data-eventchip]');

    if (isEventChip) {
      // Apply background
      if (background) {
        const calendarColor = getCalendarColorForEvent(eventId);

        if (calendarColor) {
          const gradient = `linear-gradient(to right, ${calendarColor} 4px, ${background} 4px)`;
          element.style.setProperty('background', gradient, 'important');
        } else {
          element.style.setProperty('background-color', background, 'important');
        }

        element.style.borderColor = adjustColorBrightness(background, -15);
      }

      // Apply text color
      const textColor = text || (background ? getTextColorForBackground(background) : null);
      if (textColor) {
        element.style.color = textColor;

        // Update text color on child elements
        element.querySelectorAll('.I0UMhf, .KcY3wb, .lhydbb, .fFwDnf, .XuJrye, span').forEach((child) => {
          if (child instanceof HTMLElement) {
            child.style.color = textColor;
          }
        });
      }

      // Apply border using outline (with configurable width)
      // Outline is positioned 30% inside, 70% outside
      if (border) {
        element.style.outline = `${borderWidth}px solid ${border}`;
        element.style.outlineOffset = `-${borderWidth * 0.3}px`;
      } else {
        element.style.outline = '';
        element.style.outlineOffset = '';
      }

      element.dataset.cfEventColored = 'true';
    }
  }

  /**
   * Inject CSS for the ColorSwatchModal into the page
   */
  let modalCSSInjected = false;

  function injectModalCSS() {
    if (modalCSSInjected) return;

    const styleId = 'cf-color-swatch-modal-css';
    if (document.getElementById(styleId)) {
      modalCSSInjected = true;
      return;
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* ColorSwatchModal Styles - Injected by EventColoring */
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
        width: 380px;
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
        grid-template-columns: repeat(7, 1fr);
        gap: 8px;
      }
      .csm-swatch {
        width: 100%;
        max-width: 36px;
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
    `;
    document.head.appendChild(style);
    modalCSSInjected = true;
    console.log('[EventColoring] Modal CSS injected');
  }

  function setupGoogleColorButtonHandlers(pickerElement) {
    const googleButtons = pickerElement.querySelectorAll(COLOR_PICKER_SELECTORS.GOOGLE_COLOR_BUTTON);

    googleButtons.forEach((button) => {
      if (button.hasAttribute('data-cf-handler')) return;
      button.setAttribute('data-cf-handler', 'true');

      button.addEventListener('click', async () => {
        const scenario = ScenarioDetector.findColorPickerScenario();
        const eventId = ScenarioDetector.findEventIdByScenario(button, scenario) ||
                       lastClickedEventId ||
                       getEventIdFromContext();

        if (eventId) {
          // Remove custom color when Google color is selected
          await window.cc3Storage.removeEventColor(eventId);
          delete eventColors[eventId];
          console.log('[EventColoring] Removed custom color for:', eventId);
        }
      });
    });
  }

  function updateGoogleColorLabels(pickerElement) {
    const customLabels = settings.googleColorLabels || {};
    const colorButtons = pickerElement.querySelectorAll(COLOR_PICKER_SELECTORS.GOOGLE_COLOR_BUTTON);

    colorButtons.forEach((button) => {
      const dataColor = button.getAttribute('data-color');
      if (!dataColor) return;

      const normalizedColor = dataColor.toLowerCase();

      // Try direct lookup first
      let customLabel = customLabels[normalizedColor];

      // If not found, try looking up the equivalent color from the other scheme
      // This handles cases where user set labels while using one scheme but is now viewing in another
      if (!customLabel) {
        const equivalentColor = getSchemeEquivalent(normalizedColor);
        if (equivalentColor) {
          customLabel = customLabels[equivalentColor];
          console.log('[EventColoring] Label lookup via scheme mapping:', normalizedColor, '→', equivalentColor, '=', customLabel);
        }
      }

      if (customLabel) {
        button.setAttribute('aria-label', customLabel);
        const labelElement = button.querySelector(COLOR_PICKER_SELECTORS.LABEL_ELEMENT);
        if (labelElement) {
          labelElement.setAttribute('data-text', customLabel);
        }
      }
    });
  }

  function updateCheckmarks(pickerElement) {
    const eventId = lastClickedEventId || getEventIdFromContext();
    if (!eventId) return;

    // Find color for this event (considering recurring)
    const colorData = findColorForEvent(eventId);
    const selectedColor = colorData?.hex;

    // Clear Google checkmarks if we have custom color
    if (selectedColor) {
      const googleButtons = pickerElement.querySelectorAll(COLOR_PICKER_SELECTORS.GOOGLE_COLOR_BUTTON);
      googleButtons.forEach((button) => {
        const checkmark = button.querySelector(COLOR_PICKER_SELECTORS.CHECKMARK_SELECTOR);
        if (checkmark) {
          checkmark.style.display = 'none';
        }
      });
    }

    // Update custom color button checkmarks
    const customButtons = pickerElement.querySelectorAll(
      '.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.CUSTOM_COLOR_BUTTON
    );

    customButtons.forEach((button) => {
      const buttonColor = button.getAttribute('data-color');
      const isSelected = selectedColor && buttonColor &&
                        buttonColor.toLowerCase() === selectedColor.toLowerCase();

      const checkmark = button.querySelector('.cf-checkmark');
      if (checkmark) {
        checkmark.style.display = isSelected ? 'block' : 'none';
      }
    });
  }

  // ========================================
  // COLOR SELECTION HANDLING
  // ========================================

  async function handleColorSelection(eventId, colorHex) {
    console.log('[EventColoring] Color selected:', eventId, colorHex);

    // Check if recurring event
    const parsed = EventIdUtils.fromEncoded(eventId);

    if (parsed.isRecurring) {
      // Show recurring event dialog
      showRecurringEventDialog({
        eventId,
        color: colorHex,
        onConfirm: async (applyToAll) => {
          console.log('[EventColoring] Recurring confirmed, applyToAll:', applyToAll);
          await saveColorWithRecurringSupport(eventId, colorHex, applyToAll);

          // Update the Google color swatch before closing
          updateGoogleColorSwatch(eventId, colorHex);

          closeColorPicker();
          refreshColors();
        },
        onClose: () => {
          console.log('[EventColoring] Recurring dialog closed');
        },
      });
    } else {
      // Single event
      await window.cc3Storage.saveEventColor(eventId, colorHex, false);
      eventColors[eventId] = { hex: colorHex, isRecurring: false, appliedAt: Date.now() };

      // Update the Google color swatch before closing
      updateGoogleColorSwatch(eventId, colorHex);

      closeColorPicker();
      applyColorToEvent(eventId, colorHex);
    }
  }

  /**
   * Update Google Calendar's color swatch/indicator in the editor or viewer
   * This is the small colored circle that shows the currently selected color
   * IMPORTANT: Only update the preview swatch, NOT the color buttons in the palette
   */
  function updateGoogleColorSwatch(eventId, colorHex) {
    const scenario = ScenarioDetector.findColorPickerScenario();
    console.log('[EventColoring] Updating Google color swatch for scenario:', scenario);

    // Find the color selector button in the event editor (NOT inside the color picker menu)
    // This is the button you click to open the color picker - it shows the current color
    const colorSelectorButtons = document.querySelectorAll('div[jsname="QPiGnd"].A1wrjc.kQuqUe');

    colorSelectorButtons.forEach((swatch) => {
      // Make sure this element is NOT inside a color picker menu
      // The menu has role="menu" or role="listbox"
      const isInsideMenu = swatch.closest('[role="menu"], [role="listbox"], [role="dialog"]');

      if (!isInsideMenu && swatch instanceof HTMLElement) {
        swatch.style.backgroundColor = colorHex;
        console.log('[EventColoring] Updated preview swatch color to:', colorHex);
      }
    });

    // Also check for the event viewer color indicator (different element)
    if (scenario === Scenario.EVENTVIEW) {
      const viewerIndicators = document.querySelectorAll('.xnWuge');
      viewerIndicators.forEach((indicator) => {
        const isInsideMenu = indicator.closest('[role="menu"], [role="listbox"]');
        if (!isInsideMenu && indicator instanceof HTMLElement) {
          indicator.style.backgroundColor = colorHex;
        }
      });
    }
  }

  async function saveColorWithRecurringSupport(eventId, colorHex, applyToAll) {
    const parsed = EventIdUtils.fromEncoded(eventId);

    if (applyToAll && parsed.isRecurring) {
      // Store under base ID for recurring events
      const baseStorageId = EventIdUtils.toEncodedEventId(parsed.decodedId, parsed.emailSuffix);

      // Use advanced storage if available
      if (window.cc3Storage.saveEventColorAdvanced) {
        await window.cc3Storage.saveEventColorAdvanced(eventId, colorHex, { applyToAll: true });
      } else {
        await window.cc3Storage.saveEventColor(baseStorageId, colorHex, true);
      }

      // Update local cache
      eventColors[baseStorageId] = { hex: colorHex, isRecurring: true, appliedAt: Date.now() };

      // Clean up individual instance colors
      Object.keys(eventColors).forEach((storedId) => {
        try {
          const storedParsed = EventIdUtils.fromEncoded(storedId);
          if (storedParsed.decodedId === parsed.decodedId && storedId !== baseStorageId) {
            delete eventColors[storedId];
          }
        } catch (e) {}
      });
    } else {
      await window.cc3Storage.saveEventColor(eventId, colorHex, false);
      eventColors[eventId] = { hex: colorHex, isRecurring: false, appliedAt: Date.now() };
    }
  }

  /**
   * Normalize color data from storage (handles old and new formats)
   * Preserves borderWidth if set, otherwise returns null to allow inheritance from calendar
   */
  function normalizeColorData(colorData) {
    if (!colorData) return null;

    // Handle string format (very old)
    if (typeof colorData === 'string') {
      return {
        background: colorData,
        text: null,
        border: null,
        borderWidth: null, // Allow inheritance from calendar
        hex: colorData,
        isRecurring: false,
      };
    }

    // Handle old format with only hex
    if (colorData.hex && !colorData.background && colorData.background !== null) {
      return {
        background: colorData.hex,
        text: null,
        border: null,
        // Use null-coalescing to preserve 0 if somehow set, but treat undefined as null
        borderWidth: colorData.borderWidth ?? null,
        hex: colorData.hex,
        isRecurring: colorData.isRecurring || false,
      };
    }

    // New format - return as-is with proper null handling
    // Use null-coalescing (??) to preserve explicit values including 0
    return {
      background: colorData.background || null,
      text: colorData.text || null,
      border: colorData.border || null,
      borderWidth: colorData.borderWidth ?? null,
      hex: colorData.hex || colorData.background || null,
      isRecurring: colorData.isRecurring || false,
    };
  }

  function findColorForEvent(eventId) {
    // Direct match
    if (eventColors[eventId]) {
      return normalizeColorData(eventColors[eventId]);
    }

    // Check for recurring event match
    const parsed = EventIdUtils.fromEncoded(eventId);
    if (parsed.type !== 'calendar') return null;

    for (const [storedId, colorData] of Object.entries(eventColors)) {
      const normalized = normalizeColorData(colorData);
      if (normalized && normalized.isRecurring) {
        const storedParsed = EventIdUtils.fromEncoded(storedId);
        if (EventIdUtils.matchesEvent(parsed, storedParsed)) {
          return normalized;
        }
      }
    }

    return null;
  }

  // ========================================
  // COLOR APPLICATION
  // ========================================

  async function refreshColors() {
    eventColors = await window.cc3Storage.getAllEventColors();
    calendarDefaultColors = await window.cc3Storage.getEventCalendarColors();
    applyStoredColors();

    // Also update the color swatch if we're in an event editor
    const currentEventId = lastClickedEventId || getEventIdFromContext();
    if (currentEventId) {
      const colorData = findColorForEvent(currentEventId);
      if (colorData?.hex) {
        updateGoogleColorSwatch(currentEventId, colorData.hex);
      }
    }
  }

  async function applyStoredColors() {
    console.log('[EventColoring] Applying stored colors');

    // Always refresh calendar default colors from storage to ensure we have the latest
    // This handles cases where the broadcast message might not have been received
    try {
      const freshCalendarColors = await window.cc3Storage.getEventCalendarColors();
      if (freshCalendarColors && Object.keys(freshCalendarColors).length > 0) {
        calendarDefaultColors = freshCalendarColors;
        console.log('[EventColoring] Refreshed calendar colors from storage:', JSON.stringify(calendarDefaultColors));
      }
    } catch (e) {
      console.log('[EventColoring] Could not refresh calendar colors:', e);
    }

    // Build lookup maps for manual colors
    const recurringEventColors = new Map(); // base event ID -> colors
    const singleEventColors = new Map(); // exact event ID -> colors

    Object.entries(eventColors).forEach(([eventId, colorData]) => {
      const normalized = normalizeColorData(colorData);
      if (!normalized) return;

      if (normalized.isRecurring) {
        const parsed = EventIdUtils.fromEncoded(eventId);
        if (parsed.type === 'calendar') {
          recurringEventColors.set(parsed.decodedId, normalized);
        }
      } else {
        singleEventColors.set(eventId, normalized);
      }
    });

    // Apply colors to all event elements
    // Merge manual colors with calendar defaults - each property independent
    const allEventElements = document.querySelectorAll('[data-eventid]');

    allEventElements.forEach((element) => {
      // Skip events in dialogs
      if (element.closest('[role="dialog"]')) return;

      // Skip task elements - tasks should not receive calendar list colors
      if (isTaskElement(element)) return;

      const eventId = element.getAttribute('data-eventid');
      if (!eventId) return;

      // Get manual colors for this event (single or recurring)
      let manualColors = singleEventColors.get(eventId);

      if (!manualColors) {
        // Check for recurring event colors
        const parsed = EventIdUtils.fromEncoded(eventId);
        if (parsed.type === 'calendar') {
          manualColors = recurringEventColors.get(parsed.decodedId);
        }
      }

      // Get calendar default colors
      const calendarDefaultColorsForEvent = getCalendarDefaultColorsForEvent(eventId);

      // Merge: manual colors take precedence, calendar defaults fill in gaps
      const mergedColors = mergeEventColors(manualColors, calendarDefaultColorsForEvent);

      // Debug logging for borderWidth issues
      if (manualColors && manualColors.borderWidth != null) {
        console.log('[EventColoring] applyStoredColors merge for event:', eventId.slice(0, 20) + '...', {
          manualBorderWidth: manualColors.borderWidth,
          calendarBorderWidth: calendarDefaultColorsForEvent?.borderWidth,
          mergedBorderWidth: mergedColors?.borderWidth,
        });
      }

      if (mergedColors) {
        applyColorsToElement(element, mergedColors);
      }
    });
  }

  /**
   * Merge manual event colors with calendar default colors
   * Manual colors take precedence for each property independently
   * @param {Object|null} manualColors - { background, text, border, borderWidth } from event coloring
   * @param {Object|null} calendarColors - { background, text, border, borderWidth } from calendar defaults
   * @returns {Object|null} Merged colors or null if no colors
   */
  function mergeEventColors(manualColors, calendarColors) {
    if (!manualColors && !calendarColors) return null;
    if (!calendarColors) return manualColors;
    if (!manualColors) return calendarColors;

    // Merge: manual takes precedence for each property
    // For borderWidth: use manual if explicitly set (not null/undefined), else calendar, else default 2
    const mergedBorderWidth = (manualColors.borderWidth != null)
      ? manualColors.borderWidth
      : (calendarColors.borderWidth != null ? calendarColors.borderWidth : 2);

    return {
      background: manualColors.background || calendarColors.background || null,
      text: manualColors.text || calendarColors.text || null,
      border: manualColors.border || calendarColors.border || null,
      borderWidth: mergedBorderWidth,
      // Preserve isRecurring from manual if present
      isRecurring: manualColors.isRecurring || false,
    };
  }

  function applyRecurringEventColor(eventId, colors) {
    const parsed = EventIdUtils.fromEncoded(eventId);
    if (parsed.type !== 'calendar') return;

    const allEventElements = document.querySelectorAll('[data-eventid]');

    allEventElements.forEach((element) => {
      const elementEventId = element.getAttribute('data-eventid');
      if (!elementEventId) return;

      try {
        const elementParsed = EventIdUtils.fromEncoded(elementEventId);
        if (elementParsed.type !== 'calendar') return;

        if (EventIdUtils.matchesEvent(elementParsed, parsed)) {
          applyColorsToElement(element, colors);
        }
      } catch (e) {}
    });
  }

  function applyColorToEvent(eventId, color) {
    // Legacy method - convert to new format
    applyColorsToEvent(eventId, { background: color, text: null, border: null });
  }

  function applyColorsToEvent(eventId, colors) {
    const elements = document.querySelectorAll(`[data-eventid="${eventId}"]`);
    elements.forEach((element) => {
      if (!element.closest('[role="dialog"]')) {
        applyColorsToElement(element, colors);
      }
    });
  }

  function applyColorToElement(element, colorHex) {
    // Legacy method - convert to new format
    applyColorsToElement(element, { background: colorHex, text: null, border: null });
  }

  function applyColorsToElement(element, colors) {
    if (!element) return;

    // Skip task elements - tasks should not receive event coloring
    if (isTaskElement(element)) return;

    const { background, text, border, borderWidth = 2 } = colors;
    if (!background && !text && !border) return;

    // Only color the main event chip element - NOT child elements
    // This preserves the rounded corners and other styling
    const isEventChip = element.matches('[data-eventchip]');

    if (isEventChip) {
      // Get the calendar's color from API cache (using event ID to determine calendar)
      const eventId = element.getAttribute('data-eventid');
      const calendarColor = getCalendarColorForEvent(eventId);

      // Apply background color
      if (background) {
        // Use a gradient to preserve the left 4px with calendar color
        // and apply our custom color to the rest of the element
        if (calendarColor) {
          const gradient = `linear-gradient(to right, ${calendarColor} 4px, ${background} 4px)`;
          element.style.setProperty('background', gradient, 'important');
        } else {
          // Fallback: just apply the custom color if we don't have calendar color
          element.style.setProperty('background-color', background, 'important');
        }

        element.style.borderColor = adjustColorBrightness(background, -15);
      }

      element.dataset.cfEventColored = 'true';

      // Apply text color (custom or auto-contrast)
      const textColor = text || (background ? getTextColorForBackground(background) : null);
      if (textColor) {
        element.style.color = textColor;

        // Update text color on child text elements only (not background)
        element.querySelectorAll('.I0UMhf, .KcY3wb, .lhydbb, .fFwDnf, .XuJrye, span').forEach((child) => {
          if (child instanceof HTMLElement) {
            child.style.color = textColor;
          }
        });
      }

      // Apply border using outline (since Google sets border-width: 0)
      // Outline is positioned 30% inside, 70% outside
      if (border) {
        element.style.outline = `${borderWidth}px solid ${border}`;
        element.style.outlineOffset = `-${borderWidth * 0.3}px`;
      } else {
        element.style.outline = '';
        element.style.outlineOffset = '';
      }

    } else if (element.matches('[data-draggable-id]')) {
      // For draggable items (different event type)
      if (background) {
        element.style.setProperty('background-color', background, 'important');
        element.style.borderColor = adjustColorBrightness(background, -15);
      }
      element.dataset.cfEventColored = 'true';

      const textColor = text || (background ? getTextColorForBackground(background) : null);
      if (textColor) {
        element.style.color = textColor;
      }

      if (border) {
        element.style.outline = `${borderWidth}px solid ${border}`;
        element.style.outlineOffset = `-${borderWidth * 0.3}px`;
      }
    }
  }

  // ========================================
  // UTILITIES
  // ========================================

  /**
   * Check if an element represents a task (not a calendar event)
   * Handles both OLD UI (tasks. prefix) and NEW UI (ttb_ with Mark complete button)
   * @param {Element} element - DOM element with data-eventid
   * @returns {boolean} - true if this is a task element
   */
  function isTaskElement(element) {
    if (!element) return false;

    const eventId = element.getAttribute('data-eventid');
    if (!eventId) return false;

    // OLD UI: Direct task ID prefix
    if (eventId.startsWith('tasks.') || eventId.startsWith('tasks_')) {
      return true;
    }

    // NEW UI: Tasks have a "Mark complete" checkbox button
    // Primary check: aria-label (accessibility attribute, stable)
    if (element.querySelector('[aria-label="Mark complete"]')) {
      return true;
    }

    // Fallback: jsname attribute (from Google's internal framework)
    if (element.querySelector('button[jsname="nWuQKb"]')) {
      return true;
    }

    return false;
  }

  function closeColorPicker() {
    document.querySelectorAll('[role="menu"], [role="dialog"]').forEach((el) => {
      if (!el.closest('.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.RECURRING_DIALOG)) {
        el.remove();
      }
    });
  }

  function getEventIdFromContext() {
    if (lastClickedEventId) return lastClickedEventId;

    const eventDialog = document.querySelector('div[role="dialog"][data-eventid]');
    if (eventDialog) return eventDialog.getAttribute('data-eventid');

    const eventTitle = document.querySelector('[aria-label*="Event title"], input[aria-label*="Add title"]');
    if (eventTitle) {
      const nearby = eventTitle.closest('[data-eventid]');
      if (nearby) return nearby.getAttribute('data-eventid');
    }

    return null;
  }

  function setupEventClickCapture() {
    // Capture both left-click and right-click (contextmenu) events
    const captureEventId = (e) => {
      const eventElement = e.target.closest('[data-eventid]');
      if (eventElement) {
        const eventId = eventElement.getAttribute('data-eventid');

        // Check if this is a task element
        const isTask = isTaskElement(eventElement);
        lastClickedIsTask = isTask;

        if (eventId && !isTask) {
          lastClickedEventId = eventId;
          console.log('[EventColoring] Captured event ID:', eventId, 'from', e.type);
          setTimeout(() => {
            if (lastClickedEventId === eventId) {
              lastClickedEventId = null;
            }
          }, 10000);
        } else if (isTask) {
          console.log('[EventColoring] Captured task click, skipping color picker injection');
          // Clear lastClickedEventId to prevent stale event association
          lastClickedEventId = null;
          // Reset task flag after a delay (similar to event ID timeout)
          setTimeout(() => {
            lastClickedIsTask = false;
          }, 10000);
        }
      }
    };

    // Left-click
    document.addEventListener('click', captureEventId, true);

    // Right-click (context menu) - this is crucial for the right-click color picker
    document.addEventListener('contextmenu', captureEventId, true);

    // Also capture mousedown for cases where context menu appears before click completes
    document.addEventListener('mousedown', captureEventId, true);
  }

  function getTextColorForBackground(bgHex) {
    const rgb = hexToRgb(bgHex);
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.6 ? '#000000' : '#FFFFFF';
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
      : { r: 0, g: 0, b: 0 };
  }

  function adjustColorBrightness(hex, percent) {
    const rgb = hexToRgb(hex);
    const adjust = (val) => Math.max(0, Math.min(255, val + (val * percent) / 100));
    const r = Math.round(adjust(rgb.r)).toString(16).padStart(2, '0');
    const g = Math.round(adjust(rgb.g)).toString(16).padStart(2, '0');
    const b = Math.round(adjust(rgb.b)).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`;
  }

  // ========================================
  // MESSAGE HANDLING
  // ========================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EVENT_COLORING_TOGGLED') {
      isEnabled = message.enabled;
      if (isEnabled) {
        applyStoredColors();
      } else {
        document.querySelectorAll('[data-cf-event-colored]').forEach((el) => {
          el.style.backgroundColor = '';
          el.style.borderColor = '';
          el.style.color = '';
          delete el.dataset.cfEventColored;
        });
      }
    } else if (message.type === 'EVENT_COLORING_SETTINGS_CHANGED') {
      console.log('[EventColoring] Settings changed, reloading...');
      window.cc3Storage.getEventColoringSettings().then((freshSettings) => {
        init(freshSettings).catch((err) => console.error('[EventColoring] Reinit failed:', err));
      });
    } else if (message.type === 'EVENT_CALENDAR_COLORS_CHANGED') {
      // User changed per-calendar default colors in popup
      // Use colors from message to avoid race conditions with storage
      console.log('[EventColoring] Calendar default colors changed, reloading...');
      if (message.calendarColors) {
        calendarDefaultColors = message.calendarColors;
        // Debug: log the actual calendar colors received
        Object.entries(calendarDefaultColors).forEach(([calId, colors]) => {
          console.log('[EventColoring] Calendar', calId, 'colors:', JSON.stringify(colors));
        });
        console.log('[EventColoring] Loaded calendar default colors for', Object.keys(calendarDefaultColors).length, 'calendars');
        applyStoredColors();
      } else {
        // Fallback to storage read if colors not in message
        window.cc3Storage.getEventCalendarColors().then((colors) => {
          calendarDefaultColors = colors;
          console.log('[EventColoring] Loaded calendar default colors for', Object.keys(calendarDefaultColors).length, 'calendars');
          applyStoredColors();
        });
      }
    }
  });

  // ========================================
  // FEATURE REGISTRATION
  // ========================================

  window.cc3Features.register({
    id: 'eventColoring',
    init,
    onSettingsChanged: async (newSettings) => {
      console.log('[EventColoring] Settings changed externally');
      await init(newSettings);
    },
    disable: () => {
      if (colorPickerObserver) {
        colorPickerObserver.disconnect();
        colorPickerObserver = null;
      }
      if (colorRenderObserver) {
        colorRenderObserver.disconnect();
        colorRenderObserver = null;
      }
      document.querySelectorAll('[data-cf-event-colored]').forEach((el) => {
        el.style.backgroundColor = '';
        el.style.borderColor = '';
        el.style.color = '';
        delete el.dataset.cfEventColored;
      });
      console.log('[EventColoring] Feature disabled');
    },
  });

  // Expose API
  window.cfEventColoring = {
    getLastClickedEventId: () => lastClickedEventId,
    setLastClickedEventId: (id) => { lastClickedEventId = id; },
    refreshColors,
    findColorForEvent,
    EventIdUtils,
    ScenarioDetector,
  };

  console.log('[EventColoring] Feature registered (enhanced)');
})();
