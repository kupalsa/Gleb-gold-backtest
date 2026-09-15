export function syncTakeProfitMoveFields({
  moved,
  container,
  result,
  initialExitTime,
  initialOutcome,
  initialRiskReward
} = {}) {
  const wasMoved = moved?.value === 'yes';
  if (container) container.hidden = !wasMoved;

  if (result) {
    result.required = wasMoved;
    if (!wasMoved) result.value = '';
  }

  if (initialExitTime) {
    initialExitTime.required = wasMoved;
    if (!wasMoved) initialExitTime.value = '';
  }

  if (initialOutcome) {
    initialOutcome.required = wasMoved;
    if (!wasMoved) initialOutcome.value = '';
  }

  if (initialRiskReward) {
    initialRiskReward.required = wasMoved;
    if (!wasMoved) initialRiskReward.value = '';
  }

  if (!wasMoved && container && typeof container.querySelector === 'function') {
    const initialExitDate = container.querySelector('#initialExitDate');
    if (initialExitDate) initialExitDate.value = '';
  }
}
