import React, { useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Upload, FileText, Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { parseAndCategorizeStatement } from '../../lib/ai';
import type { ParsedTransaction } from '../../lib/ai';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

type BucketType = 'NEEDS' | 'WANTS' | 'BUFFER';

type ReviewRow = {
  id: number;
  date: string;
  description: string;
  amount: number;
  bucket: BucketType;
  include: boolean;
  isDuplicate: boolean;
};

type Step = 'input' | 'review' | 'done';

const extractPdfText = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str).join(' ') + '\n';
  }
  return text;
};

export const BankImportModal: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({ open, onOpenChange }) => {
  const { geminiApiKey, importTransactions, transactions } = useFinance();

  const [step, setStep] = useState<Step>('input');
  const [rawText, setRawText] = useState('');
  const [fileName, setFileName] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [skippedCredits, setSkippedCredits] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingKeys = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach(t => set.add(`${t.description.trim().toLowerCase()}|${t.amount}`));
    return set;
  }, [transactions]);

  const reset = () => {
    setStep('input');
    setRawText('');
    setFileName('');
    setError('');
    setRows([]);
    setSkippedCredits(0);
    setImportedCount(0);
    setIsParsing(false);
    setIsImporting(false);
  };

  const handleClose = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFile = async (file: File) => {
    setError('');
    setFileName(file.name);
    try {
      if (file.name.toLowerCase().endsWith('.pdf')) {
        const text = await extractPdfText(file);
        setRawText(text);
      } else {
        const text = await file.text();
        setRawText(text);
      }
    } catch (e: any) {
      console.error('File read error:', e);
      setError('Could not read this file. If it is a scanned or password-protected PDF, try pasting the text instead.');
    }
  };

  const handleParse = async () => {
    if (!geminiApiKey) {
      setError('Add your Gemini API key in Settings first to use AI import.');
      return;
    }
    if (!rawText.trim()) {
      setError('Upload a statement file or paste your statement text first.');
      return;
    }

    setIsParsing(true);
    setError('');
    try {
      const parsed: ParsedTransaction[] = await parseAndCategorizeStatement(rawText, geminiApiKey);
      const debits = parsed.filter(t => t.type === 'debit');
      const credits = parsed.filter(t => t.type === 'credit');

      if (debits.length === 0) {
        setError('No spending transactions were detected. Try pasting the raw statement text, or check the file.');
        setIsParsing(false);
        return;
      }

      const reviewRows: ReviewRow[] = debits.map((t, idx) => {
        const isDuplicate = existingKeys.has(`${t.description.trim().toLowerCase()}|${t.amount}`);
        return {
          id: idx,
          date: t.date,
          description: t.description,
          amount: t.amount,
          bucket: (t.bucket ?? 'NEEDS') as BucketType,
          include: !isDuplicate,
          isDuplicate,
        };
      });

      setRows(reviewRows);
      setSkippedCredits(credits.length);
      setStep('review');
    } catch (e: any) {
      console.error('Parse error:', e);
      setError(
        e?.message === 'API_KEY_MISSING'
          ? 'Add your Gemini API key in Settings first.'
          : 'AI could not parse this statement. Please try a different file or paste the text directly.'
      );
    } finally {
      setIsParsing(false);
    }
  };

  const toggleRow = (id: number) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, include: !r.include } : r)));
  };

  const setRowBucket = (id: number, bucket: BucketType) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, bucket } : r)));
  };

  const selectedRows = rows.filter(r => r.include);
  const selectedTotal = selectedRows.reduce((acc, r) => acc + r.amount, 0);

  const handleImport = async () => {
    if (selectedRows.length === 0) return;
    setIsImporting(true);
    try {
      const count = await importTransactions(
        selectedRows.map(r => ({
          bucketType: r.bucket,
          amount: r.amount,
          description: r.description,
          date: r.date,
        }))
      );
      setImportedCount(count);
      setStep('done');
    } catch (e) {
      console.error('Import error:', e);
      setError('Something went wrong while importing. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  const bucketColor = (b: BucketType) => (b === 'NEEDS' ? 'text-emerald-400' : b === 'WANTS' ? 'text-yellow-400' : 'text-red-400');

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-50 sm:max-w-[640px] flex flex-col max-h-[88vh] overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload size={20} className="text-emerald-400" />
            Import Bank Statement
          </DialogTitle>
        </DialogHeader>

        {/* STEP: INPUT */}
        {step === 'input' && (
          <div className="flex flex-col gap-4 mt-2 min-h-0">
            <p className="text-sm text-zinc-400">
              Upload your bank statement (CSV, TXT, or a text-based PDF) or paste the text below. Finflow AI will read your
              transactions and sort them into Needs, Wants, and Buffer for you to review.
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-zinc-800 hover:border-emerald-600/50 hover:bg-zinc-900/50 transition-colors"
            >
              <FileText size={28} className="text-zinc-500" />
              <span className="text-sm text-zinc-300">{fileName || 'Click to upload CSV / TXT / PDF'}</span>
              {fileName && <span className="text-xs text-emerald-400">File loaded - ready to parse</span>}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-xs text-zinc-500">or paste text</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste your bank statement rows here..."
              className="w-full h-28 bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none font-mono"
            />

            {error && (
              <div className="flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-lg p-3">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" className="text-zinc-400" onClick={() => handleClose(false)}>Cancel</Button>
              <Button className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2" onClick={handleParse} disabled={isParsing}>
                <Sparkles size={16} className={isParsing ? 'animate-pulse' : ''} />
                {isParsing ? 'Reading statement...' : 'Parse with AI'}
              </Button>
            </div>
          </div>
        )}

        {/* STEP: REVIEW */}
        {step === 'review' && (
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between text-sm shrink-0">
              <span className="text-zinc-400">
                {selectedRows.length} of {rows.length} selected
                {skippedCredits > 0 && <span className="text-zinc-600"> · {skippedCredits} deposits skipped</span>}
              </span>
              <span className="text-zinc-300 font-medium">Total: ₹{selectedTotal.toLocaleString('en-IN')}</span>
            </div>

            <div className="overflow-y-auto max-h-[55vh] pr-1 -mr-1 custom-scrollbar">
              <div className="space-y-2">
                {rows.map(row => (
                  <div
                    key={row.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg border ${row.include ? 'bg-zinc-900 border-zinc-800' : 'bg-zinc-950 border-zinc-900 opacity-60'}`}
                  >
                    <input
                      type="checkbox"
                      checked={row.include}
                      onChange={() => toggleRow(row.id)}
                      className="w-4 h-4 accent-emerald-500 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-zinc-100 truncate">{row.description}</p>
                        {row.isDuplicate && (
                          <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-full shrink-0">possible duplicate</span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-500">{row.date}</p>
                    </div>
                    <div className="text-sm font-medium text-zinc-300 shrink-0">₹{row.amount.toLocaleString('en-IN')}</div>
                    <select
                      value={row.bucket}
                      onChange={(e) => setRowBucket(row.id, e.target.value as BucketType)}
                      className={`bg-zinc-950 border border-zinc-800 rounded-md px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500/40 shrink-0 ${bucketColor(row.bucket)}`}
                    >
                      <option value="NEEDS">NEEDS</option>
                      <option value="WANTS">WANTS</option>
                      <option value="BUFFER">BUFFER</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 text-sm text-amber-400 bg-amber-500/10 rounded-lg p-3 shrink-0">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-between gap-2 pt-1 shrink-0">
              <Button variant="ghost" className="text-zinc-400" onClick={() => setStep('input')}>Back</Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={handleImport}
                disabled={isImporting || selectedRows.length === 0}
              >
                {isImporting ? 'Importing...' : `Import ${selectedRows.length} transaction${selectedRows.length !== 1 ? 's' : ''}`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP: DONE */}
        {step === 'done' && (
          <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
            <CheckCircle2 size={48} className="text-emerald-400" />
            <h3 className="text-lg font-medium text-zinc-100">Imported {importedCount} transaction{importedCount !== 1 ? 's' : ''}</h3>
            <p className="text-sm text-zinc-400 max-w-xs">Your buckets have been updated. You can review or delete any of them from the dashboard.</p>
            <Button className="bg-emerald-600 hover:bg-emerald-500 text-white mt-2" onClick={() => handleClose(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
