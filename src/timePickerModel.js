const pad = value => String(value).padStart(2, '0');
export function timeParts(value = '') {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return {hour:'', minute:'', period:'AM'};
  const [hour, minute] = value.split(':');
  return {hour:pad(Number(hour) % 12 || 12), minute, period:Number(hour) >= 12 ? 'PM' : 'AM'};
}
export function storedTime(hour, minute, period) {
  return `${pad(Number(hour || 12) % 12 + (period === 'PM' ? 12 : 0))}:${minute || '00'}`;
}
export function displayTime(value) {
  const {hour, minute, period} = timeParts(value);
  return hour ? `${hour}:${minute} ${period}` : '--:--';
}
