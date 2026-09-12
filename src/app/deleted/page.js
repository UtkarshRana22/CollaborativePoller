'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DeletedPollsPage() {
  const [user, setUser] = useState(undefined);
  const [polls, setPolls] = useState(undefined);
  const [error, setError] = useState(null);
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

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function load() {
      const { data: userRow, error: userError } = await supabase
        .from('users')
        .select('deleted_polls')
        .eq('uid', user.id)
        .maybeSingle();

      if (cancelled) return;

      if (userError) {
        setError(userError.message);
        setPolls(null);
        return;
      }

      const ids = userRow?.deleted_polls ?? [];
      if (ids.length === 0) {
        setPolls([]);
        return;
      }

      const { data, error: pollsError } = await supabase
        .from('deleted_polls')
        .select('pollid, question, options, count, percentage, multiple, voters, created_at, deleted_at')
        .in('pollid', ids)
        .order('deleted_at', { ascending: false });

      if (cancelled) return;

      if (pollsError) {
        setError(pollsError.message);
        setPolls(null);
      } else {
        setPolls(data);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (user === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">Checking session…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <a
          href="/"
          className="mb-6 inline-block text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition"
        >
          ← Back to polls
        </a>

        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-1">Deleted polls</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">
          A frozen snapshot of the final results from polls you've deleted.
        </p>

        {polls === undefined && (
          <div className="flex flex-col gap-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {polls === null && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-6 py-8 text-center">
            <p className="text-sm text-red-700 dark:text-red-300">Couldn't load deleted polls: {error}</p>
          </div>
        )}

        {Array.isArray(polls) && polls.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white/60 dark:bg-slate-800/40 px-6 py-16 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">You haven't deleted any polls.</p>
          </div>
        )}

        {Array.isArray(polls) && polls.length > 0 && (
          <ul className="flex flex-col gap-3">
            {polls.map((poll) => {
              const total = poll.voters ?? 0;
              return (
                <li
                  key={poll.pollid}
                  className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm opacity-90"
                >
                  <div className="flex items-start justify-between gap-4 mb-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">{poll.question}</p>
                    {poll.multiple && (
                      <span className="shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-300">
                        Multiple choice
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                    Deleted {new Date(poll.deleted_at).toLocaleDateString()} · {total} vote{total === 1 ? '' : 's'}
                  </p>

                  <div className="flex flex-col gap-2">
                    {poll.options.map((option, i) => {
                      const pct = poll.percentage?.[i] ?? 0;
                      const count = poll.count?.[i] ?? 0;
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-slate-700 dark:text-slate-300">{option}</span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {pct}% · {count} vote{count === 1 ? '' : 's'}
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-slate-400 dark:bg-slate-500"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
