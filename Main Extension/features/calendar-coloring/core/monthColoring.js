// Month View Coloring Module
// Uses data-datekey attributes for reliable date detection

let monthMo = null;
let resizeBound = false;

// ============================================================================
// DATEKEY SYSTEM - The robust solution for month view date detection
// ============================================================================

/**
 * Build a map from datekey to ISO date string (YYYY-MM-DD)
 *
 * Strategy:
 * 1. Find h2 elements with data-datekey that show month+day (class "avfuie")
 *    These are anchor points like "Dec 1" -> 28545
 * 2. Use sequential datekeys to fill in the rest
 * 3. Fallback: parse gridcell aria-labels for full dates
 */
function buildDateKeyMap() {
  const map = new Map();

  // Strategy 1: Find h2 elements with month+day text (class avfuie)
  const monthDayHeaders = document.querySelectorAll('h2[data-datekey].avfuie');

  for (const h2 of monthDayHeaders) {
    const dateKey = h2.getAttribute('data-datekey');
    const text = h2.textContent?.trim();

    if (dateKey && text) {
      const parsed = parseMonthDayText(text);
      if (parsed) {
        map.set(dateKey, parsed);
      }
    }
  }

  // Strategy 2: Parse gridcell aria-labels for full dates
  const gridcells = document.querySelectorAll('[role="gridcell"]');

  for (const cell of gridcells) {
    const ariaLabel = cell.getAttribute('aria-label');
    if (!ariaLabel) continue;

    const h2 = cell.querySelector('h2[data-datekey]') || cell.querySelector('[data-datekey]');
    if (!h2) continue;

    const dateKey = h2.getAttribute('data-datekey');
    if (!dateKey || map.has(dateKey)) continue;

    const parsed = parseDateFromAriaLabel(ariaLabel);
    if (parsed) {
      map.set(dateKey, parsed);
    }
  }

  // Strategy 3: Fill gaps using sequential datekeys
  if (map.size > 0) {
    fillDateKeyGaps(map);
  }

  return map;
}

/**
 * Parse month+day text like "Dec 1" or "Jan 15" to ISO date string
 */
function parseMonthDayText(text) {
  if (!text) return null;

  // Match patterns like "Dec 1", "January 15", etc.
  const monthNames = {
    jan: 0, january: 0,
    feb: 1, february: 1,
    mar: 2, march: 2,
    apr: 3, april: 3,
    may: 4,
    jun: 5, june: 5,
    jul: 6, july: 6,
    aug: 7, august: 7,
    sep: 8, sept: 8, september: 8,
    oct: 9, october: 9,
    nov: 10, november: 10,
    dec: 11, december: 11
  };

  const match = text.match(/^(\w+)\s+(\d{1,2})$/i);
  if (!match) return null;

  const monthStr = match[1].toLowerCase();
  const day = parseInt(match[2], 10);

  if (!(monthStr in monthNames) || day < 1 || day > 31) return null;

  const month = monthNames[monthStr];

  // Determine year from URL or current date
  const yearInfo = getYearFromContext();
  const year = yearInfo.year;

  // Handle year boundary (e.g., viewing January but anchor shows December)
  let actualYear = year;
  if (month === 11 && yearInfo.month <= 1) {
    // December shown while viewing Jan/Feb - previous year
    actualYear = year - 1;
  } else if (month <= 1 && yearInfo.month === 11) {
    // Jan/Feb shown while viewing December - next year
    actualYear = year + 1;
  }

  const monthPadded = String(month + 1).padStart(2, '0');
  const dayPadded = String(day).padStart(2, '0');

  return `${actualYear}-${monthPadded}-${dayPadded}`;
}

/**
 * Parse date from gridcell aria-label like "3 events, Monday, December 1"
 */
function parseDateFromAriaLabel(ariaLabel) {
  if (!ariaLabel) return null;

  // Try direct Date parsing first
  const d1 = new Date(ariaLabel);
  if (!Number.isNaN(d1.getTime())) {
    return normalizeYmdFromDate(d1);
  }

  // Try patterns like "Monday, December 1" or "Tuesday, January 15"
  const monthNames = {
    january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
    july: 6, august: 7, september: 8, october: 9, november: 10, december: 11
  };

  // Match "December 1" or "January 15" anywhere in the string
  for (const [name, monthIdx] of Object.entries(monthNames)) {
    const regex = new RegExp(`${name}\\s+(\\d{1,2})`, 'i');
    const match = ariaLabel.match(regex);
    if (match) {
      const day = parseInt(match[1], 10);
      if (day >= 1 && day <= 31) {
        const yearInfo = getYearFromContext();
        let year = yearInfo.year;

        // Handle year boundary
        if (monthIdx === 11 && yearInfo.month <= 1) {
          year = year - 1;
        } else if (monthIdx <= 1 && yearInfo.month === 11) {
          year = year + 1;
        }

        const monthPadded = String(monthIdx + 1).padStart(2, '0');
        const dayPadded = String(day).padStart(2, '0');
        return `${year}-${monthPadded}-${dayPadded}`;
      }
    }
  }

  return null;
}

