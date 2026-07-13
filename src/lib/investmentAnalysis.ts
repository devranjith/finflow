import type { Bucket, Cycle, FixedExpense, SavingsGoal, Transaction } from '../types/database';

export type InvestmentPreferences = {
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
  horizon: 'short' | 'medium' | 'long';
  hasEmergencyFund: boolean;
};

export const DEFAULT_INVESTMENT_PREFERENCES: InvestmentPreferences = {
  riskTolerance: 'conservative',
  horizon: 'long',
  hasEmergencyFund: false,
};

export type InvestmentContext = {
  income: number;
  fixedExpenses: { name: string; amount: number; category: string }[];
  fixedTotal: number;
  needsSpent: number;
  needsAllocated: number;
  wantsSpent: number;
  wantsAllocated: number;
  bufferRemaining: number;
  emergencyTarget: number;
  emergencyGap: number;
  goalCommitments: number;
  investableSurplus: number;
  overspending: boolean;
  spendingPace: { dailyAvg: number; projectedMonthEnd: number };
  savingsGoals: { name: string; target: number; current: number; remaining: number }[];
  flags: {
    needsEmergencyFundFirst: boolean;
    hasHighFixedRatio: boolean;
    hasUnfundedGoals: boolean;
  };
  preferences: InvestmentPreferences;
  dependents: number;
};

function bucketRemaining(bucket?: Bucket): number {
  if (!bucket) return 0;
  return Math.max(0, bucket.allocated_amount - bucket.spent_amount);
}

function suggestedGoalCommitment(goal: SavingsGoal, availableBuffer: number): number {
  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
  if (remaining <= 0 || availableBuffer <= 0) return 0;
  const months = Math.max(1, Math.ceil(remaining / availableBuffer));
  return Math.ceil(remaining / months);
};

export function buildInvestmentContext(params: {
  cycle: Cycle;
  buckets: Bucket[];
  fixedExpenses: FixedExpense[];
  savingsGoals: SavingsGoal[];
  transactions: Transaction[];
  dependents?: number;
  preferences?: InvestmentPreferences;
}): InvestmentContext {
  const { cycle, buckets, fixedExpenses, savingsGoals, transactions, dependents = 0 } = params;
  const preferences = params.preferences ?? DEFAULT_INVESTMENT_PREFERENCES;

  const needsBucket = buckets.find(b => b.bucket_type === 'NEEDS');
  const wantsBucket = buckets.find(b => b.bucket_type === 'WANTS');
  const bufferBucket = buckets.find(b => b.bucket_type === 'BUFFER');

  const needsSpent = needsBucket?.spent_amount ?? 0;
  const needsAllocated = needsBucket?.allocated_amount ?? 0;
  const wantsSpent = wantsBucket?.spent_amount ?? 0;
  const wantsAllocated = wantsBucket?.allocated_amount ?? 0;
  const bufferRemaining = bucketRemaining(bufferBucket);

  const income = cycle.total_income || 0;
  const fixedTotal = cycle.total_fixed || fixedExpenses.reduce((acc, e) => acc + e.amount, 0);

  const emergencyTarget = fixedTotal * 3;
  const currentEmergency = preferences.hasEmergencyFund ? emergencyTarget : bufferRemaining;
  const emergencyGap = preferences.hasEmergencyFund ? 0 : Math.max(0, emergencyTarget - currentEmergency);

  const activeGoals = savingsGoals.filter(g => g.current_amount < g.target_amount);
  const goalCommitments = activeGoals.reduce(
    (acc, g) => acc + suggestedGoalCommitment(g, bufferRemaining),
    0
  );

  const safetyBuffer = Math.max(2000, Math.round(bufferRemaining * 0.1));

  const now = new Date();
  const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const spentSoFar = transactions
    .filter(t => new Date(t.date) <= endOfToday)
    .reduce((acc, t) => acc + t.amount, 0);
  const daysElapsed = Math.max(1, now.getDate());
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dailyAvg = spentSoFar / daysElapsed;
  const projectedMonthEnd = dailyAvg * daysInMonth;

  const needsPct = needsAllocated > 0 ? needsSpent / needsAllocated : 0;
  const wantsPct = wantsAllocated > 0 ? wantsSpent / wantsAllocated : 0;
  const overspending =
    projectedMonthEnd > income ||
    needsPct > 0.85 ||
    wantsPct > 0.85;

  let investableSurplus = Math.max(0, bufferRemaining - safetyBuffer - goalCommitments);
  if (overspending) {
    investableSurplus = 0;
  }

  const needsEmergencyFundFirst = !preferences.hasEmergencyFund && emergencyGap > 0;
  const hasHighFixedRatio = income > 0 && fixedTotal / income > 0.5;
  const hasUnfundedGoals = activeGoals.length > 0;

  return {
    income,
    fixedExpenses: fixedExpenses.map(e => ({ name: e.name, amount: e.amount, category: e.category })),
    fixedTotal,
    needsSpent,
    needsAllocated,
    wantsSpent,
    wantsAllocated,
    bufferRemaining,
    emergencyTarget,
    emergencyGap,
    goalCommitments,
    investableSurplus,
    overspending,
    spendingPace: { dailyAvg, projectedMonthEnd },
    savingsGoals: savingsGoals.map(g => ({
      name: g.name,
      target: g.target_amount,
      current: g.current_amount,
      remaining: Math.max(0, g.target_amount - g.current_amount),
    })),
    flags: { needsEmergencyFundFirst, hasHighFixedRatio, hasUnfundedGoals },
    preferences,
    dependents,
  };
}
