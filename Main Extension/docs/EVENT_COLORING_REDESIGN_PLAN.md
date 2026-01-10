# Event Coloring System Redesign Plan

**Version:** 1.0
**Date:** January 2026
**Status:** Ready for Implementation

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Solution Overview](#solution-overview)
4. [Architecture Changes](#architecture-changes)
5. [Implementation Phases](#implementation-phases)
6. [UI Specifications](#ui-specifications)
7. [Data Structures](#data-structures)
8. [File Changes](#file-changes)
9. [Testing Checklist](#testing-checklist)
10. [What Stays Unchanged](#what-stays-unchanged)

---

## Executive Summary

This document outlines a comprehensive redesign of the event coloring system to establish **clear ownership separation** between Google Calendar colors and ColorKit colors. The current system attempts to merge and overlay colors from both sources, causing race conditions, unpredictable behavior, and user confusion.

### Key Changes

- **Binary ownership model**: Each event is either Google-controlled OR ColorKit-controlled, never both
- **Mode toggle UI**: Clear visual indication of which system controls the event
- **Our own Google-equivalent colors**: 11 colors matching Google's palette but under ColorKit control
- **Stripe ownership**: ColorKit paints stripes itself using cached calendar colors
- **Confirmation modals**: Clear communication when switching between modes
- **Preserved features**: Merge logic, templates, recurring events, freemium gating all remain

---

## Problem Statement

### Current Architecture Issues

1. **Dual Ownership Conflict**: When a user picks a Google color, Google's logic fires AND our system tries to paint over it, creating a fragile layered approach.

2. **Merge Complexity**: The `mergeEventColors()` function with `useGoogleColors`, `overrideDefaults`, and property-by-property fallbacks creates numerous edge cases.

3. **Race Conditions**: Recent bug fixes (commit `84e1c26`) show this complexity causing real issues with color persistence.

4. **Google Dependency**: We're dependent on Google's internal DOM structure (`.jSrjCf` stripe element), which can change without notice.

5. **UX Confusion**: Users don't understand when they're using Google colors vs. ColorKit colors, or why certain features (text/border) sometimes work and sometimes don't.

### Evidence of Problems

- Race condition fixes in git history
- Complex flag system (`useGoogleColors`, `overrideDefaults`)
- Stripe preservation via CSS gradient hacks
- Interception of Google's color picker click events

---

## Solution Overview

### Core Principle

**If it's Google's color, Google owns it entirely. If it's ColorKit's color, ColorKit owns it entirely.**

### Ownership Model

| Mode | Who Controls | What Happens |
|------|--------------|--------------|
| **Google Mode** | Google Calendar | We don't touch the event. Google handles all coloring. |
| **ColorKit Mode** | ColorKit | We handle everything: background, text, border, AND stripe. |

### Key Features

1. **Mode Toggle**: Clear radio button selection between Google and ColorKit
2. **Visual States**: Greyed-out sections for inactive mode
3. **Default Colors**: Our own 11 colors matching Google's palette
4. **List Color**: Return to calendar's default color (ColorKit-controlled)
5. **Reset Options**: Three clear choices for removing ColorKit styling
6. **Confirmation Modals**: Explain what switching means, with "don't show again" option
7. **Stripe Control**: We paint stripes using `calendarDOMColors` cache (same as popup)

---

## Architecture Changes

### Before (Current)

```
User Action → Google fires color logic → We intercept → We overlay our colors
                     ↓                        ↓
              Google owns it            We try to own it
                     ↓                        ↓
                   CONFLICT - Race conditions, unpredictable state
```

### After (New)

```
User Action → Mode Check
                 ↓
         ┌──────┴──────┐
         ↓             ↓
    Google Mode    ColorKit Mode
         ↓             ↓
   We don't touch   We own everything
         ↓             ↓
   Google renders   We render (bg + text + border + stripe)
         ↓             ↓
              NO CONFLICT
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           STORAGE LAYER                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Chrome Sync Storage              │  Chrome Local Storage                │
│  ─────────────────────            │  ────────────────────                │
│  • settings.eventColoring         │  • cf.eventColors                    │
│    - categories                   │  • cf.calendarDOMColors (stripe)     │
│    - templates                    │                                      │
│    - calendarColors               │                                      │
│    - hideGoogleSwitchWarning      │                                      │
│    - hideColorKitSwitchWarning    │                                      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           MODE DETECTION                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Has entry in cf.eventColors?                                            │
│  ├── YES → ColorKit Mode (we own it)                                    │
│  └── NO  → Google Mode (we don't touch it)                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           RENDERING                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ColorKit Mode:                                                          │
│  • Paint background (from stored color)                                  │
│  • Paint stripe (from calendarDOMColors cache)                          │
│  • Paint text (stored or auto-contrast)                                  │
│  • Paint border (outline with offset)                                    │
│                                                                          │
│  Google Mode:                                                            │
│  • Skip element entirely                                                 │
│  • Let Google's native rendering handle it                              │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Storage Changes

**File:** `/lib/storage.js`

#### 1.1 Add `stripeColor` to Event Color Data

**Location:** Lines 759-772 in `saveEventColorsFullAdvanced()`

```javascript
const colorData = {
  background: colors.background || null,
  text: colors.text || null,
  border: colors.border || null,
  borderWidth: colors.borderWidth ?? 2,
  hex: colors.background || null,
  isRecurring: false,
  appliedAt: Date.now(),
  overrideDefaults: colors.overrideDefaults || false,
  stripeColor: colors.stripeColor || null,  // NEW
};
```

#### 1.2 Add Modal Preference Settings

**Location:** Default settings (~line 60-68)

```javascript
eventColoring: {
  // ... existing fields ...
  hideGoogleSwitchWarning: false,
  hideColorKitSwitchWarning: false,
}
```

#### 1.3 Add Getter/Setter Functions

```javascript
async function getHideGoogleSwitchWarning()
async function setHideGoogleSwitchWarning(value)
async function getHideColorKitSwitchWarning()
async function setHideColorKitSwitchWarning(value)
```

#### 1.4 Remove Deprecated Functions

**DELETE:**
- `markEventForGoogleColors()` (lines 600-618)
- `markRecurringEventForGoogleColors()` (lines 626-667)

#### 1.5 Update `normalizeEventColorData()`

**Location:** Lines 818-856

Add `stripeColor` to normalization with default `null`.

---

### Phase 2: Stripe Color Logic

**File:** `/features/event-coloring/index.js`

#### 2.1 Load `calendarDOMColors` Cache

**Location:** `init()` function (~line 946)

```javascript
// Load DOM colors cache (same source popup uses)
const domColorsData = await chrome.storage.local.get('cf.calendarDOMColors');
calendarDOMColors = domColorsData['cf.calendarDOMColors'] || {};
```

#### 2.2 Add Stripe Color Helper

```javascript
function getStripeColorForCalendar(calendarId) {
  // Priority order (same as popup at line 8725):
  // 1. DOM colors cache (actual displayed color)
  // 2. Google API colors
  // 3. Default blue
  return calendarDOMColors[calendarId]
    || calendarColors[calendarId]?.backgroundColor
    || '#039be5';
}
```

#### 2.3 Update `saveFullColors()` to Include Stripe

**Location:** Lines 2473-2507

```javascript
async function saveFullColors(eventId, colors) {
  const calendarId = getCalendarIdForEvent(eventId);
  const stripeColor = getStripeColorForCalendar(calendarId);

  const colorsWithStripe = {
    ...colors,
    stripeColor: stripeColor,
  };

  eventColors[eventId] = colorsWithStripe;
  await window.cc3Storage.saveEventColorsFullAdvanced(eventId, colorsWithStripe);
}
```

#### 2.4 Update `applyColorsToElement()` to Paint Stripe

**Location:** Lines 3484-3560

```javascript
function applyColorsToElement(element, colors) {
  const { background, text, border, borderWidth = 2, stripeColor } = colors;

  if (!background) return;

  // Paint stripe ourselves
  if (stripeColor) {
    const gradient = `linear-gradient(to right, ${stripeColor} 4px, ${background} 4px)`;
    element.style.setProperty('background', gradient, 'important');
  } else {
    element.style.setProperty('background-color', background, 'important');
  }

  // Text color
  const textColor = text || getTextColorForBackground(background);
  if (textColor) {
    element.style.setProperty('color', textColor, 'important');
  }

  // Border as outline
  if (border) {
    element.style.setProperty('outline', `${borderWidth}px solid ${border}`, 'important');
    element.style.setProperty('outline-offset', `-${borderWidth * 0.3}px`, 'important');
  }

  element.dataset.cfEventColored = 'true';
}
```

---

### Phase 3: Stop Intercepting Google

**File:** `/features/event-coloring/core/colorPickerInjector.js`

#### 3.1 Remove Google Button Click Listeners

**Location:** Lines 1757-1770 in `hideCheckmarkAndModifyBuiltInColors()`

**DELETE entire block:**
```javascript
googleButtons.forEach((button) => {
  if (!button.hasAttribute('data-cf-handler')) {
    button.setAttribute('data-cf-handler', 'true');
    button.addEventListener('click', async () => {
      // ... delete all of this
    });
  }
});
```

#### 3.2 Remove Google Checkmark Suppression

**Location:** Lines 1787-1793 in `updateCheckmarks()`

**DELETE** code that hides checkmarks from Google buttons.

#### 3.3 KEEP Google Labels Feature

**Location:** Lines 1838-1875 `modifyGoogleColorLabels()`

**NO CHANGE** - Keep as-is.

---

### Phase 4: Confirmation Modals

**NEW File:** `/features/event-coloring/components/SwitchConfirmationModal.js`

```javascript
class SwitchConfirmationModal {
  constructor(options) {
    this.type = options.type; // 'toGoogle' or 'toColorKit'
    this.eventId = options.eventId;
    this.onConfirm = options.onConfirm;
    this.onCancel = options.onCancel;
    this.isRecurring = options.isRecurring;
  }

  show() {
    const config = this.getConfig();
    this.createModalHTML(config.title, config.message);
    this.attachEventListeners();
    document.body.appendChild(this.container);
  }

  getConfig() {
    if (this.type === 'toGoogle') {
      return {
        title: 'Switch to Google Colors?',
        message: `This will remove all ColorKit styling (background, text, border) from this event. The event will use Google Calendar's default colors.\n\nYou can switch back to ColorKit colors anytime.`,
        confirmText: 'Switch to Google',
        confirmClass: 'cf-btn-warning',
      };
    } else {
      return {
        title: 'Switch to ColorKit Colors?',
        message: `This will take over color control from Google Calendar. ColorKit will manage this event's background, text, and border colors.\n\nThe event will keep its current appearance but be managed by ColorKit.`,
        confirmText: 'Switch to ColorKit',
        confirmClass: 'cf-btn-primary',
      };
    }
  }

  async handleConfirm(dontShowAgain) {
    if (dontShowAgain) {
      if (this.type === 'toGoogle') {
        await window.cc3Storage.setHideGoogleSwitchWarning(true);
      } else {
        await window.cc3Storage.setHideColorKitSwitchWarning(true);
      }
    }
    this.onConfirm();
    this.close();
  }
}
```

**Modal HTML Structure:**

```html
<div class="cf-switch-modal-backdrop">
  <div class="cf-switch-modal">
    <div class="cf-switch-modal-header">
      <h3>Switch to Google Colors?</h3>
    </div>
    <div class="cf-switch-modal-body">
      <p class="cf-switch-modal-message">...</p>
    </div>
    <div class="cf-switch-modal-checkbox">
      <label>
        <input type="checkbox" id="cf-dont-show-again">
        <span>Don't show this message again</span>
      </label>
    </div>
    <div class="cf-switch-modal-actions">
      <button class="cf-btn-secondary">Cancel</button>
      <button class="cf-btn-primary">Switch to ColorKit</button>
    </div>
  </div>
</div>
```

---

### Phase 5: Ensure Google Color Shows

**File:** `/features/event-coloring/index.js`

#### 5.1 Clear ColorKit Styling Function

```javascript
function clearColorKitStyling(eventId) {
  const elements = document.querySelectorAll(`[data-eventid="${eventId}"]`);

  elements.forEach(element => {
    element.style.removeProperty('background');
    element.style.removeProperty('background-color');
    element.style.removeProperty('color');
    element.style.removeProperty('outline');
    element.style.removeProperty('outline-offset');

    delete element.dataset.cfEventColored;
    delete element.dataset.cfOriginalColor;
  });
}
```

#### 5.2 Force Google Re-render

**File:** `/features/event-coloring/core/colorPickerInjector.js`

```javascript
forceGoogleColorRefresh(eventId) {
  clearColorKitStyling(eventId);

  // Toggle harmless attribute to trigger Google's observers
  const elements = document.querySelectorAll(`[data-eventid="${eventId}"]`);
  elements.forEach(element => {
    const current = element.getAttribute('data-cf-refresh');
    element.setAttribute('data-cf-refresh', current ? '' : '1');
    element.removeAttribute('data-cf-refresh');
  });

  this.closeMenus();
}
```

#### 5.3 Update `applyStoredColors()` to Skip Google-Owned Events

**Location:** Lines 3353-3394

```javascript
allEventElements.forEach((element) => {
  if (element.closest('[role="dialog"]')) return;
  if (isTaskElement(element)) return;

  const eventId = element.getAttribute('data-eventid');

  // Get ColorKit colors
  let colorKitColors = singleEventColors.get(eventId);
  if (!colorKitColors) {
    const parsed = EventIdUtils.fromEncoded(eventId);
    if (parsed?.type === 'calendar') {
      colorKitColors = recurringEventColors.get(parsed.decodedId);
    }
  }

  // NO ColorKit color = Google owns it, DON'T TOUCH
  if (!colorKitColors) {
    if (element.dataset.cfEventColored) {
      clearColorKitStyling(eventId);
    }
    return;
  }

  // Has ColorKit color = apply our colors
  applyColorsToElement(element, colorKitColors);
});
```

---

### Phase 6: UI Sections with Labels

**File:** `/features/event-coloring/core/colorPickerInjector.js`

#### 6.1 Google-Equivalent Colors Constant

```javascript
const COLORKIT_DEFAULT_COLORS = [
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
];
```

#### 6.2 Section Creator Helper

```javascript
createSectionWithLabel(label, description, content) {
  const section = document.createElement('div');
  section.className = 'cf-picker-section';

  const labelEl = document.createElement('div');
  labelEl.className = 'cf-picker-section-label';
  labelEl.textContent = label;

  const descEl = document.createElement('div');
  descEl.className = 'cf-picker-section-description';
  descEl.textContent = description;

  section.appendChild(labelEl);
  section.appendChild(descEl);
  section.appendChild(content);

  return section;
}
```

#### 6.3 List Color Section

```javascript
async createListColorSection(container, scenario, eventId) {
  const calendarId = getCalendarIdForEvent(eventId);
  const calendarName = getCalendarName(calendarId);
  const stripeColor = this.getStripeColorForCalendar(calendarId);

  const section = document.createElement('div');
  section.className = 'cf-list-color-section';

  section.innerHTML = `
    <div class="cf-section-title">LIST COLOR</div>
    <div class="cf-section-desc">Use this calendar's default color.</div>
    <div class="cf-list-color-button" role="button" tabindex="0">
      <div class="cf-list-color-preview">
        <div class="cf-list-color-stripe" style="background-color: ${stripeColor};"></div>
        <div class="cf-list-color-bg" style="background-color: ${stripeColor};"></div>
      </div>
      <span class="cf-list-color-name">${calendarName}</span>
      <span class="cf-list-color-arrow">›</span>
    </div>
  `;

  const button = section.querySelector('.cf-list-color-button');
  button.addEventListener('click', () => this.applyListColor(eventId, stripeColor));

  return section;
}
```

#### 6.4 Default Colors Subsection

```javascript
createDefaultColorsSubsection(container, scenario) {
  const subsection = document.createElement('div');
  subsection.className = 'cf-default-colors-subsection';

  subsection.innerHTML = `
    <div class="cf-subsection-title">Default Colors</div>
    <div class="cf-subsection-desc">Match Google's palette with ColorKit control.</div>
  `;

  const colorsContainer = document.createElement('div');
  colorsContainer.className = 'cf-default-colors-grid';

  COLORKIT_DEFAULT_COLORS.forEach(color => {
    const btn = this.createColorButton(color, container, scenario);
    btn.classList.add('cf-default-color-button');
    btn.setAttribute('title', color.name);
    colorsContainer.appendChild(btn);
  });

  subsection.appendChild(colorsContainer);
  return subsection;
}
```

#### 6.5 Custom Coloring Section with Description

```javascript
createCustomColorSection(container, scenario) {
  const section = document.createElement('div');
  section.className = 'cf-custom-color-section';

  const buttonRow = document.createElement('div');
  buttonRow.className = 'cf-custom-color-row';

  const button = this.createCustomColorButton(container, scenario);

  const label = document.createElement('div');
  label.className = 'cf-custom-color-label';
  label.innerHTML = `
    <span class="cf-custom-color-title">
      Custom Coloring
      <span class="cf-pro-badge-inline">Pro</span>
    </span>
    <span class="cf-custom-color-desc">Full picker with background, text & border options.</span>
  `;

  buttonRow.appendChild(button);
  buttonRow.appendChild(label);
  section.appendChild(buttonRow);

  return section;
}
```

---

### Phase 7: CSS Styling

**File:** `/features/event-coloring/core/colorPickerInjector.js`

**Location:** `injectModalCSS()` (lines 77-279)

See [UI Specifications](#ui-specifications) section for complete CSS.

---

### Phase 8: Simplify Merge Logic

**File:** `/features/event-coloring/index.js`

**Location:** Lines 3404-3442

```javascript
function mergeEventColors(manualColors, calendarDefaults) {
  if (!manualColors) return calendarDefaults;
  if (!calendarDefaults) return manualColors;

  if (manualColors.overrideDefaults) {
    return {
      background: manualColors.background || null,
      text: null,
      border: null,
      borderWidth: manualColors.borderWidth ?? 2,
      stripeColor: manualColors.stripeColor || calendarDefaults.background,
      isRecurring: manualColors.isRecurring || false,
    };
  }

  return {
    background: manualColors.background || calendarDefaults.background || null,
    text: manualColors.text || calendarDefaults.text || null,
    border: manualColors.border || calendarDefaults.border || null,
    borderWidth: manualColors.borderWidth ?? calendarDefaults.borderWidth ?? 2,
    stripeColor: manualColors.stripeColor || calendarDefaults.background || null,
    isRecurring: manualColors.isRecurring || false,
  };
}
```

---

### Phase 9: Update Injection Flow

**File:** `/features/event-coloring/core/colorPickerInjector.js`

**Location:** `injectColorCategories()` lines 568-641

```javascript
async injectColorCategories(categories) {
  const container = document.querySelector(
    COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.EDITOR
  ) || document.querySelector(
    COLOR_PICKER_SELECTORS.COLOR_PICKER_CONTROLLERS.LIST
  );

  if (!container) return;

  const scenario = ScenarioDetector.detectCurrentScenario();
  const eventId = ScenarioDetector.findEventIdByScenario(container, scenario);
  const currentMode = await this.detectCurrentMode(eventId);

  const wrapper = container.querySelector('div');
  if (!wrapper) return;

  // 1. Add mode toggle at top
  const modeToggle = this.createModeToggle(currentMode, eventId);
  wrapper.insertBefore(modeToggle, wrapper.firstChild);

  // 2. Add label above Google's colors
  const googleLabel = this.createGoogleColorsLabel();
  const googleColorGroup = wrapper.querySelector('.vbVGZb');
  if (googleColorGroup) {
    wrapper.insertBefore(googleLabel, googleColorGroup);
  }

  // 3. Add separator after Google's colors
  const separator = this.createSeparator();
  wrapper.appendChild(separator);

  // 4. Add List Color section
  const listColorSection = await this.createListColorSection(container, scenario, eventId);
  if (listColorSection) wrapper.appendChild(listColorSection);

  // 5. Add ColorKit section with Pro CTA
  const proCTA = await this.createProUpgradeCTA();
  const colorKitSection = this.createColorKitSection(categories, container, scenario, proCTA);
  wrapper.appendChild(colorKitSection);

  // 6. Add Reset section (only in ColorKit mode)
  const resetSection = await this.createResetSection(eventId, currentMode);
  if (resetSection) wrapper.appendChild(resetSection);

  // 7. Set scrolling
  wrapper.style.cssText = `
    max-height: ${scenario === Scenario.EVENTEDIT ? '600px' : '500px'};
    overflow-y: auto;
  `;

  // 8. Apply mode visual states
  this.updateSectionStates(currentMode);

  // 9. Update checkmarks
  const currentColor = await this.getCurrentEventColor(eventId);
  this.updateCheckmarks(currentColor?.background);

  // 10. Keep Google labels
  await this.modifyGoogleColorLabels();
}
```

---

### Phase 10: Checkmark Logic

**File:** `/features/event-coloring/core/colorPickerInjector.js`

**Location:** `updateCheckmarks()` lines 1783-1822

```javascript
updateCheckmarks(selectedColor, selectedType = null) {
  // Clear all OUR button checkmarks
  const ourButtons = document.querySelectorAll(
    '.cf-default-color-button, .cf-custom-color-button'
  );
  ourButtons.forEach(btn => this.toggleCheckmark(btn, false));

  // Clear list color selection
  const listColorBtn = document.querySelector('.cf-list-color-button');
  if (listColorBtn) listColorBtn.classList.remove('cf-selected');

  // Show selection
  if (selectedType === 'list' && listColorBtn) {
    listColorBtn.classList.add('cf-selected');
  } else if (selectedColor) {
    ourButtons.forEach(btn => {
      const btnColor = btn.getAttribute('data-color');
      if (btnColor?.toLowerCase() === selectedColor.toLowerCase()) {
        this.toggleCheckmark(btn, true);
      }
    });
  }

  // DO NOT touch Google's checkmarks
}
```

---

### Phase 11: Templates Section

**File:** `/features/event-coloring/index.js`

**Location:** `createTemplatesSection()` (~line 1228)

Add description and Pro badge:

```javascript
label.innerHTML = `
  <svg>...</svg>
  Templates
  <span class="cf-pro-badge-inline">Pro</span>
`;

const desc = document.createElement('div');
desc.className = 'cf-subsection-desc';
desc.textContent = 'Saved color presets with text & border.';
section.appendChild(desc);
```

---

### Phase 12: Preview Stripe Updates

**File:** `/features/event-coloring/core/colorPickerInjector.js`

#### 12.1 Update `openCustomColorModal()`

**Location:** Lines 389-398

```javascript
const calendarId = getCalendarIdForEvent(eventId);
const cachedStripeColor = this.calendarDOMColors[calendarId]
  || this.calendarColors[calendarId]?.backgroundColor
  || '#039be5';

const originalColors = {
  background: calendarDefaults?.background || currentEventBackground || cachedStripeColor,
  text: calendarDefaults?.text || currentTextColor || null,
  border: calendarDefaults?.border || null,
  stripeColor: cachedStripeColor,
};
```

#### 12.2 Update Existing Properties Dialog Preview

**Location:** Lines 1500-1546

Add stripe to preview items:

```javascript
function createPreviewItem(label, bg, textColor, borderColor, borderWidth, stripeColor) {
  // ... create chip with stripe element
  if (stripeColor) {
    const stripe = document.createElement('div');
    stripe.style.cssText = `width: 4px; background-color: ${stripeColor}; flex-shrink: 0;`;
    chip.appendChild(stripe);
  }
  // ...
}
```

---

### Phase 13: Mode Toggle System

**File:** `/features/event-coloring/core/colorPickerInjector.js`

#### 13.1 Mode Detection

```javascript
async detectCurrentMode(eventId) {
  const colorKitColor = await this.storageService.findEventColorFull(eventId);
  return (colorKitColor && !colorKitColor.useGoogleColors) ? 'colorkit' : 'google';
}
```

#### 13.2 Mode Toggle UI

```javascript
createModeToggle(currentMode, eventId) {
  const toggle = document.createElement('div');
  toggle.className = 'cf-mode-toggle';

  toggle.innerHTML = `
    <div class="cf-mode-header">
      <span class="cf-mode-title">COLOR MODE</span>
    </div>
    <div class="cf-mode-options">
      <label class="cf-mode-option ${currentMode === 'google' ? 'cf-mode-active' : ''}">
        <input type="radio" name="colorMode" value="google" ${currentMode === 'google' ? 'checked' : ''}>
        <span class="cf-mode-radio"></span>
        <div class="cf-mode-label">
          <span class="cf-mode-name">Google Calendar</span>
          <span class="cf-mode-desc">Syncs across devices</span>
        </div>
      </label>
      <label class="cf-mode-option ${currentMode === 'colorkit' ? 'cf-mode-active' : ''}">
        <input type="radio" name="colorMode" value="colorkit" ${currentMode === 'colorkit' ? 'checked' : ''}>
        <span class="cf-mode-radio"></span>
        <div class="cf-mode-label">
          <span class="cf-mode-name">ColorKit</span>
          <span class="cf-mode-desc">Text, border & stripe</span>
        </div>
      </label>
    </div>
  `;

  toggle.querySelectorAll('input[name="colorMode"]').forEach(radio => {
    radio.addEventListener('change', (e) => this.handleModeChange(e.target.value, eventId));
  });

  return toggle;
}
```

#### 13.3 Section State Management

```javascript
updateSectionStates(mode) {
  const googleSection = document.querySelector('.cf-google-colors-section');
  const colorKitSection = document.querySelector('.cf-colorkit-section');
  const listSection = document.querySelector('.cf-list-color-section');
  const resetSection = document.querySelector('.cf-reset-section');

  if (mode === 'google') {
    googleSection?.classList.remove('cf-section-disabled');
    colorKitSection?.classList.add('cf-section-disabled');
    listSection?.classList.add('cf-section-disabled');
    if (resetSection) resetSection.style.display = 'none';
  } else {
    googleSection?.classList.add('cf-section-disabled');
    colorKitSection?.classList.remove('cf-section-disabled');
    listSection?.classList.remove('cf-section-disabled');
    if (resetSection) resetSection.style.display = 'block';
  }
}
```

#### 13.4 Reset Section with Three Options

```javascript
async createResetSection(eventId, currentMode) {
  if (currentMode !== 'colorkit') return null;

  const calendarId = getCalendarIdForEvent(eventId);
  const hasListColor = !!(this.calendarDefaultColors[calendarId]?.background);

  const section = document.createElement('div');
  section.className = 'cf-reset-section';

  section.innerHTML = `
    <div class="cf-section-title">RESET COLORKIT STYLING</div>
    <div class="cf-section-desc">Remove your custom styling from this event.</div>

    <div class="cf-reset-options">
      <button class="cf-reset-option" data-action="default">
        <span class="cf-reset-icon">🎨</span>
        <div class="cf-reset-text">
          <span class="cf-reset-title">Use Default Color</span>
          <span class="cf-reset-desc">Remove styling, keep ColorKit control (uses Peacock)</span>
        </div>
      </button>

      <button class="cf-reset-option ${!hasListColor ? 'cf-reset-disabled' : ''}"
              data-action="list" ${!hasListColor ? 'disabled' : ''}>
        <span class="cf-reset-icon">📋</span>
        <div class="cf-reset-text">
          <span class="cf-reset-title">Return to List Color</span>
          <span class="cf-reset-desc">${hasListColor
            ? "Use calendar's default with ColorKit control"
            : 'No list color set for this calendar'}</span>
        </div>
      </button>

      <button class="cf-reset-option cf-reset-google" data-action="google">
        <span class="cf-reset-icon">↩</span>
        <div class="cf-reset-text">
          <span class="cf-reset-title">Switch to Google Colors</span>
          <span class="cf-reset-desc">Hand control back to Google Calendar</span>
        </div>
      </button>
    </div>
  `;

  section.querySelectorAll('.cf-reset-option:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => this.handleResetOption(btn.dataset.action, eventId));
  });

  return section;
}
```

---

### Phase 14: Freemium Integration

**File:** `/features/event-coloring/core/colorPickerInjector.js`

#### 14.1 Pro Badges on Sections

Add `<span class="cf-pro-badge-inline">Pro</span>` to:
- Custom Coloring button label
- Templates section label
- ColorKit section header (as "Pro features available")

#### 14.2 Pro Upgrade CTA (for free users)

```javascript
async createProUpgradeCTA() {
  const isPremium = await window.cc3FeatureAccess?.isPremium?.();
  if (isPremium) return null;

  const cta = document.createElement('div');
  cta.className = 'cf-pro-upgrade-cta';

  cta.innerHTML = `
    <div class="cf-pro-cta-content">
      <span class="cf-pro-cta-icon">✨</span>
      <div class="cf-pro-cta-text">
        <span class="cf-pro-cta-title">Unlock Pro Features</span>
        <span class="cf-pro-cta-desc">Text colors, borders, templates & more</span>
      </div>
    </div>
    <button class="cf-pro-cta-btn">Upgrade</button>
  `;

  cta.querySelector('.cf-pro-cta-btn').addEventListener('click', () => {
    window.cc3FeatureAccess?.openUpgradePage?.();
  });

  return cta;
}
```

#### 14.3 Template Click Gating

```javascript
async handleTemplateClick(template, eventId) {
  const colors = {
    background: template.background,
    text: template.text,
    border: template.border,
    borderWidth: template.borderWidth,
  };

  const usesPremium = window.cc3FeatureAccess?.usesPremiumEventColorFeatures?.(colors);

  if (usesPremium) {
    const isPremium = await window.cc3FeatureAccess?.isPremium?.();

    if (!isPremium) {
      await window.cc3FeatureAccess?.storePendingAction?.({
        type: 'eventColoring.template',
        data: { eventId, colors, templateName: template.name }
      });

      window.cc3PremiumComponents?.showUpgradeModal?.({
        feature: 'Color Templates',
        featureKey: 'eventColoring.templates',
        description: 'Save and apply color presets with text and border styling.',
      });
      return;
    }
  }

  await this.handleFullColorSelection(eventId, colors);
}
```

---

## UI Specifications

### Complete Picker Layout

```
┌─────────────────────────────────────────────────────────────┐
│  COLOR MODE                                                  │
│  ○ Google Calendar        ● ColorKit                        │
├─────────────────────────────────────────────────────────────┤
│  GOOGLE CALENDAR COLORS              [greyed when ColorKit] │
│  Use Google's built-in colors. Syncs across devices.        │
│  [🔴] [🟠] [🟡] [🟢] [🔵] [🟣] [⚫] [🟤] [🩷] [🩵] [🟢]    │
├─────────────────────────────────────────────────────────────┤
│  LIST COLOR                          [greyed when Google]   │
│  Use this calendar's default color.                         │
│  [█ Calendar Name ▸ Preview]                               │
├─────────────────────────────────────────────────────────────┤
│  COLORKIT COLORS           [Pro] features  [greyed when G]  │
│  Custom colors with text & border options.                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ✨ Unlock Pro Features              [Upgrade]       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Default Colors                                             │
│  Match Google's palette with ColorKit control.              │
│  [🔴] [🟠] [🟡] [🟢] [🔵] [🟣] [⚫] [🟤] [🩷] [🩵] [🟢]    │
│                                                             │
│  MY CATEGORY                                                │
│  [🔴] [🟣] [🔵]                                             │
│  [template1] [template2]                                    │
│                                                             │
│  🔲 TEMPLATES [Pro]                                        │
│  Saved color presets with text & border.                    │
│  [urgent] [important] [meeting]                             │
│                                                             │
│  [+] Custom Coloring [Pro]                                 │
│  Full picker with background, text & border options.        │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  RESET COLORKIT STYLING              [only in ColorKit mode]│
│                                                             │
│  [🎨 Use Default Color]                                    │
│  Remove styling, keep ColorKit control                      │
│                                                             │
│  [📋 Return to List Color]           [greyed if no list]   │
│  Use calendar's default with ColorKit control               │
│                                                             │
│  [↩ Switch to Google Colors]                               │
│  Hand control back to Google Calendar                       │
└─────────────────────────────────────────────────────────────┘
```

### CSS Specifications

```css
/* Mode Toggle */
.cf-mode-toggle {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #e0e0e0;
}

.cf-mode-options {
  display: flex;
  gap: 12px;
}

.cf-mode-option {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  cursor: pointer;
}

.cf-mode-option.cf-mode-active {
  border-color: #1a73e8;
  background: #e8f0fe;
}

/* Section Styling */
.cf-picker-section {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
}

.cf-section-title {
  font-size: 11px;
  font-weight: 600;
  color: #5f6368;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.cf-section-desc {
  font-size: 12px;
  color: #80868b;
  margin-bottom: 10px;
}

/* Disabled State */
.cf-section-disabled {
  position: relative;
  opacity: 0.5;
  pointer-events: none;
}

/* Pro Badges */
.cf-pro-badge-inline {
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 8px;
  font-weight: 600;
  text-transform: uppercase;
  margin-left: 4px;
}

/* Pro CTA */
.cf-pro-upgrade-cta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  margin: 8px 0;
  background: linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%);
  border: 1px solid #c4b5fd;
  border-radius: 8px;
}

.cf-pro-cta-btn {
  padding: 6px 14px;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

/* Reset Options */
.cf-reset-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.cf-reset-option {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
}

.cf-reset-option:hover:not(.cf-reset-disabled) {
  background: #f8f9fa;
}

.cf-reset-option.cf-reset-google:hover {
  background: #fce8e6;
  border-color: #f28b82;
}

/* Confirmation Modal */
.cf-switch-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cf-switch-modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 400px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.2);
}
```

---

## Data Structures

### Event Color Object (Updated)

```javascript
{
  // Color properties
  background: string | null,     // Hex color
  text: string | null,           // Hex color (Pro)
  border: string | null,         // Hex color (Pro)
  borderWidth: number,           // 1-6 pixels (Pro)
  stripeColor: string | null,    // NEW: Calendar stripe color

  // Legacy
  hex: string | null,            // Same as background

  // Metadata
  isRecurring: boolean,
  appliedAt: number,             // Timestamp

  // Control flags
  overrideDefaults: boolean,
}
```

### Settings (Updated)

```javascript
{
  eventColoring: {
    enabled: boolean,
    categories: object,
    templates: object,
    googleColorLabels: object,
    quickAccessColors: array,
    disableCustomColors: boolean,
    calendarColors: object,
    // NEW
    hideGoogleSwitchWarning: boolean,
    hideColorKitSwitchWarning: boolean,
  }
}
```

---

## File Changes

| File | Type | Changes |
|------|------|---------|
| `/lib/storage.js` | MODIFY | Add stripeColor, modal prefs, remove useGoogleColors functions |
| `/features/event-coloring/index.js` | MODIFY | Stripe logic, merge, apply, clear styling |
| `/features/event-coloring/core/colorPickerInjector.js` | MODIFY | Mode toggle, sections, reset options, Pro badges, previews |
| `/features/event-coloring/components/SwitchConfirmationModal.js` | NEW | Mode switch confirmation modal |

### Files NOT Changed

- `/shared/components/EventColorModal.js` - Already handles freemium
- `/shared/components/ColorSwatchModal.js` - No changes needed
- `/features/event-coloring/components/RecurringEventDialog.js` - No changes
- `/features/event-coloring/utils/eventIdUtils.js` - No changes
- `/shared/utils/colorUtils.js` - No changes
- `/lib/featureAccess.js` - Already has all needed functions
- `/shared/components/PremiumComponents.js` - Already has badge/modal factories

---

## Testing Checklist

### Mode Switching

| Test | Expected |
|------|----------|
| Open picker, no ColorKit color | Google mode active, ColorKit greyed |
| Open picker, has ColorKit color | ColorKit mode active, Google greyed |
| Click Google radio (from ColorKit) | Confirmation modal appears |
| Confirm switch to Google | ColorKit color deleted, Google color shows |
| Check "Don't show again" | Preference saved |
| Click ColorKit radio (from Google) | Confirmation modal appears |
| Confirm switch to ColorKit | Event gets default color, ColorKit active |

### Color Application

| Test | Expected |
|------|----------|
| Pick Default Color (Sage) | ColorKit takes over, bg + stripe painted |
| Pick category color | Same as Default Color |
| Pick template | Colors applied (Pro gating if needed) |
| Click "+" Custom | EventColorModal opens |
| Has text+border, pick new bg | Property merge modal appears |

### Reset Options

| Test | Expected |
|------|----------|
| Click "Use Default Color" | Peacock blue applied, stays in ColorKit |
| Click "Return to List Color" | Calendar color applied, stays in ColorKit |
| Click "Return to List" (no list set) | Button disabled |
| Click "Switch to Google" | Confirmation, then Google takes over |

### Visual Verification

| Test | Expected |
|------|----------|
| Google color after switch | Not blank, actual Google color |
| Stripe shows correctly | 4px left stripe in calendar color |
| Greyed sections | 50% opacity, not clickable |
| Pro badges visible | On Templates, Custom Coloring |

### Freemium

| Test | Expected |
|------|----------|
| Free user clicks template with text/border | Upgrade modal |
| Free user applies text in EventColorModal | Upgrade modal |
| Pro CTA visible for free users | Shows in ColorKit section |
| Pro user | No restrictions |

### Edge Cases

| Test | Expected |
|------|----------|
| Recurring event | Recurring dialog appears |
| Navigate calendar | Colors persist |
| Multiple tabs | Syncs via storage |
| Refresh page | Mode preserved |

---

## What Stays Unchanged

### Components
- `EventColorModal` - Full color picker (already handles freemium)
- `ColorSwatchModal` - Simple palette picker
- `RecurringEventDialog` - "Apply to all?" dialog

### Utilities
- `eventIdUtils.js` - Event ID parsing
- `colorUtils.js` - Color conversions
- `scenarioDetector.js` - Context detection

### Storage Functions
- `scanAndCacheCalendarDOMColors()` - Stripe color caching
- Category/template CRUD operations
- Calendar default color operations

### Features
- Property merge modal (keep text/border when changing bg)
- Google labels feature
- Recurring event handling
- Templates within categories
- All existing modal flows

---

## Summary

This redesign eliminates the fundamental conflict between Google and ColorKit color ownership by establishing clear boundaries:

1. **Google Mode**: We don't touch the event at all
2. **ColorKit Mode**: We own everything (bg, text, border, stripe)

The user always knows which system controls their event, can easily switch between modes with clear explanations, and all existing features (merge logic, templates, freemium) continue to work within the ColorKit ecosystem.