/**
 * Fill gaps in the datekey map using sequential calculation
 */
function fillDateKeyGaps(map) {
  if (map.size === 0) return;

  // Find an anchor point (any entry in the map)
  const entries = Array.from(map.entries());
  const [anchorKey, anchorDate] = entries[0];
  const anchorKeyNum = parseInt(anchorKey, 10);
  const anchorDateObj = new Date(anchorDate + 'T00:00:00Z');

  // Find all datekey attributes in the DOM
  const allDateKeyElements = document.querySelectorAll('[data-datekey]');
  const allDateKeys = new Set();

  for (const el of allDateKeyElements) {
    const dk = el.getAttribute('data-datekey');
    if (dk) allDateKeys.add(dk);
  }

  // Fill in missing entries
  for (const dk of allDateKeys) {
    if (map.has(dk)) continue;

    const dkNum = parseInt(dk, 10);
    const daysDiff = dkNum - anchorKeyNum;

    const targetDate = new Date(anchorDateObj.getTime() + daysDiff * 24 * 60 * 60 * 1000);
    const isoDate = normalizeYmdFromDate(targetDate);

    map.set(dk, isoDate);
  }
}

/**
 * Get year and month from URL or current date
 */
function getYearFromContext() {
  const url = window.location.href;

  // Try URL patterns
  let match = url.match(/\/(?:r\/)?month\/(\d{4})\/(\d{1,2})/);
  if (match) {
    return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) - 1 };
  }

  match = url.match(/[?&]date=(\d{4})(\d{2})/);
  if (match) {
    return { year: parseInt(match[1], 10), month: parseInt(match[2], 10) - 1 };
  }

  // Fallback to current date
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

/**
 * Normalize Date object to YYYY-MM-DD string
 */
function normalizeYmdFromDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Get ISO date string from a cell's data-datekey attribute
 * This is the ONLY method we need - simple and reliable!
 */
function getCellDateString(cell, dateKeyMap) {
  const dateKey = cell.getAttribute('data-datekey');
  if (!dateKey) return null;

  return dateKeyMap.get(dateKey) || null;
}

// ============================================================================
// WEEKDAY COLORING (unchanged - works fine)
// ============================================================================

function textToWeekdayIndex(txt) {
  if (!txt) return null;
  const t = txt.trim().toLowerCase();
  const map = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2, tues: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4, thurs: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6
  };
  return t in map ? map[t] : null;
}

function headerColumnWeekdayMap() {
  const headers = Array.from(document.querySelectorAll('[role="columnheader"]'))
    .filter(h => h.offsetParent !== null);
  if (headers.length < 5) return null;

  const items = headers
    .map(h => {
      const r = h.getBoundingClientRect();
      return { el: h, center: (r.left + r.right) / 2 };
    })
    .sort((a, b) => a.center - b.center);

  const arr = [];
  for (const item of items) {
    const h = item.el;
    const w = textToWeekdayIndex(h.getAttribute('aria-label')) ??
              textToWeekdayIndex(h.textContent || '');
    if (w !== null) arr.push(w);
  }

  return arr.length >= 5 ? arr : null;
}

// ============================================================================
// CELL SELECTION AND COLUMN CLUSTERING
// ============================================================================

function clearMonthColors() {
  document.querySelectorAll('div.MGaLHf.ChfiMc[data-gce-month-painted="1"]').forEach(el => {
    el.style.backgroundColor = '';
    el.removeAttribute('data-gce-month-painted');
    el.removeAttribute('data-gce-date-colored');
  });
}

function selectMonthCells() {
  // Target div.MGaLHf.ChfiMc elements - they have data-datekey!
  const daySquares = Array.from(document.querySelectorAll('div.MGaLHf.ChfiMc'))
    .filter(c => c.offsetParent !== null);
  return daySquares.length >= 25 ? daySquares : [];
}

