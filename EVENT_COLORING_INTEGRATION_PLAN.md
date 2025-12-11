# Event Coloring Integration Plan - ColorKit Extension

## Executive Summary

This document outlines the comprehensive plan to integrate event coloring functionality from the "Color Extension" into the Main Extension (ColorKit). This will add custom color palette support for Google Calendar events, expanding beyond the current task coloring features.

---

## Phase 1: Color Extension Analysis

### Architecture Overview

**Technology Stack:**
- React 18 (bundled)
- TypeScript (compiled/minified)
- Chrome Extension Manifest V3
- Chrome Storage API

**Core Modules:**

1. **Color Picker Module** (`picker`)
   - Injects custom color palettes into Google Calendar's color picker
   - Detects two scenarios: `EVENTEDIT` (editing existing events) and `LISTVIEW` (list view)
   - Uses MutationObserver pattern for DOM detection
   - Creates custom color categories with React components

2. **Color Renderer Module** (`renderer`)
   - Applies stored colors to calendar event elements
   - Handles both recurring and non-recurring events
   - Updates DOM styling dynamically using requestAnimationFrame
   - Processes event ID attributes for targeting

3. **Storage Service**
   - Manages color categories (palettes)
   - Stores event-to-color mappings
   - Handles recurring event logic
   - Supports custom labels for Google's built-in colors

### Key Features Identified

✅ **Custom Color Palettes**
- User-defined color categories (e.g., "Work", "Personal", "Important")
- Multiple colors per category
- Visual separation from Google's built-in colors

✅ **Event Color Storage**
```javascript
// Storage Structure
{
  eventColors: {
    [eventId]: {
      hex: "#FF5733",
      isRecurring: boolean
    }
  },
  categories: {
    [categoryId]: {
      name: "Work",
      colors: [{hex: "#...", name: "..."}, ...]
    }
  }
}
```

✅ **Recurring Event Handling**
- Shows dialog when coloring recurring events
- Options: "This event only" or "All events in series"
- Event ID matching system

✅ **Google Color Label Customization**
- Rename Google's default colors (e.g., "Tomato" → "Urgent")
- Modifies aria-labels and data attributes

✅ **Checkmark Management**
- Visual indicator for currently selected color
- Synchronizes between Google colors and custom colors

### DOM Injection Points

**Scenario 1: EVENTEDIT (Event Editor)**
- Selector: `COLOR_PICKER_CONTROLLERS.EDITOR`
- Max height: 600px
- Max width: 200px
- Injects below Google's built-in color group

**Scenario 2: LISTVIEW (Calendar List View)**
- Selector: `COLOR_PICKER_CONTROLLERS.LIST`
- Max height: 500px
- Max width: 300px
- Similar injection pattern

**Key Selectors:**
- `BUILT_IN_COLOR_GROUP` - Google's color container
- `GOOGLE_COLOR_BUTTON` - Individual Google color buttons
- `data-event-id`, `data-eventid`, `data-eid` - Event identifier attributes

---

## Phase 2: Integration Strategy

### Goals

1. ✅ Maintain existing task coloring functionality
2. ✅ Add event coloring without conflicts
3. ✅ Match ColorKit UI design language
4. ✅ Support new event creation modal (currently missing)
5. ✅ Prepare foundation for future enhancements

### Architecture Changes

#### New Feature Module Structure

```
Main Extension/
├── features/
│   ├── event-coloring/           # NEW
│   │   ├── index.js               # Feature registration
│   │   ├── core/
│   │   │   ├── colorPicker.js     # Color picker injection
│   │   │   ├── colorRenderer.js   # DOM color application
│   │   │   └── eventDetection.js  # Event ID resolution
│   │   ├── components/
│   │   │   ├── ColorButton.js     # Individual color button
│   │   │   ├── CategorySection.js # Color category display
│   │   │   └── RecurringDialog.js # Recurring event modal
│   │   └── utils/
│   │       ├── domSelectors.js    # Google Calendar selectors
│   │       ├── eventIdUtils.js    # Event ID encoding/decoding
│   │       └── scenarioDetection.js # EVENTEDIT vs LISTVIEW
│   ├── calendar-coloring/         # EXISTING
│   ├── tasks-coloring/            # EXISTING
│   └── time-blocking/             # EXISTING
```

#### Storage Schema Extension

**New Storage Keys:**

