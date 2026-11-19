import { useEffect, useState } from 'react';
import { LESSONS } from '../../lib/lessons-data';
import {
  getLessonProgress,
  loadClassroomProgress,
  resetClassroomProgress,
  type ClassroomProgress,
} from '../../lib/foundry';

export default function ClassroomHome() {
  const [progress, setProgress] = useState<ClassroomProgress | null>(null);
  const [armReset, setArmReset] = useState(false);

  useEffect(() => {
    setProgress(loadClassroomProgress());
  }, []);

  const completedCount = LESSONS.filter(
    (l) => progress && getLessonProgress(progress, l.id).completed,
  ).length;

  const onReset = () => {
    if (!armReset) {
      setArmReset(true);
      return;
    }
    resetClassroomProgress();
    setProgress(loadClassroomProgress());
    setArmReset(false);
  };

  return (
    <div>
      <p className="mb-6 text-gray-300" aria-live="polite">
        {progress === null
          ? 'Loading your on-device progress…'
          : completedCount === 0
            ? 'No lessons completed yet — start with Lesson 1 below.'
            : `${completedCount} of ${LESSONS.length} lessons completed. Progress lives only in this browser and counts toward your Clubhouse Passport.`}
      </p>

      <div className="grid gap-6 md:grid-cols-3">
        {LESSONS.map((lesson, i) => {
          const lp = progress ? getLessonProgress(progress, lesson.id) : null;
          const status = !lp || lp.seen.length === 0
            ? { label: 'Not started', cls: 'bg-gray-700 text-gray-200' }
            : lp.completed
              ? { label: 'Completed ✓', cls: 'bg-green-600 text-white' }
              : {
                  label: `In progress — ${lp.seen.length} of ${lp.totalSlides} slides`,
                  cls: 'bg-yellow-600/80 text-white',
                };
          return (
            <div
              key={lesson.id}
              className="flex flex-col rounded-lg border border-green-500/30 bg-gray-800 p-5"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold uppercase tracking-wide text-green-400">
                  Lesson {i + 1} · Topic {lesson.topic}
                </span>
                <span className={`rounded px-2 py-0.5 text-xs font-semibold ${status.cls}`}>
                  {status.label}
                </span>
              </div>
              <h3 className="mb-2 text-xl font-bold text-gray-100">{lesson.title}</h3>
              <p className="mb-4 flex-1 text-gray-300">{lesson.subtitle}</p>
              <p className="mb-4 text-sm text-gray-400">
                Slide deck · about {lesson.minutes} min · {lesson.quiz.length} check-yourself
                questions
              </p>
              <a
                href={`/clubhouse/classroom/${lesson.id}`}
                className="rounded bg-green-600 px-4 py-2 text-center font-semibold text-white hover:bg-green-500"
              >
                {lp?.completed ? 'Review lesson' : lp && lp.seen.length > 0 ? 'Continue lesson' : 'Start lesson'}
              </a>
            </div>
          );
        })}
      </div>

      <div className="mt-8">
        <button
          type="button"
          onClick={onReset}
          className="rounded border border-gray-600 px-3 py-1.5 text-sm text-gray-300 hover:border-red-400 hover:text-red-300"
        >
          {armReset ? 'Click again to erase all classroom progress on this device' : 'Reset my classroom progress'}
        </button>
      </div>
    </div>
  );
}
