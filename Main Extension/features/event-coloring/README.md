# Event Coloring Feature

Custom color palettes for Google Calendar events - part of the ColorKit extension.

## 📁 Structure

```
event-coloring/
├── index.js                    # Main feature registration
├── storage.js                  # Storage service (event colors & palettes)
├── core/                       # Core functionality (TODO)
│   ├── colorPicker.js         # Color picker injection
│   ├── colorRenderer.js       # Event color rendering
│   └── recurringDialog.js     # Recurring event dialog
├── utils/                      # Utility modules
│   ├── domSelectors.js        # DOM selectors for Google Calendar
│   └── eventIdUtils.js        # Event ID parsing and matching
└── components/                 # UI components (TODO)
    ├── ColorButton.js
    ├── CategorySection.js
    └── RecurringDialog.js
```

## 🚀 Phase 1: Foundation (COMPLETE)

### ✅ Completed
- Storage service with CRUD operations
- Default color palette (ColorKit Essentials - 12 colors)
- DOM selector utilities
- Event ID utilities (parsing, matching, recurring detection)
- Feature registration module
- Basic color picker injection
- Event color rendering
- Manifest integration

### 🎨 Default Palette
**ColorKit Essentials** (12 colors):
- Primary Blue (#4285f4)
- Alert Red (#ea4335)
- Success Green (#34a853)
- Warning Yellow (#fbbc04)
- Vibrant Orange (#ff6d01)
- Deep Purple (#9c27b0)
- Hot Pink (#e91e63)
- Cyan (#00bcd4)
- Light Green (#8bc34a)
- Amber (#ff9800)
- Blue Grey (#607d8b)
- Brown (#795548)

## 🧪 Testing

To test the storage service in the browser console:

```javascript
// Initialize default palette
await window.eventColoringStorage.initializeDefaultPalette();

// Get all palettes
const palettes = await window.eventColoringStorage.getAllPalettes();
console.log('Palettes:', palettes);

// Save an event color
await window.eventColoringStorage.saveEventColor('test_event_123', '#4285f4', false);

// Get event color
const color = await window.eventColoringStorage.getEventColor('test_event_123');
console.log('Event color:', color);

// Get all event colors
const eventColors = await window.eventColoringStorage.getAllEventColors();
console.log('All event colors:', eventColors);

// Check storage quota
const quota = await window.eventColoringStorage.getStorageQuota();
console.log('Storage quota:', quota);
```

## 📋 Next Steps (Phase 2)

### Week 3: Dual Track Development

**Track A: New Event Support**
- [ ] Detect new event modal
- [ ] Hook into save flow
- [ ] Apply temp color after creation

**Track B: Recurring Events**
- [ ] Build recurring event dialog component
- [ ] Implement "This event" vs "All events" logic
- [ ] Pattern matching for series

## 🔧 API Reference

### Storage Service

#### Event Colors
```javascript
// Save color for event
await eventColoringStorage.saveEventColor(eventId, hex, isRecurring);

// Get color for event
const color = await eventColoringStorage.getEventColor(eventId);

// Remove color
await eventColoringStorage.removeEventColor(eventId);

// Save recurring event color
await eventColoringStorage.saveRecurringEventColor(baseEventId, hex);
```

#### Palettes
```javascript
// Initialize default palette
await eventColoringStorage.initializeDefaultPalette();

// Get all palettes
const palettes = await eventColoringStorage.getAllPalettes();

// Save palette
await eventColoringStorage.savePalette(paletteData);

// Delete palette
await eventColoringStorage.deletePalette(paletteId);
```

### DOM Selectors

```javascript
// Detect scenario
const scenario = eventColoringSelectors.detectScenario();

// Find color picker
const picker = eventColoringSelectors.findColorPickerContainer(scenario);

// Extract event ID
const eventId = eventColoringSelectors.extractEventId(element, scenario);

// Toggle checkmark
eventColoringSelectors.toggleCheckmark(button, true);
```

### Event ID Utils

```javascript
// Parse event ID
const parsed = eventColoringIdUtils.parseEventId(eventId);

// Check if recurring
const isRecurring = eventColoringIdUtils.isRecurringEvent(eventId);

// Get base event ID
const baseId = eventColoringIdUtils.getBaseEventId(eventId);

// Temp selection (for new events)
eventColoringIdUtils.setTempColorSelection(hex);
const temp = eventColoringIdUtils.getTempColorSelection();
```

## 🎯 Current Status

**✅ Phase 1 Complete**: Foundation with working storage and basic injection
**🚧 Phase 2 In Progress**: New event + recurring event support
**⏳ Phase 3 Planned**: Full UI with palette management

## 📝 Notes

- Storage uses `chrome.storage.sync` for cross-device sync
- Quota: ~100KB (~2000 events capacity)
- Auto-cleanup not yet implemented (Phase 3)
- Recurring event dialog not yet implemented (Phase 2)
- New event save hook not yet implemented (Phase 2)
