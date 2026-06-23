import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Target, Plus, Trash } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { ConfirmModal } from '../ui/confirm-modal';

export const SavingsGoalsCard: React.FC = () => {
  const { savingsGoals, addSavingsGoal, fundSavingsGoal, deleteSavingsGoal, buckets } = useFinance();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  
  const [fundingGoalId, setFundingGoalId] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState('');

  const [deleteGoalId, setDeleteGoalId] = useState<string | null>(null);

  const bufferBucket = buckets.find(b => b.bucket_type === 'BUFFER');
  const availableBuffer = bufferBucket ? (bufferBucket.allocated_amount - bufferBucket.spent_amount) : 0;

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !target) return;
    await addSavingsGoal(name, Number(target));
    setName('');
    setTarget('');
    setIsAdding(false);
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
      <Card className="bg-zinc-900/50 border-zinc-800 flex flex-col max-h-[300px]">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target size={18} className="text-blue-400" />
            Savings Goals
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-50" onClick={() => setIsAdding(!isAdding)}>
            <Plus size={18} />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col">
          {isAdding && (
            <form onSubmit={handleAddGoal} className="flex gap-2 mb-4 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800">
              <Input placeholder="Goal Name" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs bg-zinc-900 border-zinc-800" />
              <Input type="number" placeholder="Target ₹" value={target} onChange={(e) => setTarget(e.target.value)} className="h-8 text-xs bg-zinc-900 border-zinc-800 w-24" />
              <Button type="submit" size="sm" className="h-8 bg-blue-600 hover:bg-blue-500 text-white text-xs">Add</Button>
            </form>
          )}

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {savingsGoals.map(goal => {
                const percent = Math.min(100, (goal.current_amount / goal.target_amount) * 100);
                const isFunding = fundingGoalId === goal.id;

                return (
                  <div key={goal.id} className="p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/50 group relative">
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <h4 className="text-sm font-medium text-zinc-200">{goal.name}</h4>
                        <p className="text-xs text-zinc-500 mt-0.5">₹{goal.current_amount.toLocaleString()} / ₹{goal.target_amount.toLocaleString()}</p>
                      </div>
                      <div className="text-xs font-semibold text-blue-400">{percent.toFixed(0)}%</div>
                    </div>
                    <Progress value={percent} className="h-1.5 bg-zinc-800" indicatorClassName="bg-blue-500" />
                    
                    {/* Hover Actions */}
                    {!isFunding && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 bg-zinc-900 border-zinc-700" onClick={() => setFundingGoalId(goal.id)}>
                          Fund
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-zinc-800" onClick={() => setDeleteGoalId(goal.id)}>
                          <Trash size={12} />
                        </Button>
                      </div>
                    )}

                    {/* Funding Form */}
                    {isFunding && (
                      <form onSubmit={handleFundGoal} className="flex gap-2 mt-3 pt-3 border-t border-zinc-800/50">
                        <Input type="number" placeholder="₹ Amount" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} className="h-7 text-xs bg-zinc-900 border-zinc-800" autoFocus />
                        <Button type="submit" size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3">Add Funds</Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs text-zinc-400" onClick={() => setFundingGoalId(null)}>Cancel</Button>
                      </form>
                    )}
                  </div>
                );
              })}
              {savingsGoals.length === 0 && !isAdding && (
                <div className="text-center text-zinc-500 py-4 text-sm">No savings goals yet. Create one!</div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <ConfirmModal 
        open={!!deleteGoalId} 
        onOpenChange={(o) => !o && setDeleteGoalId(null)}
        title="Delete Savings Goal"
        description="Are you sure you want to delete this goal? The funds will remain in your overall Buffer, but the tracking for this specific goal will be removed."
        onConfirm={() => deleteGoalId && deleteSavingsGoal(deleteGoalId)}
      />
    </>
  );
};
