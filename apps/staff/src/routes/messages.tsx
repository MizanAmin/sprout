import { useMemo, useRef, useState, useEffect } from 'react';
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
import { useChildren, type Child } from '../features/children/useChildren';
import { Badge, Spinner, EmptyState, Modal } from '../components/ui';

export const Route = createFileRoute('/messages')({
  component: MessagesPage,
});

// --- small presentational helpers -----------------------------------------

// Deterministic avatar colour from a name (mirrors the reference `clr`/`ini`).
const AVATAR_COLORS = [
  'bg-info-light text-info',
  'bg-success-light text-success',
  'bg-warning-light text-warning',
  'bg-danger-light text-danger',
  'bg-gray-100 text-muted',
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('');
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const dims = size === 'sm' ? 'h-7 w-7 text-[9px]' : 'h-10 w-10 text-xs';
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl font-semibold ${dims} ${avatarColor(
        name,
      )}`}
    >
      {initials(name) || '?'}
    </div>
  );
}

// Relative time for the conversation list (just now / 5m ago / weekday / date).
function fmtConvTime(ts: string) {
  const d = new Date(ts);
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000)
    return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (diff < 604_800_000) return d.toLocaleDateString('en-GB', { weekday: 'short' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

// Absolute-ish time inside a thread.
function fmtMsgTime(ts: string) {
  const d = new Date(ts);
  const now = new Date();
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return time;
  if (Date.now() - d.getTime() < 604_800_000)
    return `${d.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`;
  return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} ${time}`;
}

// --- types -----------------------------------------------------------------

interface Conversation {
  childId: number;
  childName: string;
  room: string;
  latest: Message;
  unread: number;
}

// --- page ------------------------------------------------------------------

function MessagesPage() {
  const { data: messages, isLoading } = useMessages();
  const { data: children } = useChildren();
  const { data: unread } = useUnreadCount();
  const markRead = useMarkRead();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // Children with no messages yet that the user has explicitly opened a thread for.
  const [draftChildIds, setDraftChildIds] = useState<number[]>([]);

  const childById = useMemo(() => {
    const m = new Map<number, Child>();
    for (const c of children ?? []) m.set(c.id, c);
    return m;
  }, [children]);

  const childName = (id: number | null) =>
    id == null ? 'Broadcast' : childById.get(id)?.name ?? 'Unknown child';

  // Group flat messages into per-child conversations (threaded-by-child).
  const conversations = useMemo<Conversation[]>(() => {
    const byChild = new Map<number, Message[]>();
    for (const m of messages ?? []) {
      if (m.child_id == null) continue;
      const list = byChild.get(m.child_id) ?? [];
      list.push(m);
      byChild.set(m.child_id, list);
    }

    const convs: Conversation[] = [];
    for (const [childId, list] of byChild) {
      const sorted = [...list].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      );
      const child = childById.get(childId);
      convs.push({
        childId,
        childName: child?.name ?? 'Unknown child',
        room: child?.room ?? '',
        latest: sorted[0]!,
        // Only inbound (parent) messages count toward the unread badge.
        unread: list.filter((m) => !m.is_read && m.from_role === 'parent').length,
      });
    }

    // Surface freshly-started drafts that have no messages yet.
    for (const childId of draftChildIds) {
      if (byChild.has(childId)) continue;
      const child = childById.get(childId);
      if (!child) continue;
      convs.push({
        childId,
        childName: child.name,
        room: child.room,
        latest: {
          id: -childId,
          child_id: childId,
          from_role: 'staff',
          from_name: '',
          body: '',
          is_read: true,
          created_at: new Date(0).toISOString(),
        },
        unread: 0,
      });
    }

    return convs.sort(
      (a, b) => +new Date(b.latest.created_at) - +new Date(a.latest.created_at),
    );
  }, [messages, childById, draftChildIds]);

  // Ordered (oldest→newest) messages for the open conversation.
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
      (m) => m.child_id === childId && !m.is_read && m.from_role === 'parent',
    );
    if (hasUnread) markRead.mutate(childId);
  };

  const startThread = (child: Child) => {
    setDraftChildIds((ids) => (ids.includes(child.id) ? ids : [...ids, child.id]));
    setPickerOpen(false);
    select(child.id);
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
      ) : (
        <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-xl border border-border bg-surface md:h-[calc(100vh-220px)] md:min-h-[480px] md:grid-cols-[300px_1fr]">
          {/* Conversation list */}
          <div className="flex min-h-0 flex-col border-border md:border-r">
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <span className="text-[11px] font-bold uppercase tracking-wide text-muted">
                Conversations
              </span>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => setPickerOpen(true)}
              >
                + New
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    title="No conversations yet"
                    description="Click + New to message a family."
                  />
                </div>
              ) : (
                <ul>
                  {conversations.map((c) => {
                    const empty = c.latest.id < 0;
                    return (
                      <li key={c.childId}>
                        <button
                          type="button"
                          onClick={() => select(c.childId)}
                          className={`flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left hover:bg-bg ${
                            selectedId === c.childId ? 'bg-bg' : ''
                          }`}
                        >
                          <div className="relative">
                            <Avatar name={c.childName} />
                            {c.unread > 0 && (
                              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-white">
                                {c.unread}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <span
                                className={`truncate text-sm text-gray-900 ${
                                  c.unread > 0 ? 'font-bold' : 'font-semibold'
                                }`}
                              >
                                {c.childName}
                              </span>
                              {!empty && (
                                <span className="shrink-0 text-[10px] text-muted">
                                  {fmtConvTime(c.latest.created_at)}
                                </span>
                              )}
                            </div>
                            <div
                              className={`truncate text-xs ${
                                c.unread > 0 ? 'text-primary' : 'text-muted'
                              }`}
                            >
                              {empty ? (
                                'No messages yet'
                              ) : (
                                <>
                                  <span
                                    className={
                                      c.latest.from_role === 'parent'
                                        ? 'font-semibold text-primary'
                                        : 'text-muted'
                                    }
                                  >
                                    {c.latest.from_role === 'parent' ? 'Parent: ' : 'You: '}
                                  </span>
                                  {c.latest.body}
                                </>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Thread panel */}
          <ThreadPanel
            selectedId={selectedId}
            childName={childName(selectedId)}
            room={selectedId == null ? '' : childById.get(selectedId)?.room ?? ''}
            thread={thread}
          />
        </div>
      )}

      <NewMessagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        children={children ?? []}
        existingIds={new Set(conversations.map((c) => c.childId))}
        onPick={startThread}
      />
    </div>
  );
}

// --- thread panel ----------------------------------------------------------

function ThreadPanel({
  selectedId,
  childName,
  room,
  thread,
}: {
  selectedId: number | null;
  childName: string;
  room: string;
  thread: Message[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [thread.length, selectedId]);

  if (selectedId == null) {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center gap-2 text-sm text-muted">
        <div className="text-3xl opacity-40">💬</div>
        <span>Select a conversation or start a new one</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-[24rem] min-w-0 flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <Avatar name={childName} />
        <div className="min-w-0">
          <div className="truncate font-bold text-gray-900">{childName}</div>
          {room && <div className="text-xs text-muted">{room}</div>}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto bg-bg px-4 py-4">
        {thread.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
            <div className="text-3xl opacity-40">✉️</div>
            <span className="text-sm">No messages yet — send the first one!</span>
          </div>
        ) : (
          thread.map((m, i) => {
            const isStaff = m.from_role === 'staff';
            const prevSame = i > 0 && thread[i - 1]!.from_role === m.from_role;
            const isLast = i === thread.length - 1;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${isStaff ? 'items-end' : 'items-start'} ${
                  prevSame ? 'mt-0.5' : 'mt-3'
                }`}
              >
                {!prevSame && (
                  <span
                    className={`mb-1 text-[10.5px] text-muted ${
                      isStaff ? 'pr-1 text-right' : 'pl-1'
                    }`}
                  >
                    {m.from_name || (isStaff ? 'You' : 'Parent')}
                  </span>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${
                    isStaff
                      ? 'rounded-br-sm bg-primary text-white'
                      : 'rounded-bl-sm border border-border bg-surface text-gray-900'
                  }`}
                >
                  {m.body}
                </div>
                {(!prevSame || isLast) && (
                  <span className={`mt-0.5 text-[10px] text-muted ${isStaff ? 'pr-1' : 'pl-1'}`}>
                    {fmtMsgTime(m.created_at)}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      <ComposeBox childId={selectedId} />
    </div>
  );
}

// --- compose ---------------------------------------------------------------

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

  const submit = handleSubmit((data) =>
    sendMessage.mutate(
      { ...data, childId },
      { onSuccess: () => reset({ childId, body: '' }) },
    ),
  );

  return (
    <form onSubmit={submit} className="shrink-0 border-t border-border px-4 py-3">
      <div className="flex items-end gap-2">
        <input
          {...register('body')}
          placeholder="Type a message…"
          className="input flex-1"
          autoComplete="off"
        />
        <button type="submit" className="btn-primary" disabled={sendMessage.isPending}>
          {sendMessage.isPending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {errors.body?.message && (
        <span className="mt-1 block text-xs text-danger">{errors.body.message}</span>
      )}
    </form>
  );
}

// --- new-message picker ----------------------------------------------------

function NewMessagePicker({
  open,
  onClose,
  children,
  existingIds,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  children: Child[];
  existingIds: Set<number>;
  onPick: (child: Child) => void;
}) {
  const [query, setQuery] = useState('');

  const active = children.filter((c) => c.status === 'Active');
  const filtered = active.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Modal open={open} onClose={onClose} title="New Message — Select a Child">
      <div className="space-y-3">
        <input
          className="input w-full"
          placeholder="Search children…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <div className="max-h-80 overflow-y-auto">
          {filtered.length === 0 ? (
            <EmptyState title="No active children found" />
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onPick(c)}
                    className="flex w-full items-center gap-3 px-1 py-2.5 text-left hover:bg-bg"
                  >
                    <Avatar name={c.name} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-gray-900">{c.name}</div>
                      <div className="text-xs text-muted">
                        {c.room || 'No room'}
                        {existingIds.has(c.id) && (
                          <span className="text-primary"> · existing thread</span>
                        )}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}
