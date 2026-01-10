# Event Coloring Redesign - Action Plan

**Branch:** `claude/redesign-event-coloring-EPsPl`
**Date:** January 2026
**Status:** Ready for Implementation

---

## Overview

This action plan implements the binary ownership model for event coloring: each event is either **Google-controlled** OR **ColorKit-controlled**, never both. The UI will be redesigned in `colorPickerInjector.js` with clear mode toggles, section states, and confirmation modals.

---

## Phase 1: Storage Layer Updates

**File:** `/lib/storage.js`
**Estimated Complexity:** Low

### Tasks

- [ ] **1.1** Add `stripeColor` field to event color data structure
  - Location: `saveEventColorsFullAdvanced()` function
  - Add `stripeColor: colors.stripeColor || null` to colorData object

- [ ] **1.2** Add modal preference settings to default settings
  ```javascript
  eventColoring: {
    // ... existing fields ...
    hideGoogleSwitchWarning: false,
    hideColorKitSwitchWarning: false,
  }
  ```

- [ ] **1.3** Add getter/setter functions for modal preferences
  - `getHideGoogleSwitchWarning()`
  - `setHideGoogleSwitchWarning(value)`
  - `getHideColorKitSwitchWarning()`
  - `setHideColorKitSwitchWarning(value)`

- [ ] **1.4** Update `normalizeEventColorData()` to include `stripeColor` normalization

- [ ] **1.5** Remove deprecated functions (after Phase 3 migration):
  - `markEventForGoogleColors()`
  - `markRecurringEventForGoogleColors()`

### Acceptance Criteria
- Event color data includes `stripeColor` field
- Modal preferences persist across sessions
- All storage functions pass existing tests

---

## Phase 2: Mode Detection & State Management

**File:** `/features/event-coloring/index.js`
**Estimated Complexity:** Medium

### Tasks

- [ ] **2.1** Load `calendarDOMColors` cache in `init()` function
  ```javascript
  const domColorsData = await chrome.storage.local.get('cf.calendarDOMColors');
  calendarDOMColors = domColorsData['cf.calendarDOMColors'] || {};
  ```

- [ ] **2.2** Add `getStripeColorForCalendar()` helper function
  ```javascript
  function getStripeColorForCalendar(calendarId) {
    return calendarDOMColors[calendarId]
      || calendarColors[calendarId]?.backgroundColor
      || '#039be5';
  }
  ```

- [ ] **2.3** Update `saveFullColors()` to include stripe color
  - Get `calendarId` from event
  - Call `getStripeColorForCalendar(calendarId)`
  - Include `stripeColor` in saved data

- [ ] **2.4** Add `detectCurrentMode()` function
  ```javascript
  async function detectCurrentMode(eventId) {
    const colorKitColor = await storageService.findEventColorFull(eventId);
    return (colorKitColor && !colorKitColor.useGoogleColors) ? 'colorkit' : 'google';
  }
  ```

