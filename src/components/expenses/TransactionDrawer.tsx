import React, { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useFinance } from '../../context/FinanceContext';
import { AlertCircle } from 'lucide-react';

export const TransactionDrawer: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({
  open,
  onOpenChange,
}) => {
  const { buckets, addTransaction, borrowFromBucket } = useFinance();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBucketType, setSelectedBucketType] = useState<'NEEDS' | 'WANTS' | 'BUFFER'>('BUFFER');
  
  const [shortfall, setShortfall] = useState<{ amount: number; bucket: any } | null>(null);

  const bucketDescriptions = {
    NEEDS: 'Essential living expenses',
    WANTS: 'Fun & discretionary',
    BUFFER: 'Emergencies & savings'
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmount = parseFloat(amount);
    if (!numAmount || !description) return;

    const bucket = buckets.find(b => b.bucket_type === selectedBucketType);
    if (!bucket) return;

    const remaining = bucket.allocated_amount - bucket.spent_amount;

    if (numAmount > remaining) {
      // Shortfall logic
      setShortfall({ amount: numAmount - remaining, bucket });
      return;
    }

    await addTransaction(bucket.id, numAmount, description);
    resetAndClose();
  };

  const handleBorrow = async () => {
    if (!shortfall) return;
    
    // Attempt to borrow from Wants, then Buffer, then Needs
    // For simplicity, if we are short on BUFFER, we pull from WANTS
    // If we are short on NEEDS, we pull from BUFFER
    
    const { amount: shortAmount, bucket: shortBucket } = shortfall;
    let fromBucket = null;

    if (shortBucket.bucket_type === 'BUFFER') fromBucket = buckets.find(b => b.bucket_type === 'WANTS');
    if (shortBucket.bucket_type === 'NEEDS') fromBucket = buckets.find(b => b.bucket_type === 'BUFFER');
    if (shortBucket.bucket_type === 'WANTS') fromBucket = buckets.find(b => b.bucket_type === 'BUFFER');

    if (fromBucket) {
      await borrowFromBucket(fromBucket.id, shortBucket.id, shortAmount);
      // Now the bucket has enough, add the transaction
      await addTransaction(shortBucket.id, parseFloat(amount), description);
      resetAndClose();
    } else {
      alert("Not enough funds in other buckets to cover this.");
    }
  };

  const resetAndClose = () => {
    setAmount('');
    setDescription('');
    setShortfall(null);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-zinc-950 border-zinc-800 text-zinc-50 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-zinc-50">Log Expense</SheetTitle>
          <SheetDescription className="text-zinc-400">
            Instantly deduct from your buckets. We'll handle the math.
          </SheetDescription>
        </SheetHeader>

        {shortfall ? (
          <div className="mt-8 space-y-6 animate-in fade-in slide-in-from-right-4">
            <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-red-400 mt-0.5" size={20} />
                <div>
                  <h4 className="text-red-400 font-medium">Insufficient Funds</h4>
                  <p className="text-sm text-red-400/80 mt-1">
                    You are short by ₹{shortfall.amount.toLocaleString('en-IN')} in your {shortfall.bucket.bucket_type.toLowerCase()} bucket.
                  </p>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-zinc-400">
              Would you like to automatically pull the remaining ₹{shortfall.amount.toLocaleString('en-IN')} from another bucket to cover this expense?
            </p>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1 border-zinc-700 hover:bg-zinc-800" onClick={() => setShortfall(null)}>
                Cancel
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={handleBorrow}>
                Cover Expense
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 mt-8">
            <div className="space-y-2">
              <Label className="text-zinc-300">Amount (₹)</Label>
              <Input
                type="number"
                placeholder="2500"
                value={amount}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
                className="bg-zinc-900 border-zinc-800 text-lg h-12"
                required
              />
            </div>

            <div className="space-y-2">
              <Label className="text-zinc-300">Description</Label>
              <Input
                placeholder="Bike repair, Groceries, etc."
                value={description}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                className="bg-zinc-900 border-zinc-800 h-12"
                required
              />
            </div>

            <div className="space-y-3">
              <Label className="text-zinc-300">Select Bucket</Label>
              <div className="grid grid-cols-3 gap-3">
                {(['NEEDS', 'WANTS', 'BUFFER'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setSelectedBucketType(type)}
                    className={`p-3 rounded-lg border flex flex-col items-center gap-2 transition-all ${
                      selectedBucketType === type
                        ? 'bg-zinc-800 border-zinc-600 shadow-md'
                        : 'bg-zinc-900/50 border-zinc-800 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full ${
                        type === 'NEEDS' ? 'bg-emerald-500' : type === 'WANTS' ? 'bg-yellow-400' : 'bg-red-500'
                      }`}
                    />
                    <span className="text-xs font-medium">{type}</span>
                    <span className="text-[9px] text-zinc-500 leading-tight text-center px-1">
                      {bucketDescriptions[type]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" className="w-full bg-white text-zinc-900 hover:bg-zinc-200 h-12 mt-4">
              Deduct Expense
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
};
