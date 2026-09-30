'use client';

import React, { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import styles from './CodeBlock.module.css';

interface CodeBlockProps {
    language?: string;
    value: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ language = 'text', value }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard write fallback
        }
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <span className={styles.languageBadge}>{language.toUpperCase()}</span>
                <button
                    onClick={handleCopy}
                    className={styles.copyButton}
                    aria-label="Copy code"
                    type="button"
                >
                    {copied ? (
                        <>
                            <Check size={14} className={styles.successIcon} />
                            <span className={styles.copyText}>Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={14} />
                            <span className={styles.copyText}>Copy</span>
                        </>
                    )}
                </button>
            </div>
            <pre className={styles.pre}>
                <code className={styles.code}>{value}</code>
            </pre>
        </div>
    );
};
