/**
 * ColorSwatchModal - Reusable color picker modal with palette tabs
 * Used by both popup UI and injected calendar color pickers
 *
 * @module ColorSwatchModal
 */

// Color Palettes
const COLOR_PALETTES = {
  vibrant: [
    // Red family
    '#d50000', '#ff1744', '#f44336', '#ff5722',
    // Orange family
    '#ff9800', '#ffc107',
    // Yellow family
    '#ffeb3b', '#cddc39',
    // Green family
    '#8bc34a', '#4caf50', '#00e676', '#1de9b6', '#009688',
    // Cyan family
    '#00e5ff', '#00bcd4', '#00b0ff',
    // Blue family
    '#03a9f4', '#2196f3', '#2979ff', '#3d5afe',
    // Purple family
    '#651fff', '#3f51b5', '#673ab7', '#9c27b0', '#e91e63',
    // Pink family
    '#ff4081', '#f50057',
    // Neutral
    '#795548', '#9e9e9e', '#607d8b',
  ],
  pastel: [
    // Pink pastels
    '#f8bbd9', '#f48fb1', '#f06292', '#ec407a', '#e1bee7',
    // Purple pastels
    '#d1c4e9', '#ce93d8', '#ba68c8', '#ab47bc', '#c8e6c9',
    // Green pastels
    '#c8e6c9', '#a5d6a7', '#81c784', '#66bb6a', '#dcedc8',
    // Blue pastels
    '#bbdefb', '#90caf9', '#64b5f6', '#42a5f5', '#b3e5fc',
    // Cyan pastels
    '#b2ebf2', '#80deea', '#4dd0e1', '#26c6da', '#f0f4c3',
    // Yellow pastels
    '#fff9c4', '#fff59d', '#fff176', '#ffee58', '#ffe0b2',
    // Orange pastels
    '#ffccbc', '#ffab91', '#ff8a65', '#ff7043', '#ffd180',
  ],
  dark: [
    // Dark reds
    '#b71c1c', '#c62828', '#d32f2f', '#f44336', '#880e4f',
    // Dark purples
    '#4a148c', '#6a1b9a', '#7b1fa2', '#8e24aa', '#311b92',
    // Dark blues
    '#0d47a1', '#1565c0', '#1976d2', '#1e88e5', '#01579b',
    // Dark teals/greens
    '#004d40', '#00695c', '#00796b', '#00897b', '#1b5e20',
    // Dark greens
    '#2e7d32', '#388e3c', '#43a047', '#4caf50', '#33691e',
    // Dark browns/grays
    '#3e2723', '#4e342e', '#5d4037', '#6d4c41', '#263238',
    // Dark grays
    '#37474f', '#455a64', '#546e7a', '#607d8b', '#212121',
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
 * Create a color swatch element
 * @param {string} color - Hex color value
 * @param {Function} onSelect - Callback when color is selected
 * @param {boolean} isCustom - Whether this is a custom color
 * @returns {HTMLElement} Swatch element
 */
function createSwatch(color, onSelect, isCustom = false) {
  const swatch = document.createElement('div');
  swatch.className = isCustom ? 'csm-swatch csm-swatch-custom' : 'csm-swatch';
  swatch.style.backgroundColor = color;
  swatch.title = color.toUpperCase();
  swatch.dataset.color = color;
  swatch.setAttribute('role', 'button');
  swatch.setAttribute('tabindex', '0');
  swatch.setAttribute('aria-label', `Select color ${color}`);

  swatch.addEventListener('click', (e) => {
    e.stopPropagation();
    onSelect(color);
  });

  swatch.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect(color);
    }
  });

  return swatch;
}

/**
 * Create empty state for custom colors
 * @returns {HTMLElement} Empty state element
 */
function createEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'csm-empty-state';
  empty.innerHTML = `
    <div class="csm-empty-icon">🎨</div>
    <div class="csm-empty-text">No custom colors</div>
    <div class="csm-empty-subtext">Add colors in Color Lab (Preferences)</div>
  `;
  return empty;
}

/**
 * ColorSwatchModal class
 * Creates a modal color picker with Vibrant, Pastel, Dark, and Custom tabs
 */
