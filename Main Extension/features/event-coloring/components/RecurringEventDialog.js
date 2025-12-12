// features/event-coloring/components/RecurringEventDialog.js
// Dialog for handling recurring event color changes

import { COLOR_PICKER_SELECTORS } from '../selectors.js';
import EventIdUtils from '../utils/eventIdUtils.js';

/**
 * RecurringEventDialog - Shows a dialog asking if color should apply to
 * just this instance or all recurring instances
 */
export class RecurringEventDialog {
  constructor(options) {
    this.eventId = options.eventId;
    this.color = options.color;
    this.onConfirm = options.onConfirm;
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
    const dialog = this.container.querySelector('.cf-recurring-dialog');
    if (dialog) {
      dialog.focus();
    }
  }

  /**
   * Create the dialog DOM structure
   */
  createDialog() {
    // Container
    this.container = document.createElement('div');
    this.container.className = COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.RECURRING_DIALOG;
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 10000;
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
    dialog.className = 'cf-recurring-dialog';
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'cf-dialog-title');
    dialog.setAttribute('tabindex', '-1');
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
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: ${this.color};
      margin: 0 auto 16px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    `;

    // Title
    const title = document.createElement('h2');
    title.id = 'cf-dialog-title';
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

    // Buttons container
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 12px;
    `;

    // "This event only" button
    const thisOnlyButton = this.createButton(
      'This event only',
      false,
      '#1a73e8',
      'white'
    );

    // "All events in series" button
    const allEventsButton = this.createButton(
      'All events in series',
      true,
      'white',
      '#1a73e8',
      true
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
      margin-top: 8px;
    `;
    cancelButton.addEventListener('click', () => this.close());
    cancelButton.addEventListener('mouseenter', () => {
      cancelButton.style.color = '#202124';
    });
    cancelButton.addEventListener('mouseleave', () => {
      cancelButton.style.color = '#5f6368';
    });

    // Assemble dialog
    buttonsContainer.appendChild(allEventsButton);
    buttonsContainer.appendChild(thisOnlyButton);
    buttonsContainer.appendChild(cancelButton);

    dialog.appendChild(colorPreview);
    dialog.appendChild(title);
    dialog.appendChild(description);
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
   * Create a styled button
   */
  createButton(text, applyToAll, bgColor, textColor, hasBorder = false) {
    const button = document.createElement('button');
    button.textContent = text;
    button.style.cssText = `
      background: ${bgColor};
      color: ${textColor};
      border: ${hasBorder ? '1px solid #1a73e8' : 'none'};
      border-radius: 4px;
      padding: 12px 24px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s, box-shadow 0.2s;
    `;

    button.addEventListener('mouseenter', () => {
      if (bgColor === 'white') {
        button.style.backgroundColor = '#f1f3f4';
      } else {
        button.style.backgroundColor = '#1557b0';
      }
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = bgColor;
    });

    button.addEventListener('click', () => {
      if (this.onConfirm) {
        this.onConfirm(applyToAll);
      }
      this.close();
    });

    return button;
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

    // Close any remaining color picker menus
    document.querySelectorAll('[role="menu"], [role="dialog"]').forEach(el => {
      if (!el.closest('.cf-recurring-dialog-container')) {
        el.remove();
      }
    });

    if (this.onClose) {
      this.onClose();
    }
  }
}

/**
 * Show the recurring event dialog
 * @param {object} options - Dialog options
 * @returns {RecurringEventDialog} The dialog instance
 */
export function showRecurringEventDialog(options) {
  // Remove any existing dialogs
  document.querySelectorAll('.' + COLOR_PICKER_SELECTORS.CUSTOM_CLASSES.RECURRING_DIALOG).forEach(el => {
    el.remove();
  });

  const dialog = new RecurringEventDialog(options);
  dialog.show();
  return dialog;
}

// Make available globally
if (typeof window !== 'undefined') {
  window.cfRecurringEventDialog = {
    RecurringEventDialog,
    showRecurringEventDialog,
  };
}

export default RecurringEventDialog;
