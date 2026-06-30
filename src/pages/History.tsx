import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { Card, CardContent, CardHeader } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Download, Search } from 'lucide-react';
import { Input } from '../components/ui/input';
import { ScrollArea } from '../components/ui/scroll-area';
import type { Transaction } from '../types/database';

type HistoryItem = Transaction & {
  bucket_type: string;
  month_year: string;
};

type CycleSummary = {
  id: string;
  month_year: string;
  total_income: number;
  total_spent: number;
  unspent_buffer: number;
};

export const History: React.FC = () => {
  const { user } = useAuth();
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>([]);
  const [cycleSummaries, setCycleSummaries] = useState<CycleSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState('all');
  const [activeTab, setActiveTab] = useState<'transactions' | 'summaries'>('transactions');

  useEffect(() => {
    const fetchHistory = async () => {
      if (!user) return;
      setIsLoading(true);
      try {
        // 1. Fetch all cycles for user
        const { data: cycles } = await supabase.from('cycles').select('*').eq('user_id', user.id);
        if (!cycles || cycles.length === 0) return;
        
        const cycleIds = cycles.map(c => c.id);

        // 2. Fetch all buckets for those cycles
        const { data: buckets } = await supabase.from('buckets').select('*').in('cycle_id', cycleIds);
        
        // 3. Fetch all transactions for those cycles
        const { data: transactions } = await supabase.from('transactions').select('*').in('cycle_id', cycleIds).order('date', { ascending: false });

        if (transactions && buckets) {
          const items: HistoryItem[] = transactions.map(tx => {
            const cycle = cycles.find(c => c.id === tx.cycle_id);
            const bucket = buckets.find(b => b.id === tx.bucket_id);
            return {
              ...tx,
              bucket_type: bucket?.bucket_type || 'UNKNOWN',
              month_year: cycle?.month_year || 'UNKNOWN'
            };
          });
          setHistoryItems(items);

          const summaries: CycleSummary[] = cycles.map(cycle => {
            const cycleBuckets = buckets.filter(b => b.cycle_id === cycle.id);
            const totalSpent = cycleBuckets.reduce((acc, b) => acc + b.spent_amount, 0);
            const bufferBucket = cycleBuckets.find(b => b.bucket_type === 'BUFFER');
            const unspentBuffer = bufferBucket ? (bufferBucket.allocated_amount - bufferBucket.spent_amount) : 0;
            
            return {
              id: cycle.id,
              month_year: cycle.month_year,
              total_income: cycle.total_income,
              total_spent: totalSpent,
              unspent_buffer: unspentBuffer
            };
          }).sort((a, b) => b.month_year.localeCompare(a.month_year));
          
          setCycleSummaries(summaries);
        }
      } catch (e) {
        console.error('Error fetching history:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, [user]);

  const uniqueMonths = Array.from(new Set(historyItems.map(item => item.month_year))).sort((a, b) => b.localeCompare(a));

  const filteredItems = historyItems.filter(item => {
    const matchesSearch = item.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.bucket_type.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesMonth = filterMonth === 'all' || item.month_year === filterMonth;
    return matchesSearch && matchesMonth;
  });

  const exportCSV = () => {
    if (historyItems.length === 0) return;
    
    const headers = ['Date', 'Cycle', 'Bucket', 'Description', 'Amount'];
    const csvRows = historyItems.map(item => [
      new Date(item.date).toLocaleDateString(),
      item.month_year,
      item.bucket_type,
      `"${item.description.replace(/"/g, '""')}"`, // escape quotes
      item.amount.toString()
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvRows.map(e => e.join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `finflow-history-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col h-auto md:h-[calc(100vh-4rem)] space-y-6 max-w-4xl mx-auto pb-20 md:pb-4">
      <div className="flex justify-between items-end mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Transaction History</h1>
          <p className="text-zinc-400 mt-1">View and export all your past transactions.</p>
        </div>
        <Button onClick={exportCSV} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
          <Download size={16} />
          Export CSV
        </Button>
      </div>

      <div className="flex bg-zinc-900/80 p-1 rounded-lg border border-zinc-800 shrink-0 mx-auto w-full max-w-sm mb-4">
        <button
          onClick={() => setActiveTab('transactions')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'transactions' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          Transactions
        </button>
        <button
          onClick={() => setActiveTab('summaries')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'summaries' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
        >
          Monthly Summaries
        </button>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800 flex flex-col flex-1 min-h-0 relative overflow-hidden">
        {/* TRANSACTIONS TAB */}
        <div className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === 'transactions' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <CardHeader className="pb-4 shrink-0 flex flex-row items-center gap-4 space-y-0">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <Input 
              placeholder="Search transactions..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-zinc-950 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 w-full"
            />
          </div>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-w-[140px]"
          >
            <option value="all">All Months</option>
            {uniqueMonths.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          {isLoading ? (
            <div className="text-zinc-500 text-center py-8">Loading history...</div>
          ) : (
            <ScrollArea className="h-full pr-4">
              <div className="space-y-3">
                {filteredItems.map(item => {
                  const isNeeds = item.bucket_type === 'NEEDS';
                  const isWants = item.bucket_type === 'WANTS';
                  return (
                    <div key={item.id} className="flex items-center justify-between p-4 rounded-lg bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${isNeeds ? 'bg-emerald-500' : isWants ? 'bg-yellow-400' : 'bg-red-500'}`} />
                        <div>
                          <p className="font-medium text-zinc-100">{item.description}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-zinc-500">{new Date(item.date).toLocaleDateString()}</span>
                            <span className="text-xs text-zinc-600">•</span>
                            <span className="text-xs text-zinc-400 font-medium">{item.bucket_type}</span>
                            <span className="text-xs text-zinc-600">•</span>
                            <span className="text-xs text-zinc-500">{item.month_year}</span>
                          </div>
                        </div>
                      </div>
                      <div className="font-semibold text-zinc-200">-₹{item.amount.toLocaleString('en-IN')}</div>
                    </div>
                  );
                })}
                {filteredItems.length === 0 && (
                  <div className="text-center text-zinc-500 py-12">No transactions found.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </div>

        {/* SUMMARIES TAB */}
        <div className={`absolute inset-0 flex flex-col transition-opacity duration-200 ${activeTab === 'summaries' ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}>
          <CardHeader className="pb-4 shrink-0">
            <h2 className="text-xl font-semibold text-zinc-100">Monthly Leftovers & Savings</h2>
            <p className="text-sm text-zinc-400 mt-1">Track how much unspent money you rolled over at the end of each month.</p>
          </CardHeader>
          <CardContent className="flex-1 min-h-0">
            <ScrollArea className="h-full pr-4">
              <div className="space-y-4">
                {cycleSummaries.map(summary => (
                  <div key={summary.id} className="p-5 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
                    <div className="flex items-center justify-between mb-4 pb-4 border-b border-zinc-800/50">
                      <h3 className="text-lg font-semibold text-zinc-100">{summary.month_year}</h3>
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-zinc-500">Unspent / Rolled Over</span>
                        <span className="text-xl font-bold text-emerald-400">₹{summary.unspent_buffer.toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Total Income</p>
                        <p className="font-medium text-zinc-200">₹{summary.total_income.toLocaleString('en-IN')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500 mb-1">Total Spent</p>
                        <p className="font-medium text-zinc-200">₹{summary.total_spent.toLocaleString('en-IN')}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {cycleSummaries.length === 0 && (
                  <div className="text-center text-zinc-500 py-12">No cycle data found.</div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </div>
      </Card>
    </div>
  );
};
