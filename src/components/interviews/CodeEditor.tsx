"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { CodeEditorState } from "@/lib/types";
import { Code, Play, Lightbulb, ChevronDown } from "lucide-react";

interface Props {
    initialCode?: string;
    language?: string;
    onCodeChange?: (state: CodeEditorState) => void;
    onRequestHint?: (code: string, language: string) => void;
    hint?: string;
    codeAnalysis?: string;
}

const LANGUAGES = [
    { value: "python", label: "Python" },
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    { value: "java", label: "Java" },
    { value: "cpp", label: "C++" },
    { value: "go", label: "Go" },
];

const DEFAULT_CODE: Record<string, string> = {
    python: '# Write your solution here\n\ndef solution():\n    pass\n',
    javascript: '// Write your solution here\n\nfunction solution() {\n  \n}\n',
    typescript: '// Write your solution here\n\nfunction solution(): void {\n  \n}\n',
    java: '// Write your solution here\n\nclass Solution {\n    public void solve() {\n        \n    }\n}\n',
    cpp: '// Write your solution here\n\n#include <iostream>\nusing namespace std;\n\nint main() {\n    \n    return 0;\n}\n',
    go: '// Write your solution here\n\npackage main\n\nfunc main() {\n\t\n}\n',
};

export default function CodeEditorPanel({
    initialCode,
    language: initialLang = "python",
    onCodeChange,
    onRequestHint,
    hint,
    codeAnalysis,
}: Props) {
    const [language, setLanguage] = useState(initialLang);
    const [code, setCode] = useState(initialCode || DEFAULT_CODE[initialLang] || "");
    const [showLangPicker, setShowLangPicker] = useState(false);
    const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [idleSeconds, setIdleSeconds] = useState(0);

    // Track idle time and auto-request hint after 30 seconds
    useEffect(() => {
        const interval = setInterval(() => {
            setIdleSeconds((prev) => {
                const next = prev + 1;
                if (next === 30 && onRequestHint) {
                    onRequestHint(code, language);
                }
                return next;
            });
        }, 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [code, language]);

    const handleCodeChange = useCallback(
        (value: string | undefined) => {
            const newCode = value || "";
            setCode(newCode);
            setIdleSeconds(0); // Reset idle timer on edit

            if (idleTimerRef.current) {
                clearTimeout(idleTimerRef.current);
            }

            onCodeChange?.({
                code: newCode,
                language,
                lastEditTimestamp: Date.now(),
            });
        },
        [language, onCodeChange]
    );

    const handleLanguageChange = (lang: string) => {
        setLanguage(lang);
        setCode(DEFAULT_CODE[lang] || "");
        setShowLangPicker(false);
        setIdleSeconds(0);
    };

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-medium text-white">Code Editor</span>

                    {/* Language picker */}
                    <div className="relative ml-2">
                        <button
                            onClick={() => setShowLangPicker(!showLangPicker)}
                            className="flex items-center gap-1 px-2 py-1 bg-slate-700 rounded text-xs text-slate-300 hover:bg-slate-600 transition-colors"
                        >
                            {LANGUAGES.find((l) => l.value === language)?.label}
                            <ChevronDown className="w-3 h-3" />
                        </button>
                        {showLangPicker && (
                            <div className="absolute top-full left-0 mt-1 bg-slate-700 rounded-lg border border-slate-600 shadow-xl z-10 overflow-hidden">
                                {LANGUAGES.map((l) => (
                                    <button
                                        key={l.value}
                                        onClick={() => handleLanguageChange(l.value)}
                                        className={`block w-full text-left px-3 py-1.5 text-xs transition-colors ${l.value === language
                                                ? "bg-indigo-500/20 text-indigo-400"
                                                : "text-slate-300 hover:bg-slate-600"
                                            }`}
                                    >
                                        {l.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {idleSeconds >= 20 && idleSeconds < 30 && (
                        <span className="text-[10px] text-amber-400 animate-pulse">
                            Hint in {30 - idleSeconds}s...
                        </span>
                    )}
                    <button
                        onClick={() => onRequestHint?.(code, language)}
                        className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs hover:bg-amber-500/30 transition-colors"
                    >
                        <Lightbulb className="w-3 h-3" />
                        Hint
                    </button>
                    <button className="flex items-center gap-1 px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs hover:bg-emerald-500/30 transition-colors">
                        <Play className="w-3 h-3" />
                        Run
                    </button>
                </div>
            </div>

            {/* Monaco Editor */}
            <div className="h-[400px]">
                <Editor
                    height="100%"
                    language={language}
                    value={code}
                    onChange={handleCodeChange}
                    theme="vs-dark"
                    options={{
                        minimap: { enabled: false },
                        fontSize: 13,
                        lineNumbers: "on",
                        scrollBeyondLastLine: false,
                        wordWrap: "on",
                        automaticLayout: true,
                        padding: { top: 12 },
                        bracketPairColorization: { enabled: true },
                        suggestOnTriggerCharacters: true,
                    }}
                />
            </div>

            {/* AI Feedback Panel */}
            {(hint || codeAnalysis) && (
                <div className="border-t border-slate-700 p-3 bg-slate-900/50 space-y-2">
                    {hint && (
                        <div className="flex items-start gap-2">
                            <Lightbulb className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-300 leading-relaxed">{hint}</p>
                        </div>
                    )}
                    {codeAnalysis && (
                        <div className="flex items-start gap-2">
                            <Code className="w-4 h-4 text-indigo-400 flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-slate-400 leading-relaxed">
                                {codeAnalysis}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
