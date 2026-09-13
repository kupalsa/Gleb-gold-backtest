const iso = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export function shiftMonth(month, delta) {
  const [year, number] = month.split('-').map(Number);
  const date = new Date(year, number - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}
export function calendarCells(month) {
  const [year, number] = month.split('-').map(Number);
  const first = new Date(year, number - 1, 1);
  const start = new Date(year, number - 1, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start); date.setDate(start.getDate() + index);
    return { date: iso(date), day: date.getDate(), inMonth: date.getMonth() === number - 1 };
  });
}
