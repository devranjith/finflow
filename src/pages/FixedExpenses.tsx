import React from 'react';
import { useFinance } from '../context/FinanceContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../components/ui/dialog';
import { Receipt, Plus, Pencil, Trash } from 'lucide-react';
import { ConfirmModal } from '../components/ui/confirm-modal';
import { ScrollArea } from '../components/ui/scroll-area';
import type { FixedExpense } from '../types/database';

export const FixedExpenses: React.FC = () => {
  const { fixedExpenses, isLoading, addFixedExpense, editFixedExpense, deleteFixedExpense } = useFinance();
  const [isOpen, setIsOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [deleteExpenseId, setDeleteExpenseId] = React.useState<string | null>(null);
  const [name, setName] = React.useState('');
  const [amount, setAmount] = React.useState('');
  const [category, setCategory] = React.useState('');

  const handleAddClick = () => {
    setEditingId(null);
    setName('');
    setAmount('');
    setCategory('');
    setIsOpen(true);
  };

  const handleEditClick = (expense: FixedExpense) => {
    setEditingId(expense.id);
    setName(expense.name);
    setAmount(expense.amount.toString());
    setCategory(expense.category);
    setIsOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name && amount && category) {
      if (editingId) {
        await editFixedExpense(editingId, name, Number(amount), category);
      } else {
        await addFixedExpense(name, Number(amount), category);
      }
      setIsOpen(false);
    }
  };

  if (isLoading) {
    return <div className="text-zinc-400">Loading expenses...</div>;
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)] space-y-6 max-w-4xl mx-auto pb-20 md:pb-4">
      <div className="flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Fixed Expenses</h1>
          <p className="text-zinc-400 mt-1">Manage your recurring monthly commitments.</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2" onClick={handleAddClick}>
            <Plus size={18} />
            Add Expense
          </Button>
          <DialogContent className="bg-zinc-900 border-zinc-800 text-zinc-50 sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Fixed Expense" : "Add Fixed Expense"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Expense Name</label>
                <Input 
                  placeholder="e.g. Rent, Internet" 
                  value={name} 
                  onChange={(e) => setName(e.target.value)}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Monthly Amount (₹)</label>
                <Input 
                  type="number" 
                  placeholder="e.g. 15000" 
                  value={amount} 
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-zinc-400">Category</label>
                <Input 
                  placeholder="e.g. Housing, Utilities" 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-zinc-950 border-zinc-800"
                  required
                />
              </div>
              <DialogFooter className="mt-6">
                <DialogClose>
                  <Button type="button" variant="ghost">Cancel</Button>
                </DialogClose>
                <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white">
                  Save Expense
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800 flex flex-col flex-1 min-h-0">
        <CardHeader className="shrink-0">
          <CardTitle className="text-lg flex items-center gap-2">
            <Receipt size={20} className="text-zinc-400" />
            Current Fixed Expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <ScrollArea className="h-full pr-4">
            <div className="space-y-4">
              {fixedExpenses.length === 0 ? (
                <p className="text-zinc-500">No fixed expenses configured.</p>
              ) : (
                fixedExpenses.map((expense) => (
                  <div key={expense.id} className="flex justify-between items-center p-4 rounded-lg bg-zinc-950/50 border border-zinc-800/50">
                    <div>
                      <h4 className="font-medium text-zinc-200">{expense.name}</h4>
                      <p className="text-sm text-zinc-500">{expense.category}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="font-semibold text-zinc-300">
                        ₹{expense.amount.toLocaleString('en-IN')}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(expense)} className="h-8 w-8 text-zinc-400 hover:text-emerald-400">
                          <Pencil size={16} />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteExpenseId(expense.id)} className="h-8 w-8 text-zinc-400 hover:text-red-400">
                          <Trash size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <ConfirmModal 
        open={!!deleteExpenseId} 
        onOpenChange={(o) => !o && setDeleteExpenseId(null)}
        title="Delete Fixed Expense"
        description="Are you sure you want to delete this fixed expense? This will instantly recalculate your remaining available income."
        onConfirm={() => deleteExpenseId && deleteFixedExpense(deleteExpenseId)}
      />
    </div>
  );
};
