'use client';

import React from 'react';
import { Sparkles, RefreshCw, PanelLeft, Bot, Wifi, WifiOff } from 'lucide-react';
import { SystemHealth } from '@/types/chat';
import styles from './Header.module.css';

interface HeaderProps {
    health: SystemHealth;
    onRefreshHealth: () => void;
    isCheckingHealth: boolean;
    onToggleSidebar: () => void;
    onNewChat: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    health,
    onRefreshHealth,
    isCheckingHealth,
    onToggleSidebar,
    onNewChat,
}) => {
    return (
        <header className={styles.header}>
            <div className={styles.leftSection}>
                <button
                    onClick={onToggleSidebar}
                    className={styles.menuButton}
                    aria-label="Toggle chat history sidebar"
                    type="button"
                >
                    <PanelLeft size={19} />
                </button>

                <div className={styles.branding}>
                    <div className={styles.logoBadge}>
                        <Sparkles size={18} className={styles.sparkleIcon} />
                    </div>
                    <div className={styles.titleWrapper}>
                        <div className={styles.titleRow}>
                            <h1 className={styles.title}>Study Buddy</h1>
                            <span className={styles.versionTag}>LangGraph Multi-Agent</span>
                        </div>
                        <p className={styles.subtitle}>Chat • Code • RAG Research</p>
                    </div>
                </div>
            </div>

            <div className={styles.rightSection}>
                {/* Model Tag */}
                {health.primaryModel && (
                    <div className={styles.modelPill} title="Active Primary LLM">
                        <Bot size={14} className={styles.modelIcon} />
                        <span className={styles.modelName}>{health.primaryModel}</span>
                    </div>
                )}

                {/* Server Status Pill */}
                <div
                    className={`${styles.statusPill} ${
                        health.isOnline ? styles.statusOnline : styles.statusOffline
                    }`}
                    title={health.error ? `Error: ${health.error}` : 'FastAPI Server Connected'}
                >
                    {health.isOnline ? (
                        <>
                            <span className={styles.statusDotOnline} />
                            <Wifi size={13} />
                            <span className={styles.statusLabel}>Agent Online</span>
                        </>
                    ) : (
                        <>
                            <span className={styles.statusDotOffline} />
                            <WifiOff size={13} />
                            <span className={styles.statusLabel}>Agent Offline</span>
                        </>
                    )}

                    <button
                        onClick={onRefreshHealth}
                        className={`${styles.refreshButton} ${isCheckingHealth ? styles.spinning : ''}`}
                        aria-label="Refresh agent health"
                        type="button"
                    >
                        <RefreshCw size={12} />
                    </button>
                </div>

                <button onClick={onNewChat} className={styles.newChatButton} type="button">
                    + New Chat
                </button>
            </div>
        </header>
    );
};
