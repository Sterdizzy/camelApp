import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Portfolio } from '@/api/entities';
import { Loader2 } from 'lucide-react';

export default function CashManagerDialog({ open, onOpenChange, portfolio, onSuccess }) {
  const [amount, setAmount] = useState('');
  const [type, setType] = useState('deposit');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const transactionAmount = parseFloat(amount);
    if (isNaN(transactionAmount) || transactionAmount <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    const currentBalance = portfolio.cash_balance || 0;
    let newBalance;

    if (type === 'deposit') {
      newBalance = currentBalance + transactionAmount;
    } else {
      if (currentBalance < transactionAmount) {
        setError("Withdrawal amount cannot exceed cash balance.");
        setIsSubmitting(false);
        return;
      }
      newBalance = currentBalance - transactionAmount;
    }

    try {
      await Portfolio.update(portfolio.id, { cash_balance: newBalance });
      onSuccess();
      onOpenChange(false);
      setAmount('');
    } catch (err) {
      console.error('Failed to update cash balance:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage Cash in {portfolio?.name}</DialogTitle>
        </DialogHeader>
        <div className="py-4 space-y-4">
          <p className="text-sm text-slate-600">
            Current Cash Balance: 
            <span className="font-bold text-slate-800">
              {' '}${portfolio?.cash_balance?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </p>
          <Tabs value={type} onValueChange={setType} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g., 1000.00"
              min="0.01"
              step="0.01"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {type === 'deposit' ? 'Deposit Cash' : 'Withdraw Cash'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}