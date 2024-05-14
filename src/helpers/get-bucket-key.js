module.exports = (date = new Date()) => {  
  // Set time to midnight in UTC
  date.setUTCHours(0, 0, 0, 0);

  const milliseconds = date.getTime();

  // Convert to seconds and return
  return Math.floor(milliseconds / 1000);
}