class ColorSwatchModal {
  /**
   * @param {Object} options - Configuration options
   * @param {string} options.id - Unique identifier for the modal
   * @param {string} [options.currentColor] - Currently selected color
   * @param {Function} options.onColorSelect - Callback when color is selected
   * @param {Function} [options.onClose] - Callback when modal is closed
   * @param {string} [options.helperText] - Helper text to display
   * @param {boolean} [options.showHexInput=true] - Show hex input field
   * @param {HTMLElement} [options.container] - Container to append modal to (default: document.body)
   */
  constructor(options) {
    this.id = options.id || `csm-${Date.now()}`;
    this.currentColor = options.currentColor || '#4285f4';
    this.onColorSelect = options.onColorSelect;
    this.onClose = options.onClose;
    this.helperText = options.helperText || '';
    this.showHexInput = options.showHexInput !== false;
    this.container = options.container || document.body;
    this.activeTab = 'vibrant';
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
    modal.className = 'csm-modal';
    modal.id = this.id;

    const helper = this.helperText
      ? `<div class="csm-helper">${this.helperText}</div>`
      : '';

    const hexInput = this.showHexInput
      ? `
        <div class="csm-hex-row">
          <input type="color" class="csm-color-input" value="${this.currentColor}">
          <input type="text" class="csm-hex-input" value="${this.currentColor.toUpperCase()}" placeholder="#FF0000" maxlength="7">
        </div>
      `
      : '';

    modal.innerHTML = `
      <div class="csm-tabs">
        <button type="button" class="csm-tab active" data-tab="vibrant">Vibrant</button>
        <button type="button" class="csm-tab" data-tab="pastel">Pastel</button>
        <button type="button" class="csm-tab" data-tab="dark">Dark</button>
        <button type="button" class="csm-tab" data-tab="custom">Custom</button>
      </div>
      <div class="csm-content">
        ${helper}
        ${hexInput}
        <div class="csm-panel active" data-panel="vibrant">
          <div class="csm-palette" id="${this.id}-vibrant"></div>
        </div>
        <div class="csm-panel" data-panel="pastel">
          <div class="csm-palette" id="${this.id}-pastel"></div>
        </div>
        <div class="csm-panel" data-panel="dark">
          <div class="csm-palette" id="${this.id}-dark"></div>
        </div>
        <div class="csm-panel" data-panel="custom">
          <div class="csm-palette" id="${this.id}-custom"></div>
        </div>
      </div>
    `;

    return modal;
  }

  /**
   * Populate palettes with color swatches
   */
  async populatePalettes() {
    const handleSelect = (color) => {
      this.currentColor = color;
      this.updateHexInputs(color);
      this.highlightSelected(color);
      if (this.onColorSelect) {
        this.onColorSelect(color);
      }
    };

    // Vibrant palette
    const vibrantEl = this.element.querySelector(`#${this.id}-vibrant`);
    if (vibrantEl) {
      vibrantEl.innerHTML = '';
      COLOR_PALETTES.vibrant.forEach((color) => {
        vibrantEl.appendChild(createSwatch(color, handleSelect));
      });
    }

    // Pastel palette
    const pastelEl = this.element.querySelector(`#${this.id}-pastel`);
    if (pastelEl) {
      pastelEl.innerHTML = '';
      COLOR_PALETTES.pastel.forEach((color) => {
        pastelEl.appendChild(createSwatch(color, handleSelect));
      });
    }

    // Dark palette
    const darkEl = this.element.querySelector(`#${this.id}-dark`);
    if (darkEl) {
      darkEl.innerHTML = '';
      COLOR_PALETTES.dark.forEach((color) => {
        darkEl.appendChild(createSwatch(color, handleSelect));
      });
    }

    // Custom palette
    this.customColors = await loadCustomColors();
    const customEl = this.element.querySelector(`#${this.id}-custom`);
    if (customEl) {
      customEl.innerHTML = '';
      if (this.customColors.length === 0) {
        customEl.appendChild(createEmptyState());
      } else {
        this.customColors.forEach((color) => {
          customEl.appendChild(createSwatch(color, handleSelect, true));
        });
      }
    }

    // Highlight current color if present
    if (this.currentColor) {
      this.highlightSelected(this.currentColor);
    }
  }

  /**
   * Highlight the selected color swatch
   * @param {string} color - Color to highlight
   */
  highlightSelected(color) {
    if (!this.element) return;

    this.element.querySelectorAll('.csm-swatch').forEach((swatch) => {
      swatch.classList.remove('selected');
      if (swatch.dataset.color?.toLowerCase() === color?.toLowerCase()) {
        swatch.classList.add('selected');
      }
    });
  }

