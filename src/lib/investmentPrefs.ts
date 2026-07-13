import type { InvestmentPreferences } from './investmentAnalysis';
import { DEFAULT_INVESTMENT_PREFERENCES } from './investmentAnalysis';

const STORAGE_KEY = 'finflow_investment_prefs';

export function loadInvestmentPreferences(userId: string): InvestmentPreferences {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${userId}`);
    if (!raw) return DEFAULT_INVESTMENT_PREFERENCES;
    return { ...DEFAULT_INVESTMENT_PREFERENCES, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_INVESTMENT_PREFERENCES;
  }
}

export function saveInvestmentPreferences(userId: string, prefs: InvestmentPreferences): void {
  localStorage.setItem(`${STORAGE_KEY}_${userId}`, JSON.stringify(prefs));
}
