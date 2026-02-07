import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { Conversation, ChatMessage, MessageSender, DbChatMessage } from '@/types';
import {
  getConversations,
  createConversation,
  deleteConversation,
  getMessages,
  addMessage,
  updateConversationTitle,
} from '@/services/chatHistoryService';

export const useConversations = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  const fetchConversations = useCallback(async (pageNum: number = 0, append: boolean = false) => {
    if (!user) return;
    setLoadingConversations(true);
    try {
      const result = await getConversations(user.id, pageNum);
      setConversations(prev => append ? [...prev, ...result.data] : result.data);
      setHasMore(result.hasMore);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, [user]);

  const loadMoreConversations = useCallback(() => {
    if (!hasMore || loadingConversations) return;
    fetchConversations(page + 1, true);
  }, [hasMore, loadingConversations, page, fetchConversations]);

  useEffect(() => {
    fetchConversations(0, false);
  }, [fetchConversations]);

  const startNewConversation = useCallback(async (knowledgeGroupName?: string) => {
    if (!user) return null;
    try {
      const conv = await createConversation(user.id, 'New Conversation', knowledgeGroupName);
      setConversations(prev => [conv, ...prev]);
      setActiveConversationId(conv.id);
      return conv;
    } catch (err) {
      console.error('Failed to create conversation:', err);
      return null;
    }
  }, [user]);

  const removeConversation = useCallback(async (conversationId: string) => {
    try {
      await deleteConversation(conversationId);
      setConversations(prev => prev.filter(c => c.id !== conversationId));
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  }, [activeConversationId]);

  const loadMessages = useCallback(async (conversationId: string): Promise<ChatMessage[]> => {
    try {
      const dbMessages = await getMessages(conversationId);
      return dbMessages.map((m: DbChatMessage) => ({
        id: m.id,
        text: m.text,
        sender: m.sender as MessageSender,
        timestamp: new Date(m.created_at),
        urlContext: m.url_context_metadata ?? undefined,
        aiProvider: m.ai_provider ?? undefined,
      }));
    } catch (err) {
      console.error('Failed to load messages:', err);
      return [];
    }
  }, []);

  const saveMessage = useCallback(async (
    conversationId: string,
    text: string,
    sender: MessageSender,
    urlContextMetadata?: unknown,
    aiProvider?: string,
  ) => {
    if (!user) return null;
    try {
      const msg = await addMessage(
        conversationId,
        user.id,
        text,
        sender,
        urlContextMetadata,
        aiProvider,
      );

      // Auto-title from first user message
      if (sender === MessageSender.USER) {
        const conv = conversations.find(c => c.id === conversationId);
        if (conv && conv.title === 'New Conversation') {
          const title = text.length > 60 ? text.substring(0, 57) + '...' : text;
          await updateConversationTitle(conversationId, title);
          setConversations(prev =>
            prev.map(c => c.id === conversationId ? { ...c, title, updated_at: new Date().toISOString() } : c)
          );
        }
      }

      return msg;
    } catch (err) {
      console.error('Failed to save message:', err);
      return null;
    }
  }, [user, conversations]);

  return {
    conversations,
    activeConversationId,
    setActiveConversationId,
    loadingConversations,
    startNewConversation,
    removeConversation,
    loadMessages,
    saveMessage,
    refreshConversations: () => fetchConversations(0, false),
    loadMoreConversations,
    hasMoreConversations: hasMore,
  };
};
