

const getSubscriptionStatus = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "Pending";
  }

  if (now >= end) {
    return "Expired";
  }

  if (now < start) {
    return "Pending";
  }

  const daysRemaining = Math.ceil(
    (end.getTime() - now.getTime()) /
      (1000 * 60 * 60 * 24)
  );

  return daysRemaining <= 7 ? "Expiring Soon" : "Active";
};

module.exports = {
  getSubscriptionStatus,
};