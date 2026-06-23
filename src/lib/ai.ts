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

  const targetModelName = 'gemini-1.5-flash';

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
    throw new Error('FAILED_TO_GENERATE');
  }
}
