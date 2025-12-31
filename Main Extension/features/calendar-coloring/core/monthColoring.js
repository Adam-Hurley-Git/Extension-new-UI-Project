// LOCKED CALENDAR COLORING FEATURE - DO NOT MODIFY
// This module contains the month view coloring functionality
// All changes to calendar coloring should be made here only

// Month view painter
// Colors the grid cells ([role="gridcell"]) by mapping the 7 columns → weekdays.
// Safe for locales / Monday-or-Sunday week start. No event-chip dependency.

let monthMo = null;
let resizeBound = false;

// idempotent clear - only clear div.MGaLHf.ChfiMc elements (NOT gridcells)
function clearMonthColors() {
  document.querySelectorAll('div.MGaLHf.ChfiMc[data-gce-month-painted="1"]').forEach((el) => {
    el.style.backgroundColor = '';
    el.removeAttribute('data-gce-month-painted');
  });
  console.log('CC3 Month Coloring: Cleared div.MGaLHf.ChfiMc elements only');
}

function isLikelyMonthViewRoot() {
  // The month grid is a [role="grid"] with many [role="gridcell"] entries.
  const grid = document.querySelector('div[role="grid"]');
  if (!grid) return null;
  const cells = grid.querySelectorAll('[role="gridcell"]');
  if (cells.length >= 35) return grid; // month usually 35-42 cells
  return null;
}

function selectMonthCells() {
  // Target ONLY the div.MGaLHf.ChfiMc elements (day squares) - NOT gridcells
  const daySquares = Array.from(document.querySelectorAll('div.MGaLHf.ChfiMc')).filter((c) => c.offsetParent !== null);
  console.log(`CC3 Month Coloring: Found ${daySquares.length} div.MGaLHf.ChfiMc elements`);

  // Handle both 5-column (weekends hidden) and 7-column (weekends shown) layouts
  // 5 columns = ~25 cells, 7 columns = ~35 cells
  const minCells = daySquares.length >= 25 ? 25 : 35;
  return daySquares.length >= minCells ? daySquares : [];
}

function getDaySquare(cell) {
  // Since we're now targeting div.MGaLHf.ChfiMc directly, return the cell itself
  return cell;
}

// -------- NEW: Column headers → weekday map (most reliable) -----------------
function textToWeekdayIndex(txt) {
  if (!txt) return null;
  const t = txt.trim().toLowerCase();
  // Try English/short forms first; aria-labels are usually full day names in locale.
  const map = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    tues: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    thurs: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
  };
  if (t in map) return map[t];
  // For other locales, rely on Date parsing trick: find next occurrence of that label in aria-label if possible.
  // If we can't confidently map, return null and let fallback handle it.
  return null;
}

function headerColumnWeekdayMap() {
  // Month grid usually has 7 column headers with role="columnheader".
  const headers = Array.from(document.querySelectorAll('[role="columnheader"]')).filter((h) => h.offsetParent !== null);
  if (headers.length < 7) return null;

  // Sort by x-position to get visual order
  const items = headers
    .map((h) => {
      const r = h.getBoundingClientRect();
      return { el: h, center: (r.left + r.right) / 2 };
    })
    .sort((a, b) => a.center - b.center)
    .slice(0, 7);

  const arr = new Array(7).fill(null);
  for (let i = 0; i < items.length; i++) {
    const h = items[i].el;
    const w = textToWeekdayIndex(h.getAttribute('aria-label')) ?? textToWeekdayIndex(h.textContent || '');
    if (w === null) return null; // unknown locale → bail and let fallback handle it
    arr[i] = w;
  }
  return arr.every((v) => v !== null) ? arr : null;
}

