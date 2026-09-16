export function prefillTradeFormDates(form, latestTradeDate) {
  if (!latestTradeDate || form.querySelector('#trade-id')?.value) return;

  for (const selector of ['#date', '#exitDate']) {
    const field = form.querySelector(selector);
    if (field && !field.value) field.value = latestTradeDate;
  }
}
