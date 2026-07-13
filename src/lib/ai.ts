import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are Finflow AI, an expert, strict, but encouraging personal financial advisor.
Your goal is to help the user manage their money according to the 50/30/20 budget rule (50% Needs, 30% Wants, 20% Buffer/Savings).
You must answer concisely (under 3-4 sentences if possible) and use the exact real-time financial context provided below.
If they want to buy something and there is not enough money in the appropriate bucket, warn them strongly and suggest waiting.
If they ask to borrow from another bucket, remind them that BUFFER is for emergencies and NEEDS are essential, so borrowing for a WANT is highly discouraged.
Format your responses strictly as clean bullet points. Do NOT use markdown asterisks (* or **), bolding, or headers. Use emojis to make it readable.`;

export async function askAdvisor(
  prompt: string,
  contextData: {
    income: number;
    fixed: number;
    needsRemaining: number;
    wantsRemaining: number;
    bufferRemaining: number;
    recentTransactions: string[];
  },
  apiKey?: string | null
): Promise<string> {
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const targetModelName = 'gemini-2.5-flash';

  const model = genAI.getGenerativeModel({ model: targetModelName });

  const contextStr = `
${SYSTEM_PROMPT}

CURRENT FINANCIAL CONTEXT:
- Total Income: ₹${contextData.income}
- Fixed Expenses: ₹${contextData.fixed}
- NEEDS Bucket Remaining: ₹${contextData.needsRemaining}
- WANTS Bucket Remaining: ₹${contextData.wantsRemaining}
- BUFFER Bucket Remaining: ₹${contextData.bufferRemaining}

Recent Transactions:
${contextData.recentTransactions.length > 0 ? contextData.recentTransactions.join('\n') : 'No recent transactions.'}

USER QUESTION:
${prompt}
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: contextStr }] }],
      generationConfig: {
        temperature: 0.7,
      }
    });
    
    return result.response.text();
  } catch (error) {
    console.error("Gemini AI Error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`FAILED_TO_GENERATE: ${detail}`);
  }
}

export type ParsedTransaction = {
  date: string;
  description: string;
  amount: number;
  type: 'debit' | 'credit';
  bucket: 'NEEDS' | 'WANTS' | 'BUFFER' | null;
};

const STATEMENT_PARSER_PROMPT = `You are a precise bank statement parser and personal finance categorizer for an Indian user (amounts are in INR).
You will be given raw text extracted from a bank statement (CSV, PDF text, or pasted text).
Extract EVERY individual transaction you can find. Ignore headers, footers, opening/closing balance summary lines, and non-transaction noise.

For each transaction return an object with:
- date: the transaction date in strict "YYYY-MM-DD" format. If the year is missing, infer the most likely recent year.
- description: a short cleaned-up merchant/description (remove long reference numbers).
- amount: a POSITIVE number (no currency symbols, no commas).
- type: "debit" if money left the account (withdrawal/spent), "credit" if money came in (deposit/received).
- bucket: for debits only, classify using the 50/30/20 rule:
    - "NEEDS" for essentials: groceries, rent, utilities, electricity, water, gas, phone/internet bills, fuel/transport, medical, insurance, education, EMIs.
    - "WANTS" for discretionary: dining/restaurants, food delivery, shopping, entertainment, streaming/subscriptions, travel/holidays, gadgets.
    - "BUFFER" for savings, investments, mutual funds, self-transfers, or anything unclear.
  For credits, set bucket to null.

Return ONLY a valid JSON array of these objects. No markdown, no explanation. If you find no transactions, return [].`;

