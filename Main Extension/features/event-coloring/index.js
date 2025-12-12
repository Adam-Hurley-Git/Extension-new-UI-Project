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
  let isEnabled = false;
  let colorPickerObserver = null;
  let colorRenderObserver = null;
  let lastClickedEventId = null;
  let isInjecting = false;

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

    console.log('[EventColoring] Initializing (enhanced)...', {
      isEnabled,
      categoriesCount: Object.keys(categories).length,
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

    if (categoriesArray.length === 0) {
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
        <div>Open the extension popup to create color categories</div>
      `;
      parentContainer.appendChild(emptyState);
    } else {
      categoriesArray.forEach((category) => {
        const section = createCategorySection(category, colorPickerElement, scenario);
        if (section) {
          parentContainer.appendChild(section);
        }
      });
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

  function createCategorySection(category, pickerElement, scenario) {
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

    // Color grid
    const colorGrid = document.createElement('div');
    colorGrid.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.COLOR_DIV_GROUP;
    colorGrid.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    `;

    const colors = category.colors || [];
    if (colors.length === 0) {
      const emptyNote = document.createElement('div');
      emptyNote.textContent = 'No colors in this category';
      emptyNote.style.cssText = 'font-size: 11px; color: #9aa0a6; font-style: italic;';
      colorGrid.appendChild(emptyNote);
    } else {
      colors.forEach((color) => {
        const button = createColorButton(color, pickerElement, scenario);
        colorGrid.appendChild(button);
      });
    }

    section.appendChild(label);
    section.appendChild(colorGrid);

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
      width: 24px;
      height: 24px;
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
      font-size: 14px;
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
      const customLabel = customLabels[normalizedColor];

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

      closeColorPicker();
      applyColorToEvent(eventId, colorHex);
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

  function findColorForEvent(eventId) {
    // Direct match
    if (eventColors[eventId]) {
      return eventColors[eventId];
    }

    // Check for recurring event match
    const parsed = EventIdUtils.fromEncoded(eventId);
    if (parsed.type !== 'calendar') return null;

    for (const [storedId, colorData] of Object.entries(eventColors)) {
      if (typeof colorData === 'object' && colorData.isRecurring) {
        const storedParsed = EventIdUtils.fromEncoded(storedId);
        if (EventIdUtils.matchesEvent(parsed, storedParsed)) {
          return colorData;
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
    applyStoredColors();
  }

  function applyStoredColors() {
    console.log('[EventColoring] Applying stored colors');

    // Separate recurring and single events
    const recurringEvents = [];
    const singleEvents = [];

    Object.entries(eventColors).forEach(([eventId, colorData]) => {
      const color = typeof colorData === 'string' ? colorData : colorData?.hex;
      const isRecurring = typeof colorData === 'object' && colorData.isRecurring;

      if (isRecurring) {
        recurringEvents.push({ eventId, color });
      } else {
        singleEvents.push({ eventId, color });
      }
    });

    // Apply recurring events (match all instances)
    recurringEvents.forEach(({ eventId, color }) => {
      applyRecurringEventColor(eventId, color);
    });

    // Apply single events
    singleEvents.forEach(({ eventId, color }) => {
      applyColorToEvent(eventId, color);
    });
  }

  function applyRecurringEventColor(eventId, color) {
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
          applyColorToElement(element, color);
        }
      } catch (e) {}
    });
  }

  function applyColorToEvent(eventId, color) {
    const elements = document.querySelectorAll(`[data-eventid="${eventId}"]`);
    elements.forEach((element) => {
      if (!element.closest('[role="dialog"]')) {
        applyColorToElement(element, color);
      }
    });
  }

  function applyColorToElement(element, colorHex) {
    if (!element || !colorHex) return;

    const paintTargets = [];

    // Strategy 1: Direct element
    if (element.matches('[data-draggable-id], .event-card, [data-eventchip]')) {
      paintTargets.push(element);
    }

    // Strategy 2: Child containers
    const containers = element.querySelectorAll('[data-draggable-id], .FAxxKc, div[style*="background"]');
    paintTargets.push(...containers);

    // Strategy 3: Fallback
    if (paintTargets.length === 0) {
      paintTargets.push(element);
    }

    paintTargets.forEach((target) => {
      target.style.setProperty('background-color', colorHex, 'important');
      target.style.borderColor = adjustColorBrightness(colorHex, -15);

      const textColor = getTextColorForBackground(colorHex);
      target.style.color = textColor;

      target.querySelectorAll('span, div:not([style*="background"])').forEach((child) => {
        child.style.color = textColor;
      });

      target.dataset.cfEventColored = 'true';
    });
  }

  // ========================================
  // UTILITIES
  // ========================================

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
    document.addEventListener('click', (e) => {
      const eventElement = e.target.closest('[data-eventid]');
      if (eventElement) {
        const eventId = eventElement.getAttribute('data-eventid');
        if (eventId && !eventId.startsWith('tasks')) {
          lastClickedEventId = eventId;
          setTimeout(() => {
            if (lastClickedEventId === eventId) {
              lastClickedEventId = null;
            }
          }, 10000);
        }
      }
    }, true);
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
