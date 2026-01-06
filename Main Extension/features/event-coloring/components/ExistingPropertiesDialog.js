// features/event-coloring/components/ExistingPropertiesDialog.js
// Dialog for handling background-only color selection when event has other properties set

import { COLOR_PICKER_SELECTORS } from '../selectors.js';

/**
 * ExistingPropertiesDialog - Shows when user selects a background-only color
 * but the event already has other properties (text, border, borderWidth) set.
 *
 * Options:
 * 1. Keep existing properties - merge the new background with existing text/border/borderWidth
 * 2. Replace everything - clear all properties and use only the new background
 * 3. Open full modal - open the custom color modal prefilled with new background + existing properties
 */
export class ExistingPropertiesDialog {
  constructor(options) {
    this.eventId = options.eventId;
    this.newBackground = options.newBackground;
    this.existingColors = options.existingColors; // { text, border, borderWidth }
    this.calendarDefaults = options.calendarDefaults || {}; // For preview fallbacks
    this.eventTitle = options.eventTitle || 'Event';
    this.onKeepExisting = options.onKeepExisting; // Called when user chooses to merge
    this.onReplaceAll = options.onReplaceAll; // Called when user chooses to replace
    this.onOpenFullModal = options.onOpenFullModal; // Called when user wants full modal
    this.onClose = options.onClose;
    this.container = null;
    this.overlay = null;
  }

  /**
   * Create and show the dialog
   */
  show() {
    this.createDialog();
    document.body.appendChild(this.container);

    // Focus the dialog for accessibility
    const dialog = this.container.querySelector('.cf-existing-props-dialog');
    if (dialog) {
      dialog.focus();
    }
  }