function clusterColumns(cells) {
  const points = cells
    .map(c => {
      const r = c.getBoundingClientRect();
      return { c, center: (r.left + r.right) / 2 };
    })
    .sort((a, b) => a.center - b.center);

  // Calculate tolerance based on typical column width
  const widths = [];
  for (let i = 1; i < points.length; i++) {
    const c1 = points[i].c.getBoundingClientRect();
    const c2 = points[i - 1].c.getBoundingClientRect();
    if (Math.abs(c1.top - c2.top) < 4) {
      widths.push(c1.left - c2.left);
    }
  }
  const median = arr => {
    if (!arr.length) return 100;
    const s = [...arr].sort((x, y) => x - y);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };
  const approxColWidth = Math.max(40, median(widths) || 100);
  const tolerance = Math.max(4, Math.round(approxColWidth * 0.25));

  const cols = [];
  for (const p of points) {
    const hit = cols.find(col => Math.abs(col.center - p.center) <= tolerance);
    if (hit) hit.members.push(p.c);
    else cols.push({ center: p.center, members: [p.c] });
  }
  cols.sort((a, b) => a.center - b.center);
  return cols;
}

function computeColumnPositionMap(cols, startWeekDay) {
  const map = new Array(cols.length).fill(0);

  if (cols.length === 5) {
    // Weekends hidden: Monday-Friday
    for (let i = 0; i < 5; i++) {
      map[i] = i + 1; // Monday=1, Tuesday=2, etc.
    }
  } else if (cols.length === 7) {
    // Weekends shown: use user's week start setting
    for (let i = 0; i < 7; i++) {
      map[i] = (i + startWeekDay) % 7;
    }
  }

  return map;
}

// ============================================================================
// COLOR UTILITIES
// ============================================================================

function hexToRgba(hex, alpha) {
  if (!hex || hex === '#ffffff') return `rgba(255, 255, 255, ${alpha})`;
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(255, 255, 255, ${alpha})`;
  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================================
// MAIN PAINTING FUNCTION
// ============================================================================

function applyMonthViewColors(userColors, opts) {
  const startWeekDay = opts?.assumeWeekStartsOn ?? 0;
  const userOpacity = opts?.opacity || {};
  const dateColors = opts?.dateColors || {};

  const paint = () => {
    clearMonthColors();

    const cells = selectMonthCells();
    if (!cells.length) return;

    const cols = clusterColumns(cells);
    if (cols.length !== 5 && cols.length !== 7) return;

    // Build the datekey map - this is the key to everything!
    const dateKeyMap = buildDateKeyMap();
    const colToPosition = computeColumnPositionMap(cols, startWeekDay);

    cols.forEach((col, cIdx) => {
      const weekday = colToPosition[cIdx];
      const defaultColor = userColors[weekday];
      const defaultOpacity = userOpacity[weekday] || 30;

      for (const cell of col.members) {
        // Get date from datekey - simple and reliable!
        const cellDateStr = getCellDateString(cell, dateKeyMap);

        let color = defaultColor;
        let opacity = defaultOpacity;
        let isDateSpecific = false;

        // Check for date-specific color
        if (cellDateStr && dateColors[cellDateStr]) {
          color = dateColors[cellDateStr];
          opacity = 30;
          isDateSpecific = true;
        }

        if (!color) continue;

        const rgba = hexToRgba(color, opacity / 100);
        cell.style.setProperty('background-color', rgba, 'important');
        cell.setAttribute('data-gce-month-painted', '1');
        if (isDateSpecific) {
          cell.setAttribute('data-gce-date-colored', cellDateStr);
        }
      }
    });
  };

  // Paint with double-RAF to avoid transition frame issues
  requestAnimationFrame(() => requestAnimationFrame(paint));

  // Observe DOM changes
  const root = document.querySelector('div[role="grid"]') || document.body;
  if (monthMo) monthMo.disconnect();
  monthMo = new MutationObserver(() => {
    cancelAnimationFrame(paint.__raf || 0);
    paint.__raf = requestAnimationFrame(() => requestAnimationFrame(paint));
  });
  monthMo.observe(root, { childList: true, subtree: true, attributes: true });

  // Repaint on resize
  if (!resizeBound) {
    window.addEventListener('resize', () => {
      cancelAnimationFrame(paint.__raf || 0);
      paint.__raf = requestAnimationFrame(paint);
    }, { passive: true });
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

// Export
window.cc3MonthColoring = {
  applyMonthViewColors,
  teardownMonthPainter,
  clearMonthColors
};
