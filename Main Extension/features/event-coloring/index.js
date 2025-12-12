// features/event-coloring/index.js
// Event Coloring Feature - Injects custom color categories into Google Calendar's event color picker

(async function () {
  console.log('[EventColoring] Feature loading...');

  // ========================================
  // STATE
  // ========================================
  let settings = {};
  let eventColors = {};
  let categories = {};
  let isEnabled = false;
  let colorPickerObserver = null;
  let lastClickedEventId = null;

  // ========================================
  // INITIALIZATION
  // ========================================

  async function init(featureSettings) {
    settings = featureSettings || {};

    // FIX #1: Ensure settings are fully loaded from storage
    // If settings don't include googleColorLabels, reload from storage
    if (!settings.googleColorLabels || !settings.categories) {
      console.log('[EventColoring] Settings incomplete, reloading from storage...');
      const fullSettings = await window.cc3Storage.getEventColoringSettings();
      settings = { ...settings, ...fullSettings };
    }

    isEnabled = settings.enabled !== false;
    categories = settings.categories || {};

    console.log('[EventColoring] Initializing...', {
      isEnabled,
      categoriesCount: Object.keys(categories).length,
      googleColorLabelsCount: Object.keys(settings.googleColorLabels || {}).length,
      disableCustomColors: settings.disableCustomColors || false
    });

    if (!isEnabled) {
      console.log('[EventColoring] Feature disabled');
      return;
    }

    // Load event colors from storage
    eventColors = await window.cc3Storage.getAllEventColors();
    console.log('[EventColoring] Loaded', Object.keys(eventColors).length, 'event colors');

    // Start observing for color picker modals
    startColorPickerObserver();

    // Apply stored colors to visible events
    applyStoredColors();

    // Capture event clicks
    setupEventClickCapture();

    console.log('[EventColoring] Initialized successfully');
  }

  // ========================================
  // COLOR PICKER DETECTION & INJECTION
  // ========================================

  function startColorPickerObserver() {
    if (colorPickerObserver) {
      colorPickerObserver.disconnect();
    }

    colorPickerObserver = new MutationObserver((mutations) => {
      // Look for color picker dialogs
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1 && node.matches) {
              // Check if this is a color picker or contains one
              const colorPicker = node.matches('[role="menu"]') ? node : node.querySelector('[role="menu"]');
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

  function isColorPicker(element) {
    // FIX #3: More specific color picker detection
    // Google Calendar color pickers have specific characteristics

    // BEST: Look for Google Calendar's specific color picker structure
    // The jsname="Ly0WL" attribute is unique to color picker buttons
    const hasLy0WLButtons = element.querySelector('div[jsname="Ly0WL"]');
    if (hasLy0WLButtons) {
      console.log('[EventColoring] ✓ Color picker detected via jsname="Ly0WL"');
      return true;
    }

    // FALLBACK: Check for color buttons with data-color attribute
    const hasDataColorButtons = element.querySelectorAll('[data-color]').length >= 8;
    const isMenu = element.getAttribute('role') === 'menu';

    if (isMenu && hasDataColorButtons) {
      console.log('[EventColoring] ✓ Color picker detected via role=menu + data-color buttons');
      return true;
    }

    // Don't match if it's just a generic menu
    return false;
  }

  function injectCustomCategories(colorPickerElement) {
    if (colorPickerElement.dataset.cfEventColorModified) {
      return; // Already modified
    }

    colorPickerElement.dataset.cfEventColorModified = 'true';
    console.log('[EventColoring] Injecting custom categories');

    // FIX #2: ALWAYS update Google color labels first (even if custom colors disabled)
    updateGoogleColorLabels(colorPickerElement);
    updateCheckmarks(colorPickerElement);

    // Check if custom colors are disabled
    if (settings.disableCustomColors) {
      console.log('[EventColoring] Custom colors disabled, skipping custom category injection');
      return; // Stop here - labels are already updated above
    }

    // Find the container for Google's built-in colors
    const builtInColorGroup = findBuiltInColorGroup(colorPickerElement);
    if (!builtInColorGroup) {
      console.warn('[EventColoring] Could not find built-in color group');
      return;
    }

    // Get the parent container
    const parentContainer = builtInColorGroup.parentElement;
    if (!parentContainer) return;

    // Style parent for scrolling
    parentContainer.style.maxHeight = '500px';
    parentContainer.style.overflowY = 'auto';
    parentContainer.style.paddingBottom = '12px';
    parentContainer.style.scrollbarWidth = 'thin';

    // Add spacing to built-in colors
    builtInColorGroup.style.marginBottom = '8px';

    // Add separator
    const separator = document.createElement('div');
    separator.style.cssText = 'border-top: 1px solid #dadce0; margin: 8px 12px; margin-top: 8px;';
    separator.className = 'cf-event-color-separator';
    parentContainer.appendChild(separator);

    // Add custom categories
    const categoriesArray = Object.values(categories).sort((a, b) => (a.order || 0) - (b.order || 0));

    if (categoriesArray.length === 0) {
      // Add empty state
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
        const categorySection = createCategorySection(category, colorPickerElement);
        if (categorySection) {
          parentContainer.appendChild(categorySection);
        }
      });
    }

    // Update Google color labels
    updateGoogleColorLabels(colorPickerElement);

    // Update checkmarks for currently selected color
    updateCheckmarks(colorPickerElement);
  }

  function findBuiltInColorGroup(pickerElement) {
    // Try multiple strategies to find Google's built-in color group

    // Strategy 1: Look for a div with multiple colored children
    const colorGroups = pickerElement.querySelectorAll('div[role="presentation"]');
    for (const group of colorGroups) {
      const coloredChildren = group.querySelectorAll('div[style*="background"]');
      if (coloredChildren.length >= 8) { // Google has at least 8 default colors
        return group;
      }
    }

    // Strategy 2: Look for specific Google color picker structure
    const potentialGroups = pickerElement.querySelectorAll('div > div > div');
    for (const group of potentialGroups) {
      const childDivs = group.querySelectorAll(':scope > div');
      if (childDivs.length >= 8) {
        const hasBackgrounds = Array.from(childDivs).some(div =>
          div.style.backgroundColor || div.getAttribute('style')?.includes('background')
        );
        if (hasBackgrounds) {
          return group;
        }
      }
    }

    // Strategy 3: Fallback - first element with multiple colored divs
    return pickerElement.querySelector('div');
  }

  function createCategorySection(category, pickerElement) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-top: 16px; padding: 0 12px;';
    section.className = 'cf-event-color-category-section';

    // Category label
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
    colorGrid.style.cssText = `
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(28px, 1fr));
      gap: 8px;
      margin-bottom: 8px;
    `;

    // Add color buttons
    const colors = category.colors || [];
    if (colors.length === 0) {
      const emptyNote = document.createElement('div');
      emptyNote.textContent = 'No colors in this category';
      emptyNote.style.cssText = 'font-size: 11px; color: #9aa0a6; font-style: italic;';
      colorGrid.appendChild(emptyNote);
    } else {
      colors.forEach((color) => {
        const colorButton = createColorButton(color, pickerElement);
        colorGrid.appendChild(colorButton);
      });
    }

    section.appendChild(label);
    section.appendChild(colorGrid);

    return section;
  }

  function createColorButton(color, pickerElement) {
    const button = document.createElement('div');
    button.style.cssText = `
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background-color: ${color.hex};
      cursor: pointer;
      position: relative;
      border: 2px solid transparent;
      transition: all 0.15s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    button.dataset.colorHex = color.hex;
    button.dataset.colorLabel = color.label || color.hex;
    button.className = 'cf-event-color-button';
    button.setAttribute('role', 'button');
    button.setAttribute('aria-label', color.label || color.hex);
    button.title = color.label || color.hex;

    // Hover effect
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.15)';
      button.style.borderColor = 'rgba(0, 0, 0, 0.3)';
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      if (!button.querySelector('.cf-checkmark')) {
        button.style.borderColor = 'transparent';
      }
    });

    // Click handler
    button.addEventListener('click', async () => {
      const eventId = getEventIdFromContext();
      if (eventId) {
        await handleColorSelection(eventId, color.hex);
        closeColorPicker(pickerElement);
      } else {
        console.warn('[EventColoring] Could not determine event ID');
      }
    });

    return button;
  }

  function updateGoogleColorLabels(pickerElement) {
    const customLabels = settings.googleColorLabels || {};

    // FIX #4: Comprehensive debug logging
    console.log('[EventColoring] ========== updateGoogleColorLabels START ==========');
    console.log('[EventColoring] Settings object:', settings);
    console.log('[EventColoring] Custom labels:', customLabels);
    console.log('[EventColoring] Number of custom labels:', Object.keys(customLabels).length);

    // Use Google Calendar's stable jsname attribute to find color buttons
    // This is the same selector used by the Color Extension
    const colorButtons = pickerElement.querySelectorAll('div[jsname="Ly0WL"]');
    console.log('[EventColoring] Found', colorButtons.length, 'Google color buttons');

    if (colorButtons.length === 0) {
      console.warn('[EventColoring] ⚠️ No Google color buttons found! Picker may not be correct element.');
      console.log('[EventColoring] Picker element:', pickerElement);
      console.log('[EventColoring] Picker HTML:', pickerElement.innerHTML.substring(0, 500));
    }

    let updatedCount = 0;
    let skippedCount = 0;

    colorButtons.forEach((button, index) => {
      // Get the color from the data-color attribute (this is set by Google)
      const dataColor = button.getAttribute('data-color');
      if (!dataColor) {
        console.log(`[EventColoring] Button ${index} has no data-color, skipping`);
        skippedCount++;
        return;
      }

      // Normalize the color to lowercase for lookup
      const normalizedColor = dataColor.toLowerCase();
      console.log(`[EventColoring] Button ${index}: ${dataColor} → ${normalizedColor}`);

      // Check if we have a custom label for this color
      if (customLabels[normalizedColor]) {
        const customLabel = customLabels[normalizedColor];
        console.log(`[EventColoring] ✓ Applying custom label to ${normalizedColor}: "${customLabel}"`);

        // Update the aria-label on the button itself (for accessibility)
        button.setAttribute('aria-label', customLabel);

        // Find the label text element - Google uses class .oMnJrf for the visible label
        const labelElement = button.querySelector('.oMnJrf');
        if (labelElement) {
          // Set the data-text attribute which Google Calendar uses to display the label
          labelElement.setAttribute('data-text', customLabel);
          console.log(`[EventColoring] ✓ Updated .oMnJrf element with data-text: "${customLabel}"`);
          updatedCount++;
        } else {
          console.warn(`[EventColoring] ⚠️ No .oMnJrf element found in button ${index}`);
          console.log('[EventColoring] Button HTML:', button.innerHTML);
        }
      } else {
        console.log(`[EventColoring] No custom label for ${normalizedColor} (using Google default)`);
      }
    });

    console.log(`[EventColoring] Summary: ${updatedCount} labels updated, ${skippedCount} skipped`);
    console.log('[EventColoring] ========== updateGoogleColorLabels END ==========');
  }

  function updateCheckmarks(pickerElement) {
    const eventId = getEventIdFromContext();
    if (!eventId) return;

    const selectedColorData = eventColors[eventId];
    const selectedColor = selectedColorData?.hex;

    // Update custom color buttons
    pickerElement.querySelectorAll('.cf-event-color-button').forEach((button) => {
      const existingCheckmark = button.querySelector('.cf-checkmark');
      if (existingCheckmark) {
        existingCheckmark.remove();
      }

      if (button.dataset.colorHex === selectedColor) {
        const checkmark = document.createElement('div');
        checkmark.className = 'cf-checkmark';
        checkmark.style.cssText = `
          width: 16px;
          height: 16px;
          background: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        `;
        checkmark.innerHTML = '✓';
        button.appendChild(checkmark);
        button.style.borderColor = 'rgba(0, 0, 0, 0.5)';
      }
    });

    // Also clear checkmarks from Google's built-in colors if we have a custom color selected
    if (selectedColor) {
      pickerElement.querySelectorAll('div[style*="background"]:not(.cf-event-color-button)').forEach((button) => {
        const checkmark = button.querySelector('svg, [role="img"]');
        if (checkmark) {
          // Don't remove Google's checkmarks, but we track that user has custom color
        }
      });
    }
  }

  // ========================================
  // EVENT ID DETECTION
  // ========================================

  function getEventIdFromContext() {
    // Strategy 1: Use last clicked event ID
    if (lastClickedEventId) {
      console.log('[EventColoring] Using last clicked event ID:', lastClickedEventId);
      return lastClickedEventId;
    }

    // Strategy 2: Look for open event dialog
    const eventDialog = document.querySelector('div[role="dialog"][data-eventid]');
    if (eventDialog) {
      const eventId = eventDialog.getAttribute('data-eventid');
      console.log('[EventColoring] Found event ID from dialog:', eventId);
      return eventId;
    }

    // Strategy 3: Look for event edit indicators
    const eventTitle = document.querySelector('[aria-label*="Event title"], input[aria-label*="Add title"]');
    if (eventTitle) {
      // Try to find associated event ID in nearby elements
      const nearbyEvent = eventTitle.closest('[data-eventid]');
      if (nearbyEvent) {
        const eventId = nearbyEvent.getAttribute('data-eventid');
        console.log('[EventColoring] Found event ID from nearby element:', eventId);
        return eventId;
      }
    }

    // Strategy 4: Check for recently opened event details
    const detailsContainer = document.querySelector('[data-details-container]');
    if (detailsContainer) {
      const eventChip = detailsContainer.querySelector('[data-eventid]');
      if (eventChip) {
        const eventId = eventChip.getAttribute('data-eventid');
        console.log('[EventColoring] Found event ID from details container:', eventId);
        return eventId;
      }
    }

    console.warn('[EventColoring] Could not determine event ID');
    return null;
  }

  function setupEventClickCapture() {
    // Capture clicks on events to track which event is being edited
    document.addEventListener('click', (e) => {
      const eventElement = e.target.closest('[data-eventid]');
      if (eventElement) {
        const eventId = eventElement.getAttribute('data-eventid');
        if (eventId && !eventId.startsWith('tasks')) { // Exclude task events
          lastClickedEventId = eventId;
          console.log('[EventColoring] Captured event click:', eventId);

          // Clear after 10 seconds
          setTimeout(() => {
            if (lastClickedEventId === eventId) {
              lastClickedEventId = null;
            }
          }, 10000);
        }
      }
    }, true);
  }

  // ========================================
  // COLOR SELECTION & STORAGE
  // ========================================

  async function handleColorSelection(eventId, colorHex) {
    console.log('[EventColoring] Color selected:', eventId, colorHex);

    // Save to storage
    await window.cc3Storage.saveEventColor(eventId, colorHex);

    // Update local cache
    eventColors[eventId] = {
      hex: colorHex,
      isRecurring: false,
      appliedAt: Date.now(),
    };

    // Apply color immediately to visible event
    const eventElement = document.querySelector(`[data-eventid="${eventId}"]`);
    if (eventElement) {
      applyColorToElement(eventElement, colorHex);
    }

    console.log('[EventColoring] Color saved and applied');
  }

  function closeColorPicker(pickerElement) {
    // Close the color picker
    if (pickerElement) {
      // Try to find and click close button
      const closeBtn = pickerElement.querySelector('[aria-label*="Close"], [aria-label*="close"]');
      if (closeBtn) {
        closeBtn.click();
      } else {
        // Remove the picker element
        const dialog = pickerElement.closest('[role="dialog"], [role="menu"]');
        if (dialog) {
          dialog.remove();
        }
      }
    }

    // Also close any backdrop/overlay
    document.querySelectorAll('[role="presentation"]').forEach((el) => {
      if (el.style.backgroundColor === 'rgba(0, 0, 0, 0.4)' || el.classList.contains('backdrop')) {
        el.remove();
      }
    });
  }

  // ========================================
  // COLOR APPLICATION
  // ========================================

  function applyStoredColors() {
    console.log('[EventColoring] Applying stored colors to visible events');

    Object.entries(eventColors).forEach(([eventId, colorData]) => {
      const eventElements = document.querySelectorAll(`[data-eventid="${eventId}"]`);
      eventElements.forEach((eventElement) => {
        if (!eventElement.closest('[role="dialog"]')) {
          applyColorToElement(eventElement, colorData.hex);
        }
      });
    });
  }

  function applyColorToElement(element, colorHex) {
    // Find the actual visual container to color
    const paintTargets = [];

    // Strategy 1: Direct element
    if (element.matches('[data-draggable-id], .event-card, [data-eventchip]')) {
      paintTargets.push(element);
    }

    // Strategy 2: Find child containers
    const containers = element.querySelectorAll('[data-draggable-id], .FAxxKc, div[style*="background"]');
    paintTargets.push(...containers);

    // Strategy 3: Fallback to element itself
    if (paintTargets.length === 0) {
      paintTargets.push(element);
    }

    paintTargets.forEach((target) => {
      // Apply background color
      target.style.backgroundColor = colorHex + ' !important';
      target.style.setProperty('background-color', colorHex, 'important');

      // Adjust border
      const darkerColor = adjustColorBrightness(colorHex, -15);
      target.style.borderColor = darkerColor;

      // Adjust text color for contrast
      const textColor = getTextColorForBackground(colorHex);
      target.style.color = textColor;

      // Apply to child text elements
      target.querySelectorAll('span, div:not([style*="background"])').forEach((child) => {
        child.style.color = textColor;
      });

      // Mark as colored
      target.dataset.cfEventColored = 'true';
    });

    console.log('[EventColoring] Color applied to element:', colorHex);
  }

  // ========================================
  // COLOR UTILITIES
  // ========================================

  function getTextColorForBackground(bgHex) {
    const rgb = hexToRgb(bgHex);
    const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
    return luminance > 0.6 ? '#000000' : '#FFFFFF';
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  function rgbToHex(rgb) {
    const match = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!match) return null;

    const r = parseInt(match[1]).toString(16).padStart(2, '0');
    const g = parseInt(match[2]).toString(16).padStart(2, '0');
    const b = parseInt(match[3]).toString(16).padStart(2, '0');

    return `#${r}${g}${b}`.toUpperCase();
  }

  function adjustColorBrightness(hex, percent) {
    const rgb = hexToRgb(hex);
    const adjust = (val) => Math.max(0, Math.min(255, val + (val * percent) / 100));

    const r = Math.round(adjust(rgb.r))
      .toString(16)
      .padStart(2, '0');
    const g = Math.round(adjust(rgb.g))
      .toString(16)
      .padStart(2, '0');
    const b = Math.round(adjust(rgb.b))
      .toString(16)
      .padStart(2, '0');

    return `#${r}${g}${b}`;
  }

  // ========================================
  // MESSAGE HANDLING
  // ========================================

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EVENT_COLORING_TOGGLED') {
      isEnabled = message.enabled;
      console.log('[EventColoring] Toggled:', isEnabled);

      if (isEnabled) {
        applyStoredColors();
      } else {
        // Remove applied colors
        document.querySelectorAll('[data-cf-event-colored]').forEach((el) => {
          el.style.backgroundColor = '';
          el.style.borderColor = '';
          el.style.color = '';
          delete el.dataset.cfEventColored;
        });
      }
    } else if (message.type === 'EVENT_COLORING_SETTINGS_CHANGED') {
      console.log('[EventColoring] Settings changed, reloading...');
      // FIX #6b: Force reload from storage, don't use cached settings
      // This ensures we get fresh googleColorLabels after user changes them in popup
      window.cc3Storage.getEventColoringSettings().then(freshSettings => {
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
      console.log('[EventColoring] Settings changed externally, reinitializing...');
      await init(newSettings);
    },
    disable: () => {
      if (colorPickerObserver) {
        colorPickerObserver.disconnect();
        colorPickerObserver = null;
      }
      // Remove applied colors
      document.querySelectorAll('[data-cf-event-colored]').forEach((el) => {
        el.style.backgroundColor = '';
        el.style.borderColor = '';
        el.style.color = '';
        delete el.dataset.cfEventColored;
      });
      console.log('[EventColoring] Feature disabled and cleaned up');
    },
  });

  // Expose API for other parts of extension
  window.cfEventColoring = {
    getLastClickedEventId: () => lastClickedEventId,
    setLastClickedEventId: (id) => {
      lastClickedEventId = id;
    },
  };

  console.log('[EventColoring] Feature registered');
})();
