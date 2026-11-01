// Chat view used by students (AI replies) and teachers (monitoring + replying).

import { sb } from './supabaseClient.js';
import { t, getLang } from './i18n.js';
import { el, renderRich, stripEmoji, timeLabel, toast } from './ui.js';

const logoUrl = 'assets/logo.svg';

export async function listRooms(ownerId, subject) {
  const { data, error } = await sb
    .from('rooms')
    .select('*')
    .eq('owner_id', ownerId)
    .eq('subject', subject)
    .order('created_at', { ascending: false })
    .limit(30);
  if (error) throw error;
  return data;
}

export async function createRoom(ownerId, subject) {
  const { data, error } = await sb
    .from('rooms')
    .insert({ owner_id: ownerId, subject, title: t('newChatTitle') })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function askAI(room, history) {
  const { data } = await sb.auth.getSession();
  const token = data.session && data.session.access_token;
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      subject: room.subject,
      lang: getLang(),
      messages: history.slice(-20).map((m) => ({
        role: m.sender_role === 'ai' ? 'assistant' : 'user',
        content: m.sender_role === 'teacher' ? `[Teacher ${m.sender_name}]: ${m.content}` : m.content,
      })),
    }),
  });
  if (!res.ok) throw new Error(`AI ${res.status}`);
  const json = await res.json();
  return stripEmoji(json.reply);
}

/**
 * Mounts a chat into `root`.
 * mode "student": the signed-in user owns the room and the AI answers.
 * mode "teacher": a teacher watches a student's room and can post as teacher (no AI call).
 * Returns { destroy }.
 */
export function mountChat(root, { room, profile, mode = 'student', onTitle }) {
  root.textContent = '';
  const isTeacher = mode === 'teacher';

  const list = el('div', 'messages');
  list.setAttribute('aria-live', 'polite');
  const form = el('form', 'composer');
  const input = el('textarea');
  input.rows = 1;
  input.placeholder = t('typeMessage');
  input.setAttribute('aria-label', t('typeMessage'));
  input.dir = 'auto';
  const sendBtn = el('button', 'btn btn-primary', t('send'));
  sendBtn.type = 'submit';
  form.append(input, sendBtn);
  root.append(list, form);

  const seen = new Set();
  const history = [];
  let typingNode = null;
  let busy = false;
  let channel = null;

  const empty = el('div', 'empty', t('emptyChat'));
  list.appendChild(empty);

  function labelFor(m) {
    if (m.sender_role === 'ai') return 'HAMOKSHA';
    if (m.sender_role === 'teacher') return `${t('teacherLabel')}${m.sender_name ? ' ' + m.sender_name : ''}`;
    return m.sender_id === profile.id ? t('you') : m.sender_name || t('student');
  }

  function isMine(m) {
    return isTeacher ? m.sender_role === 'teacher' && m.sender_id === profile.id : m.sender_role === 'student' && m.sender_id === profile.id;
  }

  function addMessage(m) {
    if (seen.has(m.id)) return;
    seen.add(m.id);
    history.push(m);
    empty.remove();

    const row = el('div', `msg msg-${m.sender_role}${isMine(m) ? ' mine' : ''}`);
    if (m.sender_role === 'ai') {
      const av = el('img', 'avatar');
      av.src = logoUrl;
      av.alt = '';
      row.appendChild(av);
    }
    const bubble = el('div', 'bubble');
    const meta = el('div', 'meta');
    meta.append(el('span', 'who', labelFor(m)), el('span', 'time', timeLabel(m.created_at)));
    const body = el('div', 'body');
    renderRich(m.content, body);
    bubble.append(meta, body);
    row.appendChild(bubble);

    if (typingNode) list.insertBefore(row, typingNode);
    else list.appendChild(row);
    list.scrollTop = list.scrollHeight;
  }

  function showTyping() {
    typingNode = el('div', 'msg msg-ai typing');
    const av = el('img', 'avatar');
    av.src = logoUrl;
    av.alt = '';
    const b = el('div', 'bubble');
    b.append(el('span', 'sr-only', t('thinking')), el('span', 'dot'), el('span', 'dot'), el('span', 'dot'));
    typingNode.append(av, b);
    list.appendChild(typingNode);
    list.scrollTop = list.scrollHeight;
  }

  function hideTyping() {
    if (typingNode) typingNode.remove();
    typingNode = null;
  }

  async function insertMessage(fields) {
    const { data, error } = await sb
      .from('messages')
      .insert({ room_id: room.id, ...fields })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function load() {
    const { data, error } = await sb
      .from('messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true })
      .limit(300);
    if (error) return toast(t('error'), 'error');
    data.forEach(addMessage);
  }

  function subscribe() {
    channel = sb
      .channel(`room-${room.id}-${Math.random().toString(36).slice(2, 7)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${room.id}` },
        (payload) => addMessage(payload.new)
      )
      .subscribe();
  }

  async function handleSend(text) {
    if (isTeacher) {
      const m = await insertMessage({
        sender_id: profile.id,
        sender_role: 'teacher',
        sender_name: profile.display_name,
        content: text,
      });
      addMessage(m);
      return;
    }

    const isFirst = !history.some((h) => h.sender_role === 'student');
    const m = await insertMessage({
      sender_id: profile.id,
      sender_role: 'student',
      sender_name: profile.display_name,
      content: text,
    });
    addMessage(m);

    if (isFirst) {
      const title = text.replace(/\s+/g, ' ').slice(0, 42);
      sb.from('rooms').update({ title }).eq('id', room.id).then(() => onTitle && onTitle(room.id, title));
    }

    showTyping();
    try {
      const reply = await askAI(room, history);
      const ai = await insertMessage({ sender_role: 'ai', sender_name: 'HAMOKSHA', content: reply });
      hideTyping();
      addMessage(ai);
    } catch (err) {
      console.error(err);
      hideTyping();
      toast(t('aiError'), 'error');
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text || busy) return;
    busy = true;
    sendBtn.disabled = true;
    input.value = '';
    input.style.height = '';
    try {
      await handleSend(text);
    } catch (err) {
      console.error(err);
      toast(t('error'), 'error');
      input.value = text;
    } finally {
      busy = false;
      sendBtn.disabled = false;
      input.focus();
    }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 160) + 'px';
  });

  load().then(subscribe);

  return {
    destroy() {
      if (channel) sb.removeChannel(channel);
    },
  };
}