export async function parseAndCategorizeStatement(
  rawText: string,
  apiKey?: string | null
): Promise<ParsedTransaction[]> {
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  // Guard against oversized inputs blowing the token budget.
  const trimmed = rawText.slice(0, 30000);

  const contextStr = `${STATEMENT_PARSER_PROMPT}\n\nBANK STATEMENT TEXT:\n${trimmed}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: contextStr }] }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
      },
    });

    const text = result.response.text().trim();
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((t: any) => t && typeof t.amount !== 'undefined')
      .map((t: any): ParsedTransaction => ({
        date: typeof t.date === 'string' ? t.date : new Date().toISOString().slice(0, 10),
        description: String(t.description ?? 'Transaction').trim(),
        amount: Math.abs(Number(t.amount)) || 0,
        type: t.type === 'credit' ? 'credit' : 'debit',
        bucket: ['NEEDS', 'WANTS', 'BUFFER'].includes(t.bucket) ? t.bucket : null,
      }))
      .filter((t: ParsedTransaction) => t.amount > 0);
  } catch (error) {
    console.error("Gemini Statement Parse Error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`FAILED_TO_PARSE: ${detail}`);
  }
}

const GOAL_COACH_PROMPT = `You are Finflow AI, a savings-focused personal finance coach.
You help the user reach a specific savings goal using money from their BUFFER bucket (the 20% in the 50/30/20 rule).
Be concrete and encouraging. Assess whether the goal is on track, realistic, or stalled.
Give a specific monthly contribution plan and, if they have competing goals or a tight buffer, tell them how to prioritize.
Answer in 3-4 short, clean bullet points. Do NOT use markdown asterisks (* or **), bolding, or headers. Use emojis to make it readable.`;

export async function askGoalCoach(
  goal: {
    name: string;
    target: number;
    current: number;
  },
  contextData: {
    income: number;
    availableBuffer: number;
    otherGoals: string[];
  },
  apiKey?: string | null
): Promise<string> {
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const remaining = Math.max(0, goal.target - goal.current);

  const contextStr = `
${GOAL_COACH_PROMPT}

SAVINGS GOAL:
- Name: ${goal.name}
- Target: ₹${goal.target}
- Saved so far: ₹${goal.current}
- Remaining to save: ₹${remaining}

FINANCIAL CONTEXT:
- Monthly Income: ₹${contextData.income}
- Currently available in BUFFER this month: ₹${contextData.availableBuffer}
- Other active goals: ${contextData.otherGoals.length > 0 ? contextData.otherGoals.join(', ') : 'None'}

Give this user a short, actionable coaching plan to reach the "${goal.name}" goal.
  `;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: contextStr }] }],
      generationConfig: {
        temperature: 0.7,
      }
    });

    return result.response.text();
  } catch (error) {
    console.error("Gemini AI Error:", error);
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`FAILED_TO_GENERATE: ${detail}`);
  }
}

export type InvestmentAllocation = {
  category: 'emergency_fund' | 'debt_fd' | 'equity_sip' | 'gold' | 'goal_specific' | 'hold_cash';
  amount: number;
  instrument_examples: string[];
  rationale: string;
  priority: number;
};

export type InvestmentPlan = {
  summary: string;
  investableAmount: number;
  allocations: InvestmentAllocation[];
  warnings: string[];
  nextMonthTip: string;
  disclaimer: string;
};

const INVESTMENT_ADVISOR_PROMPT = `You are Finflow AI, an Indian personal finance investment advisor (educational guidance only, NOT SEBI-registered advice).

You will receive a JSON object with PRE-COMPUTED financial numbers. You MUST NOT change investableAmount — use exactly the provided investableSurplus value.

Allocation priority rules:
1. If needsEmergencyFundFirst or emergencyGap > 0: prioritize emergency_fund / liquid mutual fund first
2. If hasUnfundedGoals: allocate to goal_specific (debt fund / FD for short-term goals)
3. Remaining investable: equity_sip (Nifty 50 / index funds) for long horizon; debt_fd for conservative or short horizon
4. If overspending is true: investableAmount must be 0; allocations empty or hold_cash only; warnings must explain spending fixes
5. If hasHighFixedRatio: conservative mix, smaller equity SIP
6. Respect riskTolerance: conservative = more debt_fd/hold_cash; aggressive = more equity_sip
7. Respect horizon: short = debt_fd; long = equity_sip

Return ONLY valid JSON matching this schema:
{
  "summary": "1-2 sentence overview",
  "investableAmount": number (must equal input investableSurplus),
  "allocations": [
    {
      "category": "emergency_fund" | "debt_fd" | "equity_sip" | "gold" | "goal_specific" | "hold_cash",
      "amount": number,
      "instrument_examples": ["string"],
      "rationale": "string",
      "priority": number
    }
  ],
  "warnings": ["string"],
  "nextMonthTip": "string",
  "disclaimer": "Educational guidance only, not SEBI-registered investment advice."
}

Allocation amounts must sum to investableAmount (or 0 if overspending). Use INR. No markdown.`;

export async function askInvestmentAdvisor(
  context: import('./investmentAnalysis').InvestmentContext,
  apiKey?: string | null
): Promise<InvestmentPlan> {
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const contextStr = `${INVESTMENT_ADVISOR_PROMPT}\n\nFINANCIAL CONTEXT (JSON):\n${JSON.stringify(context, null, 2)}`;

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: contextStr }] }],
      generationConfig: {
        temperature: 0.3,
        responseMimeType: 'application/json',
      },
    });

    const text = result.response.text().trim();
    const cleaned = text.replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
    const parsed = JSON.parse(cleaned) as InvestmentPlan;

    parsed.investableAmount = context.investableSurplus;
    parsed.disclaimer = parsed.disclaimer || 'Educational guidance only, not SEBI-registered investment advice.';

    if (context.overspending) {
      parsed.investableAmount = 0;
      parsed.allocations = parsed.allocations?.filter(a => a.category === 'hold_cash') ?? [];
    }

    return parsed;
  } catch (error) {
    console.error('Gemini Investment Advisor Error:', error);
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`FAILED_TO_GENERATE: ${detail}`);
  }
}
