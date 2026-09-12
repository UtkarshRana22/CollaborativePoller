'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;

export default function PollDetailPage() {
  const { pollid } = useParams();
  const router = useRouter();

  const [user, setUser] = useState(undefined);
  const [poll, setPoll] = useState(undefined);
  const [loadError, setLoadError] = useState(null);
  const [hasVoted, setHasVoted] = useState(undefined);
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [voting, setVoting] = useState(false);
  const [voteError, setVoteError] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Edit mode state
  const [editing, setEditing] = useState(false);
  const [editQuestion, setEditQuestion] = useState('');
  const [editOptions, setEditOptions] = useState([]);
  const [editMultiple, setEditMultiple] = useState(false);
  const [editError, setEditError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        router.push('/login');
      } else {
        setUser(data.user);
      }
    });
  }, [router]);

  async function loadPoll() {
    const { data, error } = await supabase
      .from('polls')
      .select('pollid, question, options, count, percentage, multiple, voters, uid, created_at')
      .eq('pollid', pollid)
      .maybeSingle();

    if (error) {
      setLoadError(error.message);
      setPoll(null);
      return;
    }
    if (!data) {
      setLoadError('This poll doesn\'t exist.');
      setPoll(null);
      return;
    }
    setPoll(data);
  }

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function load() {
      await loadPoll();
      if (cancelled) return;

      const { data: userRow } = await supabase
        .from('users')
        .select('votes')
        .eq('uid', user.id)
        .maybeSingle();

      if (cancelled) return;
      setHasVoted(Boolean(userRow?.votes?.includes(pollid)));
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, pollid]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`poll-${pollid}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'polls', filter: `pollid=eq.${pollid}` },
        (payload) => {
          setPoll((prev) => (prev ? { ...prev, ...payload.new } : prev));
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'polls', filter: `pollid=eq.${pollid}` },
        () => {
          setPoll(null);
          setLoadError('This poll was deleted.');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, pollid]);

  function toggleOption(index, multiple) {
    setVoteError(null);
    if (multiple) {
      setSelectedOptions((prev) =>
        prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index]
      );
    } else {
      setSelectedOptions([index]);
    }
  }

  async function handleVote() {
    if (selectedOptions.length === 0) {
      setVoteError('Pick at least one option first.');
      return;
    }
    setVoteError(null);
    setVoting(true);

    const { error } = await supabase.rpc('cast_vote', {
      p_pollid: pollid,
      p_option_indexes: selectedOptions,
    });

    setVoting(false);

    if (error) {
      setVoteError(error.message);
      return;
    }

    setHasVoted(true);
  }

  async function handleDelete() {
    setDeleteError(null);
    setDeleting(true);

    const { error } = await supabase.rpc('delete_poll', { p_pollid: pollid });

    setDeleting(false);

    if (error) {
      setDeleteError(error.message);
      return;
    }

    router.push('/');
  }

  function startEditing() {
    setEditQuestion(poll.question);
    setEditOptions([...poll.options]);
    setEditMultiple(poll.multiple);
    setEditError(null);
    setEditing(true);
  }

  function updateEditOption(index, value) {
    setEditOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
  }

  function addEditOption() {
    if (editOptions.length >= MAX_OPTIONS) return;
    setEditOptions((prev) => [...prev, '']);
  }

  function removeEditOption(index) {
    if (editOptions.length <= MIN_OPTIONS) return;
    setEditOptions((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveEdit(e) {
    e.preventDefault();
    setEditError(null);

    const trimmedQuestion = editQuestion.trim();
    const trimmedOptions = editOptions.map((o) => o.trim()).filter(Boolean);

    if (trimmedQuestion.length < 3 || trimmedQuestion.length > 280) {
      setEditError('Question must be between 3 and 280 characters.');
      return;
    }
    if (trimmedOptions.length < MIN_OPTIONS) {
      setEditError(`Add at least ${MIN_OPTIONS} options.`);
      return;
    }
    if (trimmedOptions.length !== editOptions.length) {
      setEditError('Options can\'t be empty — remove any blank ones.');
      return;
    }
    if (new Set(trimmedOptions).size !== trimmedOptions.length) {
      setEditError('Options must be unique.');
      return;
    }

    setSaving(true);
    const { error } = await supabase.rpc('edit_poll', {
      p_pollid: pollid,
      p_question: trimmedQuestion,
      p_options: trimmedOptions,
      p_multiple: editMultiple,
    });
    setSaving(false);

    if (error) {
      setEditError(error.message);
      return;
    }

    // Realtime UPDATE listener above will patch `poll` with the saved
    // changes as soon as they commit — just close the form.
    setEditing(false);
  }

  const total = poll ? poll.voters ?? 0 : 0;
  const isOwner = poll && user ? poll.uid === user.id : false;
  const canVote = poll && !isOwner && hasVoted === false;

  if (user === undefined || poll === undefined || hasVoted === undefined) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading…</p>
      </main>
    );
  }

  if (poll === null) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
        <div className="max-w-sm text-center">
          <p className="text-sm text-red-700 dark:text-red-300 mb-4">{loadError}</p>
          <a href="/" className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
            ← Back to polls
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-900 px-4 py-10">
      <div className="mx-auto max-w-lg">
        <a
          href="/"
          className="mb-6 inline-block text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition"
        >
          ← Back to polls
        </a>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6 shadow-sm">
          {editing ? (
            <form onSubmit={handleSaveEdit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="edit-question" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Question
                </label>
                <textarea
                  id="edit-question"
                  value={editQuestion}
                  onChange={(e) => setEditQuestion(e.target.value)}
                  rows={2}
                  maxLength={280}
                  required
                  className="resize-none rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20"
                />
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Options</span>
                {editOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateEditOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      required
                      className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-500/20"
                    />
                    {editOptions.length > MIN_OPTIONS && (
                      <button
                        type="button"
                        onClick={() => removeEditOption(i)}
                        aria-label={`Remove option ${i + 1}`}
                        className="shrink-0 rounded-lg px-2 py-2 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
                {editOptions.length < MAX_OPTIONS && (
                  <button
                    type="button"
                    onClick={addEditOption}
                    className="self-start text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 mt-1"
                  >
                    + Add option
                  </button>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Options left exactly as they were keep their existing votes; new or reworded ones start at 0.
                </p>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={editMultiple}
                  onChange={(e) => setEditMultiple(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-indigo-600 focus:ring-indigo-400"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">Allow selecting multiple options</span>
              </label>

              {editError && (
                <p className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {editError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                  className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex items-start justify-between gap-4 mb-1">
                <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{poll.question}</h1>
                {poll.multiple && (
                  <span className="shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-0.5 text-xs font-medium text-indigo-600 dark:text-indigo-300">
                    Multiple choice
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                {total} vote{total === 1 ? '' : 's'}
                {isOwner && ' · your poll'}
                {!isOwner && hasVoted && ' · you voted'}
                {canVote && poll.multiple && ' · pick one or more'}
              </p>

              <div className="flex flex-col gap-3">
                {poll.options.map((option, i) => {
                  const count = poll.count?.[i] ?? 0;
                  const pct = poll.percentage?.[i] ?? 0;
                  return (
                    <div key={i}>
                      {canVote ? (
                        <label className="flex items-center gap-2 mb-1 cursor-pointer">
                          <input
                            type={poll.multiple ? 'checkbox' : 'radio'}
                            name="option"
                            checked={selectedOptions.includes(i)}
                            onChange={() => toggleOption(i, poll.multiple)}
                            className={
                              poll.multiple
                                ? 'h-4 w-4 rounded text-indigo-600 focus:ring-indigo-400'
                                : 'h-4 w-4 text-indigo-600 focus:ring-indigo-400'
                            }
                          />
                          <span className="text-sm text-slate-800 dark:text-slate-200">{option}</span>
                        </label>
                      ) : (
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-slate-800 dark:text-slate-200">{option}</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            {pct}% · {count} vote{count === 1 ? '' : 's'}
                          </span>
                        </div>
                      )}
                      <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {isOwner && (
                <div className="mt-6 flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={startEditing}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    Edit poll
                  </button>

                  {deleteError && (
                    <p className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                      {deleteError}
                    </p>
                  )}

                  {!confirmingDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(true)}
                      className="w-full rounded-lg border border-red-200 dark:border-red-800 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      Delete poll
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {deleting ? 'Deleting…' : 'Yes, delete it'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmingDelete(false)}
                        disabled={deleting}
                        className="flex-1 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {canVote && (
                <div className="mt-6">
                  {voteError && (
                    <p className="mb-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                      {voteError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleVote}
                    disabled={voting}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {voting ? 'Voting…' : 'Vote'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
