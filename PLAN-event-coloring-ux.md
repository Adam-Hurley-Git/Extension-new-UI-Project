# Event Coloring UI - Visual Separation Improvement Plan

## Current Problem Analysis

The Event Coloring section contains **5 distinct subsections** that all blend together:

1. **Enable Toggle** - Master on/off switch
2. **Calendar Default Colors** - Per-calendar color defaults
3. **Google Color Labels** - Labels for Google's built-in colors
4. **Custom Event Color Categories** - User-created color groups
5. **Event Color Templates** - Saved complete color styles

### Current Issues:
- All sections flow together with minimal visual separation
- Info cards all have nearly identical styling (only differ by icon accent color)
- No clear hierarchy between sections
- Hard to scan and understand the structure at a glance
- Related sections (Categories + Templates) aren't visually grouped
- Users can get lost scrolling through the dense content

---

## Proposed Solution: Grouped Panels with Visual Hierarchy

### Strategy: Create 3 Distinct Visual Groups

Group the 5 sections into **3 logical panels**:

```
┌─────────────────────────────────────────────────┐
│ ⚙️ SETTINGS (subtle gray background)            │
│   └─ Enable Toggle                              │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ 🎨 GOOGLE CALENDAR COLORS (white with blue      │
│    left accent border)                          │
│   ├─ Calendar Default Colors                    │
│   └─ Google Color Labels                        │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│ ✨ YOUR CUSTOM COLORS (white with pink/purple   │
│    gradient left accent border)                 │
│   ├─ Custom Event Color Categories              │
│   └─ Event Color Templates                      │
└─────────────────────────────────────────────────┘
```

---

## Detailed Implementation

### 1. Wrapper Panel Styling

Add container panels for each group with:
- Distinct background colors (subtle tints)
- Left accent border to color-code sections
- Rounded corners
- Clear section headers
- Subtle shadows for depth

```css
/* Group 1: Settings - Neutral */
.ec-group-settings {
  background: #f8f9fa;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}

/* Group 2: Google Colors - Blue accent */
.ec-group-google {
  background: #fff;
  border-radius: 12px;
  border-left: 4px solid #1a73e8;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}

/* Group 3: Custom Colors - Gradient accent */
.ec-group-custom {
  background: #fff;
  border-radius: 12px;
  border-left: 4px solid transparent;
  border-image: linear-gradient(180deg, #ec4899, #8b5cf6) 1;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.08);
}
```

### 2. Group Headers

Add clear section headers for each group:

```html
<!-- Google Colors Group Header -->
<div class="ec-group-header">
  <div class="ec-group-icon" style="background: #e8f0fe;">
    <svg><!-- Google colors icon --></svg>
  </div>
  <div class="ec-group-title">
    <h4>Google Calendar Colors</h4>
    <p>Configure default calendar colors and add labels to Google's built-in event colors</p>
  </div>
</div>
```

### 3. Internal Dividers

Within each group, use subtle horizontal dividers between subsections:

```css
.ec-subsection {
  padding: 16px 0;
  border-bottom: 1px dashed #e8eaed;
}

.ec-subsection:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
```

### 4. Subsection Labels

Add mini-headers for each subsection:

```css
.ec-subsection-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: #5f6368;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.ec-subsection-label::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.5;
}
```

---

## Visual Mockup (ASCII)

```
┌─ Event Coloring ────────────────────────────────┐
│                                                 │
│ ┌─ ⚙️ Settings ──────────────────────────────┐ │
│ │ [✓] Enable event coloring                  │ │
│ │     Apply custom colors to your events     │ │
│ └────────────────────────────────────────────┘ │
│                                                 │
│ ┌─ 🎨 Google Calendar Colors ─────────────────┐│
│ │  │                                         ││
│ │  │  • CALENDAR DEFAULTS                    ││
│ │  │    [Calendar list...]                   ││
│ │  │                                         ││
│ │  │  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  ││
│ │  │                                         ││
│ │  │  • GOOGLE COLOR LABELS                  ││
│ │  │    Scheme: [Modern ▾]                   ││
│ │  │    [Color grid...]                      ││
│ └──┴─────────────────────────────────────────┘ │
│                                                 │
│ ┌─ ✨ Your Custom Colors ─────────────────────┐│
│ │  │                                         ││
│ │  │  • CATEGORIES                           ││
│ │  │    [+ New Category]                     ││
│ │  │    [Category list...]                   ││
│ │  │                                         ││
│ │  │  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  ││
│ │  │                                         ││
│ │  │  • TEMPLATES                            ││
│ │  │    [+ New Template]                     ││
│ │  │    [Template list...]                   ││
│ └──┴─────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Alternative Options

### Option A: Collapsible Accordions
Make each group collapsible to reduce visual overload:
- Settings: Always expanded
- Google Colors: Collapsible (default expanded)
- Custom Colors: Collapsible (default expanded)

### Option B: Tabbed Interface
Replace the scroll layout with tabs:
- Tab 1: "Settings" (enable toggle)
- Tab 2: "Google Colors" (calendar defaults + labels)
- Tab 3: "Custom Colors" (categories + templates)

### Option C: Numbered Steps
Present as a guided setup flow:
1. Enable → 2. Configure Google Colors → 3. Add Custom Colors

---

## Recommended Approach

**Primary Recommendation: Grouped Panels (Strategy above)**

Why:
- Maintains single-scroll simplicity
- Clear visual hierarchy without hiding content
- Color-coded borders make scanning easy
- Groups logically related content
- Low implementation complexity
- Consistent with existing popup design language

**Enhancement: Add subtle collapse/expand for info cards**
- Keep info cards but make them start collapsed
- This reduces vertical space while keeping help accessible

---

## Implementation Checklist

- [ ] Create CSS classes for group containers (.ec-group-*)
- [ ] Wrap sections in appropriate group containers
- [ ] Add group headers with icons
- [ ] Add subsection labels with bullet indicators
- [ ] Add dashed dividers between subsections within groups
- [ ] Update info cards to be collapsed by default
- [ ] Test visual flow and spacing
- [ ] Verify dark mode compatibility (if applicable)
