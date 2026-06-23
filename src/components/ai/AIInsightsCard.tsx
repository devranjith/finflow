import React, { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Sparkles } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext';
import { askAdvisor } from '../../lib/ai';

export const AIInsightsCard: React.FC = () => {
  const { cycle, buckets, transactions, geminiApiKey } = useFinance();
  const [insights, setInsights] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
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

    fetchInsights();
  }, [cycle, buckets, transactions]);

  return (
    <Card className="bg-zinc-900/50 border-zinc-800 bg-gradient-to-br from-zinc-900/50 to-emerald-900/10">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2 text-emerald-400">
          <Sparkles size={18} />
          AI Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3 animate-pulse mt-2">
            <div className="h-4 bg-zinc-800 rounded w-full"></div>
            <div className="h-4 bg-zinc-800 rounded w-5/6"></div>
            <div className="h-4 bg-zinc-800 rounded w-4/6"></div>
          </div>
        ) : (
          <div className="max-h-[160px] overflow-y-auto pr-2 mt-2 custom-scrollbar">
            <div className="text-sm text-zinc-300 space-y-3 whitespace-pre-line leading-relaxed">
              {insights}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