```javascript
// chrome.storage.sync
{
  'cf.eventColors': {
    [eventId]: {
      hex: "#FF5733",
      isRecurring: false,
      timestamp: Date.now()
    }
  },
  'cf.eventColorCategories': {
    [categoryId]: {
      id: "cat_1",
      name: "Work",
      order: 0,
      colors: [
        { hex: "#4285f4", name: "Primary Blue" },
        { hex: "#ea4335", name: "Alert Red" }
      ]
    }
  },
  'cf.googleColorLabels': {
    "#9e69af": "Custom Label for Purple"
  }
}
```

**Storage Quota Considerations:**
- chrome.storage.sync: 102,400 bytes (~100KB)
- Each event color: ~50 bytes
- Estimated capacity: ~2000 events
- Implement cleanup strategy for old events

---

## Phase 3: UI Integration

### 3.1 Popup Extension

**Add Event Coloring Section**

```
┌─────────────────────────────────┐
│ ColorKit Popup                  │
├─────────────────────────────────┤
│ ⚙️ Day Coloring            [ON] │
│ 📋 Task Coloring           [ON] │
│ 🎨 Event Coloring          [ON] │ ← NEW
│ ⏰ Time Blocking          [ON] │
├─────────────────────────────────┤
│ Event Color Palettes            │ ← NEW SECTION
│                                 │
│ ┌──────────────────────┐        │
│ │ Work        [Edit] [×]│        │
│ │ ●●●●●●                │        │
│ └──────────────────────┘        │
│ ┌──────────────────────┐        │
│ │ Personal    [Edit] [×]│        │
│ │ ●●●●●●                │        │
│ └──────────────────────┘        │
│                                 │
│ [+ Add Color Palette]           │
└─────────────────────────────────┘
```

**Implementation:**
- New UI section in `popup/popup.html`
- Palette CRUD operations
- Preview dots showing colors in palette
- Quick enable/disable toggle

### 3.2 Color Picker Injection

**Visual Design (matches ColorKit style):**

```
Google Calendar Event Editor
┌────────────────────────────────┐
│ Event Name: Team Meeting       │
├────────────────────────────────┤
│ Color:                         │
│                                │
│ Google Colors                  │
│ ●●●●●●●●●●●                    │
│                                │
│ ─────────────────────────      │ ← Separator
│                                │
│ WORK                           │ ← ColorKit Categories
│ ●●●●●●●●●●●                    │
│                                │
│ PERSONAL                       │
│ ●●●●●●●●●●●                    │
│                                │
│ IMPORTANT                      │
│ ●●●●●●●●●●●                    │
└────────────────────────────────┘
```

