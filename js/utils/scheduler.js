/**
 * Batch Interval Scheduler & Date Processor for WP Content Engine
 */

export function calculateBatchSchedule(posts, scheduleConfig) {
  const {
    startDateStr, // YYYY-MM-DD
    startTimeStr, // HH:MM
    intervalNum = 3,
    intervalUnit = "days"
  } = scheduleConfig;

  if (!posts || posts.length === 0) return [];

  // Parse start base date
  let baseDate = new Date();
  if (startDateStr) {
    const [year, month, day] = startDateStr.split("-").map(Number);
    const [hours, minutes] = (startTimeStr || "09:00").split(":").map(Number);
    baseDate = new Date(year, month - 1, day, hours, minutes, 0);
  }

  const now = new Date();

  return posts.map((post, index) => {
    // Calculate date offset for post #index
    const scheduledDate = new Date(baseDate.getTime());

    if (index > 0) {
      const step = index * Number(intervalNum);
      if (intervalUnit === "hours") {
        scheduledDate.setHours(scheduledDate.getHours() + step);
      } else if (intervalUnit === "weeks") {
        scheduledDate.setDate(scheduledDate.getDate() + (step * 7));
      } else {
        // Default days
        scheduledDate.setDate(scheduledDate.getDate() + step);
      }
    }

    const isFuture = scheduledDate.getTime() > now.getTime();
    const wpStatus = isFuture ? "future" : "publish";

    return {
      ...post,
      post_date: formatDateFormatted(scheduledDate),
      post_date_gmt: formatDateFormatted(scheduledDate, true),
      status: wpStatus
    };
  });
}

export function formatDateFormatted(d, isGmt = false) {
  const dateObj = isGmt ? new Date(d.getTime() + d.getTimezoneOffset() * 60000) : d;
  const pad = num => String(num).padStart(2, "0");
  const year = dateObj.getFullYear();
  const month = pad(dateObj.getMonth() + 1);
  const day = pad(dateObj.getDate());
  const hours = pad(dateObj.getHours());
  const minutes = pad(dateObj.getMinutes());
  const seconds = pad(dateObj.getSeconds());

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export function parseFormattedDateToInput(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split(" ");
  if (parts.length < 2) return dateStr;
  return `${parts[0]}T${parts[1].substring(0, 5)}`;
}

export function formatInputToFormattedDate(inputStr) {
  if (!inputStr) return formatDateFormatted(new Date());
  const [datePart, timePart] = inputStr.split("T");
  const timeFormatted = timePart.length === 5 ? `${timePart}:00` : timePart;
  return `${datePart} ${timeFormatted}`;
}
