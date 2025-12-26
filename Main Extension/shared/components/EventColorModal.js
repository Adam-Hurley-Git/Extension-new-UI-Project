/**
 * EventColorModal - Color picker for events with Background/Text/Border tabs
 * Provides live preview and palette selection for each color property
 *
 * @module EventColorModal
 */

// Color Palettes - 9 columns x 4 rows layout
const EVENT_COLOR_PALETTES = {
  vibrant: [
    '#d50000', '#ff1744', '#f44336', '#ff5722', '#ff9800',
    '#ffc107', '#ffeb3b', '#cddc39', '#8bc34a',
    '#4caf50', '#00e676', '#1de9b6', '#009688', '#00e5ff',
    '#00bcd4', '#00b0ff', '#03a9f4', '#2196f3',
    '#2979ff', '#3d5afe', '#651fff', '#3f51b5', '#673ab7',
    '#9c27b0', '#e91e63', '#ff4081', '#f50057',
    '#795548', '#9e9e9e', '#607d8b',
  ],
  pastel: [
    '#f8bbd9', '#f48fb1', '#f06292', '#ec407a', '#e1bee7',
    '#d1c4e9', '#ce93d8', '#ba68c8', '#ab47bc',
    '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#dcedc8',
    '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5',
    '#b3e5fc', '#b2ebf2', '#80deea', '#4dd0e1', '#26c6da',
    '#f0f4c3', '#fff9c4', '#fff59d', '#fff176',
    '#ffee58', '#ffe0b2', '#ffccbc', '#ffab91', '#ff8a65',
    '#ff7043', '#ffd180',
  ],
  dark: [
    '#b71c1c', '#c62828', '#d32f2f', '#f44336', '#880e4f',
    '#4a148c', '#6a1b9a', '#7b1fa2', '#8e24aa',
    '#311b92', '#0d47a1', '#1565c0', '#1976d2', '#1e88e5',
    '#01579b', '#004d40', '#00695c', '#00796b',
    '#00897b', '#1b5e20', '#2e7d32', '#388e3c', '#43a047',
    '#4caf50', '#33691e', '#3e2723', '#4e342e',
    '#5d4037', '#6d4c41', '#263238', '#37474f', '#455a64',
    '#546e7a', '#607d8b', '#212121',
  ],
};

/**
 * Load custom colors from Chrome storage
 * @returns {Promise<string[]>} Array of hex color strings
 */
async function loadCustomColors() {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.sync.get('customDayColors', (result) => {
        resolve(result.customDayColors || []);
      });
    } else {
      resolve([]);
    }
  });
}

/**
 * EventColorModal class
 * Creates a modal with Background/Text/Border property tabs and color palettes
 */
class EventColorModal {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.id - Unique identifier for the modal
   * @param {Object} [options.currentColors] - Current colors { background, text, border }
   * @param {Function} options.onApply - Callback when Apply is clicked with { background, text, border }
   * @param {Function} [options.onClose] - Callback when modal is closed
   * @param {HTMLElement} [options.container] - Container to append modal to (default: document.body)
   */
  constructor(options) {
    this.id = options.id || `ecm-${Date.now()}`;
    // Custom colors that have been set by user
    this.currentColors = {
      background: options.currentColors?.background || null,
      text: options.currentColors?.text || null,
      border: options.currentColors?.border || null,
    };
    // Original event colors from DOM (for accurate preview when no custom color set)
    this.originalColors = {
      background: options.originalColors?.background || '#039be5',
      text: options.originalColors?.text || '#ffffff',
      border: options.originalColors?.border || null,
    };
    // Event title for preview
    this.eventTitle = options.eventTitle || 'Sample Event';
    // Working copy for live preview
    this.workingColors = { ...this.currentColors };
    this.onApply = options.onApply;
    this.onClose = options.onClose;
    this.container = options.container || document.body;

    this.activePropertyTab = 'background';
    this.activePaletteTab = 'vibrant';
    this.customColors = [];

    this.element = null;
    this.backdrop = null;
  }

