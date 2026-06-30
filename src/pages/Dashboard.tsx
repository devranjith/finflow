import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { AlertCircle, IndianRupee, Trash, Edit2 } from 'lucide-react';
import { TransactionDrawer } from '../components/expenses/TransactionDrawer';
import { ScrollArea } from '../components/ui/scroll-area';
import { ConfirmModal } from '../components/ui/confirm-modal';
import { AIInsightsCard } from '../components/ai/AIInsightsCard';
import { SavingsGoalsCard } from '../components/expenses/SavingsGoalsCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '../components/ui/dialog';



export const Dashboard: React.FC = () => {
  const { cycle, buckets, transactions, isLoading, setupMonth, closeMonth, deleteTransaction, editIncome } = useFinance();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [incomeInput, setIncomeInput] = useState('');
  
  const [deleteTxParams, setDeleteTxParams] = useState<{id: string, bucketId: string, amount: number} | null>(null);
  const [showCloseMonthModal, setShowCloseMonthModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'goals' | 'ai'>('goals');
  const [isEditIncomeOpen, setIsEditIncomeOpen] = useState(false);
  const [editIncomeValue, setEditIncomeValue] = useState('');

  if (isLoading) {
    return <div className="text-zinc-400">Loading dashboard...</div>;
  }

  if (!cycle) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto pt-20">
        <h2 className="text-2xl font-semibold mb-2 text-zinc-50">No Active Cycle</h2>
        <p className="text-zinc-400 mb-6">Enter your total expected income for this month to set up your buckets.</p>
        <div className="w-full space-y-4">
          <Input 
            type="number" 
            placeholder="e.g. 50000" 
            value={incomeInput} 
            onChange={(e) => setIncomeInput(e.target.value)}
            className="bg-zinc-900 border-zinc-800 h-12 text-center text-lg"
          />
          <Button 
            className="w-full h-12 text-base bg-emerald-600 hover:bg-emerald-500 text-white"
            onClick={() => {
              if (incomeInput) setupMonth(Number(incomeInput));
            }}
          >
            Setup Month
          </Button>
        </div>
      </div>
    );
  }

  const needsBucket = buckets.find((b) => b.bucket_type === 'NEEDS');
  const wantsBucket = buckets.find((b) => b.bucket_type === 'WANTS');
  const bufferBucket = buckets.find((b) => b.bucket_type === 'BUFFER');

  const calculateRemaining = (bucket: any) => {
    if (!bucket) return 0;
    return bucket.allocated_amount - bucket.spent_amount;
  };

  const calculatePercentage = (bucket: any) => {
    if (!bucket || bucket.allocated_amount === 0) return 0;
    return (bucket.spent_amount / bucket.allocated_amount) * 100;
  };



  return (
    <div className="flex flex-col h-auto md:h-[calc(100vh-4rem)] space-y-6 pb-20 md:pb-0">
      {/* Header & Alerts */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Dashboard</h1>
            <Button variant="outline" size="sm" className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 h-8 text-xs" onClick={() => setShowCloseMonthModal(true)}>
              Close Month
            </Button>
          </div>
          <p className="text-zinc-400 mt-1">Cycle: {cycle.month_year}</p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-900/80 px-4 py-2 rounded-lg border border-zinc-800">
          <IndianRupee size={16} className="text-zinc-400" />
          <span className="font-semibold text-zinc-200">
            {buckets.reduce((acc, b) => acc + calculateRemaining(b), 0).toLocaleString('en-IN')} left
          </span>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800 relative group">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Income</CardTitle>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-zinc-500 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-opacity" 
              onClick={() => {
                setEditIncomeValue(cycle.total_income.toString());
                setIsEditIncomeOpen(true);
              }}
            >
              <Edit2 size={12} />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{cycle.total_income.toLocaleString('en-IN')}</div>
            <p className="text-xs text-zinc-500 mt-1">Fixed: ₹{cycle.total_fixed.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors relative" onClick={() => setIsDrawerOpen(true)}>
          <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                Needs
                {calculatePercentage(needsBucket) > 85 && (
                  <span className="flex items-center gap-1 text-[10px] font-medium text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-full">
                    <AlertCircle size={10} />
                    Low
                  </span>
                )}
              </CardTitle>
              <p className="text-[10px] text-zinc-500 mt-1 font-normal">Groceries, rent, utilities</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{calculateRemaining(needsBucket).toLocaleString('en-IN')}</div>
            <Progress value={calculatePercentage(needsBucket)} className="h-1 mt-3 bg-zinc-800" indicatorClassName={calculatePercentage(needsBucket) > 85 ? "bg-red-500" : "bg-emerald-500"} />
            <p className="text-xs text-zinc-500 mt-2">of ₹{needsBucket?.allocated_amount.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors" onClick={() => setIsDrawerOpen(true)}>
          <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-medium text-zinc-400">Wants</CardTitle>
              <p className="text-[10px] text-zinc-500 mt-1 font-normal">Dining out, hobbies, shopping</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-yellow-400 mt-1.5" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{calculateRemaining(wantsBucket).toLocaleString('en-IN')}</div>
            <Progress value={calculatePercentage(wantsBucket)} className="h-1 mt-3 bg-zinc-800" indicatorClassName="bg-yellow-400" />
            <p className="text-xs text-zinc-500 mt-2">of ₹{wantsBucket?.allocated_amount.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900/50 border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors" onClick={() => setIsDrawerOpen(true)}>
          <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-medium text-zinc-400">Buffer</CardTitle>
              <p className="text-[10px] text-zinc-500 mt-1 font-normal">Emergencies, extra savings</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{calculateRemaining(bufferBucket).toLocaleString('en-IN')}</div>
            <Progress value={calculatePercentage(bufferBucket)} className="h-1 mt-3 bg-zinc-800" indicatorClassName="bg-red-500" />
            <p className="text-xs text-zinc-500 mt-2">of ₹{bufferBucket?.allocated_amount.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0 pb-4">
        {/* Transactions List */}
        <Card className="md:col-span-2 bg-zinc-900/50 border-zinc-800 flex flex-col min-h-0">
          <CardHeader className="shrink-0">
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {transactions.slice(0, 50).map((tx) => {
                  const bucket = buckets.find(b => b.id === tx.bucket_id);
                  const isNeeds = bucket?.bucket_type === 'NEEDS';
                  const isWants = bucket?.bucket_type === 'WANTS';
                  
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isNeeds ? 'bg-emerald-500' : isWants ? 'bg-yellow-400' : 'bg-red-500'}`} />
                        <div>
                          <p className="text-sm font-medium text-zinc-200">{tx.description}</p>
                          <p className="text-xs text-zinc-500">{new Date(tx.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="font-semibold text-zinc-300">-₹{tx.amount.toLocaleString('en-IN')}</div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-zinc-900" onClick={() => setDeleteTxParams({ id: tx.id, bucketId: tx.bucket_id, amount: tx.amount })}>
                          <Trash size={16} />
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {transactions.length === 0 && (
                  <div className="text-center text-zinc-500 py-6">No transactions yet.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <div className="flex flex-col min-h-0 space-y-4">
          <div className="flex bg-zinc-900/80 p-1 rounded-lg border border-zinc-800 shrink-0">
            <button
              onClick={() => setActiveTab('goals')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'goals' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Savings Goals
            </button>
            <button
              onClick={() => setActiveTab('ai')}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${activeTab === 'ai' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              AI Insights
            </button>
          </div>
          <div className="flex-1 min-h-0 relative">
            <div className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === 'goals' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
              <SavingsGoalsCard />
            </div>
            <div className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === 'ai' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
              <AIInsightsCard />
            </div>
          </div>
        </div>
      </div>

      <TransactionDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />

      <ConfirmModal 
        open={!!deleteTxParams} 
        onOpenChange={(o) => !o && setDeleteTxParams(null)}
        title="Delete Transaction"
        description="Are you sure you want to delete this transaction? The amount will be refunded to your budget."
        onConfirm={() => deleteTxParams && deleteTransaction(deleteTxParams.id, deleteTxParams.bucketId, deleteTxParams.amount)}
      />

      <ConfirmModal 
        open={showCloseMonthModal} 
        onOpenChange={setShowCloseMonthModal}
        title="Close Month"
        description="Are you sure you want to close this month? This will create a new cycle for the upcoming month and automatically roll over your unused Buffer money into it."
        confirmText="Yes, Close Month"
        variant="default"
        onConfirm={closeMonth}
      />

      <Dialog open={isEditIncomeOpen} onOpenChange={setIsEditIncomeOpen}>
        <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-50 sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Total Income</DialogTitle>
            <DialogDescription className="text-zinc-400 mt-1">
              Updating your income will recalculate your buckets, but it will preserve any rollover buffer you had from last month.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input 
              type="number" 
              value={editIncomeValue} 
              onChange={(e) => setEditIncomeValue(e.target.value)}
              className="bg-zinc-900 border-zinc-800 text-zinc-100"
              placeholder="Total Income"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-zinc-800 bg-transparent hover:bg-zinc-900 text-zinc-300" onClick={() => setIsEditIncomeOpen(false)}>
              Cancel
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-500 text-white"
              onClick={() => {
                if (editIncomeValue) {
                  editIncome(Number(editIncomeValue));
                  setIsEditIncomeOpen(false);
                }
              }}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
