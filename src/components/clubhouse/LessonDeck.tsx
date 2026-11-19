import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Lesson, LessonSlide, QuizQuestion } from '../../lib/lessons-data';
import {
  completeLesson,
  getLessonProgress,
  loadClassroomProgress,
  recordQuizResult,
  recordSlideSeen,
} from '../../lib/foundry';
import 'reveal.js/reveal.css';
import './lesson-deck.css';

interface Props {
  lesson: Lesson;
  lessonNumber: number;
  totalLessons: number;
  nextHref?: string;
}

function SlideBody({ slide }: { slide: LessonSlide }) {
  return (
    <>
      {slide.heading && <h3>{slide.heading}</h3>}
      {slide.paragraphs?.map((p, i) => <p key={i}>{p}</p>)}
      {slide.bullets && (
        <ul>
          {slide.bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      )}
      {slide.mono && <div className="mh-deck-mono">{slide.mono}</div>}
      {slide.callout && <div className="mh-deck-callout">{slide.callout}</div>}
    </>
  );
}

function QuizBody({
  quiz,
  index,
  total,
  chosen,
  onAnswer,
}: {
  quiz: QuizQuestion;
  index: number;
  total: number;
  chosen: number | null;
  onAnswer: (qi: number, oi: number) => void;
}) {
  return (
    <>
      <h3>
        Check yourself {index + 1} of {total}
      </h3>
      <div className="mh-quiz-q">{quiz.question}</div>
      <div className="mh-quiz-options">
        {quiz.options.map((opt, oi) => {
          const answered = chosen !== null;
          const cls =
            'mh-quiz-option' +
            (answered && oi === quiz.answerIndex ? ' is-correct' : '') +
            (answered && chosen === oi && oi !== quiz.answerIndex ? ' is-wrong' : '');
          return (
            <button
              key={oi}
              type="button"
              className={cls}
              disabled={answered}
              onClick={() => onAnswer(index, oi)}
            >
              {opt}
            </button>
          );
        })}
      </div>
      {chosen !== null && (
        <div className="mh-quiz-why">
          {chosen === quiz.answerIndex ? 'Correct. ' : 'Not quite. '}
          {quiz.why}
        </div>
      )}
    </>
  );
}

export default function LessonDeck({ lesson, lessonNumber, totalLessons, nextHref }: Props) {
  const contentCount = lesson.slides.length;
  const quizCount = lesson.quiz.length;
  const totalSections = contentCount + quizCount + 1; // + completion slide

  const [seen, setSeen] = useState<Set<number>>(new Set());
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [completed, setCompleted] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [fbIndex, setFbIndex] = useState(0);

  const deckRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<any>(null);
  const celebratedRef = useRef(false);

  const answeredCount = Object.keys(answers).length;
  const correctCount = useMemo(
    () =>
      Object.entries(answers).filter(
        ([qi, oi]) => lesson.quiz[Number(qi)]?.answerIndex === oi,
      ).length,
    [answers, lesson.quiz],
  );

  const maybeComplete = useCallback(
    (seenSet: Set<number>, answered: number) => {
      if (seenSet.size >= totalSections && answered >= quizCount) {
        const lp = completeLesson(lesson.id);
        setCompleted(lp.completed);
        if (lp.completed && !celebratedRef.current) {
          celebratedRef.current = true;
          // canvas-confetti's UMD touches window at module scope, so it is
          // imported lazily here (client-only path) instead of at the top.
          void (async () => {
            try {
              const mod: any = await import('../../lib/vendor/canvas-confetti.js');
              const confetti = mod.default ?? mod;
              confetti({
                particleCount: 90,
                spread: 75,
                origin: { y: 0.6 },
                colors: ['#4ade80', '#22c55e', '#bbf7d0', '#ffffff'],
              });
            } catch {
              /* celebration is optional */
            }
          })();
        }
      }
    },
    [lesson.id, quizCount, totalSections],
  );

  const handleSeen = useCallback(
    (idx: number) => {
      const lp = recordSlideSeen(lesson.id, idx, totalSections);
      setSeen((prev) => {
        const next = new Set(prev);
        for (const s of lp.seen) next.add(s);
        next.add(idx);
        return next;
      });
    },
    [lesson.id, totalSections],
  );

  // Rehydrate stored progress on mount.
  useEffect(() => {
    const lp = getLessonProgress(loadClassroomProgress(), lesson.id);
    if (lp.seen.length) setSeen(new Set(lp.seen));
    if (lp.completed) {
      setCompleted(true);
      celebratedRef.current = true;
    }
    handleSeen(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson.id]);

  // Completion check whenever seen/answers change.
  useEffect(() => {
    if (seen.size > 0) maybeComplete(seen, answeredCount);
  }, [seen, answeredCount, maybeComplete]);

  // Reveal.js deck (embedded). Falls back to a hand-rolled slider if the
  // library cannot initialise in this browser.
  useEffect(() => {
    if (fallback) return;
    let destroyed = false;
    (async () => {
      try {
        const mod: any = await import('reveal.js');
        const Reveal = mod.default ?? mod;
        const deck = new Reveal(deckRef.current, {
          embedded: true,
          keyboard: true,
          touch: true,
          controls: true,
          progress: true,
          hash: false,
          slideNumber: false,
          transition: 'slide',
        });
        await deck.initialize();
        if (destroyed) return;
        revealRef.current = deck;
        const mark = () => {
          const idx = deck.getIndices().h as number;
          handleSeen(idx);
          setFbIndex(idx);
        };
        deck.on('slidechanged', mark);
        mark();
      } catch {
        if (!destroyed) setFallback(true);
      }
    })();
    return () => {
      destroyed = true;
      try {
        revealRef.current?.destroy();
      } catch {
        /* ignore */
      }
      revealRef.current = null;
    };
  }, [fallback, handleSeen]);

  const onAnswer = (qi: number, oi: number) => {
    setAnswers((prev) => {
      if (prev[qi] !== undefined) return prev;
      const next = { ...prev, [qi]: oi };
      const answered = Object.keys(next).length;
      const correct = Object.entries(next).filter(
        ([q, o]) => lesson.quiz[Number(q)]?.answerIndex === o,
      ).length;
      recordQuizResult(lesson.id, answered, correct);
      return next;
    });
  };

  const goFallback = (idx: number) => {
    const clamped = Math.max(0, Math.min(totalSections - 1, idx));
    setFbIndex(clamped);
    handleSeen(clamped);
  };

  const renderSection = (i: number) => {
    if (i < contentCount) return <SlideBody slide={lesson.slides[i]} />;
    if (i < contentCount + quizCount) {
      const qi = i - contentCount;
      return (
        <QuizBody
          quiz={lesson.quiz[qi]}
          index={qi}
          total={quizCount}
          chosen={answers[qi] ?? null}
          onAnswer={onAnswer}
        />
      );
    }
    // Completion slide
    return (
      <>
        <h3>{completed ? 'Lesson complete' : 'Almost there'}</h3>
        {completed ? (
          <>
            <p>
              You finished Lesson {lessonNumber}: {lesson.title}. Your progress is saved on this
              device and counts toward your Clubhouse Passport.
            </p>
            <p>
              Keep going, or re-check the proof page any time — every fact in this lesson is on{' '}
              <a href="/security">matrix-hub.org/security</a>.
            </p>
          </>
        ) : (
          <p>
            You have viewed {seen.size} of {totalSections} slides and answered {answeredCount} of{' '}
            {quizCount} check-yourself questions. View every slide and answer every question to
            complete this lesson — there are no wrong-answer penalties.
          </p>
        )}
        <p>
          Hands-on practice: <a href="/proving-ground">the Proving Ground</a> · All lessons:{' '}
          <a href="/clubhouse/classroom">the Classroom</a>
          {nextHref ? (
            <>
              {' '}
              · Next: <a href={nextHref}>Lesson {lessonNumber + 1}</a>
            </>
          ) : null}
        </p>
      </>
    );
  };

  const statusLine = completed
    ? 'Completed ✓ — saved on this device'
    : `${seen.size} of ${totalSections} slides viewed · ${answeredCount} of ${quizCount} questions answered`;

  return (
    <div className="mh-deck">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-green-200/80">
        <span>
          Lesson {lessonNumber} of {totalLessons}
          {lesson.topic !== null ? <> · MTX 101 Topic {lesson.topic}</> : null} · about{' '}
          {lesson.minutes} min
        </span>
        <span aria-live="polite">{statusLine}</span>
      </div>

      {!fallback ? (
        <div
          className="overflow-hidden rounded-xl border border-green-400/25 bg-black/50"
          style={{ height: '560px' }}
        >
          <div className="reveal" ref={deckRef}>
            <div className="slides">
              {Array.from({ length: totalSections }, (_, i) => (
                <section key={i}>{renderSection(i)}</section>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="mh-deck-fallback">{renderSection(fbIndex)}</div>
          <div className="mh-deck-nav">
            <button
              type="button"
              className="mh-deck-btn"
              disabled={fbIndex === 0}
              onClick={() => goFallback(fbIndex - 1)}
            >
              ← Previous
            </button>
            <span className="text-sm text-green-200/80">
              Slide {fbIndex + 1} of {totalSections}
            </span>
            <button
              type="button"
              className="mh-deck-btn"
              disabled={fbIndex === totalSections - 1}
              onClick={() => goFallback(fbIndex + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-green-200/60">
        Navigate with the arrow keys, the on-screen arrows, or swipe. Progress is stored only in
        this browser (localStorage key <code>mh_classroom_v1</code>) — no account, nothing sent
        anywhere.
      </p>
    </div>
  );
}
