"use client";

import { InterviewSession, InterviewQuestion, VoiceAnalysis } from "@/lib/types";
import {
  Mic,
  MicOff,
  SkipForward,
  Square,
  Volume2,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  interview: InterviewSession;
  onSubmitResponse: (questionId: string, transcript: string, audioBase64?: string) => Promise<void>;
  onComplete: () => void;
}

export default function InterviewPanel({
  interview,
  onSubmitResponse,
  onComplete,
}: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const currentQuestion =
    interview.questions[interview.currentQuestionIndex];

  // Speak question aloud on load
  useEffect(() => {
    if (currentQuestion && !processing) {
      speakQuestion(currentQuestion.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interview.currentQuestionIndex]);

  const speakQuestion = (text: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  const startRecording = useCallback(async () => {
    setTranscript("");
    audioChunksRef.current = [];

    // Start speech recognition (STT)
    if (typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      let finalTranscript = "";

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onresult = (event: any) => {
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + " ";
          } else {
            interim += result[0].transcript;
          }
        }
        setTranscript(finalTranscript + interim);
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognition.onerror = (e: any) => {
        console.warn("Speech recognition error:", e.error);
      };

      recognitionRef.current = recognition;
      recognition.start();
    }

    // Start audio recording (for Modulate analysis)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(1000); // collect in 1s chunks
    } catch (err) {
      console.warn("Audio recording not available:", err);
    }

    setIsRecording(true);
  }, []);

  const stopRecording = useCallback(async () => {
    setIsRecording(false);

    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }

    // Stop media recording
    let audioBase64: string | undefined;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());

      // Convert audio to base64
      if (audioChunksRef.current.length > 0) {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const buffer = await blob.arrayBuffer();
        audioBase64 = btoa(
          String.fromCharCode(...new Uint8Array(buffer))
        );
      }
    }

    if (!transcript.trim()) return;

    // Submit response
    setProcessing(true);
    try {
      await onSubmitResponse(
        currentQuestion.id,
        transcript.trim(),
        audioBase64
      );
    } finally {
      setProcessing(false);
      setTranscript("");
    }
  }, [transcript, currentQuestion, onSubmitResponse]);

  if (interview.status === "completed") {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center">
        <CheckCircle className="w-12 h-12 text-emerald-400 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-white mb-2">
          Interview Complete!
        </h3>
        {interview.overallScore && (
          <p className="text-2xl font-bold text-indigo-400 mb-2">
            {interview.overallScore}%
          </p>
        )}
        {interview.overallFeedback && (
          <p className="text-sm text-slate-400 mb-4">
            {interview.overallFeedback}
          </p>
        )}
        <button
          onClick={onComplete}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-center">
        <p className="text-slate-400">No questions available.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Question */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-400 rounded">
              {currentQuestion.type}
            </span>
            <span className="text-xs text-slate-500">
              {currentQuestion.category}
            </span>
          </div>
          <span className="text-xs text-slate-500">
            Q{interview.currentQuestionIndex + 1} of{" "}
            {interview.questions.length}
          </span>
        </div>

        <div className="flex items-start gap-3">
          <button
            onClick={() => speakQuestion(currentQuestion.text)}
            className={`p-2 rounded-lg transition-colors flex-shrink-0 ${
              isSpeaking
                ? "bg-indigo-500/20 text-indigo-400"
                : "bg-slate-700 text-slate-400 hover:text-white"
            }`}
          >
            <Volume2 className="w-4 h-4" />
          </button>
          <p className="text-white text-sm leading-relaxed">
            {currentQuestion.text}
          </p>
        </div>
      </div>

      {/* Recording controls */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
        {/* Transcript area */}
        <div className="min-h-[80px] bg-slate-900 rounded-lg p-3 mb-4 border border-slate-700">
          {transcript ? (
            <p className="text-sm text-slate-300 leading-relaxed">
              {transcript}
            </p>
          ) : (
            <p className="text-sm text-slate-600 italic">
              {isRecording
                ? "Listening... speak your answer"
                : "Press the mic button to start speaking"}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            disabled={processing}
            className={`p-4 rounded-full transition-all ${
              processing
                ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                : isRecording
                ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                : "bg-indigo-500 hover:bg-indigo-600 text-white"
            }`}
          >
            {processing ? (
              <div className="w-6 h-6 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </button>

          <button
            onClick={() => {
              setTranscript("");
              onSubmitResponse(currentQuestion.id, "skipped");
            }}
            disabled={processing}
            className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          <button
            onClick={onComplete}
            className="p-3 rounded-full bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors"
          >
            <Square className="w-5 h-5" />
          </button>
        </div>

        {isRecording && (
          <p className="text-center text-xs text-red-400 mt-3 animate-pulse">
            ● Recording — click mic to stop and submit
          </p>
        )}
      </div>

      {/* Previous answers */}
      <div className="space-y-2">
        {interview.questions
          .slice(0, interview.currentQuestionIndex)
          .filter((q) => q.response)
          .map((q) => (
            <AnsweredQuestion key={q.id} question={q} />
          ))}
      </div>
    </div>
  );
}

function AnsweredQuestion({ question }: { question: InterviewQuestion }) {
  return (
    <div className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
      <p className="text-xs text-slate-500 mb-1">{question.text}</p>
      <p className="text-xs text-slate-400 mb-2">
        &quot;{question.response?.slice(0, 150)}...&quot;
      </p>
      <div className="flex items-center gap-4">
        {question.contentScore && (
          <span className="text-xs text-indigo-400">
            Content: {question.contentScore}/5
          </span>
        )}
        {question.deliveryScore && (
          <span className="text-xs text-cyan-400">
            Delivery: {question.deliveryScore.toFixed(1)}/5
          </span>
        )}
        {question.feedback && (
          <span className="text-xs text-slate-500 truncate flex-1">
            {question.feedback}
          </span>
        )}
      </div>
      {question.voiceAnalysis && (
        <VoiceMetrics analysis={question.voiceAnalysis} />
      )}
    </div>
  );
}

function VoiceMetrics({ analysis }: { analysis: VoiceAnalysis }) {
  return (
    <div className="flex items-center gap-4 mt-2">
      <Meter label="Confidence" value={analysis.confidence} />
      <Meter label="Clarity" value={analysis.clarity} />
      <Meter label="Pace" value={analysis.pace} />
      <span className="text-[10px] text-slate-500">
        {analysis.fillerWordCount} fillers
      </span>
    </div>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  const bars = 5;
  const filled = Math.round((value / 100) * bars);

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-slate-500 w-14">{label}</span>
      <div className="flex gap-0.5">
        {Array.from({ length: bars }, (_, i) => (
          <div
            key={i}
            className={`w-2 h-3 rounded-sm ${
              i < filled
                ? value >= 70
                  ? "bg-emerald-400"
                  : value >= 40
                  ? "bg-amber-400"
                  : "bg-red-400"
                : "bg-slate-700"
            }`}
          />
        ))}
      </div>
      <span className="text-[10px] text-slate-400 w-8">{value}%</span>
    </div>
  );
}