- [ ] **2.5** Add `clearColorKitStyling()` function for Google mode transition
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
    });
  }
  ```

- [ ] **2.6** Update `applyStoredColors()` to skip Google-owned events
  - Check if event has ColorKit color entry
  - If NO entry → skip element (Google owns it)
  - If entry exists → apply ColorKit colors

- [ ] **2.7** Update `applyColorsToElement()` to paint stripe
  ```javascript
  if (stripeColor) {
    const gradient = `linear-gradient(to right, ${stripeColor} 4px, ${background} 4px)`;
    element.style.setProperty('background', gradient, 'important');
  }
  ```

### Acceptance Criteria
- Mode detection correctly identifies Google vs ColorKit ownership
- Stripe colors are painted by ColorKit (not read from DOM)
- Google-owned events remain untouched by ColorKit

---

## Phase 3: Injector UI Redesign

**File:** `/features/event-coloring/core/colorPickerInjector.js`
**Estimated Complexity:** High

### Sub-Phase 3A: CSS Injection

- [ ] **3A.1** Add mode toggle CSS to `injectModalCSS()`
  ```css
  .cf-mode-toggle { padding: 12px 16px; background: #f8f9fa; border-bottom: 1px solid #e0e0e0; }
  .cf-mode-options { display: flex; gap: 12px; }
  .cf-mode-option { flex: 1; padding: 10px; border: 2px solid #e0e0e0; border-radius: 8px; cursor: pointer; }
  .cf-mode-option.cf-mode-active { border-color: #1a73e8; background: #e8f0fe; }
  ```

- [ ] **3A.2** Add section styling CSS
  ```css
  .cf-picker-section { padding: 12px 16px; border-bottom: 1px solid #e0e0e0; }
  .cf-section-title { font-size: 11px; font-weight: 600; color: #5f6368; text-transform: uppercase; }
  .cf-section-desc { font-size: 12px; color: #80868b; margin-bottom: 10px; }
  .cf-section-disabled { opacity: 0.5; pointer-events: none; }
  ```

- [ ] **3A.3** Add Pro badge and CTA CSS
  ```css
  .cf-pro-badge-inline { background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 1px 5px; border-radius: 3px; font-size: 8px; }
  .cf-pro-upgrade-cta { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: linear-gradient(135deg, #f3e8ff, #e9d5ff); border: 1px solid #c4b5fd; border-radius: 8px; }
  ```

- [ ] **3A.4** Add reset section CSS
  ```css
  .cf-reset-options { display: flex; flex-direction: column; gap: 8px; }
  .cf-reset-option { padding: 12px; border: 1px solid #e0e0e0; border-radius: 8px; background: white; cursor: pointer; }
  .cf-reset-option:hover { background: #f8f9fa; }
  .cf-reset-option.cf-reset-google:hover { background: #fce8e6; border-color: #f28b82; }
  ```

- [ ] **3A.5** Add confirmation modal CSS
  ```css
  .cf-switch-modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 100000; display: flex; align-items: center; justify-content: center; }
  .cf-switch-modal { background: white; border-radius: 12px; padding: 24px; max-width: 400px; box-shadow: 0 4px 24px rgba(0,0,0,0.2); }
  ```

### Sub-Phase 3B: Constants & Helpers

- [ ] **3B.1** Add `COLORKIT_DEFAULT_COLORS` constant (11 Google-equivalent colors)
  ```javascript
  const COLORKIT_DEFAULT_COLORS = [
    { hex: '#d50000', name: 'Tomato' },
    { hex: '#e67c73', name: 'Flamingo' },
    // ... (all 11 colors)
  ];
  ```

- [ ] **3B.2** Add `createSectionWithLabel()` helper
- [ ] **3B.3** Add `createToggleRow()` helper (matching popup styling)

### Sub-Phase 3C: Mode Toggle Component

- [ ] **3C.1** Create `createModeToggle(currentMode, eventId)` method
  - Returns DOM element with radio buttons for Google/ColorKit
  - Visual indicators matching the image design
  - Title and description for each mode

- [ ] **3C.2** Create `handleModeChange(newMode, eventId)` method
  - Check if confirmation should be shown
  - If switching to Google: show confirmation → delete ColorKit color → force refresh
  - If switching to ColorKit: show confirmation → apply default color

- [ ] **3C.3** Create `updateSectionStates(mode)` method
  - Enable/disable sections based on mode
  - Apply `cf-section-disabled` class appropriately

### Sub-Phase 3D: Section Components

- [ ] **3D.1** Create Google Colors section with toggle
  ```javascript
  createGoogleColorsSection(container, scenario, eventId, currentMode) {
    // Toggle header with title, description, switch
    // Google's built-in 11 colors
    // Greyed when ColorKit mode active
  }
  ```

- [ ] **3D.2** Create ColorKit List Color toggle section
  ```javascript
  createListColorSection(container, scenario, eventId, currentMode) {
    // Toggle header with title, description, switch
    // Preview showing calendar name and stripe color
    // Only active when ColorKit mode selected
  }
  ```

- [ ] **3D.3** Create ColorKits Colors section with toggle
  ```javascript
  createColorKitsColorsSection(categories, container, scenario, currentMode) {
    // Toggle header with title, description, switch
    // Description: "Use custom colors with text & border options."
    // Only active when ColorKit mode selected
  }
  ```

- [ ] **3D.4** Create Full Custom Coloring row
  ```javascript
  createFullCustomColoringRow(container, scenario) {
    // "+" icon button
    // Title: "Full Custom Coloring"
    // Description: "Full picker - Any color for your background, Text and Border"
    // Opens EventColorModal
  }
  ```

- [ ] **3D.5** Create Background Colors subsection
  ```javascript
  createBackgroundColorsSubsection(container, scenario) {
    // "Googles Default Colors" label with 11-color grid
    // Categories (NEW CATEGORY, GORY, etc.)
    // Templates section with Pro badge
  }
  ```

### Sub-Phase 3E: Confirmation Modal

- [ ] **3E.1** Create `SwitchConfirmationModal` class
  ```javascript
  class SwitchConfirmationModal {
    constructor({ type, eventId, isRecurring, onConfirm, onCancel })
    show()
    getConfig() // Returns title, message based on type
    handleConfirm(dontShowAgain)
    close()
  }
  ```

- [ ] **3E.2** Create modal HTML structure
  - Header with title
  - Body with message
  - "Don't show again" checkbox
  - Cancel and Confirm buttons

- [ ] **3E.3** Integrate storage for "don't show again" preference

### Sub-Phase 3F: Updated Injection Flow

- [ ] **3F.1** Rewrite `injectColorCategories()` with new structure
  ```javascript
  async injectColorCategories(categories) {
    // 1. Detect current mode
    const currentMode = await this.detectCurrentMode(eventId);

    // 2. Add Delete button at top (existing)

    // 3. Add Google's own colors toggle section

    // 4. Add ColorKit List Color toggle section

    // 5. Add ColorKits Colors toggle section
    //    - Full Custom Coloring row
    //    - Background Colors section
    //      - Default Colors (11 Google-equivalent)
    //      - Categories
    //      - Templates

    // 6. Apply mode visual states
    this.updateSectionStates(currentMode);
  }
  ```

### Sub-Phase 3G: Remove Google Interception

- [ ] **3G.1** Remove Google button click listeners (lines 1757-1770)
  - Delete the `googleButtons.forEach()` block that removes custom colors on Google click

- [ ] **3G.2** Remove Google checkmark suppression (lines 1787-1793)
  - Let Google manage its own checkmarks

- [ ] **3G.3** KEEP `modifyGoogleColorLabels()` (lines 1828-1875)
  - Custom labels feature stays unchanged

### Acceptance Criteria
- Mode toggle clearly shows Google vs ColorKit selection
- Greyed sections match the design (50% opacity, non-clickable)
- Confirmation modals appear with "don't show again" option
- Pro badges visible on appropriate sections
- Templates section properly gated for free users

---

## Phase 4: Reset Options

**File:** `/features/event-coloring/core/colorPickerInjector.js`
**Estimated Complexity:** Medium

### Tasks

- [ ] **4.1** Redesign `createResetActionsSection()` with three options:
  1. **Use Default Color** - Remove styling, keep ColorKit control (uses Peacock blue)
  2. **Return to List Color** - Use calendar's default with ColorKit control
  3. **Switch to Google Colors** - Hand control back to Google Calendar

- [ ] **4.2** Update `handleResetOption(action, eventId)` to handle all three actions

- [ ] **4.3** Only show reset section when in ColorKit mode

- [ ] **4.4** Disable "Return to List Color" when no list color is set

### Acceptance Criteria
- Reset section only visible in ColorKit mode
- All three reset options work correctly
- "Return to List" disabled when no calendar default exists

---

## Phase 5: Google Mode Transition

**File:** `/features/event-coloring/index.js` + `colorPickerInjector.js`
**Estimated Complexity:** Medium

### Tasks

- [ ] **5.1** Create `forceGoogleColorRefresh(eventId)` function
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

- [ ] **5.2** Ensure Google color is visible after mode switch
  - Clear all inline styles
  - Remove `data-cf-event-colored` attribute
  - May need page refresh for complex cases

- [ ] **5.3** Handle instant visual updates when switching modes

### Acceptance Criteria
- Switching to Google mode immediately shows Google's color (not blank)
- No residual ColorKit styles remain after switch
- Visual change is instant (no flicker or delay)

---

## Phase 6: Freemium Integration

**File:** `/features/event-coloring/core/colorPickerInjector.js`
**Estimated Complexity:** Low

### Tasks

- [ ] **6.1** Add Pro badges to:
  - Custom Coloring button label
  - Templates section label
  - Text/border features description

- [ ] **6.2** Create `createProUpgradeCTA()` for free users
  - Shows in ColorKit section
  - "Unlock Pro Features" with upgrade button

- [ ] **6.3** Gate template clicks with premium features
  - Check if template has text/border
  - Show upgrade modal if free user clicks premium template

### Acceptance Criteria
- Pro badges visible on premium features
- Free users see upgrade CTA in ColorKit section
- Premium-only templates trigger upgrade modal for free users

---

## Phase 7: Checkmark & Preview Updates

**File:** `/features/event-coloring/core/colorPickerInjector.js`
**Estimated Complexity:** Low

### Tasks

- [ ] **7.1** Update `updateCheckmarks()` to handle new structure
  - Only manage ColorKit button checkmarks
  - Don't touch Google's checkmarks
  - Handle list color selection indicator

- [ ] **7.2** Update preview items to include stripe
  ```javascript
  function createPreviewItem(label, bg, textColor, borderColor, borderWidth, stripeColor) {
    // Create chip with stripe element (4px left side)
  }
  ```

- [ ] **7.3** Update `openCustomColorModal()` to pass cached stripe color
  - Use `calendarDOMColors` cache instead of DOM read

### Acceptance Criteria
- Checkmarks correctly show on selected ColorKit colors
- Google checkmarks remain under Google's control
- Preview items show accurate stripe colors

---

## Phase 8: Testing & Validation

### Test Cases

#### Mode Switching
| Test | Expected |
|------|----------|
| Open picker, no ColorKit color | Google mode active, ColorKit greyed |
| Open picker, has ColorKit color | ColorKit mode active, Google greyed |
| Click Google toggle (from ColorKit) | Confirmation modal appears |
| Confirm switch to Google | ColorKit color deleted, Google color shows |
| Check "Don't show again" | Preference saved |
| Click ColorKit toggle (from Google) | Confirmation modal appears |
| Confirm switch to ColorKit | Event gets default color, ColorKit active |

#### Color Application
| Test | Expected |
|------|----------|
| Pick Default Color (Sage) | ColorKit takes over, bg + stripe painted |
| Pick category color | Same as Default Color |
| Pick template | Colors applied (with Pro gating) |
| Click "+" Custom | EventColorModal opens |
| Has text+border, pick new bg | Property merge modal appears |

#### Reset Options
| Test | Expected |
|------|----------|
| Click "Use Default Color" | Peacock blue applied, stays in ColorKit |
| Click "Return to List Color" | Calendar color applied, stays in ColorKit |
| Click "Return to List" (no list set) | Button disabled |
| Click "Switch to Google" | Confirmation, then Google takes over |

#### Visual Verification
| Test | Expected |
|------|----------|
| Google color after switch | Not blank, actual Google color |
| Stripe shows correctly | 4px left stripe in calendar color |
| Greyed sections | 50% opacity, not clickable except toggle |
| Pro badges visible | On Templates, Custom Coloring |

#### Freemium
| Test | Expected |
|------|----------|
| Free user clicks template with text/border | Upgrade modal |
| Free user applies text in EventColorModal | Upgrade modal |
| Pro CTA visible for free users | Shows in ColorKit section |
| Pro user | No restrictions |

#### Edge Cases
| Test | Expected |
|------|----------|
| Recurring event | Recurring dialog appears |
| Navigate calendar | Colors persist |
| Multiple tabs | Syncs via storage |
| Refresh page | Mode preserved |

---

## File Change Summary

| File | Type | Changes |
|------|------|---------|
| `/lib/storage.js` | MODIFY | Add stripeColor, modal prefs |
| `/features/event-coloring/index.js` | MODIFY | Stripe logic, mode detection, clear styling |
| `/features/event-coloring/core/colorPickerInjector.js` | MODIFY | Complete UI redesign, mode toggle, sections |

### Files NOT Changed
- `/shared/components/EventColorModal.js` - Already complete
- `/shared/components/ColorSwatchModal.js` - No changes needed
- `/features/event-coloring/components/RecurringEventDialog.js` - No changes
- `/features/event-coloring/utils/eventIdUtils.js` - No changes
- `/shared/utils/colorUtils.js` - No changes

---

## Implementation Order

1. **Phase 1** - Storage (foundation for all other phases)
2. **Phase 2** - Mode detection & state management
3. **Phase 3A-3B** - CSS and constants
4. **Phase 3C** - Mode toggle component
5. **Phase 3D** - Section components
6. **Phase 3E** - Confirmation modal
7. **Phase 3F-3G** - Injection flow rewrite
8. **Phase 4** - Reset options
9. **Phase 5** - Google mode transition
10. **Phase 6** - Freemium integration
11. **Phase 7** - Checkmarks and previews
12. **Phase 8** - Testing

---

## Key Principles

1. **Binary Ownership**: Event is EITHER Google-controlled OR ColorKit-controlled, never both
2. **Mode Toggle UI**: Clear visual indication with toggle sections (similar to popup styling)
3. **No Google Interception**: We don't intercept Google's color clicks anymore
4. **ColorKit Paints Everything**: In ColorKit mode, we paint bg + text + border + stripe
5. **Preserve Existing Features**: Merge logic, templates, recurring events, freemium all remain
6. **Instant Visual Updates**: Mode switching should be immediately visible

---

## Risk Mitigation

- **Google DOM Changes**: By owning the stripe ourselves, we reduce dependency on `.jSrjCf`
- **Race Conditions**: Binary ownership eliminates dual-control conflicts
- **User Confusion**: Clear mode toggle with descriptions explains what each mode does
- **Data Loss**: Confirmation modals warn before deleting ColorKit colors

---

## Success Metrics

- Zero race condition bugs reported
- Users understand which system controls their colors
- Stripe colors display correctly in all scenarios
- Mode persistence works across page refreshes
- Freemium gating works correctly
