'use client';

import React, { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { AlertCircle } from 'lucide-react';
import { ChatMessage, ChatSession, SystemHealth } from '@/types/chat';
import { checkServerHealth, sendChatMessage, streamChatMessage } from '@/lib/api';
import {
    createNewSession,
    getStoredActiveSessionId,
    getStoredSessions,
    saveStoredActiveSessionId,
    saveStoredSessions,
} from '@/lib/storage';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { EmptyState } from '@/components/EmptyState';
import { MessageItem } from '@/components/MessageItem';
import { ChatInput } from '@/components/ChatInput';
import styles from './page.module.css';

const emptySubscribe = () => () => {};

export default function Home() {
    const isMounted = useSyncExternalStore(
        emptySubscribe,
        () => true,
        () => false,
    );

    const [sessions, setSessions] = useState<ChatSession[]>(() => {
        if (typeof window !== 'undefined') {
            const stored = getStoredSessions();
            if (stored.length > 0) return stored;
            const initial = createNewSession();
            saveStoredSessions([initial]);
            return [initial];
        }
        return [];
    });

    const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            const storedActiveId = getStoredActiveSessionId();
            if (storedActiveId) return storedActiveId;
            const stored = getStoredSessions();
            return stored[0]?.id || null;
        }
        return null;
    });

    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [useStreaming, setUseStreaming] = useState(true);
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    const [health, setHealth] = useState<SystemHealth>({
        isOnline: false,
        lastChecked: undefined,
    });
    const [isCheckingHealth, setIsCheckingHealth] = useState(false);

    const abortControllerRef = useRef<AbortController | null>(null);
    const scrollAnchorRef = useRef<HTMLDivElement>(null);

    // Ping server health
    const refreshHealth = useCallback(async () => {
        setIsCheckingHealth(true);
        try {
            const status = await checkServerHealth();
            setHealth(status);
        } catch {
            setHealth({ isOnline: false, error: 'Failed to reach agent server' });
        } finally {
            setIsCheckingHealth(false);
        }
    }, []);

    // Periodic health check
    useEffect(() => {
        const timer = setTimeout(() => {
            refreshHealth();
        }, 0);
        const interval = setInterval(refreshHealth, 25000);
        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [refreshHealth]);

    // Persist sessions whenever they change
    useEffect(() => {
        if (isMounted && sessions.length > 0) {
            saveStoredSessions(sessions);
        }
    }, [sessions, isMounted]);

    // Persist active session ID
    useEffect(() => {
        if (isMounted) {
            saveStoredActiveSessionId(activeSessionId);
        }
    }, [activeSessionId, isMounted]);

    // Active session helper
    const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
    const messages = activeSession?.messages || [];

    // Scroll to bottom when messages update
    const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
        scrollAnchorRef.current?.scrollIntoView({ behavior, block: 'end' });
    }, []);

    useEffect(() => {
        scrollToBottom('smooth');
    }, [messages.length, scrollToBottom]);

    // Handlers for Session Management
    const handleNewSession = () => {
        if (isLoading) handleStopGeneration();
        const newSession = createNewSession();
        const updated = [newSession, ...sessions];
        setSessions(updated);
        setActiveSessionId(newSession.id);
    };

    const handleSelectSession = (id: string) => {
        if (isLoading) handleStopGeneration();
        setActiveSessionId(id);
    };

    const handleDeleteSession = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (sessions.length <= 1) {
            // If deleting the last session, reset it to an empty one
            const fresh = createNewSession();
            setSessions([fresh]);
            setActiveSessionId(fresh.id);
            return;
        }

        const updated = sessions.filter((s) => s.id !== id);
        setSessions(updated);

        if (activeSessionId === id) {
            setActiveSessionId(updated[0].id);
        }
    };

    const handleStopGeneration = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setIsLoading(false);

        // Mark active streaming message as stopped
        if (activeSessionId) {
            setSessions((prev) =>
                prev.map((s) => {
                    if (s.id !== activeSessionId) return s;
                    const msgs = [...s.messages];
                    const lastIndex = msgs.length - 1;
                    if (lastIndex >= 0 && msgs[lastIndex].isStreaming) {
                        msgs[lastIndex] = {
                            ...msgs[lastIndex],
                            isStreaming: false,
                        };
                    }
                    return { ...s, messages: msgs };
                }),
            );
        }
    };

    // Send message implementation
    const handleSendMessage = async (textToSend?: string) => {
        const messageContent = (textToSend ?? input).trim();
        if (!messageContent || isLoading || !activeSessionId) return;

        setInput('');
        setIsLoading(true);

        const userMessage: ChatMessage = {
            id: `usr-${Date.now()}`,
            role: 'user',
            content: messageContent,
            timestamp: Date.now(),
        };

        const assistantMessageId = `ast-${Date.now()}`;
        const assistantPlaceholder: ChatMessage = {
            id: assistantMessageId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            isStreaming: true,
        };

        // Update active session with the new messages
        const threadId = activeSessionId;
        setSessions((prev) =>
            prev.map((session) => {
                if (session.id !== threadId) return session;

                // Auto-generate title if it's the initial default title
                const isFirstMessage = session.messages.length === 0;
                const autoTitle = isFirstMessage
                    ? messageContent.slice(0, 32) + (messageContent.length > 32 ? '...' : '')
                    : session.title;

                return {
                    ...session,
                    title: autoTitle,
                    updatedAt: Date.now(),
                    messages: [...session.messages, userMessage, assistantPlaceholder],
                };
            }),
        );

        const controller = new AbortController();
        abortControllerRef.current = controller;

        if (useStreaming) {
            // SSE Real-time Streaming
            try {
                let accumulatedText = '';

                await streamChatMessage(
                    messageContent,
                    threadId,
                    {
                        onSession: (data) => {
                            // LangGraph thread_id confirmation
                            if (data.thread_id && data.thread_id !== threadId) {
                                setActiveSessionId(data.thread_id);
                            }
                        },
                        onIntent: (data) => {
                            setSessions((prev) =>
                                prev.map((session) => {
                                    if (session.id !== threadId) return session;
                                    return {
                                        ...session,
                                        messages: session.messages.map((m) =>
                                            m.id === assistantMessageId
                                                ? { ...m, intent: data.intent }
                                                : m,
                                        ),
                                    };
                                }),
                            );
                        },
                        onToken: (data) => {
                            accumulatedText += data.token;
                            setSessions((prev) =>
                                prev.map((session) => {
                                    if (session.id !== threadId) return session;
                                    return {
                                        ...session,
                                        messages: session.messages.map((m) =>
                                            m.id === assistantMessageId
                                                ? { ...m, content: accumulatedText }
                                                : m,
                                        ),
                                    };
                                }),
                            );
                            scrollToBottom('smooth');
                        },
                        onDone: () => {
                            setSessions((prev) =>
                                prev.map((session) => {
                                    if (session.id !== threadId) return session;
                                    return {
                                        ...session,
                                        messages: session.messages.map((m) =>
                                            m.id === assistantMessageId
                                                ? {
                                                      ...m,
                                                      isStreaming: false,
                                                      modelUsed: health.primaryModel,
                                                  }
                                                : m,
                                        ),
                                    };
                                }),
                            );
                            setIsLoading(false);
                        },
                        onError: (err) => {
                            setSessions((prev) =>
                                prev.map((session) => {
                                    if (session.id !== threadId) return session;
                                    return {
                                        ...session,
                                        messages: session.messages.map((m) =>
                                            m.id === assistantMessageId
                                                ? {
                                                      ...m,
                                                      content:
                                                          accumulatedText ||
                                                          'Failed to complete response.',
                                                      isStreaming: false,
                                                      error: err.message,
                                                  }
                                                : m,
                                        ),
                                    };
                                }),
                            );
                            setIsLoading(false);
                        },
                    },
                    controller.signal,
                );
            } catch (err: unknown) {
                if (!controller.signal.aborted) {
                    const errorMessage =
                        err instanceof Error ? err.message : 'Unknown streaming error';
                    setSessions((prev) =>
                        prev.map((session) => {
                            if (session.id !== threadId) return session;
                            return {
                                ...session,
                                messages: session.messages.map((m) =>
                                    m.id === assistantMessageId
                                        ? {
                                              ...m,
                                              isStreaming: false,
                                              error: errorMessage,
                                          }
                                        : m,
                                ),
                            };
                        }),
                    );
                }
                setIsLoading(false);
            }
        } else {
            // Standard non-streaming fallback
            try {
                const responseData = await sendChatMessage(
                    messageContent,
                    threadId,
                    controller.signal,
                );

                setSessions((prev) =>
                    prev.map((session) => {
                        if (session.id !== threadId) return session;
                        return {
                            ...session,
                            messages: session.messages.map((m) =>
                                m.id === assistantMessageId
                                    ? {
                                          ...m,
                                          content: responseData.response,
                                          intent: responseData.intent,
                                          modelUsed: responseData.model_used || health.primaryModel,
                                          isStreaming: false,
                                      }
                                    : m,
                            ),
                        };
                    }),
                );
            } catch (err: unknown) {
                if (!controller.signal.aborted) {
                    const errorMessage = err instanceof Error ? err.message : 'Chat request failed';
                    setSessions((prev) =>
                        prev.map((session) => {
                            if (session.id !== threadId) return session;
                            return {
                                ...session,
                                messages: session.messages.map((m) =>
                                    m.id === assistantMessageId
                                        ? {
                                              ...m,
                                              isStreaming: false,
                                              error: errorMessage,
                                          }
                                        : m,
                                ),
                            };
                        }),
                    );
                }
            } finally {
                setIsLoading(false);
            }
        }
    };

    if (!isMounted) {
        return null;
    }

    return (
        <div className={styles.mainLayout}>
            {/* Sidebar for chat threads and capabilities */}
            <Sidebar
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                sessions={sessions}
                activeSessionId={activeSessionId}
                onSelectSession={handleSelectSession}
                onDeleteSession={handleDeleteSession}
                onNewSession={handleNewSession}
            />

            <div className={styles.contentArea}>
                {/* Top Header */}
                <Header
                    health={health}
                    onRefreshHealth={refreshHealth}
                    isCheckingHealth={isCheckingHealth}
                    onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
                    onNewChat={handleNewSession}
                />

                {/* Offline Banner if Agent API is not reached */}
                {!health.isOnline && (
                    <div className={styles.offlineBanner}>
                        <div className={styles.bannerContent}>
                            <AlertCircle size={15} />
                            <span>
                                Agent server is not running on{' '}
                                <strong>http://localhost:8000</strong>. Run{' '}
                                <code className={styles.bannerCode}>
                                    uv run uvicorn main:app --reload
                                </code>{' '}
                                in <code className={styles.bannerCode}>agent/</code>
                            </span>
                        </div>
                        <button onClick={refreshHealth} className={styles.retryBtn} type="button">
                            Retry Connection
                        </button>
                    </div>
                )}

                {/* Chat / Message Viewport */}
                <div className={styles.messagesViewport}>
                    {messages.length === 0 ? (
                        <EmptyState onSelectPrompt={(p) => handleSendMessage(p)} />
                    ) : (
                        <div className={styles.messagesList}>
                            {messages.map((msg) => (
                                <MessageItem key={msg.id} message={msg} />
                            ))}
                            <div ref={scrollAnchorRef} className={styles.scrollAnchor} />
                        </div>
                    )}
                </div>

                {/* Floating Input Dock */}
                <ChatInput
                    input={input}
                    setInput={setInput}
                    onSubmit={() => handleSendMessage()}
                    isLoading={isLoading}
                    onStop={handleStopGeneration}
                    useStreaming={useStreaming}
                    setUseStreaming={setUseStreaming}
                />
            </div>
        </div>
    );
}
