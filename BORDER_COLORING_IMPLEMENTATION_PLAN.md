# Task Border Coloring Implementation Plan

## Executive Summary
Implementing visible border coloring for Google Calendar tasks using the **outline method**. The previous implementation used `border-color` which was ineffective because Google Calendar task elements have `border-width: 0px` or `border-style: none`.

## Problem Analysis

### Root Cause
From console logs and DevTools verification:
- `getComputedStyle($0).borderTopWidth` returns `"0px"` or `""`
- `getComputedStyle($0).borderTopStyle` returns `"none"`
- Setting `border-color` alone has no visual effect without a border width/style

### DevTools Verification Results
```javascript
// Verified working solutions:
$0.style.setProperty('outline', '2px solid #aa00ff', 'important');
$0.style.setProperty('outline-offset', '-2px', 'important');
// ✅ Creates visible border on both old and new UI tasks

// Confirmed box-shadow is safe to use:
getComputedStyle($0).boxShadow === 'none'
// No conflicts with Google's styling
```

## Current Implementation Status

### ✅ Already Implemented (Working)
1. **Storage Layer** (`lib/storage.js`):
   - `setTaskListBorderColor(listId, color)` - Line 756
   - `clearTaskListBorderColor(listId)` - Line 774
   - `getTaskListBorderColors()` - Line 786
   - Functions exported at lines 1831, 1834, 1837

2. **UI Layer** (`popup/popup.js` & `popup/popup.html`):
   - Border color swatch display
   - Border color picker controls
   - Integration with list coloring UI
   - Reset functionality includes border colors

3. **Cache System** (`features/tasks-coloring/index.js`):
   - `listBorderColorsCache` variable
   - Border colors fetched in `refreshColorCache()`
   - Border color passed through color resolution logic

4. **Skip Repaint Logic** (`applyPaintIfNeeded()`):
   - Already compares `currentBorder` vs `desiredBorder` (line 1934)
   - Prevents unnecessary repaints when border matches
   - ✅ **This is correctly implemented**

### ❌ Needs Fixing (Not Working)

1. **applyPaint() Function** (lines 1789-1919):
   - **Problem**: Uses `border-color` property (lines 1851, 1869)
   - **Fix Needed**: Switch to outline-based rendering

2. **clearPaint() Function** (lines 1683-1727):
   - **Problem**: Restores `border-color` (lines 1693-1697)
   - **Fix Needed**: Restore outline properties instead

## Implementation Solution: Outline Method

### Why Outline?
1. **No layout shift**: outline doesn't affect element dimensions
2. **Always visible**: doesn't require border-width or border-style
3. **Proven working**: verified in DevTools on both UI types
4. **Clean separation**: doesn't conflict with Google's potential future box-shadow usage

### Technical Approach

#### Saved State Management
Store original Google outline values in dataset attributes:
- `data-cf-google-outline` - Original outline value
- `data-cf-google-outline-offset` - Original outline-offset value
- `data-cf-task-border-color` - Applied border color (for skip logic)

#### Rendering Strategy
```javascript
// Save originals once
if (node.dataset.cfGoogleOutline === undefined) {
  const cs = getComputedStyle(node);
  node.dataset.cfGoogleOutline = cs.outline || '';
  node.dataset.cfGoogleOutlineOffset = cs.outlineOffset || '';
}

// Apply visible border
const borderColorToApply = borderColorOverride || bgColorValue;
node.style.setProperty('outline', `2px solid ${borderColorToApply}`, 'important');
node.style.setProperty('outline-offset', '-2px', 'important');
node.dataset.cfTaskBorderColor = borderColorToApply.toLowerCase();
```

#### Restoration Strategy
```javascript
// Restore outline
if (node.dataset.cfGoogleOutline !== undefined) {
  const o = node.dataset.cfGoogleOutline;
  if (o && o !== 'none') {
    node.style.setProperty('outline', o, 'important');
  } else {
    node.style.removeProperty('outline');
  }
  delete node.dataset.cfGoogleOutline;
}

// Restore outline-offset
if (node.dataset.cfGoogleOutlineOffset !== undefined) {
  const oo = node.dataset.cfGoogleOutlineOffset;
  if (oo) {
    node.style.setProperty('outline-offset', oo, 'important');
  } else {
    node.style.removeProperty('outline-offset');
  }
  delete node.dataset.cfGoogleOutlineOffset;
}

delete node.dataset.cfTaskBorderColor;
```

## Files to Modify

### 1. `/Main Extension/features/tasks-coloring/index.js`

#### Changes to `applyPaint()` function (lines 1847-1876):

