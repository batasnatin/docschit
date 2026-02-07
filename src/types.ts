export enum MessageSender {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system',
}

export interface UrlContextMetadataItem {
  retrievedUrl: string;
  urlRetrievalStatus: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: MessageSender;
  timestamp: Date;
  isLoading?: boolean;
  urlContext?: UrlContextMetadataItem[];
  files?: FileData[];
  aiProvider?: string;
}

export interface FileData {
  id: string;
  name: string;
  mimeType: string;
  data?: string;
  text?: string;
}

export interface KnowledgeGroup {
  id: string;
  name: string;
  urls: string[];
  files: FileData[];
}

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  tier?: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  knowledge_group_name?: string;
  created_at: string;
  updated_at: string;
}

export interface DbChatMessage {
  id: string;
  conversation_id: string;
  user_id: string;
  text: string;
  sender: string;
  url_context_metadata?: UrlContextMetadataItem[] | null;
  ai_provider?: string | null;
  created_at: string;
}

export interface ApiChatRequest {
  prompt: string;
  urls: string[];
  files: FileData[];
  systemInstruction?: string;
}

export interface ApiChatResponse {
  text: string;
  urlContextMetadata?: UrlContextMetadataItem[];
  provider: string;
}

export interface ApiSuggestionsResponse {
  suggestions: string[];
}
