'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [user, setUser] = useState(undefined);
  const [polls, setPolls] = useState(undefined);
  const [pollsError, setPollsError] = useState(null);
  const [search, setSearch] = useState('');
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

    async function loadPolls() {
      const { data, error } = await supabase
        .from('polls')
        .select('pollid, question, options, count, percentage, multiple, voters, images, created_at')
        .order('created_at', { ascending: false });

      if (cancelled) return;

      if (error) {
        setPollsError(error.message);
        setPolls(null);
      } else {
        setPolls(data);
      }
    }

    loadPolls();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('polls-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'polls' },
        (payload) => {
          setPolls((prev) => (Array.isArray(prev) ? [payload.new, ...prev] : prev));
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'polls' },
        (payload) => {
          setPolls((prev) =>
            Array.isArray(prev)
              ? prev.map((p) => (p.pollid === payload.new.pollid ? { ...p, ...payload.new } : p))
              : prev
          );
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'polls' },
        (payload) => {
          setPolls((prev) =>
            Array.isArray(prev) ? prev.filter((p) => p.pollid !== payload.old.pollid) : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/login');
  }

  function totalVotes(poll) {
    return poll.voters ?? 0;
  }

  const trimmedSearch = search.trim().toLowerCase();
  const filteredPolls = Array.isArray(polls)
    ? trimmedSearch
      ? polls.filter(
          (poll) =>
            poll.question.toLowerCase().includes(trimmedSearch) ||
            poll.options.some((opt) => opt.toLowerCase().includes(trimmedSearch))
        )
      : polls
    : polls;

  if (user === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">Checking session…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="mx-auto max-w-3xl px-6 py-4 flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100">
            Collaborative Poller
          </span>
          <div className="flex items-center gap-4">
            <span className="hidden sm:inline text-sm text-slate-500 dark:text-slate-400">{user.email}</span>
            <a
              href="/deleted"
              className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition"
            >
              Deleted polls
            </a>
            <button
              onClick={handleSignOut}
              className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Polls</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              See what everyone's voting on, or start your own.
            </p>
          </div>
          <a
            href="/new"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-700"
          >
            <span className="text-base leading-none">+</span>
            Create poll
          </a>
        </div>

        {Array.isArray(polls) && polls.length > 0 && (
          <div className="relative mb-6">
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search polls…"
              className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20"
            />
          </div>
        )}

        {polls === undefined && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 animate-pulse"
              />
            ))}
          </div>
        )}

        {polls === null && (
          <div className="rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/40 px-6 py-8 text-center">
            <p className="text-sm text-red-700 dark:text-red-300">Couldn't load polls: {pollsError}</p>
          </div>
        )}

        {Array.isArray(polls) && polls.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white/60 dark:bg-slate-800/40 px-6 py-16 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No polls yet — be the first to create one.</p>
          </div>
        )}

        {Array.isArray(polls) && polls.length > 0 && filteredPolls.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 bg-white/60 dark:bg-slate-800/40 px-6 py-16 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">No polls match "{search.trim()}".</p>
          </div>
        )}

        {Array.isArray(polls) && filteredPolls.length > 0 && (
          <ul className="flex flex-col gap-3">
            {filteredPolls.map((poll) => {
              const total = totalVotes(poll);
              return (
                <li key={poll.pollid}>
                  <a
                    href={`/poll/${poll.pollid}`}
                    className="flex items-start gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 shadow-sm transition hover:border-indigo-300 dark:hover:border-indigo-500 hover:shadow-md"
                  >
                    {poll.images?.[0] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={poll.images[0]}
                        alt=""
                        className="h-16 w-16 shrink-0 rounded-lg object-cover border border-slate-100 dark:border-slate-700"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-4">
                        <p className="font-medium text-slate-900 dark:text-slate-100">{poll.question}</p>
                        {poll.multiple && (
                          <span className="shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-300">
                            Multiple choice
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        {poll.options.length} options · {total} vote{total === 1 ? '' : 's'}
                      </p>
                    </div>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
