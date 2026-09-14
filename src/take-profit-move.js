export function syncTakeProfitMoveFields({ moved, result, container }) {
  const wasMoved = moved.value === 'yes';
  container.hidden = !wasMoved;
  result.required = wasMoved;
  if (!wasMoved) result.value = '';
}
