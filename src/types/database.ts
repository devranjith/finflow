export type Profile = {
  id: string;
  email: string;
  name: string | null;
  dependents: number;
  default_income: number;
  created_at: string;
};

export type FixedExpense = {
  id: string;
  user_id: string;
  name: string;
  category: string;
  amount: number;
  created_at: string;
};

export type Cycle = {
  id: string;
  user_id: string;
  month_year: string;
  total_income: number;
  total_fixed: number;
  leftover_money: number;
  created_at: string;
};

export type Bucket = {
  id: string;
  cycle_id: string;
  bucket_type: 'NEEDS' | 'WANTS' | 'BUFFER';
  allocated_amount: number;
  spent_amount: number;
};

export type Transaction = {
  id: string;
  cycle_id: string;
  bucket_id: string;
  description: string;
  amount: number;
  date: string;
};
