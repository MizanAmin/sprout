import Anthropic from '@anthropic-ai/sdk';

// Anthropic client (lazy singleton — API boots without the key configured).
// Model is claude-haiku-4-5 per the spec: fast + low-cost for short drafting /
// photo-analysis turns. Haiku does not support the effort parameter, and these
// tasks don't need extended thinking, so neither is set.
const MODEL = 'claude-haiku-4-5';

let _client: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
  _client = new Anthropic({ apiKey });
  return _client;
}

// EYFS prime areas + specific areas, used to steer area suggestions.
const EYFS_AREAS = [
  'Communication and Language',
  'Physical Development',
  'Personal, Social and Emotional Development',
  'Literacy',
  'Mathematics',
  'Understanding the World',
  'Expressive Arts and Design',
];

function firstText(message: Anthropic.Message): string {
  const block = message.content.find((b): b is Anthropic.TextBlock => b.type === 'text');
  return block?.text ?? '';
}

type ImageInput = { type: 'image'; source: { type: 'url'; url: string } };

function maybeImage(photoUrl?: string): ImageInput[] {
  return photoUrl ? [{ type: 'image', source: { type: 'url', url: photoUrl } }] : [];
}

// Draft a polished EYFS learning-journal observation from a practitioner's rough
// notes, optionally grounded in a photo.
export async function draftObservation(input: {
  notes: string;
  childName?: string;
  areas?: string[];
  photoUrl?: string;
}): Promise<string> {
  const who = input.childName ? ` for ${input.childName}` : '';
  const areas = input.areas?.length ? ` Relevant EYFS areas: ${input.areas.join(', ')}.` : '';
  const message = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      'You are an early-years practitioner writing EYFS learning-journal observations. ' +
      'Turn the rough notes into a warm, professional, parent-facing observation in 2–4 sentences. ' +
      'Describe what the child did and the learning it demonstrates. Do not invent details not implied by the notes.',
    messages: [
      {
        role: 'user',
        content: [
          ...maybeImage(input.photoUrl),
          { type: 'text', text: `Rough notes${who}:${areas}\n\n${input.notes}` },
        ],
      },
    ],
  });
  return firstText(message);
}

// Analyse a photo: describe the activity and suggest applicable EYFS areas.
export async function analyzePhoto(input: { photoUrl: string; context?: string }): Promise<string> {
  const ctx = input.context ? `\n\nContext from the practitioner: ${input.context}` : '';
  const message = await getAnthropic().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system:
      'You are an early-years practitioner. Describe what is happening in the photo from an EYFS ' +
      `perspective and suggest which of these areas it evidences: ${EYFS_AREAS.join(', ')}. ` +
      'Be concise and factual; do not speculate beyond what is visible.',
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: input.photoUrl } },
          { type: 'text', text: `Describe this activity and suggest EYFS areas.${ctx}` },
        ],
      },
    ],
  });
  return firstText(message);
}
