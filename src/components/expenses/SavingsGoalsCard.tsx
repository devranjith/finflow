import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../ui/dialog';
import { Target, Plus, Trash } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { Progress } from '../ui/progress';
import { ScrollArea } from '../ui/scroll-area';
import { ConfirmModal } from '../ui/confirm-modal';

export const SavingsGoalsCard: React.FC = () => {
  const { savingsGoals, addSavingsGoal, fundSavingsGoal, deleteSavingsGoal, buckets } = useFinance();
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
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
      <Card className="bg-zinc-900/50 border-zinc-800 flex flex-col h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2 shrink-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Target size={18} className="text-blue-400" />
            Savings Goals
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-50" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4">
              {savingsGoals.map(goal => {
                const percent = Math.min(100, (goal.current_amount / goal.target_amount) * 100);

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
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 bg-zinc-900 border-zinc-700" onClick={() => setFundingGoalId(goal.id)}>
                        Fund
                      </Button>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-zinc-500 hover:text-red-400 hover:bg-zinc-800" onClick={() => setDeleteGoalId(goal.id)}>
                        <Trash size={12} />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {savingsGoals.length === 0 && (
                <div className="text-center text-zinc-500 py-4 text-sm">No savings goals yet. Create one!</div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

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