**REPLACE:** Lines 1847-1851 (bgOpacity > 0 branch)
```javascript
// OLD - doesn't work:
const borderColorToApply = borderColorOverride || bgColorValue;
console.log('[TaskColoring] Applying border color (bgOpacity > 0):', borderColorToApply, 'override was:', borderColorOverride);
node.dataset.cfTaskBorderColor = borderColorToApply;
node.style.setProperty('border-color', borderColorToApply, 'important');
```

**WITH:**
```javascript
// NEW - outline method:
const borderColorToApply = borderColorOverride || bgColorValue;
console.log('[TaskColoring] Applying border via outline (bgOpacity > 0):', borderColorToApply, 'override was:', borderColorOverride);

// Save original outline once
if (node.dataset.cfGoogleOutline === undefined) {
  const cs = getComputedStyle(node);
  node.dataset.cfGoogleOutline = cs.outline || '';
  node.dataset.cfGoogleOutlineOffset = cs.outlineOffset || '';
}

// Apply visible border using outline
node.style.setProperty('outline', `2px solid ${borderColorToApply}`, 'important');
node.style.setProperty('outline-offset', '-2px', 'important');
node.dataset.cfTaskBorderColor = borderColorToApply.toLowerCase();
```

**REPLACE:** Lines 1866-1876 (bgOpacity = 0 branch)
```javascript
// OLD - doesn't work:
if (borderColorOverride) {
  console.log('[TaskColoring] Applying border color (bgOpacity = 0):', borderColorOverride);
  node.dataset.cfTaskBorderColor = borderColorOverride;
  node.style.setProperty('border-color', borderColorOverride, 'important');
} else if (node.dataset.cfGoogleBorder) {
  node.style.setProperty('border-color', node.dataset.cfGoogleBorder, 'important');
  delete node.dataset.cfTaskBorderColor;
} else {
  node.style.removeProperty('border-color');
  delete node.dataset.cfTaskBorderColor;
}
```

**WITH:**
```javascript
// NEW - outline method:
if (borderColorOverride) {
  console.log('[TaskColoring] Applying border via outline (bgOpacity = 0):', borderColorOverride);

  // Save original outline once
  if (node.dataset.cfGoogleOutline === undefined) {
    const cs = getComputedStyle(node);
    node.dataset.cfGoogleOutline = cs.outline || '';
    node.dataset.cfGoogleOutlineOffset = cs.outlineOffset || '';
  }

  // Apply visible border using outline
  node.style.setProperty('outline', `2px solid ${borderColorOverride}`, 'important');
  node.style.setProperty('outline-offset', '-2px', 'important');
  node.dataset.cfTaskBorderColor = borderColorOverride.toLowerCase();
} else {
  // No custom border - restore Google's default outline
  if (node.dataset.cfGoogleOutline !== undefined) {
    const o = node.dataset.cfGoogleOutline;
    if (o && o !== 'none') {
      node.style.setProperty('outline', o, 'important');
    } else {
      node.style.removeProperty('outline');
    }
    delete node.dataset.cfGoogleOutline;
  }

  if (node.dataset.cfGoogleOutlineOffset !== undefined) {
    const oo = node.dataset.cfGoogleOutlineOffset;
    if (oo) {
      node.style.setProperty('outline-offset', oo, 'important');
    } else {
      node.style.removeProperty('outline-offset');
    }
    delete node.dataset.cfGoogleOutlineOffset;
  }

  delete node.dataset.cfTaskBorderColor;
}
```

#### Changes to `clearPaint()` function (lines 1693-1697):

**REPLACE:**
```javascript
if (node.dataset.cfGoogleBorder) {
  node.style.setProperty('border-color', node.dataset.cfGoogleBorder, 'important');
} else {
  node.style.removeProperty('border-color');
}
```

**WITH:**
```javascript
// Restore outline
if (node.dataset.cfGoogleOutline !== undefined) {
  const o = node.dataset.cfGoogleOutline;
  if (o && o !== 'none') {
    node.style.setProperty('outline', o, 'important');
  } else {
    node.style.removeProperty('outline');
  }
  delete node.dataset.cfGoogleOutline;
}

// Restore outline-offset
if (node.dataset.cfGoogleOutlineOffset !== undefined) {
  const oo = node.dataset.cfGoogleOutlineOffset;
  if (oo) {
    node.style.setProperty('outline-offset', oo, 'important');
  } else {
    node.style.removeProperty('outline-offset');
  }
  delete node.dataset.cfGoogleOutlineOffset;
}
```

## Data Flow Analysis