  /**
   * Build the modal HTML structure
   * @returns {HTMLElement} Modal element
   */
  buildModal() {
    const modal = document.createElement('div');
    modal.className = 'ecm-modal';
    modal.id = this.id;

    modal.innerHTML = `
      <div class="ecm-property-tabs">
        <button type="button" class="ecm-property-tab active" data-property="background">
          <span class="ecm-property-indicator" id="${this.id}-bg-indicator"></span>
          Background
        </button>
        <button type="button" class="ecm-property-tab" data-property="text">
          <span class="ecm-property-indicator" id="${this.id}-text-indicator"></span>
          Text
        </button>
        <button type="button" class="ecm-property-tab" data-property="border">
          <span class="ecm-property-indicator" id="${this.id}-border-indicator"></span>
          Border
        </button>
      </div>

      <div class="ecm-preview-section">
        <div class="ecm-preview-label">PREVIEW</div>
        <div class="ecm-preview-container">
          <div class="ecm-preview-event" id="${this.id}-preview">
            <div class="ecm-preview-stripe"></div>
            <div class="ecm-preview-content">
              <span class="ecm-preview-title">${this.eventTitle}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="ecm-palette-tabs">
        <button type="button" class="ecm-palette-tab active" data-palette="vibrant">Vibrant</button>
        <button type="button" class="ecm-palette-tab" data-palette="pastel">Pastel</button>
        <button type="button" class="ecm-palette-tab" data-palette="dark">Dark</button>
        <button type="button" class="ecm-palette-tab" data-palette="custom">Custom</button>
      </div>

      <div class="ecm-content">
        <div class="ecm-color-info">
          <span class="ecm-color-label">Choose colors for this event</span>
        </div>
        <div class="ecm-hex-row">
          <input type="color" class="ecm-color-input" id="${this.id}-color-input" value="#4285f4">
          <input type="text" class="ecm-hex-input" id="${this.id}-hex-input" value="#4285F4" placeholder="#FF0000" maxlength="7">
        </div>
        <div class="ecm-palette-panel active" data-palette-panel="vibrant">
          <div class="ecm-palette" id="${this.id}-vibrant"></div>
        </div>
        <div class="ecm-palette-panel" data-palette-panel="pastel">
          <div class="ecm-palette" id="${this.id}-pastel"></div>
        </div>
        <div class="ecm-palette-panel" data-palette-panel="dark">
          <div class="ecm-palette" id="${this.id}-dark"></div>
        </div>
        <div class="ecm-palette-panel" data-palette-panel="custom">
          <div class="ecm-palette" id="${this.id}-custom"></div>
        </div>
      </div>

      <div class="ecm-actions">
        <button type="button" class="ecm-btn ecm-btn-cancel" id="${this.id}-cancel">Cancel</button>
        <button type="button" class="ecm-btn ecm-btn-apply" id="${this.id}-apply">Apply</button>
      </div>
    `;

    return modal;
  }

