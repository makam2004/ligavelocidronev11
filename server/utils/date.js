export function getIsoWeekInfo(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNumber = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - dayNumber);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate - yearStart) / 86400000) + 1) / 7);
  const seasonYear = utcDate.getUTCFullYear();
  const weekKey = `${seasonYear}-W${String(weekNumber).padStart(2, '0')}`;

  return {
    seasonYear,
    weekNumber,
    weekKey
  };
}
