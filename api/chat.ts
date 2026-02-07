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

const LEGAL_EXPERT_INSTRUCTION = "You are a highly skilled legal expert specializing in jurisprudence, statutes, and laws. Your name is BATASnatin. Analyze the provided documents and answer questions from a formal, legal perspective. Prioritize accuracy and reference legal principles. When asked about your identity, present yourself as BATASnatin, an AI legal assistant.";

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
    if (file.data && file.mimeType.startsWith('image/')) return `[Image file: ${file.name} - image content not available in text mode]`;
    return '';
  }).filter(Boolean).join('\n\n');
};

async function tryGemini(prompt: string, urls: string[], files: FileData[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') throw new Error('Gemini API key not configured');

  const ai = new GoogleGenAI({ apiKey });
  const textPart: Part = { text: prompt };
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

  const text = response.text;
  const candidate = response.candidates?.[0];
  let urlContextMetadata;

  if (candidate?.urlContextMetadata?.urlMetadata) {
    urlContextMetadata = candidate.urlContextMetadata.urlMetadata;
  }

  return { text, urlContextMetadata, provider: 'gemini' };
}

async function tryDeepSeek(prompt: string, urls: string[], files: FileData[]) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') throw new Error('DeepSeek API key not configured');

  const openai = new OpenAI({ apiKey, baseURL: 'https://api.deepseek.com' });
  const fileContext = createTextOnlyContext(files);
  const urlContext = urls.length > 0 ? `\n\nRelevant URLs for reference: ${urls.join(', ')}` : '';
  const fullPrompt = fileContext ? `${prompt}\n\nDocument context:\n${fileContext}${urlContext}` : `${prompt}${urlContext}`;

  const completion = await openai.chat.completions.create({
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: LEGAL_EXPERT_INSTRUCTION },
      { role: 'user', content: fullPrompt },
    ],
    max_tokens: 4096,
  });

  return {
    text: completion.choices[0]?.message?.content || '',
    provider: 'deepseek',
  };
}

async function tryOpenAI(prompt: string, urls: string[], files: FileData[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') throw new Error('OpenAI API key not configured');

  const openai = new OpenAI({ apiKey });
  const fileContext = createTextOnlyContext(files);
  const urlContext = urls.length > 0 ? `\n\nRelevant URLs for reference: ${urls.join(', ')}` : '';
  const fullPrompt = fileContext ? `${prompt}\n\nDocument context:\n${fileContext}${urlContext}` : `${prompt}${urlContext}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: LEGAL_EXPERT_INSTRUCTION },
      { role: 'user', content: fullPrompt },
    ],
    max_tokens: 4096,
  });

  return {
    text: completion.choices[0]?.message?.content || '',
    provider: 'openai',
  };
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

  const allowed = await checkRateLimit(userId, 'chat', res);
  if (!allowed) return;

  const { prompt, urls = [], files = [] } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid prompt' });
  }

  const providers = [tryGemini, tryDeepSeek, tryOpenAI];
  const errors: string[] = [];

  for (const provider of providers) {
    try {
      const result = await provider(prompt, urls, files);
      return res.status(200).json(result);
    } catch (err: unknown) {
      const error = err as Error;
      errors.push(`${provider.name}: ${error.message}`);
      console.error(`${provider.name} failed:`, error.message);
    }
  }

  console.error('All AI providers failed:', errors);
  return res.status(500).json({
    error: 'All AI providers failed. Please try again later.',
  });
}
