# Implementation Plan: Reset Color Buttons for Event Coloring

## Overview

Add two new options to the injected color picker UI:
1. **"Remove all coloring"** - Returns event to Google's native colors by removing ALL custom styling
2. **"Reset to list defaults"** - Returns event to calendar list default colors (from `settings.eventColoring.calendarColors`)

## Current Architecture Summary

### Key Storage Locations
- **`cf.eventColors`** (LOCAL storage): Per-event manual colors `{ background, text, border, borderWidth, overrideDefaults }`
- **`settings.eventColoring.calendarColors`** (SYNC storage): Per-calendar default colors `{ background, text, border, borderWidth }`

### Critical Existing Functions
- `removeEventColor(eventId)` - Deletes from `cf.eventColors`
- `mergeEventColors(manual, calendar)` - Merges with respect to `overrideDefaults` flag
- `findEventColorFull(eventId)` - Finds event color considering recurring
- `getCalendarDefaultColorsForEvent(eventId)` - Gets calendar defaults for event

### Current Behavior When Removing Colors
- `removeEventColor()` only removes from `cf.eventColors` (single entry)
- For recurring events with `applyToAll`, only the base event ID entry is stored
- When no entry exists in `cf.eventColors`, event uses either:
  - Calendar defaults (if set)
  - Google's native colors (if no calendar defaults)

---

## Implementation Plan

### Phase 1: Storage Layer (`lib/storage.js`)

#### 1.1 Add `removeRecurringEventColors(eventId)` function
Removes ALL color entries for a recurring event (base + all instances).

```javascript
/**
 * Remove all color entries for a recurring event (base ID and all instances)
 * @param {string} eventId - Any event ID from the recurring series
 * @returns {Promise<number>} - Number of entries removed
 */
async function removeRecurringEventColors(eventId) {
  if (!eventId) return 0;

  return new Promise((resolve) => {
    chrome.storage.local.get('cf.eventColors', (result) => {
      const eventColors = result['cf.eventColors'] || {};
      const parsed = parseEventId(eventId);

      if (parsed.type !== 'calendar') {
        resolve(0);
        return;
      }

      let removedCount = 0;
      const baseId = parsed.decodedId;

      // Find and remove all entries with matching base ID
      Object.keys(eventColors).forEach((storedId) => {
        try {
          const storedParsed = parseEventId(storedId);
          if (storedParsed.decodedId === baseId) {
            delete eventColors[storedId];
            removedCount++;
          }
        } catch (e) {
          // Skip invalid IDs
        }
      });

      chrome.storage.local.set({ 'cf.eventColors': eventColors }, () => {
        resolve(removedCount);
      });
    });
  });
}
```

**Location**: After `removeEventColor()` around line 548
**Export**: Add to `window.cc3Storage`

---

### Phase 2: ColorPickerInjector UI (`colorPickerInjector.js`)

#### 2.1 Modify `createCustomColorSection()` to add new buttons

Replace the current section that only has the "+" button:

```javascript
createCustomColorSection(container, scenario) {
  const section = document.createElement('div');
  section.className = 'cf-custom-color-section';
  section.style.marginTop = '16px';

  // Label
  const label = document.createElement('div');
  label.className = 'color-category-label';
  label.textContent = 'Custom';
  label.style.cssText = `
    font-size: 12px;
    font-weight: 500;
    color: #202124;
    margin: 0 12px 12px 0;
    letter-spacing: 0.5px;
    text-transform: uppercase;
  `;

  // Container for buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 4px;
    padding: 0 12px 0 0;
  `;

  // Add the "+" button
  const customButton = this.createCustomColorButton(container, scenario);
  buttonContainer.appendChild(customButton);

  section.appendChild(label);
  section.appendChild(buttonContainer);

  // Add Reset Actions section
  const resetSection = this.createResetActionsSection(container, scenario);
  section.appendChild(resetSection);

  return section;
}
```

#### 2.2 Add `createResetActionsSection()` method

```javascript
/**
 * Create the Reset Actions section with "Remove all coloring" and "Reset to list defaults" buttons
 */
