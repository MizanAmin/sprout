import { useEffect, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useNewsfeed,
  useCreateNewsfeedPost,
  useUpdateNewsfeedPost,
  useDeleteNewsfeedPost,
  type NewsfeedPost,
  type NewsfeedPostInput,
} from '../features/newsfeed/useNewsfeed';
import { Modal, Field, Spinner, EmptyState, Badge } from '../components/ui';

export const Route = createFileRoute('/newsfeed')({
  component: NewsfeedPage,
});

function NewsfeedPage() {
  const { data: posts, isLoading } = useNewsfeed();
  const createPost = useCreateNewsfeedPost();
  const deletePost = useDeleteNewsfeedPost();

  const [editing, setEditing] = useState<NewsfeedPost | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
          Add post
        </button>
      </div>

      {isLoading ? (
        <Spinner />
      ) : (posts ?? []).length === 0 ? (
        <EmptyState title="No posts found" description="Add a post to get started." />
      ) : (
        <div className="space-y-4">
          {(posts ?? []).map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  {p.type && <Badge variant="info">{p.type}</Badge>}
                  <h2 className="font-semibold text-gray-900">{p.title}</h2>
                </div>
                <div className="flex gap-2">
                  <button className="text-sm text-primary" onClick={() => openEdit(p)}>
                    Edit
                  </button>
                  <button
                    className="text-sm text-danger"
                    onClick={() => {
                      if (confirm(`Delete ${p.title}?`)) deletePost.mutate(p.id);
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <p className="mt-1 text-sm text-muted">{p.date}</p>
              {p.description && <p className="mt-2 text-sm text-gray-700">{p.description}</p>}
              {p.created_by && <p className="mt-2 text-xs text-muted">By {p.created_by}</p>}
            </div>
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
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${editing.title}` : 'Add post'}>
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
  const [type, setType] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');

  useEffect(() => {
    setType(initial?.type ?? '');
    setTitle(initial?.title ?? '');
    setDescription(initial?.description ?? '');
    setDate(initial?.date ?? '');
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
      <Field label="Type">
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          required
          className="input"
          placeholder="e.g. Announcement"
        />
      </Field>
      <Field label="Title">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="input"
        />
      </Field>
      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="input"
        />
      </Field>
      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="input"
          rows={4}
        />
      </Field>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
