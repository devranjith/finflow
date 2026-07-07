import React, { useState } from 'react';

import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../ui/dialog';
import { Target, Plus, Trash, Sparkles } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { ConfirmModal } from '../ui/confirm-modal';
import { askGoalCoach } from '../../lib/ai';

export const SavingsGoalsModal: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({ open, onOpenChange }) => {
  const { savingsGoals, addSavingsGoal, fundSavingsGoal, deleteSavingsGoal, buckets, cycle, geminiApiKey } = useFinance();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  
  const [fundingGoalId, setFundingGoalId] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState('');

  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);

  const [coachAdvice, setCoachAdvice] = useState<Record<string, string>>({});
  const [coachLoadingId, setCoachLoadingId] = useState<string | null>(null);

  const bufferBucket = buckets.find(b => b.bucket_type === 'BUFFER');
  const availableBuffer = bufferBucket ? (bufferBucket.allocated_amount - bufferBucket.spent_amount) : 0;

  const getProjection = (current: number, target: number) => {
    const remaining = Math.max(0, target - current);
    if (remaining <= 0) {
      return { done: true, text: '🎉 Goal reached! Consider setting a new target.' };
    }
    if (availableBuffer <= 0) {
      return { done: false, text: '⚠️ Your Buffer is empty this month. Add funds to your Buffer to make progress.' };
    }
    const months = Math.ceil(remaining / availableBuffer);
    return {
      done: false,
      text: `At ₹${availableBuffer.toLocaleString('en-IN')}/mo from your Buffer, ~${months} month${months > 1 ? 's' : ''} to go (₹${remaining.toLocaleString('en-IN')} left).`,
    };
  };

  const handleCoach = async (goalId: string) => {
    const goal = savingsGoals.find(g => g.id === goalId);
    if (!goal) return;

    if (!geminiApiKey) {
      setCoachAdvice(prev => ({
        ...prev,
        [goalId]: '💡 Add your Gemini API key in Settings to get personalized AI coaching for this goal.',
      }));
      return;
    }

    setCoachLoadingId(goalId);
    try {
      const advice = await askGoalCoach(
        { name: goal.name, target: goal.target_amount, current: goal.current_amount },
        {
          income: cycle?.total_income || 0,
          availableBuffer,
          otherGoals: savingsGoals.filter(g => g.id !== goalId).map(g => g.name),
        },
        geminiApiKey
      );
      setCoachAdvice(prev => ({ ...prev, [goalId]: advice }));
    } catch (e: any) {
      setCoachAdvice(prev => ({
        ...prev,
        [goalId]: '⚠️ Unable to get coaching right now. Please check your Gemini API key in Settings.',
      }));
    } finally {
      setCoachLoadingId(null);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !target) return;
    await addSavingsGoal(name, Number(target));
    setName('');
    setTarget('');
    setIsAddModalOpen(false);
  };

  const handleFundGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fundingGoalId || !fundAmount) return;
    
    const amount = Number(fundAmount);
    if (amount > availableBuffer) {
      alert("You don't have enough in your Buffer bucket to fund this goal!");
      return;
    }

    await fundSavingsGoal(fundingGoalId, amount);
    setFundingGoalId(null);
    setFundAmount('');
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-50 sm:max-w-[500px] flex flex-col max-h-[85vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target size={20} className="text-blue-400" />
              Savings Goals
            </div>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-zinc-400 hover:text-zinc-50 mr-6" onClick={() => setIsAddModalOpen(true)}>
              <Plus size={16} />
              <span className="text-xs">Add Goal</span>
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 mt-2">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {savingsGoals.map(goal => {
                const percent = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
                const projection = getProjection(goal.current_amount, goal.target_amount);
                const advice = coachAdvice[goal.id];
                const isCoaching = coachLoadingId === goal.id;

                return (
                  <div key={goal.id} className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 group relative">
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <h4 className="font-medium text-zinc-100">{goal.name}</h4>
                        <p className="text-sm text-zinc-400 mt-1">₹{goal.current_amount.toLocaleString()} / ₹{goal.target_amount.toLocaleString()}</p>
                      </div>
                      <div className="text-sm font-bold text-blue-400">{percent.toFixed(0)}%</div>
                    </div>
                    <Progress value={percent} className="h-2 bg-zinc-950" indicatorClassName="bg-blue-500" />

                    {/* Projection */}
                    <p className={`text-xs mt-3 ${projection.done ? 'text-emerald-400' : 'text-zinc-500'}`}>
                      {projection.text}
                    </p>

                    {/* AI Coach */}
                    <div className="mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1.5 px-2 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                        onClick={() => handleCoach(goal.id)}
                        disabled={isCoaching}
                      >
                        <Sparkles size={13} />
                        {isCoaching ? 'Coaching...' : advice ? 'Refresh AI Coach' : 'AI Coach'}
                      </Button>
                      {isCoaching && (
                        <div className="space-y-2 animate-pulse mt-3">
                          <div className="h-3 bg-zinc-800 rounded w-full" />
                          <div className="h-3 bg-zinc-800 rounded w-4/6" />
                        </div>
                      )}
                      {!isCoaching && advice && (
                        <div className="mt-3 p-3 rounded-lg bg-zinc-950/60 border border-zinc-800 text-xs text-zinc-300 whitespace-pre-line leading-relaxed">
                          {advice}
                        </div>
                      )}
                    </div>

                    {/* Hover Actions */}
                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <Button variant="outline" size="sm" className="h-7 text-xs px-3 bg-zinc-950 border-zinc-700 hover:bg-zinc-800" onClick={() => setFundingGoalId(goal.id)}>
                        Fund
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-red-400 hover:bg-zinc-950" onClick={() => setDeleteGoalId(goal.id)}>
                        <Trash size={14} />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {savingsGoals.length === 0 && (
                <div className="text-center text-zinc-500 py-12">No savings goals yet. Create one!</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>

      {/* Add Goal Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Savings Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddGoal} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Goal Name</label>
              <Input 
                placeholder="e.g. Vacation, Laptop" 
                value={name} 
                onChange={(e) => setName(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Target Amount (₹)</label>
              <Input 
                type="number" 
                placeholder="e.g. 50000" 
                value={target} 
                onChange={(e) => setTarget(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                required
              />
            </div>
            <DialogFooter className="mt-6">
              <DialogClose render={<Button type="button" variant="ghost" />}>
                Cancel
              </DialogClose>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                Create Goal
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fund Goal Modal */}
      <Dialog open={!!fundingGoalId} onOpenChange={(o) => !o && setFundingGoalId(null)}>
        <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Fund Goal</DialogTitle>
            <p className="text-sm text-zinc-400 mt-1">
              Available Buffer: <span className="font-semibold text-zinc-200">₹{availableBuffer.toLocaleString()}</span>
            </p>
          </DialogHeader>
          <form onSubmit={handleFundGoal} className="space-y-4 pt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-400">Amount to Allocate (₹)</label>
              <Input 
                type="number" 
                placeholder="e.g. 5000" 
                value={fundAmount} 
                onChange={(e) => setFundAmount(e.target.value)}
                className="bg-zinc-950 border-zinc-800"
                autoFocus
                required
              />
            </div>
            <DialogFooter className="mt-6">
              <DialogClose render={<Button type="button" variant="ghost" onClick={() => setFundingGoalId(null)} />}>
                Cancel
              </DialogClose>
              <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                Add Funds
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmModal 
        open={!!deleteGoalId} 
        onOpenChange={(o) => !o && setDeleteGoalId(null)}
        title="Delete Savings Goal"
        description="Are you sure you want to delete this goal? Any money you saved towards this goal will be automatically refunded back into your Buffer bucket."
        onConfirm={() => deleteGoalId && deleteSavingsGoal(deleteGoalId)}
      />
    </>
  );
};
