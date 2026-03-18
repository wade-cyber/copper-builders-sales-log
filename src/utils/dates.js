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

/** Short format: "Mar 22" */
export function getWeekEndingShort() {
  const d = nextSunday();
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}
