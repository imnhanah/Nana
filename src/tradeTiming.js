export function tradeTimingError(form) {
  if (!form.date) return 'Choose an open date.';
  if (form.closeTime && !form.closeDate) return 'Choose a close date for the close time.';
  if (form.closeDate && `${form.closeDate} ${form.closeTime || '23:59'}` < `${form.date} ${form.time || '00:00'}`) return 'Close date and time cannot be before the opening.';
  return '';
}
