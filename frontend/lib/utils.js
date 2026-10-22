// Utility functions for frontend formatting

/**
 * Formats a date string or Date object into a premium, readable format: "DD MMM YYYY, hh:mm AM/PM"
 * Example: "17 Jun 2026, 04:30 PM"
 */
export const formatDate = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';

  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // hour '0' should be '12'
  const formattedHours = String(hours).padStart(2, '0');

  return `${day} ${month} ${year}, ${formattedHours}:${minutes} ${ampm}`;
};

/**
 * Splits date and time into separate non-breaking parts for responsive display:
 * { date: "17 Jun 2026", time: "04:30 PM", full: "17 Jun 2026, 04:30 PM" }
 */
export const formatDateTimeSplit = (dateString) => {
  if (!dateString) return { date: '—', time: '' };
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return { date: '—', time: '' };

  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');

  return {
    date: `${day} ${month} ${year}`,
    time: `${formattedHours}:${minutes} ${ampm}`,
    full: `${day} ${month} ${year}, ${formattedHours}:${minutes} ${ampm}`
  };
};

/**
 * Formats a date string or Date object into a premium, readable format containing date only: "DD MMM YYYY"
 * Example: "17 Jun 2026"
 */
export const formatDateOnly = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';

  const day = String(date.getDate()).padStart(2, '0');
  const month = date.toLocaleString('en-US', { month: 'short' });
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
};

/**
 * Formats a date string or Date object into a time-only format: "hh:mm AM/PM"
 * Example: "04:30 PM"
 */
export const formatTime = (dateString) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '—';

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const formattedHours = String(hours).padStart(2, '0');

  return `${formattedHours}:${minutes}:${seconds} ${ampm}`;
};
