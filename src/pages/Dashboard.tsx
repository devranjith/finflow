import React, { useState } from 'react';
import { useFinance } from '../context/FinanceContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Progress } from '../components/ui/progress';
import { AlertCircle, IndianRupee, Trash } from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TransactionDrawer } from '../components/expenses/TransactionDrawer';
import { ScrollArea } from '../components/ui/scroll-area';


export const Dashboard: React.FC = () => {
  const { cycle, buckets, transactions, isLoading, setupMonth, closeMonth, deleteTransaction } = useFinance();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [incomeInput, setIncomeInput] = useState('');

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

  const chartData = [
    { name: 'Needs', spent: needsBucket?.spent_amount || 0, fill: '#10b981' },
    { name: 'Wants', spent: wantsBucket?.spent_amount || 0, fill: '#facc15' },
    { name: 'Buffer', spent: bufferBucket?.spent_amount || 0, fill: '#ef4444' },
  ];

  return (
    <div className="space-y-6 pb-20">
      {/* Header & Alerts */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <div className="flex items-center gap-4">
            <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Dashboard</h1>
            <Button variant="outline" size="sm" className="border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300 h-8 text-xs" onClick={() => {
              if (window.confirm("Are you sure you want to close this month and rollover your buffer to the next month?")) closeMonth();
            }}>
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

      {/* Warning Banner (Example Logic) */}
      {calculatePercentage(needsBucket) > 85 && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl flex items-start gap-3">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <div>
            <h4 className="font-medium">Low Balance Alert</h4>
            <p className="text-sm mt-1 opacity-90">Your 'Needs' bucket is running very low. Consider pausing discretionary spending.</p>
          </div>
        </div>
      )}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-zinc-400">Total Income</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{cycle.total_income.toLocaleString('en-IN')}</div>
            <p className="text-xs text-zinc-500 mt-1">Fixed: ₹{cycle.total_fixed.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        
        <Card className="bg-zinc-900/50 border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors" onClick={() => setIsDrawerOpen(true)}>
          <CardHeader className="pb-2 flex flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-medium text-zinc-400">Needs</CardTitle>
              <p className="text-[10px] text-zinc-500 mt-1 font-normal">Groceries, rent, utilities</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1.5" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{calculateRemaining(needsBucket).toLocaleString('en-IN')}</div>
            <Progress value={calculatePercentage(needsBucket)} className="h-1 mt-3 bg-zinc-800" indicatorClassName="bg-emerald-500" />
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Transactions List */}
        <Card className="md:col-span-2 bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[300px] pr-4">
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
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-red-400 hover:bg-zinc-900" onClick={() => {
                          if (window.confirm("Delete this transaction?")) deleteTransaction(tx.id, tx.bucket_id, tx.amount);
                        }}>
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

        {/* Spending Trends */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-lg">Spending Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="name" stroke="#71717a" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{fill: '#27272a', opacity: 0.4}}
                    contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                  <Bar dataKey="spent" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <TransactionDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
    </div>
  );
};
