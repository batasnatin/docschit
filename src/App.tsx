import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { AuthProvider } from '@/contexts/AuthContext';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoginPromptModal from '@/components/LoginPromptModal';
import BrandedHeader from '@/components/BrandedHeader';
import ConversationSidebar from '@/components/ConversationSidebar';
import { ChatMessage, MessageSender, KnowledgeGroup, FileData } from '@/types';
import { generateContentWithKnowledgeContext, getInitialSuggestions } from '@/services/geminiService';
import { useConversations } from '@/hooks/useConversations';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const LoginPage = lazy(() => import('@/components/LoginPage'));

const KnowledgeBaseManager = React.lazy(() => import('@/components/KnowledgeBaseManager'));
const ChatInterface = React.lazy(() => import('@/components/ChatInterface'));

const INITIAL_KNOWLEDGE_GROUPS: KnowledgeGroup[] = [
  { id: 'default-group', name: 'My Case File', urls: [], files: [] },
];

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full bg-bg-primary">
    <Loader2 size={32} className="animate-spin text-accent" />
  </div>
);

const MainLayout: React.FC = () => {
  const { user } = useAuth();
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    loadingConversations,
    startNewConversation,
    removeConversation,
    loadMessages,
    saveMessage,
    loadMoreConversations,
    hasMoreConversations,
  } = useConversations();

  const [knowledgeGroups, setKnowledgeGroups] = useState<KnowledgeGroup[]>(INITIAL_KNOWLEDGE_GROUPS);
  const [activeGroupId, setActiveGroupId] = useState<string>(INITIAL_KNOWLEDGE_GROUPS[0].id);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);
  const [initialQuerySuggestions, setInitialQuerySuggestions] = useState<string[]>([]);

  const MAX_URLS = 20;
  const MAX_FILES = 5;

  const activeGroup = knowledgeGroups.find(group => group.id === activeGroupId);
  const currentUrlsForChat = activeGroup ? activeGroup.urls : [];
  const currentFilesForChat = activeGroup ? activeGroup.files : [];

  // Load messages when conversation changes
  useEffect(() => {
    if (activeConversationId) {
      loadMessages(activeConversationId).then(msgs => {
        if (msgs.length > 0) {
          setChatMessages(msgs);
        } else {
          setChatMessages([{
            id: `system-welcome-${Date.now()}`,
            text: 'Welcome to BATASnatin Docs Chit-Chat! Get started by adding legal documents or URLs to your case file.',
            sender: MessageSender.SYSTEM,
            timestamp: new Date(),
          }]);
        }
      });
    } else {
      const currentActiveGroup = knowledgeGroups.find(group => group.id === activeGroupId);
      const hasKnowledge = currentActiveGroup && (currentActiveGroup.urls.length > 0 || currentActiveGroup.files.length > 0);

      let welcomeMessageText = 'Welcome to BATASnatin Docs Chit-Chat!';
      if (hasKnowledge) {
        welcomeMessageText += ` I am ready to analyze legal documents from: "${currentActiveGroup?.name || 'None'}". Just ask me questions, or try one of the suggestions below.`;
      } else {
        welcomeMessageText += ` Get started by adding legal documents or URLs to your "${currentActiveGroup?.name || 'Case File'}" on the left.`;
      }

      setChatMessages([{
        id: `system-welcome-${activeGroupId}-${Date.now()}`,
        text: welcomeMessageText,
        sender: MessageSender.SYSTEM,
        timestamp: new Date(),
      }]);
    }
  }, [activeConversationId, activeGroupId, knowledgeGroups, loadMessages]);

  const fetchAndSetInitialSuggestions = useCallback(async (currentUrls: string[], currentFiles: FileData[]) => {
    if ((currentUrls.length + currentFiles.length) === 0) {
      setInitialQuerySuggestions([]);
      return;
    }

    setIsFetchingSuggestions(true);
    setInitialQuerySuggestions([]);

    try {
      const response = await getInitialSuggestions(currentUrls, currentFiles);
      let suggestionsArray: string[] = [];
      if (response.text) {
        try {
          let jsonStr = response.text.trim();
          const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
          const match = jsonStr.match(fenceRegex);
          if (match && match[2]) jsonStr = match[2].trim();
          const parsed = JSON.parse(jsonStr);
          if (parsed && Array.isArray(parsed.suggestions)) {
            suggestionsArray = parsed.suggestions.filter((s: unknown) => typeof s === 'string');
          }
        } catch (parseError) {
          console.error('Failed to parse suggestions JSON:', parseError);
        }
      }
      setInitialQuerySuggestions(suggestionsArray.slice(0, 4));
    } catch (e: unknown) {
      const error = e as Error;
      setChatMessages(prev => [...prev, {
        id: `sys-err-suggestion-fetch-${Date.now()}`,
        text: `Error fetching suggestions: ${error.message || 'Unknown error'}`,
        sender: MessageSender.SYSTEM,
        timestamp: new Date(),
      }]);
    } finally {
      setIsFetchingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    if (currentUrlsForChat.length > 0 || currentFilesForChat.length > 0) {
      fetchAndSetInitialSuggestions(currentUrlsForChat, currentFilesForChat);
    } else {
      setInitialQuerySuggestions([]);
    }
  }, [currentUrlsForChat, currentFilesForChat, fetchAndSetInitialSuggestions]);

  const handleAddUrl = (url: string) => {
    setKnowledgeGroups(prevGroups =>
      prevGroups.map(group => {
        if (group.id === activeGroupId) {
          if (group.urls.length < MAX_URLS && !group.urls.includes(url)) {
            return { ...group, urls: [...group.urls, url] };
          }
        }
        return group;
      })
    );
  };

  const handleRemoveUrl = (urlToRemove: string) => {
    setKnowledgeGroups(prevGroups =>
      prevGroups.map(group => {
        if (group.id === activeGroupId) {
          return { ...group, urls: group.urls.filter(url => url !== urlToRemove) };
        }
        return group;
      })
    );
  };

  const handleClearUrls = () => {
    setKnowledgeGroups(prevGroups =>
      prevGroups.map(group => {
        if (group.id === activeGroupId) {
          return { ...group, urls: [] };
        }
        return group;
      })
    );
  };

  const handleAddFile = (file: FileData) => {
    setKnowledgeGroups(prevGroups =>
      prevGroups.map(group => {
        if (group.id === activeGroupId) {
          if (group.files.length < MAX_FILES && !group.files.some(f => f.id === file.id)) {
            return { ...group, files: [...group.files, file] };
          }
        }
        return group;
      })
    );
  };

  const handleRemoveFile = (fileIdToRemove: string) => {
    setKnowledgeGroups(prevGroups =>
      prevGroups.map(group => {
        if (group.id === activeGroupId) {
          return { ...group, files: group.files.filter(f => f.id !== fileIdToRemove) };
        }
        return group;
      })
    );
  };

  const handleClearFiles = () => {
    setKnowledgeGroups(prevGroups =>
      prevGroups.map(group => {
        if (group.id === activeGroupId) {
          return { ...group, files: [] };
        }
        return group;
      })
    );
  };

  const requireAuth = useCallback((): boolean => {
    if (user) return true;
    setShowLoginPrompt(true);
    return false;
  }, [user]);

  const handleSendMessage = async (query: string) => {
    if (!requireAuth()) return;
    if (!query.trim() || isLoading || isFetchingSuggestions) return;

    setIsLoading(true);
    setInitialQuerySuggestions([]);

    // Ensure we have a conversation
    let convId = activeConversationId;
    if (!convId) {
      const conv = await startNewConversation(activeGroup?.name);
      if (!conv) { setIsLoading(false); return; }
      convId = conv.id;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      text: query,
      sender: MessageSender.USER,
      timestamp: new Date(),
      files: currentFilesForChat,
    };

    const modelPlaceholderMessage: ChatMessage = {
      id: `model-response-${Date.now()}`,
      text: 'Thinking...',
      sender: MessageSender.MODEL,
      timestamp: new Date(),
      isLoading: true,
      files: currentFilesForChat,
    };

    setChatMessages(prevMessages => [...prevMessages, userMessage, modelPlaceholderMessage]);

    // Save user message
    await saveMessage(convId, query, MessageSender.USER);

    try {
      const response = await generateContentWithKnowledgeContext(query, currentUrlsForChat, currentFilesForChat);
      setChatMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === modelPlaceholderMessage.id
            ? {
              ...modelPlaceholderMessage,
              text: response.text || 'I received an empty response.',
              isLoading: false,
              urlContext: response.urlContextMetadata,
              aiProvider: response.provider,
            }
            : msg
        )
      );

      // Save model response
      await saveMessage(
        convId,
        response.text || 'I received an empty response.',
        MessageSender.MODEL,
        response.urlContextMetadata,
        response.provider,
      );
    } catch (e: unknown) {
      const error = e as Error;
      const errorMessage = error.message || 'Failed to get response from AI.';
      setChatMessages(prevMessages =>
        prevMessages.map(msg =>
          msg.id === modelPlaceholderMessage.id
            ? { ...modelPlaceholderMessage, text: `Error: ${errorMessage}`, sender: MessageSender.SYSTEM, isLoading: false }
            : msg
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestedQueryClick = (query: string) => {
    if (!requireAuth()) return;
    handleSendMessage(query);
  };

  const hasKnowledge = currentUrlsForChat.length > 0 || currentFilesForChat.length > 0;
  const chatPlaceholder = hasKnowledge
    ? `Ask legal questions about "${activeGroup?.name || 'the current case file'}"...`
    : 'Add legal documents or URLs to the case file to enable chat.';

  return (
    <div className="h-screen max-h-screen flex flex-col overflow-hidden bg-bg-primary text-text-primary">
      <LoginPromptModal isOpen={showLoginPrompt} onClose={() => setShowLoginPrompt(false)} />
      <BrandedHeader />

      <div className="flex flex-1 overflow-hidden">
        {/* Overlay for mobile */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-20 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Left sidebar - conversations + knowledge */}
        <div className={`
          fixed top-0 left-0 h-full w-11/12 max-w-sm z-30 transform transition-transform ease-in-out duration-300 p-3 bg-bg-primary
          md:static md:p-0 md:w-80 md:h-full md:max-w-none md:translate-x-0 md:z-auto md:border-r md:border-border
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
          <div className="flex flex-col h-full p-3 gap-3 overflow-hidden">
            {/* Conversations section */}
            <div className="flex-shrink-0 h-1/3 min-h-[200px]">
              <ConversationSidebar
                conversations={conversations}
                activeConversationId={activeConversationId}
                onSelectConversation={setActiveConversationId}
                onNewConversation={() => { setActiveConversationId(null); setChatMessages([]); }}
                onDeleteConversation={removeConversation}
                loading={loadingConversations}
                hasMore={hasMoreConversations}
                onLoadMore={loadMoreConversations}
              />
            </div>

            {/* Knowledge base section */}
            <div className="flex-1 min-h-0">
              <Suspense fallback={<LoadingFallback />}>
                <KnowledgeBaseManager
                  urls={currentUrlsForChat}
                  onAddUrl={handleAddUrl}
                  onRemoveUrl={handleRemoveUrl}
                  onClearUrls={handleClearUrls}
                  maxUrls={MAX_URLS}
                  files={currentFilesForChat}
                  onAddFile={handleAddFile}
                  onRemoveFile={handleRemoveFile}
                  onClearFiles={handleClearFiles}
                  maxFiles={MAX_FILES}
                  knowledgeGroups={knowledgeGroups}
                  activeGroupId={activeGroupId}
                  onSetGroupId={setActiveGroupId}
                  onCloseSidebar={() => setIsSidebarOpen(false)}
                />
              </Suspense>
            </div>
          </div>
        </div>

        {/* Chat Interface */}
        <div className="flex-1 p-3 min-w-0">
          <Suspense fallback={<LoadingFallback />}>
            <ChatInterface
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
              placeholderText={chatPlaceholder}
              initialQuerySuggestions={initialQuerySuggestions}
              onSuggestedQueryClick={handleSuggestedQueryClick}
              isFetchingSuggestions={isFetchingSuggestions}
              onToggleSidebar={() => setIsSidebarOpen(true)}
            />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

const AuthCallback: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-screen bg-bg-primary">
      <div className="flex flex-col items-center gap-4">
        <Loader2 size={40} className="animate-spin text-accent" />
        <p className="text-text-secondary text-sm">Completing sign in...</p>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route
                path="/login"
                element={
                  <Suspense fallback={<LoadingFallback />}>
                    <LoginPage />
                  </Suspense>
                }
              />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route
                path="/*"
                element={<MainLayout />}
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default App;
