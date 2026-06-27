"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { Card } from "@/content/types";
import { checkAnswer, autoRate, type Grade } from "@/lib/srs";
import { ACTIVE_LANGUAGE, SOURCE_LANG_CODE, getPrompt, getAccepted } from "@/lib/language";

interface StudyCardProps {
  card: Card;
  cardNumber: number;
  totalCards: number;
  onRate: (grade: Grade) => void;
}

type Phase = "input" | "result" | "wrong";

const FLASH_MS = 1400;

export default function StudyCard({ card, cardNumber, totalCards, onRate }: StudyCardProps) {
  const lang = ACTIVE_LANGUAGE;
  const accepted = getAccepted(card, SOURCE_LANG_CODE);
  const prompt = getPrompt(card, SOURCE_LANG_CODE);

  const [phase, setPhase] = useState<Phase>("input");
  const [typed, setTyped] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [resultInfo, setResultInfo] = useState<{
    wasClose: boolean;
    rating: Grade;
    canonical: string;
  } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  // Initialized to 0; set by reset() which is called from the card-change effect below.
  // Keeps Date.now() out of render (react-hooks/purity).
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State setters from useState are stable references — including them in deps is safe
  // and required by the React Compiler (Next.js 16+) to preserve memoization.
  const reset = useCallback(() => {
    setPhase("input");
    setTyped("");
    setAttempts(0);
    setResultInfo(null);
    startTimeRef.current = Date.now();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [setPhase, setTyped, setAttempts, setResultInfo]);

  // Card change resets all state. This is an external event (card.id change), which
  // is a legitimate use case for setState-in-effect. The pure React alternative
  // is the `key` prop pattern (unmount/remount); deferred to Batch D.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- card change is an external event; `key` prop refactor in Batch D
    reset();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [card.id, reset]);

  const submit = () => {
    if (!typed.trim()) return;
    const matchResult = checkAnswer(
      typed,
      accepted,
      { articles: lang.articles, diacriticTolerant: lang.diacriticTolerant }
    );

    if (matchResult === "wrong") {
      setAttempts((n) => n + 1);
      setPhase("wrong");
      return;
    }

    const elapsed = Date.now() - startTimeRef.current;
    const wasClose = matchResult === "close";
    const rating = autoRate(attempts + 1, elapsed, wasClose);

    setResultInfo({ wasClose, rating, canonical: accepted[0] ?? "" });
    setPhase("result");

    timerRef.current = setTimeout(() => {
      onRate(rating);
    }, FLASH_MS);
  };

  const giveUp = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    onRate("again");
  };

  const isCorrect = phase === "result";
  const showAnswer = phase === "wrong" && attempts >= 2;

  return (
    <div className="flex flex-col items-center w-full max-w-xl mx-auto">
      {/* Progress bar */}
      <div className="w-full mb-8">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{cardNumber} / {totalCards}</span>
          <span>{Math.round((cardNumber / totalCards) * 100)}%</span>
        </div>
        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${(cardNumber / totalCards) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div
        className={`w-full rounded-2xl border-2 p-8 mb-6 transition-all duration-200 ${
          isCorrect
            ? resultInfo?.wasClose
              ? "border-yellow-500 bg-yellow-950/20"
              : "border-green-500 bg-green-950/20"
            : phase === "wrong"
            ? "border-red-500 bg-red-950/20"
            : "border-gray-700 bg-gray-900"
        }`}
      >
        {/* Card type label */}
        <div className="text-xs text-gray-500 uppercase tracking-widest mb-4">
          {lang.uiStrings.cardLabels[card.type]}
          {card.type === "conjugate" && (
            <span className="ml-2 text-yellow-600 normal-case tracking-normal">
              — present tense
            </span>
          )}
        </div>

        {/* Prompt */}
        {card.type === "passage_cloze" ? (
          <div className="text-lg text-white mb-8 leading-relaxed whitespace-pre-wrap">
            {prompt.split("___").map((part, i, arr) => (
              <span key={i}>
                {part}
                {i < arr.length - 1 && (
                  <span className="underline font-bold text-yellow-300">___</span>
                )}
              </span>
            ))}
          </div>
        ) : (
          <div className="text-3xl font-bold text-white mb-8 leading-tight">
            {prompt}
          </div>
        )}

        {/* Input phase */}
        {(phase === "input" || phase === "wrong") && (
          <div className="space-y-3">
            <input
              ref={inputRef}
              type="text"
              value={typed}
              onChange={(e) => {
                setTyped(e.target.value);
                if (phase === "wrong") setPhase("input");
              }}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="Type your answer..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className={`w-full bg-gray-800 border rounded-xl px-4 py-3 text-white text-lg outline-none transition-colors placeholder:text-gray-600 ${
                phase === "wrong"
                  ? "border-red-500 focus:border-red-400"
                  : "border-gray-600 focus:border-yellow-500"
              }`}
            />

            {phase === "wrong" && (
              <div className="text-red-400 text-sm flex items-center gap-2">
                <span>✗</span>
                <span>
                  Not quite.{" "}
                  {card.hint
                    ? <span className="text-gray-400">{card.hint}</span>
                    : "Try again."}
                </span>
              </div>
            )}

            {/* Show answer after 2 failed attempts */}
            {showAnswer && (
              <div className="pt-3 border-t border-red-900 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 text-sm">Answer:</span>
                  <span className="text-white font-bold">{accepted[0]}</span>
                </div>
                <button
                  onClick={giveUp}
                  className="w-full bg-red-900 hover:bg-red-800 text-red-200 font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  Continue →
                </button>
              </div>
            )}

            {!showAnswer && (
              <button
                onClick={submit}
                disabled={!typed.trim()}
                className="w-full bg-yellow-600 hover:bg-yellow-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-3 rounded-xl transition-colors"
              >
                Check →
              </button>
            )}
          </div>
        )}

        {/* Result flash */}
        {isCorrect && resultInfo && (
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <span className={`text-2xl mt-0.5 ${resultInfo.wasClose ? "text-yellow-400" : "text-green-400"}`}>
                ✓
              </span>
              <div>
                <div className={`font-semibold text-lg ${resultInfo.wasClose ? "text-yellow-300" : "text-green-300"}`}>
                  {resultInfo.wasClose ? lang.uiStrings.closeFeedback : lang.uiStrings.correctFeedback}
                </div>
                <div className="text-white text-lg mt-1">
                  <span className="text-gray-400">Answer: </span>
                  <span className="font-bold">{resultInfo.canonical}</span>
                </div>
                {typed.toLowerCase().trim() !== resultInfo.canonical.toLowerCase().trim() && (
                  <div className="text-gray-500 text-sm mt-0.5">You typed: {typed}</div>
                )}
              </div>
            </div>

            {card.hint && (
              <div className="bg-blue-950/50 border border-blue-800 rounded-xl p-3 text-blue-200 text-sm">
                💡 {card.hint}
              </div>
            )}

            <div className="text-xs text-gray-600 text-right">
              {resultInfo.rating === "easy" && "⚡ Fast — scheduled far out"}
              {resultInfo.rating === "good" && "✓ Good — normal spacing"}
              {resultInfo.rating === "hard" && "↻ Slow — coming back soon"}
            </div>
          </div>
        )}
      </div>

      {phase === "input" && accepted.length > 1 && (
        <div className="text-xs text-gray-600">Multiple answers accepted</div>
      )}
    </div>
  );
}
