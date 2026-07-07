import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { useFinance } from '../../context/FinanceContext';
import { askAdvisor } from '../../lib/ai';

const useAIInsights = (enabled: boolean) => {
  const { cycle, buckets, transactions, geminiApiKey } = useFinance();
  const [insights, setInsights] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchInsights = async () => {
    if (!cycle) return;

    if (!geminiApiKey) {
      setInsights("💡 Add your Gemini API key in Settings to unlock AI-powered financial insights here!");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const needsBucket = buckets.find(b => b.bucket_type === 'NEEDS');
      const wantsBucket = buckets.find(b => b.bucket_type === 'WANTS');
      const bufferBucket = buckets.find(b => b.bucket_type === 'BUFFER');

      const contextData = {
        income: cycle.total_income || 0,
        fixed: cycle.total_fixed || 0,
        needsRemaining: needsBucket ? needsBucket.allocated_amount - needsBucket.spent_amount : 0,
        wantsRemaining: wantsBucket ? wantsBucket.allocated_amount - wantsBucket.spent_amount : 0,
        bufferRemaining: bufferBucket ? bufferBucket.allocated_amount - bufferBucket.spent_amount : 0,
        recentTransactions: transactions.slice(0, 5).map(t => `${t.description}: ₹${t.amount}`)
      };

      const prompt = `Based on my current financial context, generate exactly 3 short, punchy, and actionable bullet points summarizing my financial health or spending habits. Provide only plain text with emojis. NEVER use asterisks, bold text, or headers. Make it sound like a premium financial advisor.`;

      const result = await askAdvisor(prompt, contextData, geminiApiKey);
      setInsights(result);
    } catch (e: any) {
      console.error("Insights Error:", e);
      setInsights("⚠️ Unable to fetch insights. Please check if your Gemini API key is correct and valid in Settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    fetchInsights();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cycle, buckets, transactions, geminiApiKey]);

  return { insights, isLoading, refetch: fetchInsights };
};

const InsightsBody: React.FC<{ insights: string; isLoading: boolean }> = ({ insights, isLoading }) => {
  if (isLoading) {
    return (
      <div className="space-y-3 animate-pulse mt-2">
        <div className="h-4 bg-zinc-800 rounded w-full"></div>
        <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
        <div className="h-4 bg-zinc-800 rounded w-4/6"></div>
      </div>
    );
  }
  return (
    <div className="text-sm text-zinc-300 space-y-3 whitespace-pre-line leading-relaxed">
      {insights}
    </div>
  );
};

export const AIInsightsModal: React.FC<{ open: boolean; onOpenChange: (open: boolean) => void }> = ({ open, onOpenChange }) => {
  const { insights, isLoading, refetch } = useAIInsights(open);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-zinc-950 border-zinc-800 text-zinc-50 sm:max-w-[500px] flex flex-col max-h-[85vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <Sparkles size={20} />
              AI Insights
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1.5 text-zinc-400 hover:text-emerald-400 mr-6"
              onClick={refetch}
              disabled={isLoading}
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              <span className="text-xs">Refresh</span>
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-hidden flex flex-col min-h-0 mt-2">
          <ScrollArea className="flex-1 pr-4">
            <InsightsBody insights={insights} isLoading={isLoading} />
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export const AIInsightsCard: React.FC = () => {
  const { insights, isLoading } = useAIInsights(true);

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 bg-gradient-to-br from-zinc-900/50 to-emerald-900/10 h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-emerald-400">
          <Sparkles size={18} />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto pr-2 mt-2 custom-scrollbar">
          <InsightsBody insights={insights} isLoading={isLoading} />
        </div>
      </CardContent>
    </Card>
  );
};