// --- NEW: Robust weekday extraction per gridcell -----------------------------
function parseDateFromAriaLabel(aria) {
  console.log('CC3 Month: parseDateFromAriaLabel input:', aria);

  if (!aria) {
    console.log('CC3 Month: aria is null/undefined');
    return null;
  }

  // Works for many locales (e.g., "Tuesday, September 2, 2025" or without year).
  // Let Date try first:
  const d1 = new Date(aria);
  console.log('CC3 Month: Direct Date parse result:', d1, 'isValid:', !Number.isNaN(d1.getTime()));
  if (!Number.isNaN(d1.getTime())) return d1;

  // Try common Google Calendar formats:
  // "January 14, 2025" (month name, day, year)
  const monthNameMatch = aria.match(/(\w+)\s+(\d{1,2}),?\s+(\d{4})/);
  if (monthNameMatch) {
    console.log('CC3 Month: Month name pattern matched:', monthNameMatch);
    const dateStr = `${monthNameMatch[1]} ${monthNameMatch[2]}, ${monthNameMatch[3]}`;
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      console.log('CC3 Month: Parsed from month name pattern:', d);
      return d;
    }
  }

  // Try: "14 January 2025" (day, month name, year)
  const dayFirstMatch = aria.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/);
  if (dayFirstMatch) {
    console.log('CC3 Month: Day-first pattern matched:', dayFirstMatch);
    const dateStr = `${dayFirstMatch[2]} ${dayFirstMatch[1]}, ${dayFirstMatch[3]}`;
    const d = new Date(dateStr);
    if (!Number.isNaN(d.getTime())) {
      console.log('CC3 Month: Parsed from day-first pattern:', d);
      return d;
    }
  }

  // Fallback: pick numeric pieces "dd", "mm" (month name not guaranteed parseable)
  // Common GCal aria-label often includes an ISO-like "2025" — try regex:
  const m = aria.match(/(\d{1,2})\D+(\d{1,2})\D+(\d{4})/); // dd .. mm .. yyyy
  if (m) {
    console.log('CC3 Month: Numeric pattern matched:', m);
    // Ambiguous order; try two orders safely:
    const [_, a, b, y] = m;
    const try1 = new Date(Number(y), Number(b) - 1, Number(a));
    if (!Number.isNaN(try1.getTime())) {
      console.log('CC3 Month: Parsed as dd/mm/yyyy:', try1);
      return try1;
    }
    const try2 = new Date(Number(y), Number(a) - 1, Number(b));
    if (!Number.isNaN(try2.getTime())) {
      console.log('CC3 Month: Parsed as mm/dd/yyyy:', try2);
      return try2;
    }
  }

  console.log('CC3 Month: Failed to parse aria-label');
  return null;
}

function getCellWeekday(cell) {
  // 0..6 Sun..Sat or null if unknown
  // 1) aria-label on gridcell
  const aria = cell.getAttribute('aria-label');
  if (aria) {
    const d = parseDateFromAriaLabel(aria);
    if (d && !Number.isNaN(d.getTime())) return d.getDay();
  }
  // 2) time[datetime] descendant (ISO)
  const t = cell.querySelector('time[datetime]');
  if (t && t.getAttribute('datetime')) {
    const d2 = new Date(t.getAttribute('datetime'));
    if (!Number.isNaN(d2.getTime())) return d2.getDay();
  }
  // 3) common data attributes Google sometimes emits
  // Try milliseconds since epoch if present
  const msAttr =
    cell.getAttribute('data-date') || cell.getAttribute('data-time') || cell.getAttribute('data-timestamp');
  if (msAttr && /^\d{10,13}$/.test(msAttr)) {
    const ms = msAttr.length === 13 ? Number(msAttr) : Number(msAttr) * 1000;
    const d3 = new Date(ms);
    if (!Number.isNaN(d3.getTime())) return d3.getDay();
  }
  return null;
}

