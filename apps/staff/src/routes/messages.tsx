import { useMemo, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { messageCreateSchema, type MessageCreateInput } from '@sprout/schemas';
import {
  useMessages,
  useUnreadCount,
  useSendMessage,
  useMarkRead,
  type Message,
} from '../features/messages/useMessages';
import { useChildren } from '../features/children/useChildren';
import { Badge, Spinner, EmptyState, Field } from '../components/ui';

export const Route = createFileRoute('/messages')({
  component: MessagesPage,
});

interface Conversation {
  childId: number;
  childName: string;
  latest: Message;
  unread: number;
}

function MessagesPage() {
  const { data: messages, isLoading } = useMessages();
  const { data: children } = useChildren();
  const { data: unread } = useUnreadCount();
  const markRead = useMarkRead();

  const [selectedId, setSelectedId] = useState<number | null>(null);

  const childName = (id: number | null) =>
    (children ?? []).find((c) => c.id === id)?.name ?? 'Unknown child';

  // Group messages by child_id; latest preview + unread count per conversation.
  const conversations = useMemo<Conversation[]>(() => {
    const byChild = new Map<number, Message[]>();
    for (const m of messages ?? []) {
      if (m.child_id == null) continue;
      const list = byChild.get(m.child_id) ?? [];
      list.push(m);
      byChild.set(m.child_id, list);
    }
    return Array.from(byChild.entries())
      .map(([childId, list]) => {
        const sorted = [...list].sort(
          (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
        );
        return {
          childId,
          childName: (children ?? []).find((c) => c.id === childId)?.name ?? 'Unknown child',
          latest: sorted[0],
          unread: list.filter((m) => !m.is_read).length,
        };
      })
      .sort((a, b) => +new Date(b.latest.created_at) - +new Date(a.latest.created_at));
  }, [messages, children]);

  const thread = useMemo<Message[]>(
    () =>
      (messages ?? [])
        .filter((m) => m.child_id === selectedId)
        .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)),
    [messages, selectedId],
  );

  const select = (childId: number) => {
    setSelectedId(childId);
    const hasUnread = (messages ?? []).some(
      (m) => m.child_id === childId && !m.is_read,
    );
    if (hasUnread) markRead.mutate(childId);
  };

  return (
    <div className="space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Messages</h1>
        {unread && unread.count > 0 ? (
          <Badge variant="info">{unread.count} unread</Badge>
        ) : null}
      </div>

      {isLoading ? (
        <Spinner />
      ) : conversations.length === 0 ? (
        <EmptyState title="No conversations" description="Messages from parents will appear here." />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <ul className="divide-y divide-border">
              {conversations.map((c) => (
                <li key={c.childId}>
                  <button
                    className={`flex w-full items-start justify-between gap-2 px-4 py-3 text-left hover:bg-gray-50 ${
                      selectedId === c.childId ? 'bg-gray-50' : ''
                    }`}
                    onClick={() => select(c.childId)}
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900">{c.childName}</div>
                      <div className="truncate text-sm text-muted">{c.latest.body}</div>
                    </div>
                    {c.unread > 0 && <Badge variant="info">{c.unread}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="col-span-2 flex min-h-[24rem] flex-col rounded-xl border border-border bg-surface">
            {selectedId == null ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted">
                Select a conversation
              </div>
            ) : (
              <>
                <div className="border-b border-border px-5 py-3 font-semibold text-gray-900">
                  {childName(selectedId)}
                </div>
                <div className="flex-1 space-y-3 overflow-auto px-5 py-4">
                  {thread.map((m) => (
                    <div key={m.id} className="space-y-0.5">
                      <div className="flex items-center gap-2 text-xs text-muted">
                        <span className="font-medium text-gray-700">{m.from_name}</span>
                        <span>{m.from_role}</span>
                        <span>{new Date(m.created_at).toLocaleString('en-GB')}</span>
                      </div>
                      <div className="text-sm text-gray-900">{m.body}</div>
                    </div>
                  ))}
                </div>
                <ComposeBox childId={selectedId} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ComposeBox({ childId }: { childId: number }) {
  const sendMessage = useSendMessage();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<MessageCreateInput>({
    resolver: zodResolver(messageCreateSchema),
    defaultValues: { childId, body: '' },
    values: { childId, body: '' },
  });

  return (
    <form
      onSubmit={handleSubmit((data) =>
        sendMessage.mutate(
          { ...data, childId },
          { onSuccess: () => reset({ childId, body: '' }) },
        ),
      )}
      className="border-t border-border px-5 py-3"
    >
      <Field label="Reply" error={errors.body?.message}>
        <div className="flex gap-2">
          <input {...register('body')} placeholder="Type a message…" className="input flex-1" />
          <button type="submit" className="btn-primary" disabled={sendMessage.isPending}>
            {sendMessage.isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </Field>
    </form>
  );
}