  /**
   * Create a color swatch element
   * @param {string} color - Hex color value
   * @param {boolean} isCustom - Whether this is a custom color
   * @returns {HTMLElement} Swatch element
   */
  createSwatch(color, isCustom = false) {
    const swatch = document.createElement('div');
    swatch.className = isCustom ? 'ecm-swatch ecm-swatch-custom' : 'ecm-swatch';
    swatch.style.backgroundColor = color;
    swatch.title = color.toUpperCase();
    swatch.dataset.color = color;
    swatch.setAttribute('role', 'button');
    swatch.setAttribute('tabindex', '0');

    // Add "no color" indicator for clearing
    if (color === 'none') {
      swatch.className = 'ecm-swatch ecm-swatch-none';
      swatch.style.backgroundColor = '#ffffff';
      swatch.innerHTML = '<span class="ecm-no-color-line"></span>';
      swatch.title = 'No color (use default)';
    }

    swatch.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectColor(color === 'none' ? null : color);
    });

    swatch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.selectColor(color === 'none' ? null : color);
      }
    });

    return swatch;
  }

  /**
   * Select a color for the current property
   * @param {string|null} color - Color hex or null to clear
   */
  selectColor(color) {
    this.workingColors[this.activePropertyTab] = color;
    this.updateHexInputs(color);
    this.updatePreview();
    this.updatePropertyIndicators();
    this.highlightSelected();
  }

  /**
   * Update hex input fields
   * @param {string|null} color - Color value
   */
  updateHexInputs(color) {
    const colorInput = this.element.querySelector(`#${this.id}-color-input`);
    const hexInput = this.element.querySelector(`#${this.id}-hex-input`);

    if (colorInput) colorInput.value = color || '#4285f4';
    if (hexInput) hexInput.value = color ? color.toUpperCase() : '';
  }

  /**
   * Get the effective color for a property (working > original)
   */
  getEffectiveColor(property) {
    return this.workingColors[property] || this.originalColors[property] || null;
  }

  /**
   * Update the live preview
   */
  updatePreview() {
    const preview = this.element.querySelector(`#${this.id}-preview`);
    if (!preview) return;

    // Use working colors if set, otherwise fall back to original event colors
    const bg = this.getEffectiveColor('background') || '#039be5';
    const text = this.workingColors.text || this.currentColors.text || this.originalColors.text || '#ffffff';
    const border = this.getEffectiveColor('border');

    preview.style.backgroundColor = bg;
    preview.style.color = text;

    if (border) {
      preview.style.outline = `2px solid ${border}`;
      preview.style.outlineOffset = '-2px';
    } else {
      preview.style.outline = 'none';
    }

    // Update title text color
    const title = preview.querySelector('.ecm-preview-title');
    if (title) {
      title.style.color = text;
    }
  }

  /**
   * Update the property tab indicators
   * Shows actual current colors (working > original) for accurate representation
   */
  updatePropertyIndicators() {
    const bgIndicator = this.element.querySelector(`#${this.id}-bg-indicator`);
    const textIndicator = this.element.querySelector(`#${this.id}-text-indicator`);
    const borderIndicator = this.element.querySelector(`#${this.id}-border-indicator`);

    // Background indicator - use working color if set, else original event color
    if (bgIndicator) {
      const bgColor = this.getEffectiveColor('background') || '#039be5';
      bgIndicator.style.backgroundColor = bgColor;
      bgIndicator.classList.toggle('has-color', !!this.workingColors.background);
    }

    // Text indicator - use working color if set, else original event text color
    if (textIndicator) {
      const textColor = this.getEffectiveColor('text') || '#ffffff';
      textIndicator.style.backgroundColor = textColor;
      textIndicator.classList.toggle('has-color', !!this.workingColors.text);
    }

    // Border indicator - use working color if set, else original or show no border style
    if (borderIndicator) {
      const borderColor = this.getEffectiveColor('border');
      if (borderColor) {
        borderIndicator.style.backgroundColor = borderColor;
        borderIndicator.classList.add('has-color');
        borderIndicator.classList.remove('no-border');
      } else {
        // No border set - show a "no border" style (gray with diagonal line)
        borderIndicator.style.backgroundColor = '#e0e0e0';
        borderIndicator.classList.remove('has-color');
        borderIndicator.classList.add('no-border');
      }
    }
  }

  /**
   * Highlight the selected swatch for current property
   */
  highlightSelected() {
    const currentColor = this.workingColors[this.activePropertyTab];

    this.element.querySelectorAll('.ecm-swatch').forEach((swatch) => {
      swatch.classList.remove('selected');
      const swatchColor = swatch.dataset.color;

      if (currentColor === null && swatchColor === 'none') {
        swatch.classList.add('selected');
      } else if (swatchColor && currentColor && swatchColor.toLowerCase() === currentColor.toLowerCase()) {
        swatch.classList.add('selected');
      }
    });
  }

  /**
   * Populate palettes with color swatches
   */
  async populatePalettes() {
    // Add "no color" swatch to each palette
    const addNoColorSwatch = (palette) => {
      if (palette) {
        palette.appendChild(this.createSwatch('none'));
      }
    };

    // Vibrant palette
    const vibrantEl = this.element.querySelector(`#${this.id}-vibrant`);
    if (vibrantEl) {
      vibrantEl.innerHTML = '';
      addNoColorSwatch(vibrantEl);
      EVENT_COLOR_PALETTES.vibrant.forEach((color) => {
        vibrantEl.appendChild(this.createSwatch(color));
      });
    }

    // Pastel palette
    const pastelEl = this.element.querySelector(`#${this.id}-pastel`);
    if (pastelEl) {
      pastelEl.innerHTML = '';
      addNoColorSwatch(pastelEl);
      EVENT_COLOR_PALETTES.pastel.forEach((color) => {
        pastelEl.appendChild(this.createSwatch(color));
      });
    }

    // Dark palette
    const darkEl = this.element.querySelector(`#${this.id}-dark`);
    if (darkEl) {
      darkEl.innerHTML = '';
      addNoColorSwatch(darkEl);
      EVENT_COLOR_PALETTES.dark.forEach((color) => {
        darkEl.appendChild(this.createSwatch(color));
      });
    }

    // Custom palette
    this.customColors = await loadCustomColors();
    const customEl = this.element.querySelector(`#${this.id}-custom`);
    if (customEl) {
      customEl.innerHTML = '';
      addNoColorSwatch(customEl);
      if (this.customColors.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'ecm-empty-state';
        empty.innerHTML = `
          <div class="ecm-empty-icon">🎨</div>
          <div class="ecm-empty-text">No custom colors</div>
          <div class="ecm-empty-subtext">Add colors in Color Lab (Preferences)</div>
        `;
        customEl.appendChild(empty);
      } else {
        this.customColors.forEach((color) => {
          customEl.appendChild(this.createSwatch(color, true));
        });
      }
    }

    this.highlightSelected();
  }

  /**
   * Setup property tab switching
   */
  setupPropertyTabs() {
    const tabs = this.element.querySelectorAll('.ecm-property-tab');

    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const property = tab.dataset.property;

        tabs.forEach((t) => t.classList.toggle('active', t.dataset.property === property));
        this.activePropertyTab = property;

        // Update hex inputs to show current property's color
        const currentColor = this.workingColors[property];
        this.updateHexInputs(currentColor);
        this.highlightSelected();
      });
    });
  }

  /**
   * Setup palette tab switching
   */
  setupPaletteTabs() {
    const tabs = this.element.querySelectorAll('.ecm-palette-tab');
    const panels = this.element.querySelectorAll('.ecm-palette-panel');

    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const palette = tab.dataset.palette;

        tabs.forEach((t) => t.classList.toggle('active', t.dataset.palette === palette));
        panels.forEach((p) => p.classList.toggle('active', p.dataset.palettePanel === palette));

        this.activePaletteTab = palette;
      });
    });
  }

  /**
   * Setup hex input handling
   */
  setupHexInputs() {
    const colorInput = this.element.querySelector(`#${this.id}-color-input`);
    const hexInput = this.element.querySelector(`#${this.id}-hex-input`);

    if (colorInput && hexInput) {
      colorInput.addEventListener('input', () => {
        hexInput.value = colorInput.value.toUpperCase();
      });

      colorInput.addEventListener('change', () => {
        this.selectColor(colorInput.value);
      });

      hexInput.addEventListener('input', () => {
        const hex = hexInput.value.trim();
        const normalized = hex.startsWith('#') ? hex : '#' + hex;
        if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
          colorInput.value = normalized;
          hexInput.style.borderColor = '#1a73e8';
        } else {
          hexInput.style.borderColor = '#dc2626';
        }
      });

      hexInput.addEventListener('change', () => {
        const hex = hexInput.value.trim();
        const normalized = hex.startsWith('#') ? hex : '#' + hex;
        if (/^#[0-9A-Fa-f]{6}$/.test(normalized)) {
          this.selectColor(normalized);
        }
      });
    }
  }

  /**
   * Setup action buttons
   */
  setupActions() {
    const cancelBtn = this.element.querySelector(`#${this.id}-cancel`);
    const applyBtn = this.element.querySelector(`#${this.id}-apply`);

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        this.close();
      });
    }

    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        if (this.onApply) {
          this.onApply(this.workingColors);
        }
        this.close();
      });
    }
  }

  /**
   * Create and show backdrop
   */
  createBackdrop() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'ecm-backdrop';
    this.backdrop.addEventListener('click', () => this.close());
    this.container.appendChild(this.backdrop);

    requestAnimationFrame(() => {
      this.backdrop.classList.add('active');
    });
  }

  /**
   * Open the modal
   * @returns {Promise<void>}
   */
  async open() {
    // Inject CSS if not already present
    this.injectCSS();

    // Build modal
    this.element = this.buildModal();

    // Create backdrop
    this.createBackdrop();

    // Append to container
    this.container.appendChild(this.element);

    // Setup functionality
    this.setupPropertyTabs();
    this.setupPaletteTabs();
    this.setupHexInputs();
    this.setupActions();
    await this.populatePalettes();

    // Initialize preview and indicators
    this.updatePreview();
    this.updatePropertyIndicators();

    // Set initial hex input based on current property
    const initialColor = this.workingColors[this.activePropertyTab];
    this.updateHexInputs(initialColor);

    // Prevent clicks inside modal from closing it
    this.element.addEventListener('click', (e) => e.stopPropagation());

    // Animate in
    requestAnimationFrame(() => {
      this.element.classList.add('open');
    });
  }

  /**
   * Close the modal
   */
  close() {
    if (this.element) {
      this.element.classList.remove('open');
    }
    if (this.backdrop) {
      this.backdrop.classList.remove('active');
    }

    setTimeout(() => {
      if (this.element) {
        this.element.remove();
        this.element = null;
      }
      if (this.backdrop) {
        this.backdrop.remove();
        this.backdrop = null;
      }
      if (this.onClose) {
        this.onClose();
      }
    }, 200);
  }

  /**
   * Inject CSS for the modal
   */
  injectCSS() {
    const styleId = 'ecm-event-color-modal-css';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* EventColorModal Styles */
      .ecm-backdrop {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 99999;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .ecm-backdrop.active {
        display: block;
        opacity: 1;
      }
      .ecm-modal {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.24);
        z-index: 100000;
        width: 380px;
        max-width: 95vw;
        max-height: 90vh;
        overflow: hidden;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
      }
      .ecm-modal.open {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }

      /* Property Tabs (Background/Text/Border) */
      .ecm-property-tabs {
        display: flex;
        gap: 8px;
        padding: 16px 16px 12px;
        background: #f8f9fa;
        border-bottom: 1px solid #e8eaed;
      }
      .ecm-property-tab {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 8px 10px;
        border: 2px solid #dadce0;
        background: #ffffff;
        color: #5f6368;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.15s ease;
      }
      .ecm-property-tab:hover {
        border-color: #1a73e8;
        color: #1a73e8;
      }
      .ecm-property-tab.active {
        border-color: #1a73e8;
        background: #e8f0fe;
        color: #1a73e8;
        font-weight: 600;
      }
      .ecm-property-indicator {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        border: 2px solid rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
        position: relative;
        overflow: hidden;
      }
      .ecm-property-indicator.no-border::after {
        content: '';
        position: absolute;
        top: 50%;
        left: -2px;
        width: 120%;
        height: 2px;
        background: #f44336;
        transform: rotate(-45deg);
        transform-origin: center;
      }

      /* Preview Section */
      .ecm-preview-section {
        padding: 12px 16px;
        background: #fafafa;
        border-bottom: 1px solid #e8eaed;
      }
      .ecm-preview-label {
        font-size: 11px;
        font-weight: 600;
        color: #5f6368;
        margin-bottom: 8px;
        letter-spacing: 0.5px;
      }
      .ecm-preview-container {
        display: flex;
        justify-content: flex-start;
      }
      .ecm-preview-event {
        display: inline-flex;
        align-items: stretch;
        background: #039be5;
        border-radius: 4px;
        overflow: hidden;
        min-height: 36px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
        transition: all 0.15s ease;
      }
      .ecm-preview-stripe {
        width: 5px;
        background: #f4511e;
        flex-shrink: 0;
      }
      .ecm-preview-content {
        padding: 6px 14px;
        display: flex;
        align-items: center;
      }
      .ecm-preview-title {
        font-size: 14px;
        font-weight: 500;
        color: #ffffff;
        white-space: nowrap;
      }

      /* Palette Tabs */
      .ecm-palette-tabs {
        display: flex;
        gap: 4px;
        padding: 12px 16px 0;
        border-bottom: 1px solid #e8eaed;
      }
      .ecm-palette-tab {
        flex: 1;
        padding: 8px 8px;
        border: none;
        background: transparent;
        color: #5f6368;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border-radius: 6px 6px 0 0;
        transition: all 0.15s ease;
      }
      .ecm-palette-tab:hover {
        background: #e8eaed;
        color: #202124;
      }
      .ecm-palette-tab.active {
        background: #ffffff;
        color: #1a73e8;
        font-weight: 600;
        box-shadow: 0 -1px 0 0 #e8eaed, inset 0 -2px 0 0 #1a73e8;
      }

      /* Content Area */
      .ecm-content {
        padding: 12px 16px;
        overflow: hidden;
      }
      .ecm-color-info {
        margin-bottom: 12px;
      }
      .ecm-color-label {
        font-size: 13px;
        color: #5f6368;
      }
      .ecm-hex-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
      }
      .ecm-color-input {
        width: 60%;
        height: 36px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        padding: 0;
      }
      .ecm-hex-input {
        flex: 1;
        height: 36px;
        padding: 0 10px;
        border: 2px solid #dadce0;
        border-radius: 6px;
        font-size: 13px;
        font-family: monospace;
        text-transform: uppercase;
        transition: border-color 0.15s ease;
      }
      .ecm-hex-input:focus {
        outline: none;
        border-color: #1a73e8;
      }

      /* Palette Panels */
      .ecm-palette-panel {
        display: none;
      }
      .ecm-palette-panel.active {
        display: block;
      }
      .ecm-palette {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 8px;
      }

      /* Swatches */
      .ecm-swatch {
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
      .ecm-swatch:hover {
        transform: scale(1.1);
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
        z-index: 1;
      }
      .ecm-swatch.selected {
        border-color: #1a73e8;
        box-shadow: 0 0 0 2px #1a73e8;
      }
      .ecm-swatch.selected::after {
        content: '\\2713';
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 11px;
        font-weight: bold;
        color: white;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
      }

      /* No color swatch */
      .ecm-swatch-none {
        background: #ffffff !important;
        border: 2px solid #dadce0;
        position: relative;
        overflow: hidden;
      }
      .ecm-swatch-none .ecm-no-color-line {
        position: absolute;
        top: 50%;
        left: -10%;
        width: 120%;
        height: 2px;
        background: #f44336;
        transform: rotate(-45deg);
        transform-origin: center;
      }
      .ecm-swatch-none.selected {
        border-color: #1a73e8;
      }
      .ecm-swatch-none.selected::after {
        display: none;
      }

      /* Empty State */
      .ecm-empty-state {
        grid-column: 1 / -1;
        text-align: center;
        padding: 24px 16px;
        color: #5f6368;
      }
      .ecm-empty-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }
      .ecm-empty-text {
        font-weight: 600;
        margin-bottom: 4px;
        color: #202124;
      }
      .ecm-empty-subtext {
        font-size: 12px;
        color: #80868b;
      }

      /* Action Buttons */
      .ecm-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
        padding: 12px 16px;
        background: #f8f9fa;
        border-top: 1px solid #e8eaed;
      }
      .ecm-btn {
        padding: 10px 24px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .ecm-btn-cancel {
        background: #ffffff;
        border: 1px solid #dadce0;
        color: #5f6368;
      }
      .ecm-btn-cancel:hover {
        background: #f1f3f4;
        border-color: #c6c9cc;
      }
      .ecm-btn-apply {
        background: #1a73e8;
        border: none;
        color: #ffffff;
      }
      .ecm-btn-apply:hover {
        background: #1557b0;
        box-shadow: 0 2px 6px rgba(26, 115, 232, 0.3);
      }
    `;
    document.head.appendChild(style);
  }
}

/**
 * Factory function to create and open an event color modal
 * @param {Object} options - Same options as EventColorModal constructor
 * @returns {EventColorModal} Modal instance
 */
function createEventColorModal(options) {
  const modal = new EventColorModal(options);
  modal.open();
  return modal;
}

// Export to window for content scripts (no bundler)
if (typeof window !== 'undefined') {
  window.EventColorModal = EventColorModal;
  window.createEventColorModal = createEventColorModal;
}
