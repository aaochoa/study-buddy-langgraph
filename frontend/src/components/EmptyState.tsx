'use client';

import React from 'react';
import { Sparkles, Code2, BookOpen, MessageSquare, ArrowUpRight } from 'lucide-react';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
    onSelectPrompt: (prompt: string) => void;
}

const SAMPLE_PROMPTS = [
    {
        icon: <MessageSquare size={16} className={styles.chatIcon} />,
        title: 'Explain Complex Concept',
        description: 'Break down LangGraph conditional edges and state management step by step.',
        prompt: 'Can you explain how conditional edges and state work in LangGraph using a simple analogy?',
        category: 'Chat',
    },
    {
        icon: <Code2 size={16} className={styles.codeIcon} />,
        title: 'Code & Debugging',
        description: 'Write an asynchronous Python function with robust error retry logic.',
        prompt: 'Write an async Python function using asyncio and tenacity that retries an API call with exponential backoff.',
        category: 'Code',
    },
    {
        icon: <BookOpen size={16} className={styles.ragIcon} />,
        title: 'Study & Document Search',
        description:
            'Search study materials or indexed knowledge for key definitions and insights.',
        prompt: 'What study materials or vector documents are indexed in my database, and how does the RAG retriever work?',
        category: 'RAG',
    },
    {
        icon: <Sparkles size={16} className={styles.sparkleIcon} />,
        title: 'Interactive Quiz',
        description: 'Test my knowledge with 3 multiple-choice questions on system design.',
        prompt: 'Give me a quick 3-question quiz to test my understanding of Event-Driven vs Request-Response architectures.',
        category: 'Study',
    },
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onSelectPrompt }) => {
    return (
        <div className={styles.container}>
            <div className={styles.heroSection}>
                <div className={styles.badgeGlow}>
                    <Sparkles size={20} className={styles.badgeIcon} />
                </div>
                <h2 className={styles.title}>How can Study Buddy help you today?</h2>
                <p className={styles.description}>
                    An intelligent multi-agent study assistant powered by LangGraph. It
                    automatically classifies your query and routes to the specialized agent for
                    conversational tutoring, code generation, or document retrieval.
                </p>
            </div>

            <div className={styles.cardsGrid}>
                {SAMPLE_PROMPTS.map((item, idx) => (
                    <button
                        key={idx}
                        onClick={() => onSelectPrompt(item.prompt)}
                        className={styles.card}
                        type="button"
                    >
                        <div className={styles.cardHeader}>
                            <div className={styles.cardIconBox}>{item.icon}</div>
                            <span className={styles.categoryBadge}>{item.category}</span>
                        </div>
                        <h3 className={styles.cardTitle}>{item.title}</h3>
                        <p className={styles.cardDescription}>{item.description}</p>
                        <div className={styles.cardFooter}>
                            <span>Try this prompt</span>
                            <ArrowUpRight size={14} className={styles.arrowIcon} />
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
};
