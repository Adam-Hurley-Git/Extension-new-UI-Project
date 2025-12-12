# Event Coloring - Issues Analysis and Fixes

## Problem Statement

1. **Labels not updating** in Google Calendar color picker
2. **Color count mismatch** between our UI (24 colors) and Google Calendar (11 colors)
3. **Mapping issues** between stored colors and displayed colors

## Root Cause Analysis

### Issue 1: Color Count Mismatch

**Our GOOGLE_COLORS array (24 colors):**
```javascript
[
  { hex: '#a4bdfc', default: 'Lavender' },
  { hex: '#7ae7bf', default: 'Sage' },
  { hex: '#dbadff', default: 'Grape' },
  { hex: '#ff887c', default: 'Flamingo' },
  { hex: '#fbd75b', default: 'Banana' },
  { hex: '#ffb878', default: 'Tangerine' },
  { hex: '#46d6db', default: 'Peacock' },
  { hex: '#e1e1e1', default: 'Graphite' },
  { hex: '#5484ed', default: 'Blueberry' },
  { hex: '#51b749', default: 'Basil' },
  { hex: '#dc2127', default: 'Tomato' },
  { hex: '#ff6d00', default: 'Mango' },
  { hex: '#fb00ff', default: 'Fuchsia' },
  { hex: '#0bd904', default: 'Lime' },
  { hex: '#8c5e00', default: 'Cocoa' },
  { hex: '#a37d00', default: 'Mustard' },
  { hex: '#e18700', default: 'Amber' },
  { hex: '#b73800', default: 'Rust' },
  { hex: '#f4c20d', default: 'Gold' },
  { hex: '#3f51b5', default: 'Indigo' },
  { hex: '#7986cb', default: 'Periwinkle' },
  { hex: '#039be5', default: 'Azure' },
  { hex: '#616161', default: 'Charcoal' },
  { hex: '#33b679', default: 'Emerald' }
]
```

**Actual Google Calendar colors (11 colors):**
Google Calendar uses 11 standard event colors. We need to verify which 11 of our 24 colors are actually used.

### Issue 2: Label Update Mechanism

**Current approach:**
1. User changes label in popup → Saved to `chrome.storage.sync`
2. Content script reads labels from storage
3. Content script tries to update Google Calendar UI using `data-text` attribute

**Problems:**
- Hex case sensitivity (storage uses lowercase, code uses uppercase)
- Wrong selector (need `div[jsname="Ly0WL"]`)
- Wrong attribute update target (need `.oMnJrf` element)

### Issue 3: Storage Format

**Current storage structure:**
```javascript
googleColorLabels: {
  '#a4bdfc': 'Custom Label 1',
  '#7ae7bf': 'Custom Label 2',
  // ... more colors
}
```

**Problem:** We're storing 24 colors but Google only shows 11.

## Required Fixes

### Fix 1: Correct GOOGLE_COLORS Array
- Reduce to 11 colors that Google Calendar actually uses
- Remove extra colors that don't exist in Google's picker

### Fix 2: Fix Label Update in Content Script
- ✅ Use correct selector: `div[jsname="Ly0WL"]`
- ✅ Read from `data-color` attribute
- ✅ Update `.oMnJrf` element's `data-text` attribute
- ✅ Normalize hex to lowercase

### Fix 3: Storage Consistency
- Ensure all hex values are lowercase throughout
- Only store/display the 11 colors Google actually uses

### Fix 4: UI Consistency
- Update grid to show only 11 colors in appropriate layout
- Adjust grid columns to fit 11 colors properly

## Implementation Plan

1. **Identify actual Google Calendar colors** - Need to check live Google Calendar
2. **Update GOOGLE_COLORS array** - Remove colors that don't exist
3. **Update storage functions** - Ensure consistency
4. **Update content script** - Fix label update mechanism (already done)
5. **Update UI** - Adjust grid for 11 colors
6. **Test end-to-end** - Verify labels update correctly

## Testing Checklist

- [ ] Verify exactly which 11 colors Google Calendar uses
- [ ] Update popup UI to show only those 11 colors
- [ ] Change a label in popup
- [ ] Open Google Calendar event color picker
- [ ] Verify custom label appears in color picker
- [ ] Verify all 11 colors have correct labels
