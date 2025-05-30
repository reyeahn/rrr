// Utility functions for handling Pacific Time and daily reset logic

/**
 * Gets the current Pacific Time Date object
 */
export const getPacificTime = (): Date => {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
};

/**
 * Gets the most recent 9 AM Pacific reset time
 * If current time is before 9 AM today, returns yesterday's 9 AM
 * If current time is after 9 AM today, returns today's 9 AM
 */
export const getLastResetTime = (): Date => {
  const pacificNow = getPacificTime();
  const resetTime = new Date(pacificNow);
  
  // Set to 9 AM today
  resetTime.setHours(9, 0, 0, 0);
  
  // If current time is before 9 AM today, use yesterday's 9 AM
  if (pacificNow.getTime() < resetTime.getTime()) {
    resetTime.setDate(resetTime.getDate() - 1);
  }
  
  return resetTime;
};

/**
 * Gets the next 9 AM Pacific reset time
 */
export const getNextResetTime = (): Date => {
  const pacificNow = getPacificTime();
  const nextReset = new Date(pacificNow);
  
  // Set to 9 AM today
  nextReset.setHours(9, 0, 0, 0);
  
  // If we've passed 9 AM today, move to tomorrow
  if (pacificNow.getTime() >= nextReset.getTime()) {
    nextReset.setDate(nextReset.getDate() + 1);
  }
  
  return nextReset;
};

/**
 * Checks if a given timestamp is after the most recent 9 AM Pacific reset
 * Used to determine if a user has posted today (after the last reset)
 */
export const isAfterLastReset = (timestamp: Date | any): boolean => {
  const lastReset = getLastResetTime();
  
  // Handle Firestore Timestamp objects
  const dateToCheck = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  
  return dateToCheck.getTime() > lastReset.getTime();
};

/**
 * Checks if the user has posted today (after 9 AM Pacific reset)
 * Enhanced with fallback logic for better reliability
 */
export const hasPostedToday = (lastPostDate: Date | any | null, lastPostDateManual?: Date | any | null): boolean => {
  if (!lastPostDate && !lastPostDateManual) return false;
  
  // Try primary timestamp first
  if (lastPostDate) {
    const result = isAfterLastReset(lastPostDate);
    console.log('🕐 hasPostedToday check (primary):', {
      lastPostDate,
      isAfterReset: result,
      lastResetTime: getLastResetTime()
    });
    if (result) return true;
  }
  
  // Fallback to manual timestamp if primary fails
  if (lastPostDateManual) {
    const result = isAfterLastReset(lastPostDateManual);
    console.log('🕐 hasPostedToday check (fallback):', {
      lastPostDateManual,
      isAfterReset: result,
      lastResetTime: getLastResetTime()
    });
    return result;
  }
  
  return false;
};

/**
 * Gets a human-readable time until next reset
 */
export const getTimeUntilReset = (): string => {
  const now = getPacificTime();
  const nextReset = getNextResetTime();
  const diff = nextReset.getTime() - now.getTime();
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

/**
 * Formats a date as a human-readable date string
 * e.g., "Jan 15, 2024" or "Today" or "Yesterday"
 */
export const formatPostDate = (date: Date | any): string => {
  const postDate = date?.toDate ? date.toDate() : new Date(date);
  const now = getPacificTime();
  
  // Check if it's today
  const isToday = postDate.toDateString() === now.toDateString();
  if (isToday) return 'Today';
  
  // Check if it's yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = postDate.toDateString() === yesterday.toDateString();
  if (isYesterday) return 'Yesterday';
  
  // Otherwise format as "Jan 15, 2024"
  return postDate.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}; 