createResetActionsSection(container, scenario) {
  const section = document.createElement('div');
  section.className = 'cf-reset-actions-section';
  section.style.cssText = `
    margin-top: 16px;
    border-top: 1px solid #e8eaed;
    padding-top: 12px;
  `;

  // Label
  const label = document.createElement('div');
  label.textContent = 'Reset Options';
  label.style.cssText = `
    font-size: 11px;
    font-weight: 500;
    color: #5f6368;
    margin: 0 0 10px 0;
    letter-spacing: 0.3px;
    text-transform: uppercase;
  `;

  // Buttons container
  const buttonsContainer = document.createElement('div');
  buttonsContainer.style.cssText = `
    display: flex;
    flex-direction: column;
    gap: 6px;
  `;

  // "Remove all coloring" button
  const removeAllBtn = this.createResetButton(
    'Remove all coloring',
    'Return to Google Calendar colors',
    container,
    scenario,
    'removeAll'
  );

  // "Reset to list defaults" button
  const resetToListBtn = this.createResetButton(
    'Reset to list defaults',
    'Apply calendar list colors',
    container,
    scenario,
    'resetToList'
  );

  buttonsContainer.appendChild(removeAllBtn);
  buttonsContainer.appendChild(resetToListBtn);

  section.appendChild(label);
  section.appendChild(buttonsContainer);

  return section;
}
```

#### 2.3 Add `createResetButton()` method

```javascript
/**
 * Create a reset action button
 * @param {string} title - Button title
 * @param {string} subtitle - Helper text
 * @param {HTMLElement} container - Color picker container
 * @param {string} scenario - Current scenario
 * @param {string} action - 'removeAll' or 'resetToList'
 */
