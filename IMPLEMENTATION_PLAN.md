# ColorKit Unified Color System - Implementation Plan

## Project Overview
Unify task coloring and event coloring into a cohesive UI system with enhanced color customization capabilities.

**Status Legend:**
- [ ] Not Started
- [~] In Progress
- [x] Completed

---

## Phase 1: Custom Color Picker Modal (Foundation)
**Goal:** Create a reusable custom swatch modal component with palettes

### Stage 1.1: Extract & Refactor Swatch Modal
- [x] Extract `buildTaskListColorDetails` from popup.js into a shared module
- [x] Create `/Main Extension/shared/components/ColorSwatchModal.js`
- [x] Support Vibrant, Pastel, Dark, Custom palette tabs
- [x] Add full color picker input (hex, color wheel)
- [x] Include user's saved custom colors from Color Lab
- [x] Make it importable for both popup and content scripts
- [x] Create `/Main Extension/shared/styles/ColorSwatchModal.css`
- [x] Create `/Main Extension/shared/utils/colorUtils.js`

### Stage 1.2: Add "+" Custom Color Button to Event Color Picker
- [x] Modify `event-coloring/index.js` to add "+" button after categories
- [x] "+" opens the new ColorSwatchModal (injected into calendar page)
- [x] On color select, apply to event via existing `handleColorSelection`
- [x] Style the "+" button to match existing category color buttons
- [x] Inject modal CSS dynamically when needed
- [x] Add ColorSwatchModal.js to manifest content_scripts

### Stage 1.3: Integrate with New UI Tasks
- [x] Modify task coloring modal injection for new UI (ttb_ prefix tasks)
- [x] Add same "+" custom color button to task color picker
- [x] Ensure palettes and Color Lab colors are accessible
- [x] Add CSS injection for ColorSwatchModal in task coloring
- [x] Create createTaskCustomColorButton() and openTaskCustomColorModal() functions

**Files Affected:**
- `Main Extension/popup/popup.js` (extract shared code)
- `Main Extension/shared/components/ColorSwatchModal.js` (new)
- `Main Extension/features/event-coloring/core/colorPickerInjector.js`
- `Main Extension/features/tasks-coloring/index.js`
- `Main Extension/features/tasks-coloring/styles.css`

---

## Phase 2: Calendar List Coloring (Mirror Task List System)
**Goal:** Add per-calendar default colors (bg/text/border) like task lists
**Status:** Ready to implement - approach validated by Phase 3

### Stage 2.1: Storage Schema for Calendar Colors
- [ ] Add to `defaultSettings.eventColoring`:
  ```javascript
  calendarColors: {
    // calendarId -> { background, text, border }
  }
  ```
- [ ] Add storage functions to `storage.js` (mirror task list pattern):
  - `getCalendarColors(calendarId)`
  - `setCalendarBackgroundColor(calendarId, color)`
  - `setCalendarTextColor(calendarId, color)`
  - `setCalendarBorderColor(calendarId, color)`
  - `clearCalendarColors(calendarId)`
- [ ] Store in sync storage (like task list colors)

### Stage 2.2: Fetch Calendar List from Google API
- [ ] Use existing auth from Calendar Colors API
- [ ] Fetch user's calendars: `calendar.calendarList.list()`
- [ ] Cache calendar list locally (similar to task lists)
- [ ] Store calendar metadata: id, summary (name), backgroundColor

### Stage 2.3: Popup UI for Calendar Colors
- [ ] Create "Calendar Colors" subsection in Event Coloring section
- [ ] Mirror the Task List Colors UI structure:
  - OAuth status check (should already be granted for events)
  - Grid of calendars with swatches (bg/text/border)
  - Each calendar expandable to color picker modal
- [ ] Reuse `createTaskListColorControl` pattern for consistency