  /**
   * Calculate contrasting text color for a background
   */
  getContrastingTextColor(bgColor) {
    if (!bgColor) return '#ffffff';

    // Remove # if present
    const hex = bgColor.replace('#', '');

    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Calculate relative luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  /**
   * Create the dialog DOM structure
   */
  createDialog() {
    // Container
    this.container = document.createElement('div');
    this.container.className = 'cf-existing-props-dialog-container';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Overlay
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
    `;
    this.overlay.addEventListener('click', () => this.close());

    // Dialog box
    const dialog = document.createElement('div');
    dialog.className = 'cf-existing-props-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'cf-props-dialog-title');
    dialog.setAttribute('tabindex', '-1');
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
    title.id = 'cf-props-dialog-title';
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
    const previewSection = this.createPreviewSection();

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 20px;
    `;

    // "Keep existing styling" button (merge)
    const keepButton = this.createButton(
      'Keep existing styling',
      'Apply new background, keep text/border settings',
      () => {
        if (this.onKeepExisting) {
          this.onKeepExisting();
        }
        this.close();
      },
      '#1a73e8',
      'white'
    );

    // "Replace all" button
    const replaceButton = this.createButton(
      'Replace all styling',
      'Use only the new background color',
      () => {
        if (this.onReplaceAll) {
          this.onReplaceAll();
        }
        this.close();
      },
      'white',
      '#1a73e8',
      true
    );

    // "Open full modal" button
    const fullModalButton = this.createButton(
      'Customize in full editor',
      'Fine-tune all color properties',
      () => {
        this.close();
        if (this.onOpenFullModal) {
          this.onOpenFullModal();
        }
      },
      '#f1f3f4',
      '#202124'
    );

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
      background: transparent;
      border: none;
      color: #5f6368;
      padding: 8px 16px;
      font-size: 14px;
      cursor: pointer;
      margin-top: 4px;
    `;
    cancelButton.addEventListener('click', () => this.close());
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.color = '#202124';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.color = '#5f6368';
    });

    // Assemble dialog
    buttonsContainer.appendChild(keepButton);
    buttonsContainer.appendChild(replaceButton);
    buttonsContainer.appendChild(fullModalButton);
    buttonsContainer.appendChild(cancelButton);

    dialog.appendChild(title);
    dialog.appendChild(description);
    dialog.appendChild(previewSection);
    dialog.appendChild(buttonsContainer);

    this.container.appendChild(this.overlay);
    this.container.appendChild(dialog);

    // Handle escape key
    this.handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.handleKeyDown);
  }

  /**
   * Create the preview section showing current vs new styling
   */
  createPreviewSection() {
    const section = document.createElement('div');
    section.style.cssText = `
      display: flex;
      gap: 16px;
      justify-content: center;
      margin: 16px 0;
    `;

    // Current styling preview
    const currentPreview = this.createPreviewItem(
      'Current',
      this.existingColors.background || this.calendarDefaults.background || '#039be5',
      this.existingColors.text || this.calendarDefaults.text,
      this.existingColors.border || this.calendarDefaults.border,
      this.existingColors.borderWidth ?? this.calendarDefaults.borderWidth ?? 2
    );

    // Arrow
    const arrow = document.createElement('div');
    arrow.textContent = '→';
    arrow.style.cssText = `
      display: flex;
      align-items: center;
      font-size: 20px;
      color: #5f6368;
    `;

    // New background preview (with merged styling - what "Keep existing" would produce)
    const mergedPreview = this.createPreviewItem(
      'Keep Existing',
      this.newBackground,
      this.existingColors.text || this.calendarDefaults.text,
      this.existingColors.border || this.calendarDefaults.border,
      this.existingColors.borderWidth ?? this.calendarDefaults.borderWidth ?? 2
    );

    // Replace all preview (background only)
    const replacePreview = this.createPreviewItem(
      'Replace All',
      this.newBackground,
      null, // No text override
      null, // No border
      2 // Default border width (not visible without border)
    );

    section.appendChild(currentPreview);
    section.appendChild(arrow);
    section.appendChild(mergedPreview);
    section.appendChild(replacePreview);

    return section;
  }

  /**
   * Create a single preview item
   */
  createPreviewItem(label, background, textColor, borderColor, borderWidth) {
    const container = document.createElement('div');
    container.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
    `;

    // Label
    const labelEl = document.createElement('div');
    labelEl.textContent = label;
    labelEl.style.cssText = `
      font-size: 11px;
      font-weight: 500;
      color: #5f6368;
      text-transform: uppercase;
    `;

    // Preview chip (mimics event appearance)
    const chip = document.createElement('div');
    const effectiveTextColor = textColor || this.getContrastingTextColor(background);

    chip.style.cssText = `
      width: 70px;
      height: 28px;
      border-radius: 4px;
      background-color: ${background || '#039be5'};
      color: ${effectiveTextColor};
      font-size: 11px;
      font-weight: 500;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 6px;
      box-sizing: border-box;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      ${borderColor ? `outline: ${borderWidth || 2}px solid ${borderColor}; outline-offset: -${Math.round((borderWidth || 2) * 0.3)}px;` : ''}
    `;
    chip.textContent = this.eventTitle.substring(0, 8) || 'Event';

    container.appendChild(labelEl);
    container.appendChild(chip);

    return container;
  }

  /**
   * Create a styled button with subtitle
   */
  createButton(text, subtitle, onClick, bgColor, textColor, hasBorder = false) {
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      flex-direction: column;
    `;

    const button = document.createElement('button');
    button.style.cssText = `
      background: ${bgColor};
      color: ${textColor};
      border: ${hasBorder ? '1px solid #1a73e8' : 'none'};
      border-radius: 6px;
      padding: 12px 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s, box-shadow 0.2s;
      text-align: left;
    `;

    const mainText = document.createElement('div');
    mainText.textContent = text;
    mainText.style.cssText = `font-weight: 500;`;

    const subText = document.createElement('div');
    subText.textContent = subtitle;
    subText.style.cssText = `
      font-size: 12px;
      opacity: 0.8;
      margin-top: 2px;
      font-weight: 400;
    `;

    button.appendChild(mainText);
    button.appendChild(subText);

    button.addEventListener('mouseenter', () => {
      if (bgColor === 'white') {
        button.style.backgroundColor = '#f1f3f4';
      } else if (bgColor === '#f1f3f4') {
        button.style.backgroundColor = '#e8eaed';
      } else {
        button.style.backgroundColor = '#1557b0';
      }
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = bgColor;
    });

    button.addEventListener('click', onClick);

    buttonContainer.appendChild(button);
    return buttonContainer;
  }

  /**
   * Close and remove the dialog
   */
  close() {
    if (this.handleKeyDown) {
      document.removeEventListener('keydown', this.handleKeyDown);
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    if (this.onClose) {
      this.onClose();
    }
  }
}

/**
 * Show the existing properties dialog
 * @param {object} options - Dialog options
 * @returns {ExistingPropertiesDialog} The dialog instance
 */
export function showExistingPropertiesDialog(options) {
  // Remove any existing dialogs
  document.querySelectorAll('.cf-existing-props-dialog-container').forEach(el => {
    el.remove();
  });

  const dialog = new ExistingPropertiesDialog(options);
  dialog.show();
  return dialog;
}

/**
 * Check if an event has non-background properties that would be lost
 * @param {Object} existingColors - The existing color data for the event
 * @param {Object} calendarDefaults - The calendar default colors
 * @returns {boolean} - True if there are non-background properties
 */
export function hasNonBackgroundProperties(existingColors, calendarDefaults) {
  if (!existingColors && !calendarDefaults) return false;

  // Check event-level properties first
  const hasEventText = !!existingColors?.text;
  const hasEventBorder = !!existingColors?.border;
  const hasEventBorderWidth = existingColors?.borderWidth != null && existingColors?.borderWidth !== 2;

  // Check calendar-level properties
  const hasCalendarText = !!calendarDefaults?.text;
  const hasCalendarBorder = !!calendarDefaults?.border;
  const hasCalendarBorderWidth = calendarDefaults?.borderWidth != null && calendarDefaults?.borderWidth !== 2;

  return hasEventText || hasEventBorder || hasEventBorderWidth ||
         hasCalendarText || hasCalendarBorder || hasCalendarBorderWidth;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.cfExistingPropertiesDialog = {
    ExistingPropertiesDialog,
    showExistingPropertiesDialog,
    hasNonBackgroundProperties,
  };
}

export default ExistingPropertiesDialog;
