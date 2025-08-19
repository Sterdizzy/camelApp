
import React from "react";
import { format } from "date-fns";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Edit, Trash2, Calendar, DollarSign, TrendingUp, Check } from "lucide-react";

export default function TransactionList({
  transactions,
  portfolios = [], // Add default empty array
  onEdit,
  onDelete,
  selectedTransactions,
  onToggleSelect,
  onToggleSelectAll
}) {
  if (transactions.length === 0) {
    return (
      <div className="text-center p-8 border-2 border-dashed border-slate-300 rounded-lg">
        <h3 className="font-semibold text-slate-700">No Transactions Recorded</h3>
        <p className="text-sm text-slate-500 mt-1">Click "Record Transaction" to log your first trade.</p>
      </div>
    );
  }

  const areAllSelected = transactions.length > 0 && selectedTransactions.length === transactions.length;

  return (
    <>
      {/* Desktop Table View - Hidden on mobile */}
      <div className="hidden lg:block overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-200 hover:bg-transparent">
              <TableHead className="w-[50px]">
                <div className="flex items-center justify-center">
                  <button
                    onClick={onToggleSelectAll}
                    className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                      areAllSelected
                        ? 'bg-blue-600 border-blue-600 text-white'
                        : 'border-slate-300 hover:border-blue-400'
                    }`}
                    aria-label="Select all transactions"
                  >
                    {areAllSelected && <Check className="w-3 h-3" />}
                  </button>
                </div>
              </TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Symbol</TableHead>
              <TableHead>Portfolio</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Total Value</TableHead>
              <TableHead className="text-right">Stop-Loss</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {transactions.map(tx => {
              const portfolio = portfolios.find(p => p.id === tx.portfolio_id);
              const isSelected = selectedTransactions.includes(tx.id);
              
              return (
                <TableRow
                  key={tx.id}
                  className={`border-b border-slate-200 transition-all duration-200 ${
                    isSelected 
                      ? 'bg-blue-50' 
                      : 'hover:bg-slate-50'
                  }`}
                >
                  <TableCell>
                    <div className="flex items-center justify-center">
                      <button
                        onClick={() => onToggleSelect(tx.id)}
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                          isSelected
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'border-slate-300 hover:border-blue-400'
                        }`}
                        aria-label={`Select transaction ${tx.id}`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium text-slate-700">
                    {format(new Date(tx.transaction_date), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>
                    <Badge className={tx.type === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                      {tx.type.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="font-semibold text-slate-900">{tx.symbol}</div>
                    <div className="text-xs text-slate-500">{tx.name}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {portfolio ? portfolio.name : 'N/A'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-700">
                    {tx.quantity.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}
                  </TableCell>
                  <TableCell className="text-right font-mono text-slate-700">
                    ${tx.price.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-slate-900">
                    ${(tx.quantity * tx.price).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-red-600">
                    {tx.stop_loss_at_trade ? `$${tx.stop_loss_at_trade.toFixed(2)}` : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => onEdit(tx)} className="w-8 h-8">
                        <Edit className="w-4 h-4 text-slate-600" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => onDelete(tx.id)} className="w-8 h-8 text-red-500 hover:text-red-700">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Mobile Card View - Visible on mobile and tablet */}
      <div className="lg:hidden space-y-3">
        {/* Mobile Select All Control */}
        <div className="flex items-center gap-3 p-3 bg-slate-100 rounded-lg border border-slate-200">
          <button
            onClick={onToggleSelectAll}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
              areAllSelected
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-slate-300 hover:border-blue-400'
            }`}
            aria-label="Select all transactions"
          >
            {areAllSelected && <Check className="w-3 h-3" />}
          </button>
          <span className="text-sm font-medium text-slate-700">
            Select All ({transactions.length} transactions)
          </span>
        </div>

        {/* Mobile Transaction Cards */}
        {transactions.map(tx => {
          const portfolio = portfolios.find(p => p.id === tx.portfolio_id);
          const isSelected = selectedTransactions.includes(tx.id);
          
          return (
            <Card 
              key={tx.id} 
              className={`transition-all duration-200 ${
                isSelected 
                  ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200' 
                  : 'hover:shadow-md'
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => onToggleSelect(tx.id)}
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'border-slate-300 hover:border-blue-400'
                      }`}
                      aria-label={`Select transaction ${tx.id}`}
                    >
                      {isSelected && <Check className="w-3 h-3" />}
                    </button>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg text-slate-900">{tx.symbol}</span>
                        <Badge className={tx.type === 'buy' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>
                          {tx.type.toUpperCase()}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-600">{tx.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => onEdit(tx)}>
                      <Edit className="w-4 h-4 text-slate-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => onDelete(tx.id)} className="text-red-500 hover:text-red-700">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Date</p>
                      <p className="text-sm font-medium">{format(new Date(tx.transaction_date), "MMM d, yyyy")}</p>
                      <p className="text-xs text-slate-400">{format(new Date(tx.transaction_date), "HH:mm")}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Quantity</p>
                      <p className="text-sm font-medium">{tx.quantity.toLocaleString()}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-slate-400" />
                    <div>
                      <p className="text-xs text-slate-500">Price</p>
                      <p className="text-sm font-medium">${tx.price.toFixed(2)}</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Total Value</p>
                    <p className="text-sm font-bold text-slate-900">${(tx.quantity * tx.price).toFixed(2)}</p>
                  </div>
                </div>

                {portfolio && (
                  <div className="pt-2 border-t border-slate-200 mt-2">
                    <p className="text-xs text-slate-500">Portfolio</p>
                    <p className="text-sm font-medium">{portfolio.name}</p>
                  </div>
                )}

                {tx.stop_loss_at_trade && (
                  <div className="pt-2 border-t border-slate-200 mt-2">
                    <p className="text-xs text-slate-500">Stop-Loss</p>
                    <p className="text-sm font-medium text-red-600">${tx.stop_loss_at_trade.toFixed(2)}</p>
                  </div>
                )}

                {tx.notes && (
                  <div className="pt-2 border-t border-slate-200 mt-2">
                    <p className="text-xs text-slate-500">Notes</p>
                    <p className="text-sm text-slate-700">{tx.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </>
  );
}
