import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';

export const Settings: React.FC = () => {
  const { geminiApiKey, updateGeminiKey } = useFinance();
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (geminiApiKey) {
      setApiKey(geminiApiKey);
    }
  }, [geminiApiKey]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateGeminiKey(apiKey.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-50">Settings</h1>
        <p className="text-zinc-400 mt-1">Manage your app preferences and integrations.</p>
      </div>

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="text-zinc-400" size={20} />
            <CardTitle>AI Advisor Configuration</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            To use the Finflow AI Advisor, please provide a Google Gemini API Key. This key is stored securely in your account and used only to generate your financial insights.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-zinc-300">Gemini API Key</Label>
              <Input
                type="password"
                placeholder="AIzaSy..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  updateGeminiKey(e.target.value.trim());
                }}
                className="bg-zinc-950 border-zinc-800 font-mono"
              />
              <p className="text-xs text-zinc-500">
                You can get a free API key from <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-emerald-400 hover:underline">Google AI Studio</a>. (Auto-saves to your account)
              </p>
            </div>
            <Button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
              {isSaved ? <><CheckCircle2 size={16} /> Saved!</> : 'Save Key'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
