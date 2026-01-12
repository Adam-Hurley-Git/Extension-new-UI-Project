// features/event-coloring/components/EventColorPanel.js
// Redesigned event color panel with clear mode separation between Google colors and ColorKit colors

import { showRecurringEventDialog } from './RecurringEventDialog.js';
import EventIdUtils from '../utils/eventIdUtils.js';

// Google's default 12 colors (Modern scheme)
const GOOGLE_COLORS = [
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
  { hex: '#a79b8e', name: 'Cocoa' },
];

/**
 * EventColorPanel - Redesigned event color UI with mode separation
 *
 * Modes:
 * - Google Mode: Event uses Google's native colors (12 color picker)
 * - ColorKit Mode: Event uses ColorKit coloring (list defaults or manual colors)
 */
export class EventColorPanel {
  constructor(options) {
    this.eventId = options.eventId;
    this.storageService = options.storageService;
    this.onClose = options.onClose;
    this.onColorApplied = options.onColorApplied;

    // State
    this.currentMode = 'google'; // 'google' or 'colorkit'
    this.hasListColoring = false;
    this.listColorEnabled = false;
    this.eventColors = null;
    this.calendarDefaults = null;
    this.calendarId = null;
    this.calendarName = '';
    this.categories = [];
    this.templates = [];
    this.isRecurring = false;

    // DOM elements
    this.container = null;
    this.backdrop = null;
  }

  /**
   * Initialize and load data
   */
  async init() {
    try {
      // Parse event ID
      const parsed = EventIdUtils.fromEncoded(this.eventId);
      this.isRecurring = parsed.isRecurring;
      this.calendarId = parsed.emailSuffix;

      // Load all data in parallel with fallbacks
      const [eventColors, calendarDefaults, categories, templates] = await Promise.all([
        this.storageService.findEventColorFull?.(this.eventId) ||
          this.storageService.findEventColor?.(this.eventId) ||
          null,
        this.calendarId ? this.storageService.getEventCalendarColor?.(this.calendarId) : null,
        this.storageService.getEventColorCategories?.() || {},
        this.storageService.getEventColorTemplates?.() || {},
      ]);

      this.eventColors = eventColors;
      this.calendarDefaults = calendarDefaults;

      // Handle categories - could be object or array
      this.categories = Array.isArray(categories) ? categories : Object.values(categories || {});

      // Handle templates - could be object or array
      this.templates = Array.isArray(templates) ? templates : Object.values(templates || {});

      // Determine current mode
      this.determineCurrentMode();

      // Get calendar name from DOM or use email
      this.calendarName = this.getCalendarName();

      // Check if list coloring exists
      this.hasListColoring = !!(calendarDefaults?.background || calendarDefaults?.text || calendarDefaults?.border);
      this.listColorEnabled = this.hasListColoring && !this.eventColors?.overrideDefaults && !this.eventColors?.useGoogleColors;
    } catch (error) {
      console.error('[EventColorPanel] Error initializing:', error);
      // Set defaults on error
      this.eventColors = null;
      this.calendarDefaults = null;
      this.categories = [];
      this.templates = [];
      this.hasListColoring = false;
      this.listColorEnabled = false;
    }
  }

  /**
   * Determine if event is in Google mode or ColorKit mode
   */
  determineCurrentMode() {
    // If useGoogleColors flag is set, definitely Google mode
    if (this.eventColors?.useGoogleColors) {
      this.currentMode = 'google';
      return;
    }

    // If event has manual colors (background, text, or border), it's ColorKit mode
    if (this.eventColors?.background || this.eventColors?.text || this.eventColors?.border) {
      this.currentMode = 'colorkit';
      return;
    }

    // If calendar has defaults and event doesn't override them, it's ColorKit mode
    if (this.calendarDefaults && !this.eventColors?.overrideDefaults) {
      if (this.calendarDefaults.background || this.calendarDefaults.text || this.calendarDefaults.border) {
        this.currentMode = 'colorkit';
        return;
      }
    }

    // Default to Google mode
    this.currentMode = 'google';
  }

