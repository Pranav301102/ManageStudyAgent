"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Pencil, Camera, Loader2, Eye } from "lucide-react";
import { RekaVisionAnalysis } from "@/lib/types";

interface Props {
    onSnapshotReady?: (imageBase64: string) => void;
    analysis?: RekaVisionAnalysis | null;
    isAnalyzing?: boolean;
}

export default function WhiteboardPanel({
    onSnapshotReady,
    analysis,
    isAnalyzing,
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState("#ffffff");
    const [strokeWidth, setStrokeWidth] = useState(2);
    const [tool, setTool] = useState<"pen" | "eraser">("pen");
    const lastPosRef = useRef<{ x: number; y: number } | null>(null);
    const snapshotIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Set canvas size
        const updateSize = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (rect) {
                canvas.width = rect.width;
                canvas.height = 400;
                // Dark background
                ctx.fillStyle = "#0f172a";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
        };

        updateSize();
        window.addEventListener("resize", updateSize);
        return () => window.removeEventListener("resize", updateSize);
    }, []);

    // Auto-snapshot every 5 seconds for Reka Vision analysis
    useEffect(() => {
        snapshotIntervalRef.current = setInterval(() => {
            captureSnapshot();
        }, 5000);

        return () => {
            if (snapshotIntervalRef.current) {
                clearInterval(snapshotIntervalRef.current);
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const captureSnapshot = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas || !onSnapshotReady) return;

        const dataUrl = canvas.toDataURL("image/png");
        const base64 = dataUrl.split(",")[1];
        if (base64) {
            onSnapshotReady(base64);
        }
    }, [onSnapshotReady]);

    const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        };
    };

    const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        lastPosRef.current = getPos(e);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing || !lastPosRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;

        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.strokeStyle = tool === "eraser" ? "#0f172a" : color;
        ctx.lineWidth = tool === "eraser" ? strokeWidth * 4 : strokeWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.stroke();

        lastPosRef.current = pos;
    };

    const stopDraw = () => {
        setIsDrawing(false);
        lastPosRef.current = null;
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!ctx || !canvas) return;
        ctx.fillStyle = "#0f172a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    const COLORS = ["#ffffff", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4"];

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-700">
                <div className="flex items-center gap-3">
                    <Pencil className="w-4 h-4 text-indigo-400" />
                    <span className="text-xs font-medium text-white">Whiteboard</span>

                    {/* Tool selection */}
                    <div className="flex items-center gap-1 ml-2">
                        <button
                            onClick={() => setTool("pen")}
                            className={`px-2 py-1 rounded text-xs transition-colors ${tool === "pen"
                                    ? "bg-indigo-500/20 text-indigo-400"
                                    : "text-slate-400 hover:text-white"
                                }`}
                        >
                            Pen
                        </button>
                        <button
                            onClick={() => setTool("eraser")}
                            className={`px-2 py-1 rounded text-xs transition-colors ${tool === "eraser"
                                    ? "bg-indigo-500/20 text-indigo-400"
                                    : "text-slate-400 hover:text-white"
                                }`}
                        >
                            Eraser
                        </button>
                    </div>

                    {/* Color palette */}
                    <div className="flex items-center gap-1 ml-1">
                        {COLORS.map((c) => (
                            <button
                                key={c}
                                onClick={() => { setColor(c); setTool("pen"); }}
                                className={`w-4 h-4 rounded-full border-2 transition-transform ${color === c && tool === "pen"
                                        ? "border-white scale-125"
                                        : "border-transparent hover:scale-110"
                                    }`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>

                    {/* Stroke width */}
                    <input
                        type="range"
                        min="1"
                        max="8"
                        value={strokeWidth}
                        onChange={(e) => setStrokeWidth(Number(e.target.value))}
                        className="w-16 h-1 ml-2 accent-indigo-500"
                    />
                </div>

                <div className="flex items-center gap-2">
                    {isAnalyzing && (
                        <span className="flex items-center gap-1 text-[10px] text-cyan-400">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Analyzing...
                        </span>
                    )}
                    <button
                        onClick={captureSnapshot}
                        className="flex items-center gap-1 px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs hover:bg-cyan-500/30 transition-colors"
                    >
                        <Camera className="w-3 h-3" />
                        Analyze
                    </button>
                    <button
                        onClick={clearCanvas}
                        className="px-2 py-1 bg-slate-700 text-slate-400 rounded text-xs hover:bg-slate-600 hover:text-white transition-colors"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Canvas */}
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    className="w-full cursor-crosshair"
                    style={{ height: "400px", touchAction: "none" }}
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={stopDraw}
                    onMouseLeave={stopDraw}
                />

                {/* Grid overlay hint */}
                <div className="absolute bottom-2 right-2 text-[10px] text-slate-600/50 select-none pointer-events-none">
                    Draw your system design here
                </div>
            </div>

            {/* Reka Vision Analysis Panel */}
            {analysis && (
                <div className="border-t border-slate-700 p-3 bg-slate-900/50 space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                        <Eye className="w-4 h-4 text-cyan-400" />
                        <span className="text-xs font-medium text-white">
                            AI Vision Analysis
                        </span>
                        <span className="text-[8px] text-cyan-400/60 italic ml-auto">Powered by Reka Vision</span>
                    </div>

                    <p className="text-xs text-slate-400 leading-relaxed">
                        {analysis.description}
                    </p>

                    {analysis.detectedPatterns.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                            {analysis.detectedPatterns.map((p, i) => (
                                <span
                                    key={i}
                                    className="px-1.5 py-0.5 bg-cyan-500/10 text-cyan-400 rounded text-[10px]"
                                >
                                    {p}
                                </span>
                            ))}
                        </div>
                    )}

                    {analysis.suggestions.length > 0 && (
                        <div className="space-y-1 mt-1">
                            <span className="text-[10px] text-amber-400 font-medium">
                                Suggestions:
                            </span>
                            {analysis.suggestions.map((s, i) => (
                                <p key={i} className="text-[10px] text-amber-300/70 pl-2">
                                    • {s}
                                </p>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
