import { supabase } from '@/lib/supabase';
import { FileData, ApiChatResponse, ApiSuggestionsResponse } from '@/types';

const FETCH_TIMEOUT_MS = 30_000;

interface GeminiResponse {
  text: string;
  urlContextMetadata?: { retrievedUrl: string; urlRetrievalStatus: string }[];
  provider?: string;
}

const getAuthToken = async (): Promise<string> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Not authenticated. Please sign in.');
  }
  return session.access_token;
};

const fetchWithTimeout = async (url: string, options: RequestInit): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const generateContentWithKnowledgeContext = async (
  prompt: string,
  urls: string[],
  files: FileData[]
): Promise<GeminiResponse> => {
  const token = await getAuthToken();

  const response = await fetchWithTimeout('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      prompt,
      urls,
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        data: f.mimeType.startsWith('image/') ? f.data : undefined,
        text: f.text,
      })),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorBody.error || `API error: ${response.status}`);
  }

  const data: ApiChatResponse = await response.json();
  return {
    text: data.text,
    urlContextMetadata: data.urlContextMetadata,
    provider: data.provider,
  };
};

export const getInitialSuggestions = async (urls: string[], files: FileData[]): Promise<GeminiResponse> => {
  const hasContent = urls.length > 0 || files.length > 0;
  if (!hasContent) {
    return { text: JSON.stringify({ suggestions: ['Add a legal document to get suggestions.'] }) };
  }

  const token = await getAuthToken();

  const response = await fetchWithTimeout('/api/suggestions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      urls,
      files: files.map(f => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        data: f.mimeType.startsWith('image/') ? f.data : undefined,
        text: f.text,
      })),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(errorBody.error || `API error: ${response.status}`);
  }

  const data: ApiSuggestionsResponse = await response.json();
  return { text: JSON.stringify({ suggestions: data.suggestions }) };
};
