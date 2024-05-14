module.exports = (date = new Date()) => {  
  // Set time to midnight in UTC
  date.setUTCHours(0, 0, 0, 0);

  // Convert to seconds and return
  return date.toISOString();
}