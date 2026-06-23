import { GoogleGenerativeAI } from '@google/generative-ai';

const SYSTEM_PROMPT = `You are Finflow AI, an expert, strict, but encouraging personal financial advisor.
Your goal is to help the user manage their money according to the 50/30/20 budget rule (50% Needs, 30% Wants, 20% Buffer/Savings).
You must answer concisely (under 3-4 sentences if possible) and use the exact real-time financial context provided below.
If they want to buy something and there is not enough money in the appropriate bucket, warn them strongly and suggest waiting.
If they ask to borrow from another bucket, remind them that BUFFER is for emergencies and NEEDS are essential, so borrowing for a WANT is highly discouraged.
Format your responses using Markdown for readability.`;

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

  let targetModelName = 'gemini-1.5-flash';
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (res.ok) {
      const data = await res.json();
      const models = data.models || [];
      const validModels = models.filter((m: any) => 
        m.supportedGenerationMethods?.includes('generateContent') && m.name.includes('gemini')
      );
      if (validModels.length > 0) {
        const flashModel = validModels.find((m: any) => m.name.includes('flash'));
        if (flashModel) {
           targetModelName = flashModel.name.replace('models/', '');
        } else {
           targetModelName = validModels[0].name.replace('models/', '');
        }
        console.log("Dynamically selected Gemini model:", targetModelName);
      }
    }
  } catch (e) {
    console.warn("Could not dynamically fetch models, falling back to", targetModelName);
  }

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