// --- NEW: Get the day number from a cell -----------------------------
function getCellDayNumber(cell) {
  const DEBUG = true;
  // Extract the day number (1-31) from the cell content
  const daySquare = getDaySquare(cell);
  const text = daySquare.textContent?.trim();

  if (DEBUG) console.log('CC3 Month: getCellDayNumber - raw text:', text);

  // Try to extract a number from the text - be more flexible
  if (text) {
    // First try: number at start
    let match = text.match(/^(\d{1,2})/);
    if (match) {
      const dayNum = parseInt(match[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        if (DEBUG) console.log('CC3 Month: Found day number at start:', dayNum);
        return dayNum;
      }
    }

    // Second try: any number between 1-31 (first match)
    match = text.match(/\b(\d{1,2})\b/);
    if (match) {
      const dayNum = parseInt(match[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        if (DEBUG) console.log('CC3 Month: Found day number in text:', dayNum);
        return dayNum;
      }
    }
  }

  // Try to find the day number in a child element with specific class
  const dayNumberEl = cell.querySelector('[class*="number"], [class*="day-num"], span, div');
  if (dayNumberEl) {
    const numText = dayNumberEl.textContent?.trim();
    if (numText) {
      const match = numText.match(/^(\d{1,2})$/);
      if (match) {
        const dayNum = parseInt(match[1], 10);
        if (dayNum >= 1 && dayNum <= 31) {
          if (DEBUG) console.log('CC3 Month: Found day number in child element:', dayNum);
          return dayNum;
        }
      }
    }
  }

  // Fallback to data attributes
  const aria = cell.getAttribute('aria-label');
  if (aria) {
    const match = aria.match(/(?:^|\D)(\d{1,2})(?:\D|$)/);
    if (match) {
      const dayNum = parseInt(match[1], 10);
      if (dayNum >= 1 && dayNum <= 31) {
        if (DEBUG) console.log('CC3 Month: Found day number in aria:', dayNum);
        return dayNum;
      }
    }
  }

  if (DEBUG) console.log('CC3 Month: Could not extract day number from cell');
  return null;
}

function clusterColumns(cells) {
  // Use centerX and adaptive tolerance based on median column width
  const points = cells
    .map((c) => {
      const r = getDaySquare(c).getBoundingClientRect();
      return { c, left: r.left, right: r.right, center: (r.left + r.right) / 2 };
    })
    .sort((a, b) => a.center - b.center);

  // Estimate typical column width using median
  const widths = [];
  for (let i = 1; i < points.length; i++) {
    // only same-row neighbors; rough filter using similar top
    if (
      Math.abs(
        getDaySquare(points[i].c).getBoundingClientRect().top -
          getDaySquare(points[i - 1].c).getBoundingClientRect().top,
      ) < 4
    ) {
      widths.push(points[i].left - points[i - 1].left);
    }
  }
  const median = (arr) => {
    if (!arr.length) return 100; // sane default
    const s = [...arr].sort((x, y) => x - y);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const approxColWidth = Math.max(40, Math.min(400, median(widths) || 100));
  const tolerance = Math.max(4, Math.round(approxColWidth * 0.25)); // 25% of width

  const cols = [];
  for (const p of points) {
    const hit = cols.find((col) => Math.abs(col.center - p.center) <= tolerance);
    if (hit) hit.members.push(p.c);
    else cols.push({ center: p.center, members: [p.c] });
  }
  cols.sort((a, b) => a.center - b.center);
  // Return all columns found (could be 5 for weekends hidden, or 7 for weekends shown)
  return cols;
}

// --- NEW: Assign column position based on user's week start setting --------
function computeColumnPositionMap(cols, startWeekDay) {
  // Create a mapping from column index to weekday (0-6, Sun-Sat) based on user's week start setting
  const map = new Array(cols.length).fill(0);

  console.log(
    'CC3 Month Coloring: Computing column position map with startWeekDay:',
    startWeekDay,
    'for',
    cols.length,
    'columns',
  );

  if (cols.length === 5) {
    // When weekends are hidden, Google Calendar always shows Monday-Friday (weekdays 1-5)
    // Map columns 0-4 to weekdays 1-5 (Monday-Friday)
    for (let colIndex = 0; colIndex < 5; colIndex++) {
      const weekday = colIndex + 1; // Monday=1, Tuesday=2, Wednesday=3, Thursday=4, Friday=5
      map[colIndex] = weekday;
      console.log(
        `CC3 Month Coloring: Column ${colIndex} -> Weekday ${weekday} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday]}) - weekends hidden`,
      );
    }
  } else if (cols.length === 7) {
    // When weekends are shown, use the user's week start setting
    // startWeekDay: 0=Sunday, 1=Monday, 6=Saturday
    for (let colIndex = 0; colIndex < 7; colIndex++) {
      const weekday = (colIndex + startWeekDay) % 7;
      map[colIndex] = weekday;
      console.log(
        `CC3 Month Coloring: Column ${colIndex} -> Weekday ${weekday} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday]}) based on user setting`,
      );
    }
  }

  console.log('CC3 Month Coloring: Final column mapping:', map);
  return map;
}

// Helper function to convert hex color to rgba with opacity
function hexToRgba(hex, alpha) {
  if (!hex || hex === '#ffffff') return `rgba(255, 255, 255, ${alpha})`;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(255, 255, 255, ${alpha})`;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Helper to normalize date to YYYY-MM-DD format
function normalizeYmdFromDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Build a map of visual positions to dates by finding elements with date info
function buildDatePositionMap() {
  const DEBUG = true;
  const dateMap = {}; // "row-col" -> "YYYY-MM-DD"

  // Find all elements with data-date attribute in the calendar grid
  const grid = document.querySelector('div[role="grid"]');
  if (!grid) {
    if (DEBUG) console.log('CC3 Month: No grid found for date position map');
    return dateMap;
  }

  // Find all gridcells with date info
  const gridcells = grid.querySelectorAll('[role="gridcell"]');
  if (DEBUG) console.log('CC3 Month: Found gridcells:', gridcells.length);

  // Get bounding boxes and sort into rows/columns
  const cellData = [];
  gridcells.forEach((cell) => {
    const rect = cell.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Try to get date from this gridcell or its descendants
    let dateStr = cell.getAttribute('data-date');
    if (!dateStr) {
      const dateEl = cell.querySelector('[data-date]');
      if (dateEl) dateStr = dateEl.getAttribute('data-date');
    }
    if (!dateStr) {
      // Try aria-label
      const aria = cell.getAttribute('aria-label');
      if (aria) {
        const d = parseDateFromAriaLabel(aria);
        if (d && !Number.isNaN(d.getTime())) {
          dateStr = normalizeYmdFromDate(d);
        }
      }
    }

    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      cellData.push({
        date: dateStr,
        left: rect.left,
        top: rect.top,
        centerX: (rect.left + rect.right) / 2,
        centerY: (rect.top + rect.bottom) / 2,
      });
    }
  });

  if (DEBUG) console.log('CC3 Month: Gridcells with dates found:', cellData.length);

  // Also try to find date elements directly
  const dateElements = grid.querySelectorAll('[data-date]');
  dateElements.forEach((el) => {
    const dateStr = el.getAttribute('data-date');
    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        // Check if we already have this date
        const exists = cellData.some(c => c.date === dateStr);
        if (!exists) {
          cellData.push({
            date: dateStr,
            left: rect.left,
            top: rect.top,
            centerX: (rect.left + rect.right) / 2,
            centerY: (rect.top + rect.bottom) / 2,
          });
        }
      }
    }
  });

  if (DEBUG) console.log('CC3 Month: Total date entries:', cellData.length);
  if (cellData.length > 0) {
    if (DEBUG) console.log('CC3 Month: Sample dates:', cellData.slice(0, 3).map(c => c.date));
  }

  return cellData;
}

// Find the date for a cell by matching its position to known date positions
function findDateByPosition(cell, datePositions) {
  const DEBUG = true;
  if (!datePositions.length) return null;

  const rect = cell.getBoundingClientRect();
  const cellCenterX = (rect.left + rect.right) / 2;
  const cellCenterY = (rect.top + rect.bottom) / 2;

  // Find the closest date position
  let closestDate = null;
  let minDistance = Infinity;

  for (const pos of datePositions) {
    const dx = pos.centerX - cellCenterX;
    const dy = pos.centerY - cellCenterY;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < minDistance) {
      minDistance = distance;
      closestDate = pos.date;
    }
  }

  // Only accept if reasonably close (within 100px)
  if (minDistance < 100 && closestDate) {
    if (DEBUG) console.log(`CC3 Month: Position match found: ${closestDate} (distance: ${minDistance.toFixed(1)}px)`);
    return closestDate;
  }

  if (DEBUG) console.log(`CC3 Month: No position match found (closest was ${minDistance.toFixed(1)}px away)`);
  return null;
}

// Get ISO date string from a month cell
function getCellDateString(cell, currentMonthInfo, datePositions) {
  const DEBUG = true; // Enable debug logging for investigation

  if (DEBUG) console.log('CC3 Month: getCellDateString called for cell:', cell);

  // Try data-date attribute first (most reliable)
  const dateAttr = cell.getAttribute('data-date');
  if (DEBUG) console.log('CC3 Month: cell data-date attr:', dateAttr);
  if (dateAttr && /^\d{4}-\d{2}-\d{2}$/.test(dateAttr)) {
    return dateAttr;
  }

  // Try aria-label parsing on the cell itself
  const aria = cell.getAttribute('aria-label');
  if (DEBUG) console.log('CC3 Month: cell aria-label:', aria);
  if (aria) {
    const d = parseDateFromAriaLabel(aria);
    if (d && !Number.isNaN(d.getTime())) {
      const result = normalizeYmdFromDate(d);
      if (DEBUG) console.log('CC3 Month: Parsed from cell aria-label:', result);
      return result;
    }
  }

  // Try parent gridcell for aria-label (div.MGaLHf.ChfiMc is inside gridcell)
  const parentGridcell = cell.closest('[role="gridcell"]');
  if (DEBUG) console.log('CC3 Month: parentGridcell found:', !!parentGridcell, parentGridcell);
  if (parentGridcell) {
    const parentAria = parentGridcell.getAttribute('aria-label');
    if (DEBUG) console.log('CC3 Month: parent aria-label:', parentAria);
    if (parentAria) {
      const d = parseDateFromAriaLabel(parentAria);
      if (DEBUG) console.log('CC3 Month: Parsed date from parent aria:', d, 'isValid:', d && !Number.isNaN(d.getTime()));
      if (d && !Number.isNaN(d.getTime())) {
        const result = normalizeYmdFromDate(d);
        if (DEBUG) console.log('CC3 Month: Successfully parsed from parent aria-label:', result);
        return result;
      }
    }
    // Also try data-date on parent gridcell
    const parentDateAttr = parentGridcell.getAttribute('data-date');
    if (DEBUG) console.log('CC3 Month: parent data-date attr:', parentDateAttr);
    if (parentDateAttr && /^\d{4}-\d{2}-\d{2}$/.test(parentDateAttr)) {
      return parentDateAttr;
    }

    // Try to find ANY element with data-date within the gridcell
    const dateElInGridcell = parentGridcell.querySelector('[data-date]');
    if (dateElInGridcell) {
      const foundDate = dateElInGridcell.getAttribute('data-date');
      if (DEBUG) console.log('CC3 Month: Found data-date in gridcell child:', foundDate);
      if (foundDate && /^\d{4}-\d{2}-\d{2}$/.test(foundDate)) {
        return foundDate;
      }
    }
  }

  // NEW: Try position-based matching using pre-built date map
  if (datePositions && datePositions.length > 0) {
    if (DEBUG) console.log('CC3 Month: Trying position-based matching...');
    const positionMatch = findDateByPosition(cell, datePositions);
    if (positionMatch) {
      return positionMatch;
    }
  }

  // Try searching up the DOM tree for any element with date info
  let parent = cell.parentElement;
  let searchDepth = 0;
  while (parent && searchDepth < 5) {
    const ariaLabel = parent.getAttribute('aria-label');
    if (ariaLabel) {
      if (DEBUG) console.log(`CC3 Month: Found aria-label at depth ${searchDepth}:`, ariaLabel);
      const d = parseDateFromAriaLabel(ariaLabel);
      if (d && !Number.isNaN(d.getTime())) {
        return normalizeYmdFromDate(d);
      }
    }
    const dateAttr = parent.getAttribute('data-date');
    if (dateAttr && /^\d{4}-\d{2}-\d{2}$/.test(dateAttr)) {
      if (DEBUG) console.log(`CC3 Month: Found data-date at depth ${searchDepth}:`, dateAttr);
      return dateAttr;
    }
    parent = parent.parentElement;
    searchDepth++;
  }

  // Try to find date in descendant
  const dateEl = cell.querySelector('[data-date]');
  if (DEBUG) console.log('CC3 Month: descendant with data-date:', dateEl);
  if (dateEl) {
    const childDate = dateEl.getAttribute('data-date');
    if (childDate && /^\d{4}-\d{2}-\d{2}$/.test(childDate)) {
      return childDate;
    }
  }

  // Try time element
  const timeEl = cell.querySelector('time[datetime]');
  if (DEBUG) console.log('CC3 Month: time element:', timeEl);
  if (timeEl) {
    const datetime = timeEl.getAttribute('datetime');
    if (datetime) {
      const d = new Date(datetime);
      if (!Number.isNaN(d.getTime())) {
        return normalizeYmdFromDate(d);
      }
    }
  }

  // Fallback: Calculate date from day number + current month/year
  if (DEBUG) console.log('CC3 Month: Using calculation fallback. currentMonthInfo:', currentMonthInfo);
  if (currentMonthInfo) {
    const dayNumber = getCellDayNumber(cell);
    if (DEBUG) console.log('CC3 Month: Day number extracted:', dayNumber);
    if (dayNumber) {
      const calculatedDate = calculateCellDate(cell, dayNumber, currentMonthInfo);
      if (DEBUG) console.log('CC3 Month: Calculated date:', calculatedDate);
      return calculatedDate;
    }
  }

  if (DEBUG) console.log('CC3 Month: FAILED to get date string for cell');
  return null;
}

// Calculate the full date for a cell based on day number and position in grid
function calculateCellDate(cell, dayNumber, monthInfo) {
  const { year, month } = monthInfo;

  // Get the cell's row position to determine if it's from an adjacent month
  const rect = getDaySquare(cell).getBoundingClientRect();
  const allCells = selectMonthCells();
  if (!allCells.length) return null;

  // Sort cells by vertical position to find rows
  const sortedByY = allCells
    .map(c => ({ cell: c, top: getDaySquare(c).getBoundingClientRect().top }))
    .sort((a, b) => a.top - b.top);

  // Find unique row positions (with tolerance)
  const rowTops = [];
  for (const item of sortedByY) {
    if (!rowTops.length || Math.abs(item.top - rowTops[rowTops.length - 1]) > 10) {
      rowTops.push(item.top);
    }
  }

  // Determine which row this cell is in
  let rowIndex = 0;
  for (let i = 0; i < rowTops.length; i++) {
    if (Math.abs(rect.top - rowTops[i]) < 10) {
      rowIndex = i;
      break;
    }
  }

  const totalRows = rowTops.length;
  const isFirstRow = rowIndex === 0;
  const isLastRow = rowIndex === totalRows - 1;

  // Determine the actual month for this cell
  let actualYear = year;
  let actualMonth = month;

  if (isFirstRow && dayNumber > 20) {
    // High day numbers in first row = previous month
    actualMonth = month - 1;
    if (actualMonth < 0) {
      actualMonth = 11;
      actualYear = year - 1;
    }
  } else if (isLastRow && dayNumber < 15) {
    // Low day numbers in last row = next month
    actualMonth = month + 1;
    if (actualMonth > 11) {
      actualMonth = 0;
      actualYear = year + 1;
    }
  }

  // Create the date string
  const monthStr = String(actualMonth + 1).padStart(2, '0');
  const dayStr = String(dayNumber).padStart(2, '0');
  return `${actualYear}-${monthStr}-${dayStr}`;
}

// Get current month/year from URL
function getMonthYearFromURL() {
  const url = window.location.href;
  console.log('CC3 Month: getMonthYearFromURL - URL:', url);

  // Try multiple URL patterns that Google Calendar uses
  // Pattern 1: /r/month/YYYY/M/D or /month/YYYY/M/D
  let match = url.match(/\/(?:r\/)?month\/(\d{4})\/(\d{1,2})(?:\/\d{1,2})?/);
  if (match) {
    console.log('CC3 Month: Pattern 1 matched:', match);
    return {
      year: parseInt(match[1]),
      month: parseInt(match[2]) - 1 // JS months are 0-based
    };
  }

  // Pattern 2: ?date=YYYYMMDD
  match = url.match(/[?&]date=(\d{4})(\d{2})(\d{2})/);
  if (match) {
    console.log('CC3 Month: Pattern 2 (date param) matched:', match);
    return {
      year: parseInt(match[1]),
      month: parseInt(match[2]) - 1
    };
  }

  // Pattern 3: /u/0/r/month - just month view without date, use current date
  if (url.includes('/month')) {
    console.log('CC3 Month: URL contains /month but no date found, using current date');
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth()
    };
  }

  console.log('CC3 Month: No URL pattern matched, returning null');
  return null;
}

function applyMonthViewColors(userColors, opts) {
  const startWeekDay = opts?.assumeWeekStartsOn ?? 0; // 0=Sunday, 1=Monday, 6=Saturday
  const userOpacity = opts?.opacity || {};
  const dateColors = opts?.dateColors || {}; // Date-specific color overrides

  console.log('CC3 Month Coloring: applyMonthViewColors called');
  console.log('CC3 Month Coloring: userColors:', userColors);
  console.log('CC3 Month Coloring: opts:', opts);
  console.log('CC3 Month Coloring: dateColors received:', dateColors);
  console.log('CC3 Month Coloring: dateColors keys:', Object.keys(dateColors));

  const paint = () => {
    console.log('CC3 Month Coloring: paint() executing');
    clearMonthColors();
    const cells = selectMonthCells();
    console.log('CC3 Month Coloring: Total cells found:', cells.length);
    if (!cells.length) return;
    const cols = clusterColumns(cells);

    // Handle both 5-column (weekends hidden) and 7-column (weekends shown) layouts
    if (cols.length !== 5 && cols.length !== 7) {
      console.log(`CC3 Month Coloring: Unexpected column count: ${cols.length}, expected 5 or 7`);
      return;
    }

    console.log(
      `CC3 Month Coloring: Found ${cols.length} columns (weekends ${cols.length === 5 ? 'hidden' : 'shown'})`,
    );

    // Get current month/year for date calculation fallback
    const currentMonthInfo = getMonthYearFromURL();
    console.log('CC3 Month Coloring: Current month info:', currentMonthInfo);
    console.log('CC3 Month Coloring: Date colors to apply:', dateColors);
    console.log('CC3 Month Coloring: Number of date colors:', Object.keys(dateColors).length);

    // Build a position-based date map from gridcells with date info
    const datePositions = buildDatePositionMap();
    console.log('CC3 Month Coloring: Built date position map with', datePositions.length, 'entries');

    // Compute column position map based on day numbers
    const colToPosition = computeColumnPositionMap(cols, startWeekDay);

    let dateSpecificCount = 0;
    let cellsProcessed = 0;

    cols.forEach((col, cIdx) => {
      const weekday = colToPosition[cIdx];
      const defaultColor = userColors[weekday];
      const defaultOpacity = userOpacity[weekday] || 30; // Default to 30% if not set

      for (const cell of col.members) {
        cellsProcessed++;
        // Try to get date-specific color first (now with position-based matching)
        const cellDateStr = getCellDateString(cell, currentMonthInfo, datePositions);
        let color = defaultColor;
        let opacity = defaultOpacity;
        let isDateSpecific = false;

        // Log every cell's date detection
        if (cellsProcessed <= 5 || (cellDateStr && dateColors[cellDateStr])) {
          console.log(`CC3 Month Coloring: Cell ${cellsProcessed} dateStr:`, cellDateStr,
            'Has date-specific color:', cellDateStr && !!dateColors[cellDateStr]);
        }

        if (cellDateStr && dateColors[cellDateStr]) {
          color = dateColors[cellDateStr];
          opacity = 30; // Default opacity for date-specific colors
          isDateSpecific = true;
          dateSpecificCount++;
          console.log(`CC3 Month Coloring: ✅ APPLYING date-specific color for ${cellDateStr}:`, color);
        }

        if (!color) continue;

        // Convert hex color to rgba with opacity
        const rgba = hexToRgba(color, opacity / 100);

        // Apply color with opacity to the div.MGaLHf.ChfiMc background
        cell.style.setProperty('background-color', rgba, 'important');
        cell.setAttribute('data-gce-month-painted', '1');
        if (isDateSpecific) {
          cell.setAttribute('data-gce-date-colored', cellDateStr);
        }
      }
    });

    console.log(`CC3 Month Coloring: Finished. Cells processed: ${cellsProcessed}, Date-specific colors applied: ${dateSpecificCount}`);
  };

  // Paint now
  // Double-RAF to avoid painting during GCal's transition frame
  requestAnimationFrame(() => requestAnimationFrame(paint));

  // Observe DOM churn inside the month grid (navigation, redraws)
  const root = isLikelyMonthViewRoot() ?? document.body;
  if (monthMo) monthMo.disconnect();
  monthMo = new MutationObserver(() => {
    cancelAnimationFrame(paint.__raf || 0);
    paint.__raf = requestAnimationFrame(() => {
      // settle one more frame after layout
      requestAnimationFrame(paint);
    });
  });
  monthMo.observe(root, { childList: true, subtree: true, attributes: true });

  // Repaint on resize (column positions shift)
  if (!resizeBound) {
    window.addEventListener(
      'resize',
      () => {
        cancelAnimationFrame(paint.__raf || 0);
        paint.__raf = requestAnimationFrame(paint);
      },
      { passive: true },
    );
    resizeBound = true;
  }
}

function teardownMonthPainter() {
  if (monthMo) {
    monthMo.disconnect();
    monthMo = null;
  }
  clearMonthColors();
}

// Export functions for use in the feature system
window.cc3MonthColoring = {
  applyMonthViewColors,
  teardownMonthPainter,
  clearMonthColors,
};