### Stage 2.4: Apply Calendar Colors to Events
- [ ] In `colorRenderer.js` or `index.js`, check calendar ID of event
- [ ] **Color priority:** Manual event color > Calendar default > Google default
- [ ] Apply colors using same method as individual events:
  ```javascript
  // Background: set on [data-eventchip] element
  element.style.backgroundColor = bgColor;

  // Text: set on .I0UMhf, .lhydbb elements
  textElements.forEach(el => el.style.color = textColor);

  // Border: use outline (Google sets border-width: 0)
  element.style.outline = `2px solid ${borderColor}`;
  element.style.outlineOffset = '-2px';
  ```
- [ ] Handle 4px calendar stripe preservation (existing gradient logic)

### Implementation Notes (from Phase 3):
- Calendar ID can be extracted from event's data attributes or API response
- Use `rgbToHex()` helper for color conversion
- Outline method proven effective for borders
- Text elements to target: `.I0UMhf`, `.lhydbb.gVNoLb`, `.lhydbb.K9QN7e`

**Files Affected:**
- `Main Extension/lib/storage.js`
- `Main Extension/popup/popup.js`
- `Main Extension/popup/popup.html`
- `Main Extension/features/event-coloring/core/colorRenderer.js`
- `Main Extension/features/event-coloring/index.js`

---

## Phase 3: Full Event Color Control (Text/Border/Background) ✅ COMPLETED
**Goal:** Events get same granular control as tasks
**Status:** ✅ Completed - 2025-12-19

### Stage 3.1: Extend Event Color Storage ✅
- [x] Changed `cf.eventColors` structure:
  ```javascript
  // New structure supports all three properties:
  {
    background: "#..." | null,
    text: "#..." | null,
    border: "#..." | null,
    isRecurring: bool,
    appliedAt: timestamp
  }
  ```
- [x] Added `saveEventColorsFullAdvanced()` function in `storage.js`
- [x] Added `findEventColorFull()` function in `storage.js`
- [x] Added `normalizeEventColorData()` for backward compatibility
- [x] Existing `hex` format auto-migrates to `background` property

### Stage 3.2: Update Event Color Picker UI ✅
- [x] Created `EventColorModal.js` component with:
  - Property tabs: Background | Text | Border (with color indicators)
  - Live preview showing actual event appearance
  - Palette tabs: Vibrant | Pastel | Dark | Custom
  - "No color" swatch to clear individual properties
  - Hex input for manual color entry
  - Apply/Cancel buttons
- [x] Modal shows actual event title and colors on open
- [x] Tab indicators update dynamically with selected colors
- [x] Grid layout matches ColorSwatchModal (7 columns, 36px max-width swatches)

### Stage 3.3: Apply Full Color Styling to Events ✅
- [x] Modified `index.js` to apply colors:
  ```javascript
  // Background: directly on [data-eventchip] element
  element.style.backgroundColor = bgColor;

  // Text: on .I0UMhf, .lhydbb elements
  const textEls = element.querySelectorAll('.I0UMhf, .lhydbb.gVNoLb, .lhydbb.K9QN7e');
  textEls.forEach(el => el.style.color = textColor);

  // Border: using outline (Google sets border-width: 0)
  element.style.outline = `2px solid ${borderColor}`;
  element.style.outlineOffset = '-2px';
  ```
- [x] Calendar stripe (.jSrjCf) preserved - not modified
- [x] Auto-contrast text color when no custom text set
- [x] Works in day/week/month views

### Stage 3.4: Calendar Default Text/Border Colors
- [ ] Moved to Phase 2 (Calendar List Coloring)

### Key Implementation Details:
- **Border method:** `outline` with `outline-offset: -2px` (border-width is 0 in Google)
- **Text selectors:** `.I0UMhf` (title), `.lhydbb.gVNoLb` (time), `.lhydbb.K9QN7e` (location)
- **DOM color extraction:** `getEventColorsFromDOM()` reads actual colors for preview
- **Color conversion:** `rgbToHex()` helper for computed style conversion

**Files Created/Modified:**
- `Main Extension/shared/components/EventColorModal.js` ✅ (new)
- `Main Extension/lib/storage.js` ✅
- `Main Extension/features/event-coloring/index.js` ✅
- `Main Extension/manifest.json` ✅