  /**
   * Get calendar display name
   */
  getCalendarName() {
    // Try to find calendar name from DOM
    const calendarSelect = document.querySelector('[data-key="calendar"] select');
    if (calendarSelect) {
      const selectedOption = calendarSelect.options[calendarSelect.selectedIndex];
      if (selectedOption) return selectedOption.textContent;
    }

    // Fallback to email or generic
    return this.calendarId || 'Google Calendar';
  }

  /**
   * Render the panel
   */
  async render() {
    await this.init();

    // Inject CSS if not already
    this.injectCSS();

    // Create backdrop
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'ecp-backdrop';
    this.backdrop.addEventListener('click', () => this.close());

    // Create container
    this.container = document.createElement('div');
    this.container.className = 'ecp-container';

    // Build content
    this.container.innerHTML = this.buildHTML();

    // Add to DOM
    document.body.appendChild(this.backdrop);
    document.body.appendChild(this.container);

    // Trigger animation
    requestAnimationFrame(() => {
      this.backdrop.classList.add('active');
      this.container.classList.add('active');
    });

    // Attach event listeners
    this.attachEventListeners();
  }

  /**
   * Build the HTML structure
   */
  buildHTML() {
    const isGoogleMode = this.currentMode === 'google';
    const isColorKitMode = this.currentMode === 'colorkit';

    return `
      <div class="ecp-header">
        <h3>Event Color</h3>
        <button class="ecp-close-btn" aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="ecp-content">
        <!-- Delete/Remove Button -->
        <button class="ecp-delete-btn" data-action="delete">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
          Delete
        </button>

        <!-- Google's Own Colors Section -->
        <div class="ecp-section ecp-section-google ${isGoogleMode ? 'active' : 'disabled'}">
          <div class="ecp-section-header">
            <div class="ecp-section-info">
              <h4>Google's own colors</h4>
              <p>Use Google's built-in colors. Syncs across devices.</p>
            </div>
            <div class="ecp-toggle ${isGoogleMode ? 'active' : ''}" data-toggle="google">
              <div class="ecp-toggle-track">
                <div class="ecp-toggle-thumb"></div>
              </div>
            </div>
          </div>
          <div class="ecp-google-colors-preview">
            ${this.buildGoogleColorsPreview()}
          </div>
        </div>

        <!-- ColorKit List Color Section -->
        <div class="ecp-section ecp-section-list ${isColorKitMode ? 'active' : 'disabled'}">
          <div class="ecp-section-header">
            <div class="ecp-section-info">
              <h4>ColorKit List Color <span class="ecp-pro-badge">PRO</span></h4>
              <div class="ecp-calendar-info">
                <span class="ecp-calendar-color" style="background: ${this.calendarDefaults?.background || '#039be5'}"></span>
                <span class="ecp-calendar-name">${this.calendarName}</span>
                ${this.hasListColoring ? `<span class="ecp-list-default-chip" style="background: ${this.calendarDefaults?.background || '#039be5'}; color: ${this.getContrastColor(this.calendarDefaults?.background || '#039be5')}">List Default</span>` : ''}
              </div>
              <p>Choose to use calendar default or completely custom coloring below</p>
            </div>
            <div class="ecp-toggle ${this.listColorEnabled ? 'active' : ''}" data-toggle="list">
              <div class="ecp-toggle-track">
                <div class="ecp-toggle-thumb"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- ColorKit's Colors Section -->
        <div class="ecp-section ecp-section-colorkit ${isColorKitMode ? 'active' : 'disabled'}">
          <div class="ecp-section-header">
            <div class="ecp-section-info">
              <h4>ColorKit's Colors</h4>
              <p>Use custom colors with text & border options.</p>
            </div>
            <div class="ecp-toggle ${isColorKitMode ? 'active' : ''}" data-toggle="colorkit">
              <div class="ecp-toggle-track">
                <div class="ecp-toggle-thumb"></div>
              </div>
            </div>
          </div>

          <!-- Full Custom Coloring Button -->
          <button class="ecp-full-custom-btn" data-action="full-custom">
            <span class="ecp-full-custom-icon">+</span>
            <div class="ecp-full-custom-text">
              <strong>Full Custom Coloring</strong>
              <span>Full picker - Any color for your background, Text and Border</span>
            </div>
          </button>
        </div>

        <!-- Background Colors Section -->
        <div class="ecp-section ecp-section-backgrounds ${isColorKitMode ? '' : 'disabled'}">
          <div class="ecp-section-divider">
            <span>Background Colors</span>
          </div>

          <!-- Google's Default Colors -->
          <div class="ecp-subsection">
            <h5>Google's Default Colors</h5>
            <div class="ecp-color-grid">
              ${this.buildGoogleColorsGrid()}
            </div>
          </div>

          <!-- Custom Categories -->
          ${this.buildCategoriesHTML()}

          <!-- Templates -->
          ${this.buildTemplatesHTML()}
        </div>
      </div>
    `;
  }