### 1. Storage → Cache Flow
```
User sets border color in popup
↓
setTaskListBorderColor(listId, color)
↓
chrome.storage.sync.set({'cf.taskListBorderColors': {...}})
↓
Extension sends message: {type: 'TASK_LISTS_UPDATED'}
↓
Content script receives message
↓
invalidateColorCache()
↓
refreshColorCache() fetches cf.taskListBorderColors
↓
listBorderColorsCache populated
```

### 2. Cache → Rendering Flow
```
Task detected on page
↓
getTaskIdFromChip(element)
↓
taskToListMap[taskId] → listId
↓
listBorderColorsCache[listId] → borderColor
↓
buildColorInfo({pendingBorderColor: borderColor, ...})
↓
{backgroundColor, textColor, borderColor, ...}
↓
applyPaintIfNeeded(node, colors)
↓
Check if border changed (currentBorder vs desiredBorder)
↓
applyPaint(node, color, text, bgOp, textOp, isCompleted, borderColor)
↓
Apply outline with borderColor
```

### 3. Clear/Unpaint Flow
```
User clears border color or resets list
↓
clearTaskListBorderColor(listId)
↓
Storage cleared
↓
TASK_LISTS_UPDATED message
↓
invalidateColorCache()
↓
refreshColorCache() (borderColors now empty for that list)
↓
applyPaintIfNeeded sees borderColor = null
↓
applyPaint with borderColorOverride = null
↓
clearPaint() restores Google's outline
```

## Testing Plan

### Test Cases

1. **Set border color on list with background color**
   - Expected: Outline visible around task chip
   - Verify: `getComputedStyle($0).outline` shows color
   - Verify: `getComputedStyle($0).outlineOffset` = "-2px"

2. **Set border color on list without background color (bgOpacity = 0)**
   - Expected: Outline visible, background transparent
   - Verify: Custom border shows, Google's bg preserved

3. **Change border color while task already painted**
   - Expected: Skip repaint logic properly detects border change
   - Expected: New border color applied without flickering

4. **Clear border color**
   - Expected: Google's original outline restored
   - Verify: No outline remnants, clean restoration

5. **Task completion with border color**
   - Expected: Border persists through completion opacity changes
   - Verify: Completed task styling doesn't break border

6. **Both old UI (recurring) and new UI tasks**
   - Expected: Outline works on both `.GTG3wb` elements
   - Verify: No visual differences or bugs

### Console Verification
After implementation, run:
```javascript
// Select a colored task
getComputedStyle($0).outline
// Should see: "rgb(170, 0, 255) solid 2px"

getComputedStyle($0).outlineOffset
// Should see: "-2px"

$0.dataset.cfTaskBorderColor
// Should see: color value in lowercase
```

## Edge Cases Handled

1. **Google adds outline in future**: Saved in dataset, restored on clear
2. **bgOpacity = 0 with border**: Border still applies (lines 1866-1876 logic)
3. **Border color same as background**: Visual effect still distinct due to outline
4. **Task dragging/moving**: Border persists through DOM manipulation
5. **Multiple rapid color changes**: Skip logic prevents redundant paints

## Alternative Considered: box-shadow inset

### Why Not Used
While `box-shadow: inset 0 0 0 2px ${color}` also works, outline is preferred because:
- Simpler (2 properties vs shadow composition logic)
- No risk of shadow stacking bugs if Google adds shadows later
- outline explicitly designed for this use case
- Easier to debug in DevTools

### Implementation if needed
Available as fallback if outline causes issues:
```javascript
const stroke = `inset 0 0 0 2px ${borderColorToApply}`;
const baseShadow = node.dataset.cfGoogleBoxShadow || 'none';
const combined = baseShadow !== 'none' ? `${stroke}, ${baseShadow}` : stroke;
node.style.setProperty('box-shadow', combined, 'important');
```

## Success Criteria

- ✅ Border color visible on task chips (both UI types)
- ✅ No layout shift or flickering
- ✅ Skip repaint logic working (no redundant paints)
- ✅ Clean restoration when border removed
- ✅ Compatible with all opacity and completion states
- ✅ Original Google styling preserved and restorable
- ✅ Console logs show outline application
- ✅ No errors in browser console

## Implementation Checklist

- [ ] Update `applyPaint()` function (lines 1847-1876)
- [ ] Update `clearPaint()` function (lines 1693-1697)
- [ ] Verify `applyPaintIfNeeded()` skip logic (already correct)
- [ ] Test with old UI recurring tasks
- [ ] Test with new UI tasks
- [ ] Test border color changes
- [ ] Test border color clear
- [ ] Test with various opacity settings
- [ ] Verify console logs show outline application
- [ ] Check DevTools computed styles
- [ ] Commit changes with descriptive message
- [ ] Push to branch `claude/add-task-border-coloring-8HXmO`
