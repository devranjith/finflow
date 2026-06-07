import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import type { Cycle, Bucket, Transaction, FixedExpense } from '../types/database';

interface FinanceContextType {
  cycle: Cycle | null;
  buckets: Bucket[];
  transactions: Transaction[];
  fixedExpenses: FixedExpense[];
  isLoading: boolean;
  addTransaction: (bucketId: string, amount: number, description: string) => Promise<void>;
  borrowFromBucket: (fromBucketId: string, toBucketId: string, amount: number) => Promise<void>;
  setupMonth: (income: number) => Promise<void>;
  addFixedExpense: (name: string, amount: number, category: string) => Promise<void>;
  editFixedExpense: (id: string, name: string, amount: number, category: string) => Promise<void>;
  deleteFixedExpense: (id: string) => Promise<void>;
}

const FinanceContext = createContext<FinanceContextType>({
  cycle: null,
  buckets: [],
  transactions: [],
  fixedExpenses: [],
  isLoading: true,
  addTransaction: async () => {},
  borrowFromBucket: async () => {},
  setupMonth: async () => {},
  addFixedExpense: async () => {},
  editFixedExpense: async () => {},
  deleteFixedExpense: async () => {},
});

export const useFinance = () => useContext(FinanceContext);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fixedExpenses, setFixedExpenses] = useState<FixedExpense[]>([]);
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

  return (
    <FinanceContext.Provider value={{ cycle, buckets, transactions, fixedExpenses, isLoading, addTransaction, borrowFromBucket, setupMonth, addFixedExpense, editFixedExpense, deleteFixedExpense }}>
      {children}
    </FinanceContext.Provider>
  );
};