**Styling Guidelines:**
- Match ColorKit brand colors
- Use `#4285f4` for primary actions
- 8px gap between color buttons
- 12px vertical spacing between categories
- Uppercase category labels (12px, 500 weight, #202124)
- Smooth hover transitions (150ms ease)

### 3.3 New Event Modal Support

**Critical Enhancement:** Color Extension only works for *existing* events. We need to add support for *new event creation*.

**Detection Strategy:**

```javascript
// Detect new event modal
function detectNewEventModal() {
  // Google Calendar shows event creation modal with specific attributes
  const modal = document.querySelector('[role="dialog"][aria-label*="Event"]');

  // Check for "Save" button (not "Save & close" which is edit)
  const saveButton = modal?.querySelector('button[aria-label="Save"]');

  // No event ID = new event
  const hasEventId = modal?.querySelector('[data-eventid]');

  return modal && saveButton && !hasEventId;
}
```

**Injection Point:**
- Same color picker container as edit mode
- Store temporary selection in memory
- Apply color on event save
- Clear temporary selection on modal close

**Implementation Flow:**
```
1. User opens "Create event"
2. Extension detects modal (no event ID)
3. Inject color picker
4. User selects color → store in tempColorSelection
5. User clicks "Save"
6. Intercept save → get new event ID
7. Apply color mapping: newEventId → tempColorSelection
8. Render color on calendar
9. Clear tempColorSelection
```

---

## Phase 4: Implementation Roadmap

### Milestone 1: Core Event Coloring (Week 1-2)

**Tasks:**
1. ✅ Create `features/event-coloring/` module structure
2. ✅ Implement storage service for event colors
3. ✅ Build DOM selector utilities
4. ✅ Create event ID detection/encoding system
5. ✅ Implement color picker injection (EVENTEDIT scenario)
6. ✅ Build color renderer for applying colors to DOM
7. ✅ Add recurring event detection
8. ✅ Test with existing events

**Success Criteria:**
- User can color existing events
- Colors persist after page reload
- No conflicts with task coloring
- Works in both calendar views (month, week, day)

### Milestone 2: New Event Support (Week 3)

**Tasks:**
1. ✅ Implement new event modal detection
2. ✅ Add temporary color selection storage
3. ✅ Hook into event save flow
4. ✅ Resolve new event ID after creation
5. ✅ Apply stored color to new event
6. ✅ Test edge cases (cancel, errors)

**Success Criteria:**
- User can set color when creating event
- Color applies immediately after save
- Cancel/close properly clears temp selection

### Milestone 3: Palette Management UI (Week 4)

**Tasks:**
1. ✅ Design popup UI mockups
2. ✅ Implement palette CRUD in popup
3. ✅ Add color picker component for palette editing
4. ✅ Build category management
5. ✅ Add drag-and-drop reordering
6. ✅ Implement import/export

**Success Criteria:**
- User can create/edit/delete palettes
- Changes sync across devices (chrome.storage.sync)
- UI matches ColorKit design language

### Milestone 4: Recurring Events (Week 5)

**Tasks:**
1. ✅ Build recurring event dialog component
2. ✅ Implement "This event" vs "All events" logic
3. ✅ Add recurring event pattern matching
4. ✅ Handle exceptions properly
5. ✅ Test with various recurrence patterns

**Success Criteria:**
- Dialog appears for recurring events
- Both options work correctly
- No performance issues with large series

### Milestone 5: Polish & Testing (Week 6)

**Tasks:**
1. ✅ Add loading states
2. ✅ Implement error handling
3. ✅ Add user feedback (toasts/notifications)
4. ✅ Performance optimization
5. ✅ Cross-browser testing
6. ✅ Documentation

---

## Phase 5: Future Enhancements (Post-Launch)

### 5.1 Calendar-Level Coloring

**Feature:** Set default colors per calendar (not just per event)

**Storage:**
```javascript
'cf.calendarColors': {
  [calendarId]: {
    defaultColor: "#4285f4",
    applyToNewEvents: true
  }
}
```

**UI:** Settings page with calendar list

### 5.2 Advanced Styling Options

**Features:**
- Text color override (separate from background)
- Border color customization
- Border width/style options
- Opacity control

**Storage:**
```javascript
'cf.eventColors': {
  [eventId]: {
    background: "#FF5733",
    text: "#FFFFFF",
    border: "#CC4429",
    borderWidth: 2,
    opacity: 0.9
  }
}
```

**UI:** Advanced color picker with separate controls

### 5.3 Color Presets Library

**Features:**
- Pre-made color schemes ("Professional", "Vibrant", "Pastel")
- One-click import of preset palettes
- Community sharing (via export/import)

**Storage:**
```javascript
'cf.colorPresets': {
  [presetId]: {
    name: "Professional",
    description: "Muted corporate colors",
    categories: [...]
  }
}
```

### 5.4 Smart Coloring Rules

**Features:**
- Auto-color based on keywords (e.g., "meeting" → blue)
- Time-based coloring (morning events → yellow)
- Attendee-based coloring (events with boss → red)

**Storage:**
```javascript
'cf.coloringRules': {
  [ruleId]: {
    trigger: "keyword",
    pattern: "meeting",
    color: "#4285f4",
    enabled: true
  }
}
```

---

## Phase 6: Technical Considerations

### 6.1 Performance

**Optimization Strategies:**
- Debounce DOM mutations (100ms)
- Use requestAnimationFrame for rendering
- Batch color applications
- Cache selector queries
- Lazy load React components

**Benchmarks:**
- Color picker injection: <50ms
- Color rendering (100 events): <100ms
- Storage read: <10ms
- No jank on scroll/navigation

### 6.2 Compatibility

**Google Calendar Versions:**
- New UI (2023+) - Primary target
- Legacy UI - Best effort support
- Mobile web - Out of scope (Phase 2)

**Browser Support:**
- Chrome 121+ (required for silent push)
- Edge 121+
- Other Chromium browsers (untested)

**Conflicts:**
- No interference with Google's native coloring
- Coexist with other calendar extensions
- Graceful degradation if Google changes selectors

### 6.3 Data Migration

**Strategy:**
- Version storage schema (`version: 1`)
- Implement migration functions
- Backward compatibility for 2 versions
- Export/import for user safety

**Example:**
```javascript
async function migrateStorage(fromVersion, toVersion) {
  if (fromVersion === 1 && toVersion === 2) {
    // Migrate old structure to new
    const oldData = await chrome.storage.sync.get('eventColors');
    const newData = transformV1toV2(oldData);
    await chrome.storage.sync.set(newData);
  }
}
```

---

## Phase 7: Testing Strategy

### Unit Tests
- Storage service CRUD operations
- Event ID encoding/decoding
- Color palette management
- Scenario detection logic

### Integration Tests
- Color picker injection in both scenarios
- Color rendering across calendar views
- Recurring event handling
- New event creation flow

### Manual Test Cases

**Test Case 1: Color Existing Event**
1. Open Google Calendar
2. Click existing event
3. Verify ColorKit palettes appear below Google colors
4. Select custom color
5. Verify checkmark appears
6. Close modal
7. Verify event has custom color on calendar
8. Refresh page
9. Verify color persists

**Test Case 2: Create New Event with Color**
1. Click "+ Create" button
2. Verify ColorKit palettes appear
3. Select custom color before adding details
4. Fill in event name, time
5. Click "Save"
6. Verify event appears with selected color
7. Verify color stored in chrome.storage

**Test Case 3: Recurring Event**
1. Color a recurring event
2. Verify dialog appears with options
3. Select "All events in series"
4. Verify all instances colored
5. Color one instance with "This event only"
6. Verify only that instance changes

---

## Phase 8: Documentation

### User Guide
- How to create color palettes
- How to color events
- How to manage recurring events
- How to import/export palettes

### Developer Docs
- Architecture overview
- Storage schema
- Adding new features
- Debugging tips

### API Reference
- Storage service methods
- Event ID utilities
- DOM selector utilities

---

## Implementation Priority

### CRITICAL (Do First)
1. ✅ Event color storage system
2. ✅ Color picker injection (EVENTEDIT)
3. ✅ Color renderer
4. ✅ New event modal support

### HIGH (Do Next)
5. ✅ Popup UI for palette management
6. ✅ Recurring event dialog
7. ✅ Performance optimization

### MEDIUM (After Launch)
8. ⏳ Calendar-level default colors
9. ⏳ Advanced styling (text/border colors)
10. ⏳ Color presets library

### LOW (Future)
11. ⏳ Smart coloring rules
12. ⏳ Analytics/usage tracking
13. ⏳ Mobile web support

---

## Risk Assessment

### High Risk
❌ **Google Calendar DOM changes**
- Mitigation: Maintain multiple selector strategies
- Fallback: Show error message + link to report issue

❌ **Storage quota exceeded**
- Mitigation: Implement auto-cleanup of old events
- Fallback: Warn user + provide cleanup tool

### Medium Risk
⚠️ **Performance with large event volumes**
- Mitigation: Pagination, lazy loading
- Monitoring: Add performance tracking

⚠️ **Conflicts with other extensions**
- Mitigation: Unique class names, careful injection
- Testing: Test with popular calendar extensions

### Low Risk
⚡ **Browser compatibility issues**
- Mitigation: Target Chrome 121+ only
- Documentation: Clear browser requirements

---

## Success Metrics

### Adoption
- 80% of users enable event coloring within 7 days
- Average 3+ color palettes created per user
- 50+ events colored per user per month

### Performance
- <100ms color picker injection
- <50ms per event rendering
- <5% CPU usage during scrolling
- 0 crashes related to event coloring

### User Satisfaction
- <2% negative feedback on event coloring
- >4.5/5 rating for feature
- <1% disable rate after 30 days

---

## Next Steps

1. **Review & Approve Plan** - Get stakeholder sign-off
2. **Set Up Dev Environment** - Create feature branch
3. **Build Storage Foundation** - Implement storage service
4. **Prototype Color Picker** - Build minimal MVP
5. **User Testing** - Get feedback on prototype
6. **Iterate** - Refine based on feedback
7. **Launch** - Roll out to beta users
8. **Monitor** - Track metrics and bugs
9. **Iterate** - Add future enhancements

---

## Conclusion

This integration will transform ColorKit into a comprehensive calendar customization tool, expanding beyond tasks to full event management. By carefully planning the architecture, UI, and implementation phases, we can deliver a high-quality feature that enhances user productivity without sacrificing performance or reliability.

**Estimated Timeline:** 6 weeks for MVP, 12 weeks for full feature set
**Estimated Effort:** 200-300 developer hours
**Priority:** HIGH (high user demand for event coloring)

---

*Document Version: 1.0*
*Last Updated: 2025-12-11*
*Author: ColorKit Development Team*
