import type { VercelRequest, VercelResponse } from '@vercel/node';
import { validateAuth } from './_utils/auth';
import { checkRateLimit } from './_utils/rateLimit';
import { GoogleGenAI, type Part, type Tool, type Content, HarmCategory, HarmBlockThreshold } from '@google/genai';
import OpenAI from 'openai';

interface FileData {
  id: string;
  name: string;
  mimeType: string;
  data?: string;
  text?: string;
}

const LEGAL_EXPERT_INSTRUCTION = "You are a highly skilled legal expert specializing in jurisprudence, statutes, and laws. Your name is BATASnatin.";

const SUGGESTION_PROMPT = `Based on the provided legal documents (from URLs and/or file uploads), provide 3-4 concise and actionable questions a legal professional might ask to explore them. These questions should be suitable as quick-start prompts. Return ONLY a JSON object with a key "suggestions" containing an array of these question strings. For example: {"suggestions": ["What are the key legal issues?", "Summarize the court's main argument.", "Identify all parties involved and their roles."]}

Note: Do not reference the file names or URLs in the suggestions. The suggestions should be about the content itself.`;

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];

const createFileParts = (files: FileData[]): Part[] => {
  return files.map((file): Part | null => {
    if (file.text) {
      return { text: `--- START OF FILE: ${file.name} ---\n${file.text}\n--- END OF FILE: ${file.name} ---` };
    } else if (file.data && file.mimeType.startsWith('image/')) {
      return { inlineData: { mimeType: file.mimeType, data: file.data } };
    }
    return null;
  }).filter((part): part is Part => part !== null);
};

const createTextOnlyContext = (files: FileData[]): string => {
  return files.map(file => {
    if (file.text) return `--- FILE: ${file.name} ---\n${file.text}\n--- END FILE ---`;
    return '';
  }).filter(Boolean).join('\n\n');
};

function parseSuggestions(text: string): string[] {
  try {
    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) jsonStr = match[2].trim();
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.suggestions)) {
      return parsed.suggestions.filter((s: unknown) => typeof s === 'string').slice(0, 4);
    }
  } catch {
    console.error('Failed to parse suggestions JSON');
  }
  return [];
}

async function tryGemini(urls: string[], files: FileData[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') throw new Error('Gemini API key not configured');

  const ai = new GoogleGenAI({ apiKey });
  const textPart: Part = { text: SUGGESTION_PROMPT };
  const fileParts: Part[] = createFileParts(files);
  const tools: Tool[] = urls.length > 0 ? [{ urlContext: {} }] : [];
  const contents: Content[] = [{ role: 'user', parts: [textPart, ...fileParts] }];

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents,
    config: {
      systemInstruction: LEGAL_EXPERT_INSTRUCTION,
      tools,
      safetySettings,
    },
  });

  return parseSuggestions(response.text || '');
}

async function tryDeepSeek(urls: string[], files: FileData[]) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') throw new Error('DeepSeek API key not configured');

  const openai = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
  const fileContext = createTextOnlyContext(files);
  const fullPrompt = fileContext ? `${SUGGESTION_PROMPT}\n\nDocument context:\n${fileContext}` : SUGGESTION_PROMPT;

  const completion = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: LEGAL_EXPERT_INSTRUCTION },
      { role: 'user', content: fullPrompt },
    ],
    max_tokens: 1024,
  });

  return parseSuggestions(completion.choices[0]?.message?.content || '');
}

async function tryOpenAI(urls: string[], files: FileData[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') throw new Error('OpenAI API key not configured');

  const openai = new OpenAI({ apiKey });
  const fileContext = createTextOnlyContext(files);
  const fullPrompt = fileContext ? `${SUGGESTION_PROMPT}\n\nDocument context:\n${fileContext}` : SUGGESTION_PROMPT;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: LEGAL_EXPERT_INSTRUCTION },
      { role: 'user', content: fullPrompt },
    ],
    max_tokens: 1024,
  });

  return parseSuggestions(completion.choices[0]?.message?.content || '');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let userId: string;
  try {
    userId = await validateAuth(req.headers.authorization);
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(401).json({ error: error.message });
  }

  const allowed = await checkRateLimit(userId, 'suggestions', res);
  if (!allowed) return;

  const { urls = [], files = [] } = req.body;

  const providers = [tryGemini, tryDeepSeek, tryOpenAI];
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const suggestions = await provider(urls, files);
      if (suggestions.length > 0) {
        return res.status(200).json({ suggestions });
      }
      errors.push(`${provider.name}: returned empty suggestions`);
    } catch (err: unknown) {
      const error = err as Error;
      errors.push(`${provider.name}: ${error.message}`);
      console.error(`${provider.name} failed:`, error.message);
    }
  }

  return res.status(200).json({
    suggestions: ['What are the key legal issues in this document?', 'Summarize the main arguments.', 'Identify all parties involved.'],
  });
}
