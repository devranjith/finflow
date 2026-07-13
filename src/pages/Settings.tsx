import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { KeyRound, CheckCircle2, TrendingUp } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { useAuth } from '../context/AuthContext';
import { DEFAULT_INVESTMENT_PREFERENCES } from '../lib/investmentAnalysis';
import type { InvestmentPreferences } from '../lib/investmentAnalysis';
import { loadInvestmentPreferences, saveInvestmentPreferences } from '../lib/investmentPrefs';

export const Settings: React.FC = () => {
  const { user } = useAuth();
  const { geminiApiKey, updateGeminiKey } = useFinance();
  const [apiKey, setApiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [investPrefs, setInvestPrefs] = useState<InvestmentPreferences>(DEFAULT_INVESTMENT_PREFERENCES);
  const [prefsSaved, setPrefsSaved] = useState(false);

  useEffect(() => {
    if (geminiApiKey) {
      setApiKey(geminiApiKey);
    }
  }, [geminiApiKey]);

  useEffect(() => {
    if (user) {
      setInvestPrefs(loadInvestmentPreferences(user.id));
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateGeminiKey(apiKey.trim());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const handlePrefsSave = () => {
    if (!user) return;
    saveInvestmentPreferences(user.id, investPrefs);
    setPrefsSaved(true);
    setTimeout(() => setPrefsSaved(false), 3000);
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

      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="text-zinc-400" size={20} />
            <CardTitle>Investment Preferences</CardTitle>
          </div>
          <CardDescription className="text-zinc-400">
            Used by Smart Invest to tailor monthly allocation advice. Stored locally on this device.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-zinc-300">Risk tolerance</Label>
            <select
              value={investPrefs.riskTolerance}
              onChange={(e) => setInvestPrefs(p => ({ ...p, riskTolerance: e.target.value as InvestmentPreferences['riskTolerance'] }))}
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="conservative">Conservative</option>
              <option value="moderate">Moderate</option>
              <option value="aggressive">Aggressive</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="text-zinc-300">Investment horizon</Label>
            <select
              value={investPrefs.horizon}
              onChange={(e) => setInvestPrefs(p => ({ ...p, horizon: e.target.value as InvestmentPreferences['horizon'] }))}
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              <option value="short">Short (under 3 years)</option>
              <option value="medium">Medium (3–5 years)</option>
              <option value="long">Long (5+ years)</option>
            </select>
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-300 cursor-pointer">
            <input
              type="checkbox"
              checked={investPrefs.hasEmergencyFund}
              onChange={(e) => setInvestPrefs(p => ({ ...p, hasEmergencyFund: e.target.checked }))}
              className="w-4 h-4 accent-emerald-500"
            />
            I already have a 3-month emergency fund saved elsewhere
          </label>
          <Button type="button" onClick={handlePrefsSave} className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2">
            {prefsSaved ? <><CheckCircle2 size={16} /> Saved!</> : 'Save Preferences'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