---

## Phase 4: Color Templates System
**Goal:** Save and apply preset bg/text/border combinations

### Stage 4.1: Template Storage Schema
- [ ] Add to settings:
  ```javascript
  colorTemplates: {
    // templateId -> {
    //   name: "Work Meeting",
    //   background: "#...",
    //   text: "#...",
    //   border: "#...",
    //   type: "all" | "task" | "event" // where it can be used
    // }
  }
  ```
- [ ] Storage functions:
  - `getColorTemplates()`
  - `saveColorTemplate(template)`
  - `deleteColorTemplate(templateId)`
  - `updateColorTemplate(templateId, changes)`

### Stage 4.2: Template Management UI in Popup
- [ ] New section in Preferences tab: "Color Templates"
- [ ] Create template: pick bg/text/border, give it a name
- [ ] Preview shows a mock chip with colors applied
- [ ] Edit/delete existing templates
- [ ] Import/export templates (JSON)

### Stage 4.3: Templates in Injected Color Picker
- [ ] Add "Templates" section in event/task color picker
- [ ] Show user's saved templates as buttons
- [ ] Click template = apply all three colors at once
- [ ] Quick visual preview on hover
- [ ] **Recurring Events:** When applying template to recurring event, show existing `RecurringEventDialog`:
  - "Apply to this instance only" → save template colors for single instance
  - "Apply to all instances" → save template colors with `isRecurring: true`

### Stage 4.4: Template Sharing (Optional/Future)
- [ ] Export template as shareable code
- [ ] Import template from code
- [ ] Community templates browser (if backend exists)

**Files Affected:**
- `Main Extension/lib/storage.js`
- `Main Extension/popup/popup.js`
- `Main Extension/popup/popup.html`
- `Main Extension/features/event-coloring/core/colorPickerInjector.js`
- `Main Extension/features/tasks-coloring/index.js`
- `Main Extension/shared/components/ColorSwatchModal.js`

---

## Phase 5: UI Polish & Unification
**Goal:** Consistent look and feel across all color UI

### Stage 5.1: Unified Component Library
- [ ] Create `/Main Extension/shared/styles/colors.css`
- [ ] Standardize:
  - Color swatch sizes and shapes
  - Color picker modal layout
  - Tab styling for palettes
  - Button styles for color actions

### Stage 5.2: Popup UI Reorganization
- [ ] Group related color features:
  - "Events" section: Event coloring + Calendar colors + Event templates
  - "Tasks" section: Task coloring + Task list colors + Task templates
  - "Day Coloring" section: existing
  - "Color Lab" section: custom colors + shared templates
- [ ] Update section headers and icons

### Stage 5.3: Responsive & Accessibility
- [ ] Ensure color picker works in narrow popups
- [ ] Keyboard navigation for all color buttons
- [ ] ARIA labels for screen readers
- [ ] High contrast mode support

### Stage 5.4: Performance Optimization
- [ ] Lazy load color palettes in modals
- [ ] Debounce color application in calendar
- [ ] Cache commonly used color computations
- [ ] Optimize storage reads/writes

**Files Affected:**
- Multiple CSS files
- `Main Extension/popup/popup.html`
- `Main Extension/popup/popup.js`
- All color-related feature files

---

## Technical Considerations

### Storage Keys (Final Structure)
```javascript
// Sync Storage
settings.eventColoring.calendarColors = { calendarId: { background, text, border } }
settings.colorTemplates = { templateId: { name, background, text, border, type } }

// Local Storage - Events
cf.eventColors = {
  eventId: { background, text, border, isRecurring, appliedAt }
  // When isRecurring=true, eventId is the base ID (no instance suffix)
  // All instances of that recurring event will match via findEventColor()
}

// Local Storage - Tasks (existing, extended for templates)
cf.taskColors = { taskId: { background, text, border } }  // Single task instance
```

