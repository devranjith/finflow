import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import type { Cycle, Bucket, Transaction, FixedExpense, SavingsGoal } from '../types/database';

interface FinanceContextType {
  cycle: Cycle | null;
  buckets: Bucket[];
  transactions: Transaction[];
  fixedExpenses: FixedExpense[];
  savingsGoals: SavingsGoal[];
  isLoading: boolean;
  addTransaction: (bucketId: string, amount: number, description: string) => Promise<void>;
  borrowFromBucket: (fromBucketId: string, toBucketId: string, amount: number) => Promise<void>;
  setupMonth: (income: number) => Promise<void>;
  addFixedExpense: (name: string, amount: number, category: string) => Promise<void>;
  editFixedExpense: (id: string, name: string, amount: number, category: string) => Promise<void>;
  deleteFixedExpense: (id: string) => Promise<void>;
  deleteTransaction: (id: string, bucketId: string, amount: number) => Promise<void>;
  closeMonth: () => Promise<void>;
  addSavingsGoal: (name: string, target_amount: number) => Promise<void>;
  fundSavingsGoal: (id: string, amount: number) => Promise<void>;
  deleteSavingsGoal: (id: string) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType>({
  cycle: null,
  buckets: [],
  transactions: [],
  fixedExpenses: [],
  savingsGoals: [],
  isLoading: true,
  addTransaction: async () => {},
  borrowFromBucket: async () => {},
  setupMonth: async () => {},
  addFixedExpense: async () => {},
  editFixedExpense: async () => {},
  deleteFixedExpense: async () => {},
  deleteTransaction: async () => {},
  closeMonth: async () => {},
  addSavingsGoal: async () => {},
  fundSavingsGoal: async () => {},
  deleteSavingsGoal: async () => {},
});

export const useFinance = () => useContext(FinanceContext);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentMonthYear = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  const fetchData = async () => {
    if (!user) {
      setCycle(null);
      setBuckets([]);
      setTransactions([]);
      setFixedExpenses([]);
      setSavingsGoals([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Fetch Fixed Expenses
      const { data: feData } = await supabase
        .from('fixed_expenses')
        .select('*')
        .eq('user_id', user.id);
      if (feData) setFixedExpenses(feData);

      // Fetch Savings Goals
      const { data: sgData } = await supabase
        .from('savings_goals')
        .select('*')
        .eq('user_id', user.id);
      if (sgData) setSavingsGoals(sgData);

      // Fetch current cycle
      const { data: cycleData, error: cycleErr } = await supabase
        .from('cycles')
        .select('*')
        .eq('user_id', user.id)
        .eq('month_year', currentMonthYear)
        .maybeSingle();

      if (cycleErr) {
        console.error("Error fetching cycle:", cycleErr);
      }

      if (cycleData) {
        setCycle(cycleData);

        // Fetch buckets for cycle
        const { data: bucketData } = await supabase
          .from('buckets')
          .select('*')
          .eq('cycle_id', cycleData.id);
        if (bucketData) setBuckets(bucketData);

        // Fetch transactions for cycle
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .eq('cycle_id', cycleData.id)
          .order('date', { ascending: false });
        if (txData) setTransactions(txData);
      }
    } catch (e) {
      console.error("Exception in fetchData:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, currentMonthYear]);

  const addTransaction = async (bucketId: string, amount: number, description: string) => {
    if (!cycle) return;

    try {
      const { error } = await supabase.from('transactions').insert({
        cycle_id: cycle.id,
        bucket_id: bucketId,
        amount,
        description,
      });

      if (error) {
        console.error("Error adding transaction:", error);
      } else {
        // Manually update the bucket's spent_amount
        const bucket = buckets.find(b => b.id === bucketId);
        if (bucket) {
          await supabase.from('buckets').update({
            spent_amount: bucket.spent_amount + amount
          }).eq('id', bucket.id);
        }
        await fetchData();
      }
    } catch (e) {
      console.error("Exception adding transaction:", e);
    }
  };

  const deleteTransaction = async (id: string, bucketId: string, amount: number) => {
    if (!cycle) return;
    try {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
      if (error) {
        console.error("Error deleting transaction:", error);
      } else {
        const bucket = buckets.find(b => b.id === bucketId);
        if (bucket) {
          await supabase.from('buckets').update({
            spent_amount: bucket.spent_amount - amount
          }).eq('id', bucket.id);
        }
        await fetchData();
      }
    } catch (e) {
      console.error("Exception deleting transaction:", e);
    }
  };

  const borrowFromBucket = async (fromBucketId: string, toBucketId: string, amount: number) => {
    if (!cycle) return;
    
    const fromBucket = buckets.find(b => b.id === fromBucketId);
    const toBucket = buckets.find(b => b.id === toBucketId);

    if (fromBucket && toBucket) {
      await supabase.from('buckets').update({ allocated_amount: fromBucket.allocated_amount - amount }).eq('id', fromBucket.id);
      await supabase.from('buckets').update({ allocated_amount: toBucket.allocated_amount + amount }).eq('id', toBucket.id);
      await fetchData();
    }
  };

  const setupMonth = async (totalIncome: number) => {
    if (!user) return;
    setIsLoading(true);

    try {
      const totalFixed = fixedExpenses.reduce((acc, exp) => acc + exp.amount, 0);
      const leftover = totalIncome - totalFixed;

      // 50/30/20 rule allocation
      const needsAmount = leftover * 0.5;
      const wantsAmount = leftover * 0.3;
      const bufferAmount = leftover * 0.2;

      const { data: newCycle, error: cycleError } = await supabase.from('cycles').insert({
        user_id: user.id,
        month_year: currentMonthYear,
        total_income: totalIncome,
        total_fixed: totalFixed,
        leftover_money: leftover
      }).select().single();

      if (cycleError) {
        console.error("Error creating cycle:", cycleError);
      }

      if (newCycle && !cycleError) {
        const { error: bucketsError } = await supabase.from('buckets').insert([
          { cycle_id: newCycle.id, bucket_type: 'NEEDS', allocated_amount: needsAmount },
          { cycle_id: newCycle.id, bucket_type: 'WANTS', allocated_amount: wantsAmount },
          { cycle_id: newCycle.id, bucket_type: 'BUFFER', allocated_amount: bufferAmount },
        ]);
        if (bucketsError) console.error("Error creating buckets:", bucketsError);
        
        await fetchData();
      }
    } catch (e) {
      console.error("Exception in setupMonth:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const closeMonth = async () => {
    if (!user || !cycle) return;
    setIsLoading(true);
    try {
      // Calculate remaining buffer from current cycle
      const bufferBucket = buckets.find(b => b.bucket_type === 'BUFFER');
      const rolloverAmount = bufferBucket ? (bufferBucket.allocated_amount - bufferBucket.spent_amount) : 0;
      
      // Calculate next month string
      const now = new Date();
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonthYear = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}`;

      // Insert new cycle carrying over income/fixed, but with added rollover buffer logic
      const totalFixed = fixedExpenses.reduce((acc, exp) => acc + exp.amount, 0);
      const leftover = cycle.total_income - totalFixed;

      const needsAmount = leftover * 0.5;
      const wantsAmount = leftover * 0.3;
      // The new buffer gets its 20% PLUS the rollover from the previous month
      const bufferAmount = (leftover * 0.2) + Math.max(0, rolloverAmount);

      const { data: newCycle, error: cycleError } = await supabase.from('cycles').insert({
        user_id: user.id,
        month_year: nextMonthYear,
        total_income: cycle.total_income,
        total_fixed: totalFixed,
        leftover_money: leftover
      }).select().single();

      if (cycleError) console.error("Error closing month:", cycleError);

      if (newCycle && !cycleError) {
        await supabase.from('buckets').insert([
          { cycle_id: newCycle.id, bucket_type: 'NEEDS', allocated_amount: needsAmount },
          { cycle_id: newCycle.id, bucket_type: 'WANTS', allocated_amount: wantsAmount },
          { cycle_id: newCycle.id, bucket_type: 'BUFFER', allocated_amount: bufferAmount },
        ]);
        alert("Month closed and buffer rolled over to next month! It will become visible on the 1st.");
      }
    } catch (e) {
      console.error("Exception closing month:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const syncCycleWithFixedExpenses = async () => {
    if (!user) return;
    
    // 1. Fetch the latest fixed expenses directly from the DB
    const { data: latestFe } = await supabase.from('fixed_expenses').select('*').eq('user_id', user.id);
    if (!latestFe) return;

    // 2. Fetch the current active cycle directly
    const { data: activeCycle } = await supabase.from('cycles').select('*').eq('user_id', user.id).eq('month_year', currentMonthYear).maybeSingle();
    if (!activeCycle) {
      await fetchData();
      return; // No active cycle to update, just refresh UI
    }

    const totalFixed = latestFe.reduce((acc, exp) => acc + exp.amount, 0);
    const leftover = activeCycle.total_income - totalFixed;

    // 50/30/20 rule allocation
    const needsAmount = leftover * 0.5;
    const wantsAmount = leftover * 0.3;
    const bufferAmount = leftover * 0.2;

    // Update cycle
    await supabase.from('cycles').update({
      total_fixed: totalFixed,
      leftover_money: leftover
    }).eq('id', activeCycle.id);

    // Update buckets
    const { data: cycleBuckets } = await supabase.from('buckets').select('*').eq('cycle_id', activeCycle.id);
    if (cycleBuckets) {
      const needsBucket = cycleBuckets.find(b => b.bucket_type === 'NEEDS');
      const wantsBucket = cycleBuckets.find(b => b.bucket_type === 'WANTS');
      const bufferBucket = cycleBuckets.find(b => b.bucket_type === 'BUFFER');

      if (needsBucket) await supabase.from('buckets').update({ allocated_amount: needsAmount }).eq('id', needsBucket.id);
      if (wantsBucket) await supabase.from('buckets').update({ allocated_amount: wantsAmount }).eq('id', wantsBucket.id);
      if (bufferBucket) await supabase.from('buckets').update({ allocated_amount: bufferAmount }).eq('id', bufferBucket.id);
    }

    await fetchData();
  };

  const addFixedExpense = async (name: string, amount: number, category: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('fixed_expenses').insert({
        user_id: user.id,
        name,
        amount,
        category
      });
      if (error) {
        console.error("Error adding fixed expense:", error);
      } else {
        await syncCycleWithFixedExpenses();
      }
    } catch (e) {
      console.error("Exception adding fixed expense:", e);
    }
  };

  const editFixedExpense = async (id: string, name: string, amount: number, category: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('fixed_expenses').update({
        name, amount, category
      }).eq('id', id).eq('user_id', user.id);
      
      if (error) console.error("Error editing fixed expense:", error);
      else await syncCycleWithFixedExpenses();
    } catch (e) {
      console.error("Exception editing fixed expense:", e);
    }
  };

  const deleteFixedExpense = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('fixed_expenses').delete().eq('id', id).eq('user_id', user.id);
      if (error) console.error("Error deleting fixed expense:", error);
      else await syncCycleWithFixedExpenses();
    } catch (e) {
      console.error("Exception deleting fixed expense:", e);
    }
  };

  const addSavingsGoal = async (name: string, target_amount: number) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('savings_goals').insert({
        user_id: user.id,
        name,
        target_amount,
        current_amount: 0
      });
      if (error) console.error("Error adding savings goal:", error);
      else await fetchData();
    } catch (e) {
      console.error("Exception adding savings goal:", e);
    }
  };

  const fundSavingsGoal = async (id: string, amount: number) => {
    if (!user) return;
    try {
      const goal = savingsGoals.find(g => g.id === id);
      if (!goal) return;
      
      const { error } = await supabase.from('savings_goals').update({
        current_amount: goal.current_amount + amount
      }).eq('id', id).eq('user_id', user.id);
      
      if (error) console.error("Error funding savings goal:", error);
      else await fetchData();
    } catch (e) {
      console.error("Exception funding savings goal:", e);
    }
  };

  const deleteSavingsGoal = async (id: string) => {
    if (!user) return;
    try {
      const { error } = await supabase.from('savings_goals').delete().eq('id', id).eq('user_id', user.id);
      if (error) console.error("Error deleting savings goal:", error);
      else await fetchData();
    } catch (e) {
      console.error("Exception deleting savings goal:", e);
    }
  };

  return (
    <FinanceContext.Provider value={{ 
      cycle, buckets, transactions, fixedExpenses, savingsGoals, isLoading, 
      addTransaction, borrowFromBucket, setupMonth, addFixedExpense, 
      editFixedExpense, deleteFixedExpense, deleteTransaction, closeMonth,
      addSavingsGoal, fundSavingsGoal, deleteSavingsGoal 
    }}>
      {children}
    </FinanceContext.Provider>
  );
};
