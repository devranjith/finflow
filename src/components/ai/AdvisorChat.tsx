import React, { useState, useRef, useEffect } from 'react';
import { useFinance } from '../../context/FinanceContext';
import { askAdvisor } from '../../lib/ai';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../ui/card';
import { MessageCircle, X, Send, Bot, User, Sparkles } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export const AdvisorChat: React.FC = () => {
  const { cycle, buckets, transactions } = useFinance();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([{
    id: '1',
    role: 'assistant',
    content: "Hi! I'm your AI Financial Advisor. Ask me anything about your current budget or if you can afford a specific purchase."
  }]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      // Build context
      const needsBucket = buckets.find(b => b.bucket_type === 'NEEDS');
      const wantsBucket = buckets.find(b => b.bucket_type === 'WANTS');
      const bufferBucket = buckets.find(b => b.bucket_type === 'BUFFER');

      const contextData = {
        income: cycle?.total_income || 0,
        fixed: cycle?.total_fixed || 0,
        needsRemaining: needsBucket ? needsBucket.allocated_amount - needsBucket.spent_amount : 0,
        wantsRemaining: wantsBucket ? wantsBucket.allocated_amount - wantsBucket.spent_amount : 0,
        bufferRemaining: bufferBucket ? bufferBucket.allocated_amount - bufferBucket.spent_amount : 0,
        recentTransactions: transactions.slice(0, 5).map(t => `${t.description}: ₹${t.amount}`)
      };

      const aiResponse = await askAdvisor(userMessage, contextData);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: aiResponse }]);
    } catch (error: any) {
      const isMissingKey = error.message === 'API_KEY_MISSING';
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'assistant', 
        content: isMissingKey 
          ? "Please configure your Gemini API Key in the Settings page to use the advisor." 
          : "Sorry, I had trouble connecting to the AI. Please try again later." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 hover:bg-emerald-500 rounded-full shadow-lg flex items-center justify-center text-white transition-transform hover:scale-105 z-40 ${isOpen ? 'scale-0' : 'scale-100'}`}
      >
        <MessageCircle size={24} />
      </button>

      {/* Chat Window */}
      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-[380px] h-[600px] max-h-[80vh] flex flex-col shadow-2xl border-zinc-800 bg-zinc-950 z-50 overflow-hidden animate-in slide-in-from-bottom-5">
          <CardHeader className="p-4 border-b border-zinc-800 bg-zinc-900/50 flex flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <div className="bg-emerald-500/20 p-2 rounded-full">
                <Sparkles size={18} className="text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-base text-zinc-50">Finflow Advisor</CardTitle>
                <p className="text-xs text-zinc-400">Powered by Gemini AI</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-zinc-50" onClick={() => setIsOpen(false)}>
              <X size={18} />
            </Button>
          </CardHeader>
          
          <CardContent className="flex-1 p-4 overflow-y-auto space-y-4" ref={scrollRef}>
            {messages.map((msg) => (
              <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-zinc-800 text-zinc-300' : 'bg-emerald-600 text-white'}`}>
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className={`p-3 rounded-lg max-w-[80%] text-sm ${msg.role === 'user' ? 'bg-zinc-800 text-zinc-100 rounded-tr-none' : 'bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-tl-none'}`}>
                  {/* Basic markdown rendering (for MVP just white-space preserve) */}
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Bot size={16} />
                </div>
                <div className="p-4 rounded-lg bg-zinc-900 border border-zinc-800 rounded-tl-none">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce" />
                    <div className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce delay-75" />
                    <div className="w-2 h-2 rounded-full bg-zinc-600 animate-bounce delay-150" />
                  </div>
                </div>
              </div>
            )}
          </CardContent>

          <CardFooter className="p-3 border-t border-zinc-800 bg-zinc-900/30">
            <form onSubmit={handleSend} className="flex w-full gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Can I afford to buy..."
                className="flex-1 bg-zinc-950 border-zinc-800 focus-visible:ring-emerald-500"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" className="bg-emerald-600 hover:bg-emerald-500 text-white" disabled={isLoading || !input.trim()}>
                <Send size={18} />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  );
};
