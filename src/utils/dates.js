const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday',
  'Thursday', 'Friday', 'Saturday'];

function nextSunday() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const diff = day === 0 ? 0 : 7 - day;
  const sun = new Date(now);
  sun.setDate(now.getDate() + diff);
  sun.setHours(0, 0, 0, 0);
  return sun;
}

/** Upcoming Sunday formatted as "Sunday Mar 22" */
export function getWeekEnding() {
  const d = nextSunday();
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Monday after the upcoming Sunday as "Monday Mar 23" */
export function getDueDate() {
  const d = nextSunday();
  d.setDate(d.getDate() + 1);
  return `${DAYS[d.getDay()]} ${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Full weeks elapsed since an ISO date string (0 = less than 7 days ago) */
export function weeksElapsed(isoDate) {
  if (!isoDate) return 0;
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (7 * 24 * 60 * 60 * 1000));
}

/** True if a prospect needs a "Still Engaged" reaffirmation (3+ weeks old, not reaffirmed in last 3 weeks) */
export function needsReaffirmation(createdDate, lastReaffirmedAt) {
  const THRESHOLD = 3;
  if (weeksElapsed(createdDate) < THRESHOLD) return false;
  return !lastReaffirmedAt || weeksElapsed(lastReaffirmedAt) >= THRESHOLD;
}

/** Short format: "Mar 22" */
export function getWeekEndingShort() {
  const d = nextSunday();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
