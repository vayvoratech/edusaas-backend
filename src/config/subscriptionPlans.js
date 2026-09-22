

const SUBSCRIPTION_PLANS = [
  {
    code: "free",
    name: "Free",
    active: true,
  },
  {
    code: "basic",
    name: "Basic",
    active: true,
  },
  {
    code: "pro",
    name: "Pro",
    active: true,
  },
  {
    code: "enterprise",
    name: "Enterprise",
    active: true,
  },
];

const getActiveSubscriptionPlans = () =>
  SUBSCRIPTION_PLANS.filter((plan) => plan.active);

const isValidSubscriptionPlan = (code) =>
  SUBSCRIPTION_PLANS.some(
    (plan) => plan.code === code && plan.active
  );

module.exports = {
  SUBSCRIPTION_PLANS,
  getActiveSubscriptionPlans,
  isValidSubscriptionPlan,
};