  /**
   * Update hex input fields
   * @param {string} color - Color value
   */
  updateHexInputs(color) {
    if (!this.element) return;

    const colorInput = this.element.querySelector('.csm-color-input');
    const hexInput = this.element.querySelector('.csm-hex-input');

    if (colorInput) colorInput.value = color;
    if (hexInput) hexInput.value = color.toUpperCase();
  }

  /**
   * Setup tab switching
   */
  setupTabs() {
    const tabs = this.element.querySelectorAll('.csm-tab');
    const panels = this.element.querySelectorAll('.csm-panel');

    tabs.forEach((tab) => {
      tab.addEventListener('click', (e) => {
        e.stopPropagation();
        const tabName = tab.dataset.tab;

        tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === tabName));
        panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === tabName));

        this.activeTab = tabName;
      });
    });
  }

  /**
   * Setup hex input handling
   */
  setupHexInputs() {
    const colorInput = this.element.querySelector('.csm-color-input');
    const hexInput = this.element.querySelector('.csm-hex-input');

    if (colorInput && hexInput) {
      colorInput.addEventListener('input', () => {
        hexInput.value = colorInput.value.toUpperCase();
      });

      colorInput.addEventListener('change', () => {
        const color = colorInput.value;
        this.currentColor = color;
        this.highlightSelected(color);
        if (this.onColorSelect) {
          this.onColorSelect(color);
        }
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
          this.currentColor = normalized;
          colorInput.value = normalized;
          this.highlightSelected(normalized);
          if (this.onColorSelect) {
            this.onColorSelect(normalized);
          }
        }
      });
    }
  }

  /**
   * Create and show backdrop
   */
  createBackdrop() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'csm-backdrop';
    this.backdrop.addEventListener('click', () => this.close());
    this.container.appendChild(this.backdrop);

    // Animate in
    requestAnimationFrame(() => {
      this.backdrop.classList.add('active');
    });
  }

  /**
   * Open the modal
   * @returns {Promise<void>}
   */
  async open() {
    // Build modal
    this.element = this.buildModal();

    // Create backdrop
    this.createBackdrop();

    // Append to container
    this.container.appendChild(this.element);

    // Setup functionality
    this.setupTabs();
    this.setupHexInputs();
    await this.populatePalettes();

    // Prevent clicks inside modal from closing it
    this.element.addEventListener('click', (e) => e.stopPropagation());

    // Animate in
    requestAnimationFrame(() => {
      this.element.classList.add('open');
    });

    // Focus first tab for accessibility
    const firstTab = this.element.querySelector('.csm-tab');
    if (firstTab) firstTab.focus();
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

    // Wait for animation then remove
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
   * Update current color
   * @param {string} color - New color value
   */
  setColor(color) {
    this.currentColor = color;
    this.updateHexInputs(color);
    this.highlightSelected(color);
  }

  /**
   * Refresh custom colors from storage
   */
  async refreshCustomColors() {
    this.customColors = await loadCustomColors();
    const customEl = this.element?.querySelector(`#${this.id}-custom`);
    if (customEl) {
      customEl.innerHTML = '';
      if (this.customColors.length === 0) {
        customEl.appendChild(createEmptyState());
      } else {
        const handleSelect = (color) => {
          this.currentColor = color;
          this.updateHexInputs(color);
          this.highlightSelected(color);
          if (this.onColorSelect) {
            this.onColorSelect(color);
          }
        };
        this.customColors.forEach((color) => {
          customEl.appendChild(createSwatch(color, handleSelect, true));
        });
      }
    }
  }
}

/**
 * Factory function to create and open a color swatch modal
 * @param {Object} options - Same options as ColorSwatchModal constructor
 * @returns {ColorSwatchModal} Modal instance
 */
function createColorSwatchModal(options) {
  const modal = new ColorSwatchModal(options);
  modal.open();
  return modal;
}

// Export to window for content scripts (no bundler)
if (typeof window !== 'undefined') {
  window.ColorSwatchModal = ColorSwatchModal;
  window.createColorSwatchModal = createColorSwatchModal;
  window.COLOR_PALETTES = COLOR_PALETTES;
}
