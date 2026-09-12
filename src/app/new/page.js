'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export default function NewPollPage() {
  const [user, setUser] = useState(undefined);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login');
      } else {
        setUser(data.user);
      }
    });
  }, [router]);

  function updateOption(index, value) {
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(index) {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    const trimmedQuestion = question.trim();
    const trimmedOptions = options.map((o) => o.trim()).filter(Boolean);

    if (trimmedQuestion.length < 3 || trimmedQuestion.length > 280) {
      setError('Question must be between 3 and 280 characters.');
      return;
    }
    if (trimmedOptions.length < MIN_OPTIONS) {
      setError(`Add at least ${MIN_OPTIONS} options.`);
      return;
    }
    if (trimmedOptions.length !== options.length) {
      setError('Options can\'t be empty — remove any blank ones.');
      return;
    }
    const hasDuplicates = new Set(trimmedOptions).size !== trimmedOptions.length;
    if (hasDuplicates) {
      setError('Options must be unique.');
      return;
    }

    setLoading(true);
    const { error: insertError } = await supabase.from('polls').insert({
      question: trimmedQuestion,
      uid: user.id,
      options: trimmedOptions,
      multiple,
    });
    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    router.push('/');
  }

  if (user === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">Checking session…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-10">
      <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-8">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Create a poll</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Ask a question, add your options.</p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="question" className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Question
            </label>
            <textarea
              id="question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="What do you want to ask?"
              rows={2}
              maxLength={280}
              required
              className="resize-none rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20"
            />
            <span className="text-xs text-slate-400 dark:text-slate-500 self-end">{question.length}/280</span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Options</span>
            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  required
                  className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20"
                />
                {options.length > MIN_OPTIONS && (
                  <button
                    type="button"
                    onClick={() => removeOption(i)}
                    aria-label={`Remove option ${i + 1}`}
                    className="shrink-0 rounded-lg px-2 py-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}

            {options.length < MAX_OPTIONS && (
              <button
                type="button"
                onClick={addOption}
                className="self-start text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-1"
              >
                + Add option
              </button>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={multiple}
              onChange={(e) => setMultiple(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-400"
            />
            <span className="text-sm text-slate-700 dark:text-slate-300">Allow selecting multiple options</span>
          </label>

          {error && (
            <p className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Creating…' : 'Create poll'}
          </button>
        </form>
      </div>
    </main>
  );
}
