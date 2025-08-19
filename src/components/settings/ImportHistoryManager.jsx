import React, { useState, useEffect } from "react";
import { ImportHistory, Transaction } from "@/api/entities";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  History, 
  RotateCcw, 
  FileText, 
  AlertTriangle, 
  CheckCircle,
  Calendar,
  Loader2,
  Eye,
  Info
} from "lucide-react";
import { format } from "date-fns";

export default function ImportHistoryManager() {
  const [importHistory, setImportHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedImport, setSelectedImport] = useState(null);
  const [errorDetailsDialog, setErrorDetailsDialog] = useState(null);
  const [isRollingBack, setIsRollingBack] = useState(false);

  useEffect(() => {
    loadImportHistory();
  }, []);

  const loadImportHistory = async () => {
    setIsLoading(true);
    try {
      const history = await ImportHistory.list("-import_date");
      setImportHistory(history);
    } catch (error) {
      console.error("Failed to load import history:", error);
    }
    setIsLoading(false);
  };

  const handleViewErrors = (importRecord) => {
    try {
      const errorDetails = JSON.parse(importRecord.error_details || '{"skipped_rows": []}');
      setErrorDetailsDialog({ import: importRecord, errors: errorDetails });
    } catch (error) {
      console.error("Failed to parse error details:", error);
      alert("Unable to display error details - data may be corrupted");
    }
  };

  const handleRollback = async (importRecord) => {
    if (importRecord.status === 'rolled_back') {
      alert("This import has already been rolled back.");
      return;
    }

    if (!window.confirm(
      `Are you sure you want to roll back the import "${importRecord.filename}"?\n\n` +
      `This will permanently delete ${importRecord.imported_count} transactions that were imported on ${format(new Date(importRecord.import_date), 'MMM d, yyyy')}.\n\n` +
      `This action cannot be undone.`
    )) {
      return;
    }

    setIsRollingBack(true);
    try {
      // Find and delete all transactions with this batch ID
      const transactionsToDelete = await Transaction.filter({ import_batch_id: importRecord.batch_id });
      
      if (transactionsToDelete.length > 0) {
        const deletePromises = transactionsToDelete.map(tx => Transaction.delete(tx.id));
        await Promise.all(deletePromises);
      }

      // Update import history status
      await ImportHistory.update(importRecord.id, { status: 'rolled_back' });

      alert(`Successfully rolled back ${transactionsToDelete.length} transactions.`);
      
      // Clear any current rollback info from localStorage if it matches this import
      const currentBatchId = localStorage.getItem('lastImportBatchId');
      if (currentBatchId === importRecord.batch_id) {
        localStorage.removeItem('lastImportBatchId');
        localStorage.removeItem('lastImportCount');
      }

      loadImportHistory(); // Reload to show updated status

    } catch (error) {
      console.error("Failed to roll back import:", error);
      alert("An error occurred during rollback. Please check the console for details.");
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <>
      <Card className="bg-white/70 backdrop-blur-sm border-slate-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <History className="w-5 h-5 text-blue-600" />
            Import History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center p-8">
              <Loader2 className="w-8 h-8 mx-auto animate-spin text-blue-600" />
              <p className="mt-2 text-slate-500">Loading import history...</p>
            </div>
          ) : importHistory.length > 0 ? (
            <div className="space-y-4">
              {importHistory.map((record) => (
                <div key={record.id} className="border border-slate-200 rounded-lg p-4 hover:bg-slate-50">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <FileText className="w-4 h-4 text-blue-600" />
                        <span className="font-semibold text-slate-800">{record.filename}</span>
                        <Badge 
                          variant={record.status === 'completed' ? 'default' : 'destructive'}
                          className="text-xs"
                        >
                          {record.status === 'completed' ? 'Active' : 'Rolled Back'}
                        </Badge>
                      </div>
                      
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span className="text-slate-600">
                            {format(new Date(record.import_date), 'MMM d, yyyy HH:mm')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-3 h-3 text-green-600" />
                          <span className="text-slate-600">{record.imported_count} imported</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-3 h-3 text-red-600" />
                          <span className="text-slate-600">{record.skipped_count} skipped</span>
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          ID: {record.batch_id.slice(-8)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {record.skipped_count > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleViewErrors(record)}
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          View Errors
                        </Button>
                      )}
                      
                      <Button
                        variant={record.status === 'completed' ? 'destructive' : 'outline'}
                        size="sm"
                        onClick={() => handleRollback(record)}
                        disabled={isRollingBack || record.status === 'rolled_back'}
                      >
                        {isRollingBack ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : (
                          <RotateCcw className="w-4 h-4 mr-1" />
                        )}
                        {record.status === 'completed' ? 'Rollback' : 'Already Rolled Back'}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 border-2 border-dashed border-slate-300 rounded-lg">
              <h3 className="font-semibold text-slate-700">No Import History</h3>
              <p className="text-sm text-slate-500 mt-1">Import transaction files to see history here.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error Details Dialog */}
      {errorDetailsDialog && (
        <Dialog open={!!errorDetailsDialog} onOpenChange={() => setErrorDetailsDialog(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Import Errors - {errorDetailsDialog.import.filename}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4">
              <Alert className="bg-red-50 border-red-200">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <AlertDescription className="text-red-800">
                  {errorDetailsDialog.errors.skipped_rows?.length || 0} transactions were skipped due to validation errors
                </AlertDescription>
              </Alert>

              <div className="space-y-3">
                {errorDetailsDialog.errors.skipped_rows?.map((error, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">Row {error.row_number}</Badge>
                      <span className="text-sm text-slate-500">
                        {error.data?.symbol} - {error.data?.type} {error.data?.quantity} @ ${error.data?.price}
                      </span>
                    </div>
                    
                    <div className="text-xs font-mono bg-slate-50 p-2 rounded mb-2">
                      {JSON.stringify(error.data, null, 2)}
                    </div>
                    
                    {error.errors?.map((err, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-red-600">
                        <AlertTriangle className="w-3 h-3" />
                        {err}
                      </div>
                    ))}
                    
                    {error.warnings?.map((warning, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-yellow-600">
                        <Info className="w-3 h-3" />
                        {warning}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            
            <DialogFooter>
              <Button onClick={() => setErrorDetailsDialog(null)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}