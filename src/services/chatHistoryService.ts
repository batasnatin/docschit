import { supabase } from '@/lib/supabase';
import { Conversation, DbChatMessage, MessageSender } from '@/types';

const CONVERSATIONS_PAGE_SIZE = 30;

export const getConversations = async (
  userId: string,
  page: number = 0,
): Promise<{ data: Conversation[]; hasMore: boolean }> => {
  const from = page * CONVERSATIONS_PAGE_SIZE;
  const to = from + CONVERSATIONS_PAGE_SIZE;

  const { data, error } = await supabase
    .from('docschat_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  const rows = data ?? [];
  // If we got one more than page size, there are more pages
  const hasMore = rows.length > CONVERSATIONS_PAGE_SIZE;
  return {
    data: hasMore ? rows.slice(0, CONVERSATIONS_PAGE_SIZE) : rows,
    hasMore,
  };
};

export const createConversation = async (
  userId: string,
  title: string = 'New Conversation',
  knowledgeGroupName?: string,
): Promise<Conversation> => {
  const { data, error } = await supabase
    .from('docschat_conversations')
    .insert({
      user_id: userId,
      title,
      knowledge_group_name: knowledgeGroupName ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateConversationTitle = async (conversationId: string, title: string): Promise<void> => {
  const { error } = await supabase
    .from('docschat_conversations')
    .update({ title })
    .eq('id', conversationId);

  if (error) throw error;
};

export const deleteConversation = async (conversationId: string): Promise<void> => {
  const { error } = await supabase
    .from('docschat_conversations')
    .delete()
    .eq('id', conversationId);

  if (error) throw error;
};

export const getMessages = async (conversationId: string): Promise<DbChatMessage[]> => {
  const { data, error } = await supabase
    .from('docschat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
};

export const addMessage = async (
  conversationId: string,
  userId: string,
  text: string,
  sender: MessageSender,
  urlContextMetadata?: unknown,
  aiProvider?: string,
): Promise<DbChatMessage> => {
  const { data, error } = await supabase
    .from('docschat_messages')
    .insert({
      conversation_id: conversationId,
      user_id: userId,
      text,
      sender,
      url_context_metadata: urlContextMetadata ?? null,
      ai_provider: aiProvider ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  // Update conversation's updated_at
  await supabase
    .from('docschat_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data;
};
