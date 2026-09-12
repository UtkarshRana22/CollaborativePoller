'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 10;
const MAX_IMAGES = 4;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB

export default function NewPollPage() {
  const [user, setUser] = useState(undefined);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multiple, setMultiple] = useState(false);
  const [images, setImages] = useState([]); // File objects
  const [imagePreviews, setImagePreviews] = useState([]); // object URLs
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

  // Clean up object URLs when they're replaced/unmounted.
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imagePreviews]);

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

  function handleImagesChange(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow picking the same file again later

    setError(null);

    const accepted = [];
    for (const file of files) {
      if (images.length + accepted.length >= MAX_IMAGES) break;
      if (!file.type.startsWith('image/')) {
        setError('Only image files are allowed.');
        continue;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setError('Each image must be under 5MB.');
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length === 0) return;

    setImages((prev) => [...prev, ...accepted]);
    setImagePreviews((prev) => [...prev, ...accepted.map((f) => URL.createObjectURL(f))]);
  }

  function removeImage(index) {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
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

    // Generate the poll's id up front so image paths can be scoped to it
    // before the poll row itself exists.
    const pollid = crypto.randomUUID();
    const imageUrls = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'jpg';
      const path = `${user.id}/${pollid}/${i}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('poll-images')
        .upload(path, file, { contentType: file.type });

      if (uploadError) {
        setLoading(false);
        setError(`Image upload failed: ${uploadError.message}`);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from('poll-images').getPublicUrl(path);
      imageUrls.push(publicUrlData.publicUrl);
    }

    const { error: insertError } = await supabase.from('polls').insert({
      pollid,
      question: trimmedQuestion,
      uid: user.id,
      options: trimmedOptions,
      multiple,
      images: imageUrls,
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

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Images <span className="text-slate-400 dark:text-slate-500 font-normal">(optional, up to {MAX_IMAGES})</span>
            </span>

            {imagePreviews.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {imagePreviews.map((url, i) => (
                  <div key={url} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Preview ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      aria-label={`Remove image ${i + 1}`}
                      className="absolute top-1 right-1 h-5 w-5 flex items-center justify-center rounded-full bg-black/60 text-white text-xs leading-none opacity-0 group-hover:opacity-100 transition"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {images.length < MAX_IMAGES && (
              <label className="self-start cursor-pointer text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                + Add image{images.length > 0 ? 's' : ''}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImagesChange}
                  className="hidden"
                />
              </label>
            )}
          </div>

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
