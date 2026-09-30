'use client';

import React from 'react';
import { Plus, MessageSquare, Trash2, X, Code2, BookOpen, Sparkles, Layers } from 'lucide-react';
import { ChatSession } from '@/types/chat';
import styles from './Sidebar.module.css';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
    sessions: ChatSession[];
    activeSessionId: string | null;
    onSelectSession: (id: string) => void;
    onDeleteSession: (id: string, e: React.MouseEvent) => void;
    onNewSession: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    isOpen,
    onClose,
    sessions,
    activeSessionId,
    onSelectSession,
    onDeleteSession,
    onNewSession,
}) => {
    return (
        <>
            {/* Mobile backdrop */}
            {isOpen && (
                <button
                    type="button"
                    aria-label="Close sidebar overlay"
                    className={styles.backdrop}
                    onClick={onClose}
                />
            )}

            <aside className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}>
                <div className={styles.topSection}>
                    <div className={styles.sidebarHeader}>
                        <div className={styles.headerLabel}>
                            <Layers size={16} className={styles.headerIcon} />
                            <span>Workspace</span>
                        </div>
                        <button
                            onClick={onClose}
                            className={styles.closeButton}
                            aria-label="Close sidebar"
                            type="button"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    <button
                        onClick={() => {
                            onNewSession();
                            if (window.innerWidth < 768) onClose();
                        }}
                        className={styles.newChatBtn}
                        type="button"
                    >
                        <Plus size={16} />
                        <span>New Chat</span>
                    </button>
                </div>

                {/* Sessions list */}
                <div className={styles.sessionsContainer}>
                    <div className={styles.sectionTitle}>
                        <span>Chat Sessions</span>
                        <span className={styles.badge}>{sessions.length}</span>
                    </div>

                    {sessions.length === 0 ? (
                        <div className={styles.emptySessions}>
                            <p>No saved conversations yet.</p>
                            <span>Start chatting to save history.</span>
                        </div>
                    ) : (
                        <ul className={styles.sessionList}>
                            {sessions.map((session) => {
                                const isActive = session.id === activeSessionId;
                                return (
                                    <li key={session.id}>
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            onClick={() => {
                                                onSelectSession(session.id);
                                                if (window.innerWidth < 768) onClose();
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    onSelectSession(session.id);
                                                    if (window.innerWidth < 768) onClose();
                                                }
                                            }}
                                            className={`${styles.sessionItem} ${isActive ? styles.active : ''}`}
                                        >
                                            <MessageSquare
                                                size={15}
                                                className={styles.sessionIcon}
                                            />
                                            <div className={styles.sessionInfo}>
                                                <span className={styles.sessionTitle}>
                                                    {session.title || 'Untitled Session'}
                                                </span>
                                                <span className={styles.sessionDate}>
                                                    {new Date(session.updatedAt).toLocaleDateString(
                                                        [],
                                                        {
                                                            month: 'short',
                                                            day: 'numeric',
                                                            hour: '2-digit',
                                                            minute: '2-digit',
                                                        },
                                                    )}
                                                </span>
                                            </div>
                                            <button
                                                onClick={(e) => onDeleteSession(session.id, e)}
                                                className={styles.deleteBtn}
                                                aria-label={`Delete chat session ${session.title}`}
                                                type="button"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                {/* Agent Routing Capabilities Info */}
                <div className={styles.infoCard}>
                    <div className={styles.infoTitle}>
                        <Sparkles size={13} className={styles.infoSparkle} />
                        <span>Multi-Agent Routing</span>
                    </div>
                    <div className={styles.agentPills}>
                        <div className={styles.agentItem}>
                            <div className={`${styles.agentDot} ${styles.chatDot}`} />
                            <div className={styles.agentMeta}>
                                <strong>Study Chat</strong>
                                <p>General Q&A and tutoring</p>
                            </div>
                        </div>
                        <div className={styles.agentItem}>
                            <Code2 size={14} className={styles.codeIcon} />
                            <div className={styles.agentMeta}>
                                <strong>Code Agent</strong>
                                <p>Algorithms & debugging</p>
                            </div>
                        </div>
                        <div className={styles.agentItem}>
                            <BookOpen size={14} className={styles.ragIcon} />
                            <div className={styles.agentMeta}>
                                <strong>RAG Agent</strong>
                                <p>Knowledge & doc retrieval</p>
                            </div>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
};