### Migration Requirements
1. Existing `cf.eventColors` with `hex` -> migrate to `background` property
2. Existing `cf.taskColors` (string hex) -> migrate to `{ background: hex }` object
3. Preserve all existing functionality during migration
4. Version flag to track migration status
5. Backward compatibility: check for string vs object when reading colors

### Shared Code Modules
```
/Main Extension/shared/
  /components/
    ColorSwatchModal.js      # Reusable color picker modal
    ColorPaletteGrid.js      # Palette grid component
    ColorTemplateButton.js   # Template quick-apply button
  /styles/
    colors.css               # Shared color UI styles
  /utils/
    colorUtils.js            # Color manipulation helpers
```

### Testing Checklist
- [ ] New UI tasks color correctly
- [ ] Old UI tasks still work
- [ ] Events color correctly in all views (day/week/month/schedule)
- [ ] Recurring events handled properly
- [ ] Recurring event "apply to all" works with new bg/text/border model
- [ ] Calendar default colors apply
- [ ] Templates apply all three color properties
- [ ] Templates show recurring dialog for recurring events
- [ ] Storage migration preserves existing colors
- [ ] Existing recurring event colors preserved after migration
- [ ] No performance regression

---

## Implementation Order Recommendation

1. **Phase 1** first - establishes shared components
2. **Phase 3.1-3.3** next - extends event color model
3. **Phase 2** parallel - calendar list coloring
4. **Phase 4** after storage is finalized
5. **Phase 5** last - polish

---

## Current Progress

**Last Updated:** 2025-12-19

### Completed
- [x] Analysis of existing task coloring feature
- [x] Analysis of existing event coloring feature
- [x] Plan document created
- [x] Phase 1.1: ColorSwatchModal component created
- [x] Phase 1.2: Event coloring "+" button integrated
- [x] Phase 1.3: Task coloring "+" button integrated
- [x] **Phase 3: Full Event Color Control** ✅
  - [x] EventColorModal.js with Background/Text/Border tabs
  - [x] Live preview with actual event title and colors
  - [x] Storage functions for full color support
  - [x] Color rendering for bg/text/border on events
  - [x] Backward compatibility with existing hex format

### Next Steps
- [ ] **Phase 2: Calendar List Coloring** (Ready to implement)
  - Storage schema for per-calendar colors
  - Fetch calendar list from Google API
  - Popup UI for calendar color management
  - Apply calendar default colors to events

### Implementation Knowledge Gained
From Phase 3 implementation, we now know:
1. **Border coloring:** Use `outline` + `outline-offset: -2px` (not border-color)
2. **Text elements:** Target `.I0UMhf`, `.lhydbb.gVNoLb`, `.lhydbb.K9QN7e`
3. **Event detection:** Read from `[data-eventchip]` elements
4. **Color extraction:** `window.getComputedStyle()` + `rgbToHex()` helper
5. **Calendar stripe:** `.jSrjCf` element - preserve, don't modify

---

## Notes & Decisions
- ✅ **Border coloring confirmed:** Uses `outline` method (not `border-color`) because Google sets `border-width: 0`
- ✅ **Calendar stripe preserved:** `.jSrjCf` element untouched, background applied to parent
- ✅ **No "completed event" styling needed** (unlike completed tasks)
- Templates are stored in sync storage for cross-device access
- ✅ **EventColorModal UI:** 7-column grid, 36px max-width swatches (matches ColorSwatchModal)
- ✅ **Live preview:** Shows actual event title and colors from DOM on modal open

## Existing Recurring Systems (Must Integrate With)

### Recurring Events (Already Implemented)
- **Dialog:** `RecurringEventDialog.js` component shows "This event only" vs "All events" choice
- **Detection:** `EventIdUtils.fromEncoded()` parses event ID to detect `isRecurring`
- **Storage:** `cf.eventColors[baseEventId]` with `isRecurring: true` flag
- **Matching:** `findEventColor()` checks both direct ID and base ID for recurring matches
- **Templates must:** Reuse `showRecurringEventDialog()` when applying to recurring events
