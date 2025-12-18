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
- [ ] Extract `buildTaskListColorDetails` from popup.js into a shared module
- [ ] Create `/Main Extension/shared/components/ColorSwatchModal.js`
- [ ] Support Vibrant, Pastel, Dark, Custom palette tabs
- [ ] Add full color picker input (hex, color wheel)
- [ ] Include user's saved custom colors from Color Lab
- [ ] Make it importable for both popup and content scripts

### Stage 1.2: Add "+" Custom Color Button to Event Color Picker
- [ ] Modify `colorPickerInjector.js` to add "+" button after categories
- [ ] "+" opens the new ColorSwatchModal (injected into calendar page)
- [ ] On color select, apply to event via existing `handleColorSelect`
- [ ] Style the "+" button to match existing category color buttons

### Stage 1.3: Integrate with New UI Tasks
- [ ] Modify task coloring modal injection for new UI (ttb_ prefix tasks)
- [ ] Add same "+" custom color button to task color picker
- [ ] Ensure palettes and Color Lab colors are accessible

**Files Affected:**
- `Main Extension/popup/popup.js` (extract shared code)
- `Main Extension/shared/components/ColorSwatchModal.js` (new)
- `Main Extension/features/event-coloring/core/colorPickerInjector.js`
- `Main Extension/features/tasks-coloring/index.js`
- `Main Extension/features/tasks-coloring/styles.css`

---

## Phase 2: Calendar List Coloring (Mirror Task List System)
**Goal:** Add per-calendar default colors (bg/text/border) like task lists

### Stage 2.1: Storage Schema for Calendar Colors
- [ ] Add to `defaultSettings.eventColoring`:
  ```javascript
  calendarColors: {
    // calendarId -> { background, text, border }
  }
  ```
- [ ] Add storage functions to `storage.js`:
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
- [ ] In `colorRenderer.js`, check calendar ID of event
- [ ] Color priority: Manual event color > Calendar default > Google default
- [ ] Apply bg/text/border same as task list coloring does for tasks
- [ ] Handle 4px calendar stripe preservation (existing gradient logic)

**Files Affected:**
- `Main Extension/lib/storage.js`
- `Main Extension/popup/popup.js`
- `Main Extension/popup/popup.html`
- `Main Extension/features/event-coloring/core/colorRenderer.js`
- `Main Extension/features/event-coloring/index.js`

---

## Phase 3: Full Event Color Control (Text/Border/Background)
**Goal:** Events get same granular control as tasks

### Stage 3.1: Extend Event Color Storage
- [ ] Change `cf.eventColors` structure:
  ```javascript
  // Before:
  { hex: "#...", isRecurring: bool }

  // After:
  {
    background: "#..." | null,
    text: "#..." | null,
    border: "#..." | null,
    isRecurring: bool
  }
  ```
- [ ] Add migration for existing event colors (map `hex` -> `background`)
- [ ] Update all storage functions

### Stage 3.2: Update Event Color Picker UI
- [ ] In injected color picker, add tabs or sections for:
  - Background color
  - Text color
  - Border color
- [ ] Each opens ColorSwatchModal targeting that property
- [ ] Show current colors as small preview chips

### Stage 3.3: Apply Full Color Styling to Events
- [ ] Modify `colorRenderer.js` to apply:
  - `background-color` (with gradient for calendar stripe)
  - `color` for text
  - `border` or `outline` for border (test which works)
- [ ] Maintain calendar stripe gradient on left edge
- [ ] Handle multi-day events and different view layouts

### Stage 3.4: Calendar Default Text/Border Colors
- [ ] Similar to task lists: calendar defaults for text/border
- [ ] Event manual color overrides calendar default
- [ ] UI in popup to set per-calendar text/border defaults

**Files Affected:**
- `Main Extension/lib/storage.js`
- `Main Extension/features/event-coloring/core/colorPickerInjector.js`
- `Main Extension/features/event-coloring/core/colorRenderer.js`
- `Main Extension/popup/popup.js`
- `Main Extension/popup/popup.html`

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
- [ ] **Recurring Tasks:** Same pattern for recurring task chains (use existing fingerprint system)

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
cf.recurringChainColors = { chainId: { background, text, border } }  // All instances in chain
```

### Migration Requirements
1. Existing `cf.eventColors` with `hex` -> migrate to `background` property
2. Existing `cf.taskColors` (string hex) -> migrate to `{ background: hex }` object
3. Existing `cf.recurringChainColors` (string hex) -> migrate to `{ background: hex }` object
4. Preserve all existing functionality during migration
5. Version flag to track migration status
6. Backward compatibility: check for string vs object when reading colors

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
- [ ] Recurring task chains work with templates
- [ ] Calendar default colors apply
- [ ] Templates apply all three color properties
- [ ] Templates show recurring dialog for recurring events/tasks
- [ ] Storage migration preserves existing colors
- [ ] Existing recurring colors preserved after migration
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

**Last Updated:** [DATE]

### Completed
- [x] Analysis of existing task coloring feature
- [x] Analysis of existing event coloring feature
- [x] Plan document created

### Next Steps
- [ ] Begin Phase 1.1: Extract swatch modal component

---

## Notes & Decisions
- Border coloring will use `outline` method (not `border-color`) because Google sets `border-width: 0`
- Calendar stripe (4px left gradient) will be preserved even with custom colors
- No "completed event" styling needed (unlike completed tasks)
- Templates are stored in sync storage for cross-device access

## Existing Recurring Systems (Must Integrate With)

### Recurring Events (Already Implemented)
- **Dialog:** `RecurringEventDialog.js` component shows "This event only" vs "All events" choice
- **Detection:** `EventIdUtils.fromEncoded()` parses event ID to detect `isRecurring`
- **Storage:** `cf.eventColors[baseEventId]` with `isRecurring: true` flag
- **Matching:** `findEventColor()` checks both direct ID and base ID for recurring matches
- **Templates must:** Reuse `showRecurringEventDialog()` when applying to recurring events

### Recurring Tasks (Already Implemented)
- **Chain System:** `cf.recurringChainColors[chainId]` stores color for entire chain
- **Fingerprint:** Format is `{title}|{time}` (e.g., "Daily standup|9am")
- **Legacy:** `cf.recurringTaskColors[fingerprint]` for backward compatibility
- **Priority:** Chain color > Legacy recurring > List default
- **Templates must:** Detect recurring tasks and offer "all instances" option via similar dialog
