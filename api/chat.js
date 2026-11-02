// Vercel serverless function: POST /api/chat
// Keeps the AI key on the server and applies the HAMOKSHA persona.
//
// Required environment variables (Vercel > Project > Settings > Environment Variables):
//   OPENAI_API_KEY      your OpenAI API key   (or ANTHROPIC_API_KEY to use Claude instead)
//   SUPABASE_URL        same URL used in js/config.js
//   SUPABASE_ANON_KEY   same anon key used in js/config.js
// Optional:
//   OPENAI_MODEL        defaults to gpt-4.1-mini
//   ANTHROPIC_MODEL     defaults to claude-sonnet-5-5
// If OPENAI_API_KEY is set, OpenAI is used; otherwise Anthropic.

const EMOJI_RE = /[\p{Extended_Pictographic}\p{Regional_Indicator}‍️⃣]/gu;
const stripEmoji = (s) => String(s).replace(EMOJI_RE, '').replace(/[ \t]{2,}/g, ' ').trim();

const SUBJECTS = {
  general:
    'You are in the general chat. Help with any everyday or study question.',
  math:
    'You are the Mathematics teaching assistant. Guide the student step by step, ask one short check question at the end when useful, and prefer hints over dumping the full solution unless asked. Write maths in plain text (for example x^2 + 3x = 10).',
  languages:
    'You are the Languages teaching assistant. Help with vocabulary, grammar, translation, pronunciation tips and writing. Give short examples and correct mistakes kindly.',
  programming:
    'You are the Programming teaching assistant. Explain concepts clearly, show small, correct code samples in fenced code blocks, and point out the reason behind each fix.',
  science:
    'You are the Science teaching assistant covering physics, chemistry, biology and earth science. Use simple analogies, correct definitions and short worked examples.',
};

function systemPrompt(subject, lang) {
  const langRule =
    lang === 'ar'
      ? 'The interface language is Arabic. Reply in natural colloquial Arabic (simple spoken dialect, easy for any Arab student to follow), not stiff formal Arabic. Keep technical terms in English in brackets only when helpful. If the student writes in English, reply in English.'
      : 'The interface language is English. Reply in English. If the student writes in Arabic, reply in natural colloquial Arabic.';

  return [
    'You are HAMOKSHA, a calm and curious cat who runs an educational platform.',
    SUBJECTS[subject] || SUBJECTS.general,
    'Style rules:',
    '- Be concise and useful. Aim for under 120 words unless code or a worked example needs more.',
    '- Light feline personality: composed, observant, quietly witty. At most one short cat-flavoured remark per reply, and skip it when the topic is serious.',
    '- Never use emojis, emoticons, or decorative symbols. Plain text only (code blocks allowed).',
    '- Do not invent facts. If unsure, say so briefly.',
    '- Messages that begin with "[Teacher ...]" come from a human teacher watching the chat. Treat them as authoritative guidance.',
    langRule,
  ].join('\n');
}

async function verifyUser(token) {
  // Falls back to the public values in js/config.js if the env vars are not set.
  const url = process.env.SUPABASE_URL || 'https://vyfhrkclaoiaucvlxwta.supabase.co';
  const key = process.env.SUPABASE_ANON_KEY || 'sb_publishable_3Fc2L59usF14DPaEYJDxRA_bWTlGeke';
  if (!url || !key || !token) return false;
  const r = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: key, Authorization: `Bearer ${token}` },
  });
  return r.ok;
}

async function callOpenAI(system, messages) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      max_completion_tokens: 700,
      messages: [{ role: 'system', content: system }, ...messages],
    }),
  });
  if (!r.ok) {
    console.error('OpenAI error', r.status, await r.text());
    throw new AIError();
  }
  const data = await r.json();
  return (data.choices && data.choices[0] && data.choices[0].message.content) || '';
}

async function callAnthropic(system, messages) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5',
      max_tokens: 700,
      system,
      messages,
    }),
  });
  if (!r.ok) {
    console.error('Anthropic error', r.status, await r.text());
    throw new AIError();
  }
  const data = await r.json();
  return (data.content || [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

class AIError extends Error {}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!(await verifyUser(token))) return res.status(401).json({ error: 'Unauthorized' });

    const useOpenAI = !!process.env.OPENAI_API_KEY;
    if (!useOpenAI && !process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY is not set on the server' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const subject = Object.keys(SUBJECTS).includes(body.subject) ? body.subject : 'general';
    const lang = body.lang === 'ar' ? 'ar' : 'en';

    let messages = (Array.isArray(body.messages) ? body.messages : [])
      .slice(-20)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 4000),
      }))
      .filter((m) => m.content.trim());

    while (messages.length && messages[0].role !== 'user') messages.shift();
    if (!messages.length) return res.status(400).json({ error: 'No messages' });

    const system = systemPrompt(subject, lang);
    const text = useOpenAI ? await callOpenAI(system, messages) : await callAnthropic(system, messages);

    return res.status(200).json({ reply: stripEmoji(text) || '...' });
  } catch (err) {
    if (err instanceof AIError) return res.status(502).json({ error: 'AI service error' });
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
};
