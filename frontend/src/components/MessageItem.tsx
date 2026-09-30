'use client';

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    User,
    Bot,
    Copy,
    Check,
    Code2,
    BookOpen,
    MessageCircle,
    AlertCircle,
    Cpu,
} from 'lucide-react';
import { ChatMessage, MessageIntent } from '@/types/chat';
import { CodeBlock } from './CodeBlock';
import styles from './MessageItem.module.css';

interface MessageItemProps {
    message: ChatMessage;
}

const markdownComponents = {
    code({ className, children, ...props }: React.ComponentPropsWithoutRef<'code'>) {
        const match = /language-(\w+)/.exec(className || '');
        const isInline = !match && !String(children).includes('\n');
        if (isInline) {
            return (
                <code className={className} {...props}>
                    {children}
                </code>
            );
        }
        return (
            <CodeBlock
                language={match ? match[1] : 'text'}
                value={String(children).replace(/\n$/, '')}
            />
        );
    },
};

export const MessageItem: React.FC<MessageItemProps> = ({ message }) => {
    const [copied, setCopied] = useState(false);
    const isUser = message.role === 'user';

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(message.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard write fallback
        }
    };

    const renderIntentBadge = (intent?: MessageIntent) => {
        if (!intent) return null;
        switch (intent) {
            case 'code':
                return (
                    <span className={`${styles.intentBadge} ${styles.intentCode}`}>
                        <Code2 size={12} />
                        <span>Code Specialist</span>
                    </span>
                );
            case 'rag':
                return (
                    <span className={`${styles.intentBadge} ${styles.intentRag}`}>
                        <BookOpen size={12} />
                        <span>Knowledge RAG</span>
                    </span>
                );
            case 'chat':
                return (
                    <span className={`${styles.intentBadge} ${styles.intentChat}`}>
                        <MessageCircle size={12} />
                        <span>Study Chat</span>
                    </span>
                );
            default:
                return null;
        }
    };

    return (
        <div
            className={`${styles.messageRow} ${
                isUser ? styles.userRow : styles.assistantRow
            } animate-fade-in`}
        >
            <div className={styles.avatar}>
                {isUser ? (
                    <div className={styles.userAvatar}>
                        <User size={16} />
                    </div>
                ) : (
                    <div className={styles.botAvatar}>
                        <Bot size={17} />
                    </div>
                )}
            </div>

            <div className={styles.messageContentWrapper}>
                <div className={styles.metaRow}>
                    <span className={styles.authorName}>{isUser ? 'You' : 'Study Buddy'}</span>

                    {!isUser && renderIntentBadge(message.intent)}

                    {!isUser && message.modelUsed && (
                        <span className={styles.modelTag}>
                            <Cpu size={10} />
                            {message.modelUsed}
                        </span>
                    )}

                    <span className={styles.timestamp}>
                        {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                        })}
                    </span>
                </div>

                <div
                    className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}
                >
                    {message.error ? (
                        <div className={styles.errorContainer}>
                            <AlertCircle size={16} className={styles.errorIcon} />
                            <span>{message.error}</span>
                        </div>
                    ) : (
                        <div className="markdown-body">
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                            >
                                {message.content}
                            </ReactMarkdown>

                            {message.isStreaming && <span className="streaming-cursor" />}
                        </div>
                    )}
                </div>

                {/* Message Action Footer */}
                {!isUser && !message.isStreaming && message.content && (
                    <div className={styles.actionFooter}>
                        <button
                            onClick={handleCopy}
                            className={styles.copyAction}
                            aria-label="Copy full response"
                            type="button"
                        >
                            {copied ? (
                                <>
                                    <Check size={12} className={styles.successIcon} />
                                    <span>Copied</span>
                                </>
                            ) : (
                                <>
                                    <Copy size={12} />
                                    <span>Copy</span>
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