  /**
   * Build Google colors preview (2 rows of 6)
   */
  buildGoogleColorsPreview() {
    return `
      <div class="ecp-google-preview-row">
        ${GOOGLE_COLORS.slice(0, 6).map(c => `
          <div class="ecp-google-preview-dot" style="background: ${c.hex}" title="${c.name}"></div>
        `).join('')}
      </div>
      <div class="ecp-google-preview-row">
        ${GOOGLE_COLORS.slice(6, 12).map(c => `
          <div class="ecp-google-preview-dot" style="background: ${c.hex}" title="${c.name}"></div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Build Google colors grid (clickable)
   */
  buildGoogleColorsGrid() {
    return GOOGLE_COLORS.map(c => `
      <button class="ecp-color-swatch" data-color="${c.hex}" title="${c.name}" style="background: ${c.hex}">
        <span class="ecp-color-check">✓</span>
      </button>
    `).join('');
  }

  /**
   * Build categories HTML
   */
  buildCategoriesHTML() {
    if (this.categories.length === 0) return '';

    return this.categories.map(category => `
      <div class="ecp-subsection">
        <h5>${category.name}</h5>
        <div class="ecp-color-grid">
          ${(category.colors || []).map(colorObj => {
            const hex = typeof colorObj === 'string' ? colorObj : colorObj.hex;
            const name = typeof colorObj === 'object' ? colorObj.name : hex;
            return `
              <button class="ecp-color-swatch" data-color="${hex}" title="${name || hex}" style="background: ${hex}">
                <span class="ecp-color-check">✓</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  }

  /**
   * Build templates HTML
   */
  buildTemplatesHTML() {
    if (this.templates.length === 0) return '';

    return `
      <div class="ecp-subsection ecp-templates-section">
        <div class="ecp-subsection-header">
          <h5>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1"/>
              <rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/>
              <rect x="14" y="14" width="7" height="7" rx="1"/>
            </svg>
            TEMPLATES
            <span class="ecp-pro-badge">PRO</span>
          </h5>
        </div>
        <div class="ecp-templates-grid">
          ${this.templates.map(t => `
            <button class="ecp-template-chip" data-template="${t.id}" style="
              background: ${t.background || '#039be5'};
              color: ${t.text || this.getContrastColor(t.background || '#039be5')};
              ${t.border ? `outline: 2px solid ${t.border}; outline-offset: -1px;` : ''}
            ">
              ${t.name || 'Template'}
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Attach event listeners
   */
  attachEventListeners() {
    // Close button
    const closeBtn = this.container.querySelector('.ecp-close-btn');
    closeBtn?.addEventListener('click', () => this.close());

    // Delete button
    const deleteBtn = this.container.querySelector('[data-action="delete"]');
    deleteBtn?.addEventListener('click', () => this.handleDelete());

    // Toggle switches
    this.container.querySelectorAll('.ecp-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => this.handleToggle(e.currentTarget.dataset.toggle));
    });

    // Full custom button
    const fullCustomBtn = this.container.querySelector('[data-action="full-custom"]');
    fullCustomBtn?.addEventListener('click', () => this.handleFullCustom());

    // Color swatches
    this.container.querySelectorAll('.ecp-color-swatch').forEach(swatch => {
      swatch.addEventListener('click', (e) => this.handleColorSelect(e.currentTarget.dataset.color));
    });

    // Template chips
    this.container.querySelectorAll('.ecp-template-chip').forEach(chip => {
      chip.addEventListener('click', (e) => this.handleTemplateSelect(e.currentTarget.dataset.template));
    });

    // Escape key
    this.escapeHandler = (e) => {
      if (e.key === 'Escape') this.close();
    };
    document.addEventListener('keydown', this.escapeHandler);
  }

  /**
   * Handle toggle switch clicks
   */
  async handleToggle(toggleType) {
    if (toggleType === 'google') {
      // Switch to Google mode
      if (this.currentMode !== 'google') {
        this.showModeSwitchModal('google');
      }
    } else if (toggleType === 'colorkit') {
      // Switch to ColorKit mode
      if (this.currentMode !== 'colorkit') {
        this.showModeSwitchModal('colorkit');
      }
    } else if (toggleType === 'list') {
      // Toggle list coloring
      if (this.listColorEnabled) {
        this.showDisableListColorModal();
      } else {
        await this.enableListColoring();
      }
    }
  }

  /**
   * Show mode switch confirmation modal
   */
  showModeSwitchModal(newMode) {
    const isToGoogle = newMode === 'google';
    const title = isToGoogle ? 'Switch to Google Colors' : 'Switch to ColorKit Colors';
    const message = isToGoogle
      ? 'You are switching to Google\'s native color mode. This event will use Google\'s built-in 12 colors and sync across devices. Any ColorKit styling will be removed.'
      : 'You are switching to ColorKit color mode. This enables custom background, text, and border colors. The event will no longer use Google\'s synced colors.';

    this.showConfirmModal({
      title,
      message,
      confirmText: 'Switch Mode',
      onConfirm: async () => {
        if (isToGoogle) {
          await this.switchToGoogleMode();
        } else {
          await this.switchToColorKitMode();
        }
      }
    });
  }

  /**
   * Show disable list coloring modal
   */
  showDisableListColorModal() {
    this.showConfirmModal({
      title: 'Disable List Coloring',
      message: 'You are disabling the calendar list default color for this event. Would you like to:',
      buttons: [
        {
          text: 'Use Google Colors',
          primary: false,
          action: async () => await this.switchToGoogleMode()
        },
        {
          text: 'Setup Manual Color',
          primary: true,
          action: () => this.handleFullCustom()
        }
      ]
    });
  }

  /**
   * Show a confirmation modal
   */
  showConfirmModal(options) {
    const { title, message, confirmText, onConfirm, buttons } = options;

    // Remove existing modal
    document.querySelector('.ecp-confirm-modal')?.remove();

    const modal = document.createElement('div');
    modal.className = 'ecp-confirm-modal';
    modal.innerHTML = `
      <div class="ecp-confirm-backdrop"></div>
      <div class="ecp-confirm-dialog">
        <h4>${title}</h4>
        <p>${message}</p>
        <div class="ecp-confirm-buttons">
          ${buttons ? buttons.map(btn => `
            <button class="ecp-confirm-btn ${btn.primary ? 'primary' : ''}" data-action="${btn.text}">${btn.text}</button>
          `).join('') : `
            <button class="ecp-confirm-btn" data-action="cancel">Cancel</button>
            <button class="ecp-confirm-btn primary" data-action="confirm">${confirmText || 'Confirm'}</button>
          `}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Animate in
    requestAnimationFrame(() => modal.classList.add('active'));

    // Event handlers
    const closeModal = () => {
      modal.classList.remove('active');
      setTimeout(() => modal.remove(), 200);
    };

    modal.querySelector('.ecp-confirm-backdrop').addEventListener('click', closeModal);

    if (buttons) {
      buttons.forEach(btn => {
        modal.querySelector(`[data-action="${btn.text}"]`)?.addEventListener('click', () => {
          closeModal();
          btn.action?.();
        });
      });
    } else {
      modal.querySelector('[data-action="cancel"]')?.addEventListener('click', closeModal);
      modal.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
        closeModal();
        onConfirm?.();
      });
    }
  }

  /**
   * Switch to Google mode
   */
  async switchToGoogleMode() {
    const applySwitch = async (applyToAll = false) => {
      if (applyToAll && this.storageService.markRecurringEventForGoogleColors) {
        await this.storageService.markRecurringEventForGoogleColors(this.eventId);
      } else {
        await this.storageService.markEventForGoogleColors(this.eventId);
      }

      this.close();
      window.location.reload();
    };

    if (this.isRecurring) {
      showRecurringEventDialog({
        eventId: this.eventId,
        color: null,
        showColorPreview: false,
        dialogTitle: 'Switch to Google Colors',
        dialogMessage: 'This is a recurring event. Apply Google colors to:',
        allEventsLabel: 'All events in series',
        thisOnlyLabel: 'This event only',
        onConfirm: applySwitch,
        onClose: () => {}
      });
    } else {
      await applySwitch(false);
    }
  }

  /**
   * Switch to ColorKit mode
   */
  async switchToColorKitMode() {
    // If there are list defaults, enable them
    if (this.hasListColoring) {
      await this.enableListColoring();
    } else {
      // Otherwise open full custom modal
      this.handleFullCustom();
    }
  }

  /**
   * Enable list coloring for this event
   */
  async enableListColoring() {
    const applyListColor = async (applyToAll = false) => {
      // Remove any existing custom colors to let list defaults apply
      if (applyToAll && this.storageService.removeRecurringEventColors) {
        await this.storageService.removeRecurringEventColors(this.eventId);
      } else {
        await this.storageService.removeEventColor(this.eventId);
      }

      this.triggerColorUpdate();
      this.close();
    };

    if (this.isRecurring) {
      showRecurringEventDialog({
        eventId: this.eventId,
        color: this.calendarDefaults?.background,
        dialogTitle: 'Apply List Color',
        dialogMessage: 'This is a recurring event. Apply list default to:',
        allEventsLabel: 'All events in series',
        thisOnlyLabel: 'This event only',
        onConfirm: applyListColor,
        onClose: () => {}
      });
    } else {
      await applyListColor(false);
    }
  }

  /**
   * Handle delete/remove all coloring
   */
  async handleDelete() {
    const applyDelete = async (applyToAll = false) => {
      if (applyToAll && this.storageService.markRecurringEventForGoogleColors) {
        await this.storageService.markRecurringEventForGoogleColors(this.eventId);
      } else {
        await this.storageService.markEventForGoogleColors(this.eventId);
      }

      this.close();
      window.location.reload();
    };

    if (this.isRecurring) {
      showRecurringEventDialog({
        eventId: this.eventId,
        color: null,
        showColorPreview: false,
        dialogTitle: 'Remove Coloring',
        dialogMessage: 'This is a recurring event. Remove coloring from:',
        allEventsLabel: 'All events in series',
        thisOnlyLabel: 'This event only',
        onConfirm: applyDelete,
        onClose: () => {}
      });
    } else {
      await applyDelete(false);
    }
  }

  /**
   * Handle full custom button click
   */
  handleFullCustom() {
    this.close();
    // Trigger the full EventColorModal
    if (window.cfEventColoring?.openCustomColorModal) {
      window.cfEventColoring.openCustomColorModal(this.eventId);
    } else {
      // Dispatch event for colorPickerInjector to handle
      window.dispatchEvent(new CustomEvent('cf-open-full-color-modal', { detail: { eventId: this.eventId } }));
    }
  }

  /**
   * Handle color swatch selection
   */
  async handleColorSelect(hex) {
    // Check if ColorKit mode is active
    if (this.currentMode !== 'colorkit') {
      // First switch to ColorKit mode
      this.currentMode = 'colorkit';
    }

    const applyColor = async (applyToAll = false) => {
      const colors = {
        background: hex,
        text: null,
        border: null,
        borderWidth: 2,
        overrideDefaults: true, // Override list defaults
      };

      if (this.storageService.saveEventColorsFullAdvanced) {
        await this.storageService.saveEventColorsFullAdvanced(this.eventId, colors, { applyToAll });
      } else {
        await this.storageService.saveEventColor(this.eventId, hex, applyToAll);
      }

      this.triggerColorUpdate();
      this.close();
    };

    if (this.isRecurring) {
      showRecurringEventDialog({
        eventId: this.eventId,
        color: hex,
        dialogTitle: 'Apply Color',
        dialogMessage: 'This is a recurring event. Apply color to:',
        allEventsLabel: 'All events in series',
        thisOnlyLabel: 'This event only',
        onConfirm: applyColor,
        onClose: () => {}
      });
    } else {
      await applyColor(false);
    }
  }

  /**
   * Handle template selection
   */
  async handleTemplateSelect(templateId) {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    const applyTemplate = async (applyToAll = false) => {
      const colors = {
        background: template.background || null,
        text: template.text || null,
        border: template.border || null,
        borderWidth: template.borderWidth || 2,
        overrideDefaults: true,
      };

      if (this.storageService.saveEventColorsFullAdvanced) {
        await this.storageService.saveEventColorsFullAdvanced(this.eventId, colors, { applyToAll });
      }

      this.triggerColorUpdate();
      this.close();
    };

    if (this.isRecurring) {
      showRecurringEventDialog({
        eventId: this.eventId,
        color: template.background,
        dialogTitle: 'Apply Template',
        dialogMessage: 'This is a recurring event. Apply template to:',
        allEventsLabel: 'All events in series',
        thisOnlyLabel: 'This event only',
        onConfirm: applyTemplate,
        onClose: () => {}
      });
    } else {
      await applyTemplate(false);
    }
  }

  /**
   * Trigger color update event
   */
  triggerColorUpdate() {
    window.dispatchEvent(new CustomEvent('cf-event-color-changed'));
    this.onColorApplied?.();
  }

  /**
   * Get contrasting text color
   */
  getContrastColor(hex) {
    if (!hex) return '#ffffff';
    const cleanHex = hex.replace('#', '');
    const r = parseInt(cleanHex.substr(0, 2), 16);
    const g = parseInt(cleanHex.substr(2, 2), 16);
    const b = parseInt(cleanHex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  /**
   * Close the panel
   */
  close() {
    document.removeEventListener('keydown', this.escapeHandler);

    this.backdrop?.classList.remove('active');
    this.container?.classList.remove('active');

    setTimeout(() => {
      this.backdrop?.remove();
      this.container?.remove();
      this.onClose?.();
    }, 200);
  }

  /**
   * Inject CSS styles
   */
  injectCSS() {
    const styleId = 'ecp-panel-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      /* Event Color Panel Styles */
      .ecp-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        z-index: 99998;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .ecp-backdrop.active {
        opacity: 1;
      }

      .ecp-container {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%) scale(0.95);
        background: #ffffff;
        border-radius: 16px;
        box-shadow: 0 12px 48px rgba(0, 0, 0, 0.2);
        z-index: 99999;
        width: 340px;
        max-width: 95vw;
        max-height: 85vh;
        overflow: hidden;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      }
      .ecp-container.active {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }

      .ecp-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 20px;
        border-bottom: 1px solid #e8eaed;
        background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      }
      .ecp-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
      }
      .ecp-close-btn {
        background: none;
        border: none;
        padding: 4px;
        cursor: pointer;
        color: #64748b;
        border-radius: 4px;
        transition: all 0.15s ease;
      }
      .ecp-close-btn:hover {
        background: #e2e8f0;
        color: #1e293b;
      }

      .ecp-content {
        padding: 16px;
        max-height: calc(85vh - 60px);
        overflow-y: auto;
      }

      /* Delete Button */
      .ecp-delete-btn {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 10px 16px;
        background: #f8f9fa;
        border: 1px solid #e8eaed;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 500;
        color: #5f6368;
        cursor: pointer;
        transition: all 0.15s ease;
        margin-bottom: 12px;
      }
      .ecp-delete-btn:hover {
        background: #fee2e2;
        border-color: #fecaca;
        color: #dc2626;
      }

      /* Sections */
      .ecp-section {
        background: #ffffff;
        border: 1.5px solid #e2e8f0;
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 12px;
        transition: all 0.2s ease;
      }
      .ecp-section.disabled {
        opacity: 0.5;
        background: #f8f9fa;
      }
      .ecp-section.active {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      }

      .ecp-section-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
      }
      .ecp-section-info {
        flex: 1;
        min-width: 0;
      }
      .ecp-section-info h4 {
        margin: 0 0 4px;
        font-size: 14px;
        font-weight: 600;
        color: #1e293b;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .ecp-section-info p {
        margin: 0;
        font-size: 11px;
        color: #64748b;
        line-height: 1.4;
      }

      /* Pro Badge */
      .ecp-pro-badge {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 9px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Toggle Switch */
      .ecp-toggle {
        cursor: pointer;
        flex-shrink: 0;
      }
      .ecp-toggle-track {
        width: 44px;
        height: 24px;
        background: #cbd5e1;
        border-radius: 12px;
        position: relative;
        transition: background 0.2s ease;
      }
      .ecp-toggle.active .ecp-toggle-track {
        background: #3b82f6;
      }
      .ecp-toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 20px;
        height: 20px;
        background: white;
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        transition: left 0.2s ease;
      }
      .ecp-toggle.active .ecp-toggle-thumb {
        left: 22px;
      }

      /* Calendar Info */
      .ecp-calendar-info {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 6px 0;
        flex-wrap: wrap;
      }
      .ecp-calendar-color {
        width: 12px;
        height: 12px;
        border-radius: 3px;
        flex-shrink: 0;
      }
      .ecp-calendar-name {
        font-size: 12px;
        color: #475569;
        font-weight: 500;
      }
      .ecp-list-default-chip {
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
      }

      /* Google Colors Preview */
      .ecp-google-colors-preview {
        margin-top: 10px;
        padding-top: 10px;
        border-top: 1px solid #f1f5f9;
      }
      .ecp-google-preview-row {
        display: flex;
        gap: 6px;
        justify-content: center;
        margin-bottom: 6px;
      }
      .ecp-google-preview-row:last-child {
        margin-bottom: 0;
      }
      .ecp-google-preview-dot {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
      }

      /* Full Custom Button */
      .ecp-full-custom-btn {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        padding: 12px;
        background: #f8f9fa;
        border: 1.5px dashed #cbd5e1;
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.15s ease;
        margin-top: 12px;
        text-align: left;
      }
      .ecp-full-custom-btn:hover {
        background: #f1f5f9;
        border-color: #3b82f6;
      }
      .ecp-full-custom-icon {
        width: 32px;
        height: 32px;
        background: #e2e8f0;
        border-radius: 6px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 20px;
        font-weight: 300;
        color: #64748b;
        flex-shrink: 0;
      }
      .ecp-full-custom-text {
        flex: 1;
      }
      .ecp-full-custom-text strong {
        display: block;
        font-size: 13px;
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 2px;
      }
      .ecp-full-custom-text span {
        font-size: 11px;
        color: #64748b;
        line-height: 1.3;
      }

      /* Section Divider */
      .ecp-section-divider {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 12px;
      }
      .ecp-section-divider::before,
      .ecp-section-divider::after {
        content: '';
        flex: 1;
        height: 1px;
        background: #e2e8f0;
      }
      .ecp-section-divider span {
        font-size: 12px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Backgrounds Section */
      .ecp-section-backgrounds {
        border: none;
        padding: 0;
        background: transparent;
      }
      .ecp-section-backgrounds.disabled {
        pointer-events: none;
      }

      /* Subsection */
      .ecp-subsection {
        margin-bottom: 16px;
      }
      .ecp-subsection:last-child {
        margin-bottom: 0;
      }
      .ecp-subsection h5 {
        margin: 0 0 8px;
        font-size: 11px;
        font-weight: 600;
        color: #64748b;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      /* Color Grid */
      .ecp-color-grid {
        display: grid;
        grid-template-columns: repeat(6, 1fr);
        gap: 8px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 8px;
      }
      .ecp-color-swatch {
        aspect-ratio: 1;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        position: relative;
        transition: transform 0.1s ease, box-shadow 0.1s ease;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      }
      .ecp-color-swatch:hover {
        transform: scale(1.15);
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
        z-index: 1;
      }
      .ecp-color-check {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        font-size: 12px;
        color: white;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
        opacity: 0;
      }
      .ecp-color-swatch.selected .ecp-color-check {
        opacity: 1;
      }

      /* Templates Section */
      .ecp-templates-section {
        background: linear-gradient(135deg, #f3e8ff 0%, #faf5ff 100%);
        border: 1.5px solid #8b5cf6;
        border-radius: 10px;
        padding: 12px;
      }
      .ecp-subsection-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 10px;
      }
      .ecp-subsection-header h5 {
        display: flex;
        align-items: center;
        gap: 6px;
        color: #6d28d9;
        margin: 0;
      }
      .ecp-subsection-header svg {
        color: #8b5cf6;
      }
      .ecp-templates-grid {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }
      .ecp-template-chip {
        padding: 6px 12px;
        border-radius: 16px;
        border: none;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .ecp-template-chip:hover {
        transform: scale(1.05);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      }

      /* Confirm Modal */
      .ecp-confirm-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 100000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .ecp-confirm-modal.active {
        opacity: 1;
      }
      .ecp-confirm-backdrop {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
      }
      .ecp-confirm-dialog {
        position: relative;
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 360px;
        width: 90%;
        box-shadow: 0 12px 40px rgba(0, 0, 0, 0.2);
      }
      .ecp-confirm-dialog h4 {
        margin: 0 0 12px;
        font-size: 16px;
        font-weight: 600;
        color: #1e293b;
      }
      .ecp-confirm-dialog p {
        margin: 0 0 20px;
        font-size: 14px;
        color: #64748b;
        line-height: 1.5;
      }
      .ecp-confirm-buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .ecp-confirm-btn {
        padding: 10px 16px;
        border-radius: 6px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.15s ease;
        border: 1px solid #e2e8f0;
        background: white;
        color: #475569;
      }
      .ecp-confirm-btn:hover {
        background: #f1f5f9;
      }
      .ecp-confirm-btn.primary {
        background: #3b82f6;
        border-color: #3b82f6;
        color: white;
      }
      .ecp-confirm-btn.primary:hover {
        background: #2563eb;
      }
    `;

    document.head.appendChild(style);
  }
}

/**
 * Factory function
 */
export function createEventColorPanel(options) {
  return new EventColorPanel(options);
}

export default EventColorPanel;
