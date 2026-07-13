import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import { TrendingUp, RefreshCw, AlertTriangle } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { useAuth } from '../../context/AuthContext';
import { buildInvestmentContext } from '../../lib/investmentAnalysis';
import type { InvestmentContext } from '../../lib/investmentAnalysis';
import { loadInvestmentPreferences } from '../../lib/investmentPrefs';
import { askInvestmentAdvisor } from '../../lib/ai';
import type { InvestmentPlan } from '../../lib/ai';

const CATEGORY_LABELS: Record<string, string> = {
  emergency_fund: 'Emergency Fund',
  debt_fd: 'FD / Debt',
  equity_sip: 'Equity SIP',
  gold: 'Gold',
  goal_specific: 'Goal Savings',
  hold_cash: 'Hold Cash',
};

export const SmartInvestmentModal: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({ open, onOpenChange }) => {
  const { user } = useAuth();
  const { cycle, buckets, fixedExpenses, savingsGoals, transactions, geminiApiKey } = useFinance();
  const [plan, setPlan] = useState<InvestmentPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const context: InvestmentContext | null = useMemo(() => {
    if (!cycle) return null;
    const prefs = user ? loadInvestmentPreferences(user.id) : undefined;
    return buildInvestmentContext({
      cycle,
      buckets,
      fixedExpenses,
      savingsGoals,
      transactions,
      preferences: prefs,
    });
  }, [cycle, buckets, fixedExpenses, savingsGoals, transactions, user]);

  const fetchPlan = async () => {
    if (!context) return;

    if (!geminiApiKey) {
      setError('Add your Gemini API key in Settings to get investment recommendations.');
      setPlan(null);
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const result = await askInvestmentAdvisor(context, geminiApiKey);
      setPlan(result);
    } catch (e) {
      console.error('Investment advisor error:', e);
      setError('Unable to generate investment plan. Please check your Gemini API key.');
      setPlan(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchPlan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, context, geminiApiKey]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-50 sm:max-w-[560px] flex flex-col max-h-[88vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <TrendingUp size={20} />
              Smart Invest
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-zinc-400 hover:text-emerald-400 mr-6"
              onClick={fetchPlan}
              disabled={isLoading || !context}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span className="text-xs">Refresh</span>
            </Button>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 max-h-[70vh] pr-3">
          {!cycle ? (
            <p className="text-sm text-zinc-500 py-6 text-center">Set up your monthly cycle on the Dashboard first.</p>
          ) : !context ? null : (
            <div className="space-y-5 mt-2 pb-2">
              {/* Your numbers */}
              <div className="p-4 rounded-lg bg-zinc-900/80 border border-zinc-800 space-y-3">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Your numbers</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-zinc-500 text-xs">Income</p>
                    <p className="font-medium text-zinc-200">₹{context.income.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Fixed expenses</p>
                    <p className="font-medium text-zinc-200">₹{context.fixedTotal.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Buffer remaining</p>
                    <p className="font-medium text-zinc-200">₹{context.bufferRemaining.toLocaleString('en-IN')}</p>
                  </div>
                  <div>
                    <p className="text-zinc-500 text-xs">Emergency gap</p>
                    <p className={`font-medium ${context.emergencyGap > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      ₹{context.emergencyGap.toLocaleString('en-IN')}
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-800">
                  <p className="text-zinc-500 text-xs">Investable this month</p>
                  <p className="text-2xl font-bold text-emerald-400">₹{context.investableSurplus.toLocaleString('en-IN')}</p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Day {new Date().getDate()} · ₹{Math.round(context.spendingPace.dailyAvg).toLocaleString('en-IN')}/day avg spend
                  </p>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-lg p-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {context.overspending && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg p-3">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  <span>Spending pace is high this month. Focus on reducing Wants/Needs before investing.</span>
                </div>
              )}

              {isLoading && (
                <div className="space-y-3 animate-pulse">
                  <div className="h-4 bg-zinc-800 rounded w-full" />
                  <div className="h-16 bg-zinc-800 rounded w-full" />
                  <div className="h-16 bg-zinc-800 rounded w-full" />
                </div>
              )}

              {!isLoading && plan && (
                <div className="space-y-4">
                  <p className="text-sm text-zinc-300 leading-relaxed">{plan.summary}</p>

                  {plan.allocations.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">This month&apos;s plan</p>
                      {[...plan.allocations].sort((a, b) => a.priority - b.priority).map((alloc, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                          <div className="flex justify-between items-start mb-1">
                            <span className="text-sm font-medium text-zinc-100">
                              {CATEGORY_LABELS[alloc.category] ?? alloc.category}
                            </span>
                            <span className="text-sm font-bold text-emerald-400">₹{alloc.amount.toLocaleString('en-IN')}</span>
                          </div>
                          <p className="text-xs text-zinc-500 mb-1">{alloc.instrument_examples.join(' · ')}</p>
                          <p className="text-xs text-zinc-400 leading-relaxed">{alloc.rationale}</p>
                        </div>
                      ))}
                    </div>
                  ) : context.investableSurplus === 0 ? (
                    <p className="text-sm text-zinc-400">
                      No surplus to invest this month. Build your emergency fund or reduce spending first.
                    </p>
                  ) : null}

                  {plan.warnings.length > 0 && (
                    <div className="space-y-1">
                      {plan.warnings.map((w, i) => (
                        <p key={i} className="text-xs text-amber-400/90">⚠ {w}</p>
                      ))}
                    </div>
                  )}

                  {plan.nextMonthTip && (
                    <p className="text-xs text-zinc-500 border-t border-zinc-800 pt-3">💡 {plan.nextMonthTip}</p>
                  )}

                  <p className="text-[10px] text-zinc-600 leading-relaxed">{plan.disclaimer}</p>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
