import { useEffect, useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useNewsfeed,
  useCreateNewsfeedPost,
  useUpdateNewsfeedPost,
  useDeleteNewsfeedPost,
  type NewsfeedPost,
  type NewsfeedPostInput,
} from '../features/newsfeed/useNewsfeed';
import { Modal, Field, Spinner, EmptyState } from '../components/ui';
import { fmtDate } from '../lib/date';

export const Route = createFileRoute('/newsfeed')({
  component: NewsfeedPage,
});

// Post-type metadata: icon, accent colour and label per type. Mirrors
// CAL_TYPE_META in the reference app — drives the typed badge and the
// left-accent feed card. Keys match the values offered in the composer.
interface TypeMeta {
  label: string;
  color: string;
  icon: string;
}
const TYPE_META: Record<string, TypeMeta> = {
  announcement: { label: 'Announcement', color: '#3b82f6', icon: '📢' },
  event: { label: 'Event', color: '#8b5cf6', icon: '🎉' },
  reminder: { label: 'Reminder', color: '#f59e0b', icon: '⏰' },
  closure: { label: 'Closure', color: '#ef4444', icon: '🔒' },
  newsletter: { label: 'Newsletter', color: '#10b981', icon: '📰' },
};
const DEFAULT_META: TypeMeta = { label: 'Update', color: '#64748b', icon: '📝' };

// Map a raw type string to its metadata; unknown types fall back to a neutral
// look while still showing the original label.
function metaFor(type: string): TypeMeta {
  const key = type?.toLowerCase().trim();
  if (key in TYPE_META) return TYPE_META[key];
  return { ...DEFAULT_META, label: type || DEFAULT_META.label };
}

function NewsfeedPage() {
  const { data: posts, isLoading } = useNewsfeed();
  const createPost = useCreateNewsfeedPost();
  const deletePost = useDeleteNewsfeedPost();

  const [editing, setEditing] = useState<NewsfeedPost | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const sorted = useMemo(
    () => [...(posts ?? [])].sort((a, b) => (b.date || '').localeCompare(a.date || '')),
    [posts],
  );

  const openAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const openEdit = (p: NewsfeedPost) => {
    setEditing(p);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Newsfeed</h1>
        <button className="btn-primary" onClick={openAdd}>
          + New post
        </button>
      </div>

      <p className="text-sm text-muted">
        Posts shared with parents in their portal — announcements, events, reminders and closures.
      </p>

      {isLoading ? (
        <Spinner />
      ) : sorted.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Create your first post to share news, events and reminders with parents."
        />
      ) : (
        <div className="mx-auto max-w-2xl space-y-4">
          {sorted.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              onEdit={() => openEdit(p)}
              onDelete={() => {
                if (confirm(`Delete "${p.title}"?`)) deletePost.mutate(p.id);
              }}
            />
          ))}
        </div>
      )}

      <NewsfeedModal
        open={modalOpen}
        editing={editing}
        onClose={() => setModalOpen(false)}
        createSubmitting={createPost.isPending}
        onCreate={(data) => createPost.mutate(data, { onSuccess: () => setModalOpen(false) })}
      />
    </div>
  );
}

// A single feed post: left accent bar + type icon, typed badge, title, date,
// description and author. Layout mirrors the reference list-view event card.
function PostCard({
  post: p,
  onEdit,
  onDelete,
}: {
  post: NewsfeedPost;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const m = metaFor(p.type);
  return (
    <div className="card border-l-4 p-5" style={{ borderLeftColor: m.color }}>
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
          style={{ backgroundColor: `${m.color}20` }}
        >
          {m.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span
              className="badge"
              style={{ backgroundColor: `${m.color}20`, color: m.color }}
            >
              {m.label}
            </span>
            <span className="text-xs text-muted">{fmtDate(p.date)}</span>
          </div>

          <h2 className="mt-1.5 text-sm font-bold text-gray-900">{p.title}</h2>

          {p.description && (
            <p className="mt-1.5 whitespace-pre-line text-sm text-gray-700">{p.description}</p>
          )}

          {p.created_by && <p className="mt-2 text-xs text-muted">Posted by {p.created_by}</p>}
        </div>

        <div className="flex shrink-0 gap-1.5">
          <button className="btn-outline btn-sm" onClick={onEdit} aria-label="Edit post">
            Edit
          </button>
          <button
            className="btn-outline btn-sm text-danger"
            onClick={onDelete}
            aria-label="Delete post"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// Add/edit composer modal. Edit uses a per-post update mutation hook.
function NewsfeedModal({
  open,
  editing,
  onClose,
  onCreate,
  createSubmitting,
}: {
  open: boolean;
  editing: NewsfeedPost | null;
  onClose: () => void;
  onCreate: (data: NewsfeedPostInput) => void;
  createSubmitting: boolean;
}) {
  const updatePost = useUpdateNewsfeedPost(editing?.id ?? 0);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit "${editing.title}"` : 'New post'}
    >
      <NewsfeedForm
        initial={editing ?? undefined}
        submitting={editing ? updatePost.isPending : createSubmitting}
        onSubmit={(data) =>
          editing ? updatePost.mutate(data, { onSuccess: onClose }) : onCreate(data)
        }
      />
    </Modal>
  );
}

function NewsfeedForm({
  initial,
  onSubmit,
  submitting,
}: {
  initial?: NewsfeedPost;
  onSubmit: (data: NewsfeedPostInput) => void;
  submitting?: boolean;
}) {
  const [type, setType] = useState('announcement');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    setType(initial?.type ?? 'announcement');
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setDate(initial?.date ? initial.date.slice(0, 10) : '');
  }, [initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      type,
      title,
      description: description || undefined,
      date: date || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value)} className="input">
            {Object.entries(TYPE_META).map(([k, v]) => (
              <option key={k} value={k}>
                {v.icon} {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </Field>
      </div>

      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="input"
          placeholder="e.g. Spring term starts Monday"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input"
          rows={4}
          placeholder="What do you want parents to know?"
        />
      </Field>

      <div className="flex justify-end gap-2">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : initial ? 'Save changes' : 'Post'}
        </button>
      </div>
    </form>
  );
}