createResetButton(title, subtitle, container, scenario, action) {
  const button = document.createElement('button');
  button.className = `cf-reset-btn cf-reset-${action}`;
  button.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
    padding: 8px 12px;
    background: #f8f9fa;
    border: 1px solid #dadce0;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    text-align: left;
  `;

  const titleEl = document.createElement('span');
  titleEl.textContent = title;
  titleEl.style.cssText = `
    font-size: 13px;
    font-weight: 500;
    color: #202124;
    line-height: 1.3;
  `;

  const subtitleEl = document.createElement('span');
  subtitleEl.textContent = subtitle;
  subtitleEl.style.cssText = `
    font-size: 11px;
    color: #5f6368;
    margin-top: 2px;
  `;

  button.appendChild(titleEl);
  button.appendChild(subtitleEl);

  // Hover effects
  button.addEventListener('mouseenter', () => {
    button.style.background = '#e8eaed';
    button.style.borderColor = '#c6c6c6';
  });

  button.addEventListener('mouseleave', () => {
    button.style.background = '#f8f9fa';
    button.style.borderColor = '#dadce0';
  });

  // Click handler
  button.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const eventId = ScenarioDetector.findEventIdByScenario(container, scenario);
    if (!eventId) {
      console.error('[CF] Could not find event ID for reset action');
      return;
    }

    if (action === 'removeAll') {
      await this.handleRemoveAllColoring(eventId);
    } else if (action === 'resetToList') {
      await this.handleResetToListDefaults(eventId);
    }
  });

  return button;
}
```

#### 2.4 Add `handleRemoveAllColoring()` method

```javascript
/**
 * Remove all custom coloring from an event, returning it to Google's native colors
 * For recurring events, removes ALL instance colors
 * @param {string} eventId - Event ID
 */
async handleRemoveAllColoring(eventId) {
  const parsed = EventIdUtils.fromEncoded(eventId);

  if (parsed.isRecurring) {
    // Show recurring event dialog with custom options for removal
    showRecurringEventDialog({
      eventId,
      color: null,
      dialogTitle: 'Remove Coloring',
      dialogMessage: 'This is a recurring event. Remove coloring from:',
      allEventsLabel: 'All events in series',
      thisOnlyLabel: 'This event only',
      onConfirm: async (applyToAll) => {
        console.log('[CF] Remove coloring confirmed, applyToAll:', applyToAll);

        if (applyToAll) {
          // Remove ALL colors for this recurring series (base + instances)
          await this.storageService.removeRecurringEventColors(eventId);
        } else {
          // Remove only this instance
          await this.storageService.removeEventColor(eventId);
        }

        this.closeMenus();
        // Force reload to ensure Google's colors are re-applied
        window.location.reload();
      },
      onClose: () => {
        console.log('[CF] Remove coloring dialog closed');
      },
    });
  } else {
    // Single event - remove directly
    await this.storageService.removeEventColor(eventId);
    this.closeMenus();
    window.location.reload();
  }
}
```

#### 2.5 Add `handleResetToListDefaults()` method

```javascript
/**
 * Reset event to calendar list default colors
 * This applies the calendar's default colors (from settings.eventColoring.calendarColors)
 * @param {string} eventId - Event ID
 */
async handleResetToListDefaults(eventId) {
  const parsed = EventIdUtils.fromEncoded(eventId);

  // Get calendar defaults for this event
  const calendarId = this.getCalendarIdForEvent(eventId);
  const calendarDefaults = await this.storageService.getEventCalendarColor?.(calendarId);

  // If no calendar defaults exist, inform user and optionally remove custom colors
  if (!calendarDefaults || (!calendarDefaults.background && !calendarDefaults.text && !calendarDefaults.border)) {
    // Show a dialog informing user there are no list defaults
    this.showNoListDefaultsDialog(eventId, parsed.isRecurring);
    return;
  }

  if (parsed.isRecurring) {
    showRecurringEventDialog({
      eventId,
      color: calendarDefaults.background,
      dialogTitle: 'Reset to List Defaults',
      dialogMessage: 'This is a recurring event. Apply list defaults to:',
      allEventsLabel: 'All events in series',
      thisOnlyLabel: 'This event only',
      onConfirm: async (applyToAll) => {
        console.log('[CF] Reset to list defaults confirmed, applyToAll:', applyToAll);

        // Remove existing custom colors first
        if (applyToAll) {
          await this.storageService.removeRecurringEventColors(eventId);
        } else {
          await this.storageService.removeEventColor(eventId);
        }

        this.closeMenus();
        this.triggerColorUpdate();
      },
      onClose: () => {},
    });
  } else {
    // Single event - just remove custom color to let list defaults apply
    await this.storageService.removeEventColor(eventId);
    this.closeMenus();
    this.triggerColorUpdate();
  }
}
```

#### 2.6 Add `showNoListDefaultsDialog()` helper

```javascript
/**
 * Show dialog when no list defaults exist for calendar
 */
showNoListDefaultsDialog(eventId, isRecurring) {
  // Remove existing dialogs
  document.querySelectorAll('.cf-no-defaults-dialog').forEach(el => el.remove());

  const container = document.createElement('div');
  container.className = 'cf-no-defaults-dialog';
  container.style.cssText = `
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
  `;

  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5);
  `;

  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: relative;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    padding: 24px;
    max-width: 380px;
    z-index: 1;
    text-align: center;
  `;

  const title = document.createElement('h3');
  title.textContent = 'No List Defaults Set';
  title.style.cssText = 'margin: 0 0 12px; font-size: 16px; color: #202124;';

  const message = document.createElement('p');
  message.textContent = 'This calendar has no default colors configured. You can set list defaults in the extension popup under "Calendar List Colors".';
  message.style.cssText = 'margin: 0 0 20px; font-size: 14px; color: #5f6368; line-height: 1.5;';

  const removeInsteadBtn = document.createElement('button');
  removeInsteadBtn.textContent = 'Remove custom coloring instead';
  removeInsteadBtn.style.cssText = `
    background: #1a73e8;
    color: white;
    border: none;
    border-radius: 6px;
    padding: 10px 16px;
    font-size: 14px;
    cursor: pointer;
    width: 100%;
    margin-bottom: 8px;
  `;
  removeInsteadBtn.addEventListener('click', async () => {
    container.remove();
    await this.handleRemoveAllColoring(eventId);
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = `
    background: transparent;
    border: none;
    color: #5f6368;
    padding: 8px 16px;
    font-size: 14px;
    cursor: pointer;
  `;
  cancelBtn.addEventListener('click', () => container.remove());

  overlay.addEventListener('click', () => container.remove());

  dialog.appendChild(title);
  dialog.appendChild(message);
  dialog.appendChild(removeInsteadBtn);
  dialog.appendChild(cancelBtn);
  container.appendChild(overlay);
  container.appendChild(dialog);
  document.body.appendChild(container);
}
```

---

### Phase 3: RecurringEventDialog Enhancement

#### 3.1 Modify `showRecurringEventDialog()` to support custom text

Update the function signature and implementation to accept:
- `dialogTitle` - Custom title (default: "Recurring Event")
- `dialogMessage` - Custom message
- `allEventsLabel` - Label for "all events" button
- `thisOnlyLabel` - Label for "this only" button

**Location**: `colorPickerInjector.js` lines 301-350

```javascript
function showRecurringEventDialog(options) {
  const {
    eventId,
    color,
    dialogTitle = 'Recurring Event',
    dialogMessage = 'This is a recurring event. Would you like to apply this color to:',
    allEventsLabel = 'All events in series',
    thisOnlyLabel = 'This event only',
    onConfirm,
    onClose
  } = options;

  // ... rest of implementation with parameterized strings
}
```

---

### Phase 4: Index.js Integration

#### 4.1 Add `removeRecurringEventColors` to storage service reference

In the storage service initialization around line 2890:

```javascript
const storageService = {
  // ... existing methods ...
  removeRecurringEventColors: window.cc3Storage.removeRecurringEventColors,
};
```

---

### Phase 5: Testing Checklist

#### Unit Tests
- [ ] `removeRecurringEventColors` removes base event color
- [ ] `removeRecurringEventColors` removes all instance colors
- [ ] `removeRecurringEventColors` returns correct count

#### Integration Tests

##### "Remove all coloring" button:
- [ ] Single event: Removes color, event shows Google native colors
- [ ] Recurring "All events": All instances revert to Google colors
- [ ] Recurring "This only": Only clicked instance reverts
- [ ] Event with only background: Properly removed
- [ ] Event with bg + text + border: All properties cleared

##### "Reset to list defaults" button:
- [ ] Calendar WITH defaults: Event uses calendar defaults
- [ ] Calendar WITHOUT defaults: Shows "no defaults" dialog
- [ ] Recurring with defaults: Applies to all/single works
- [ ] Events with overrideDefaults flag: Properly reset

##### Edge Cases:
- [ ] Event already at Google default: Both buttons work gracefully
- [ ] Event already at list default: No-op or refresh
- [ ] Task elements (not events): Buttons don't appear / don't affect

---

## File Changes Summary

| File | Changes |
|------|---------|
| `lib/storage.js` | Add `removeRecurringEventColors()` function |
| `colorPickerInjector.js` | Add reset section UI + handlers |
| `index.js` | Wire storage service with new function |

---

## Risk Mitigation

### Backward Compatibility
- No changes to existing storage format
- Existing `removeEventColor()` unchanged
- New functions are additive only

### User Data Safety
- "Remove all coloring" = storage deletion (reversible by re-applying)
- "Reset to list defaults" = storage deletion (list defaults preserved in sync storage)
- No destructive changes to sync storage data

### Performance
- `removeRecurringEventColors` loops through all event colors once (O(n))
- Page reload ensures clean state after removal
- No additional network requests

---

## Estimated Implementation Time

- Phase 1 (Storage): ~15 minutes
- Phase 2 (UI): ~45 minutes
- Phase 3 (Dialog enhancement): ~15 minutes
- Phase 4 (Integration): ~10 minutes
- Phase 5 (Testing): ~30 minutes

**Total: ~2 hours**
