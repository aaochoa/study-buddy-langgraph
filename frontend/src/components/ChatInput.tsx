'use client';

import React, { useRef, useEffect } from 'react';
import { ArrowUp, Square, Zap } from 'lucide-react';
import styles from './ChatInput.module.css';

interface ChatInputProps {
    input: string;
    setInput: (value: string) => void;
    onSubmit: () => void;
    isLoading: boolean;
    onStop: () => void;
    useStreaming: boolean;
    setUseStreaming: (value: boolean) => void;
    disabled?: boolean;
}

export const ChatInput: React.FC<ChatInputProps> = ({
    input,
    setInput,
    onSubmit,
    isLoading,
    onStop,
    useStreaming,
    setUseStreaming,
    disabled = false,
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea height
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            const scrollHeight = textareaRef.current.scrollHeight;
            textareaRef.current.style.height = `${Math.min(scrollHeight, 180)}px`;
        }
    }, [input]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!isLoading && input.trim()) {
                onSubmit();
            }
        }
    };

    return (
        <div className={styles.wrapper}>
            <div className={styles.container}>
                <div className={styles.inputArea}>
                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={
                            disabled
                                ? 'Backend server appears unreachable. Check connection...'
                                : 'Ask a question, request code debugging, or query study topics...'
                        }
                        rows={1}
                        disabled={disabled && !isLoading}
                        className={styles.textarea}
                    />
                </div>

                <div className={styles.toolbar}>
                    {/* Stream Mode Toggle */}
                    <div className={styles.toolbarLeft}>
                        <button
                            onClick={() => setUseStreaming(!useStreaming)}
                            className={`${styles.streamToggle} ${useStreaming ? styles.streamActive : ''}`}
                            title={
                                useStreaming
                                    ? 'Streaming mode: ON (Fast tokens)'
                                    : 'Standard mode (Complete response)'
                            }
                            type="button"
                        >
                            <Zap size={13} className={styles.streamIcon} />
                            <span>{useStreaming ? 'SSE Streaming' : 'Standard API'}</span>
                        </button>
                        <span className={styles.shortcutHint}>
                            Press <kbd>Enter ↵</kbd> to send
                        </span>
                    </div>

                    <div className={styles.toolbarRight}>
                        {isLoading ? (
                            <button
                                onClick={onStop}
                                className={styles.stopButton}
                                aria-label="Stop generating response"
                                type="button"
                            >
                                <Square size={13} fill="currentColor" />
                                <span>Stop</span>
                            </button>
                        ) : (
                            <button
                                onClick={onSubmit}
                                disabled={!input.trim() || disabled}
                                className={styles.sendButton}
                                aria-label="Send message"
                                type="button"
                            >
                                <ArrowUp size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
