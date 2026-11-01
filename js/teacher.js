// Teacher dashboard: watch/join student educational chats and run live classes.

import { sb } from './supabaseClient.js';
import { t } from './i18n.js';
import { el, toast } from './ui.js';
import { mountChat } from './chat.js';
import { mountClassList, startClass } from './meeting.js';

const EDU_SUBJECTS = ['math', 'languages', 'programming', 'science'];

export function mountTeacher(root, profile) {
  root.textContent = '';
  const layout = el('div', 'teacher-layout');

  // ---- left column ----
  const left = el('div', 'teacher-left');

  const classPanel = el('section', 'panel');
  classPanel.appendChild(el('h2', '', t('startClass')));
  const form = el('form', 'inline-form');
  const titleInput = el('input');
  titleInput.required = true;
  titleInput.maxLength = 80;
  titleInput.placeholder = t('classTitle');
  titleInput.setAttribute('aria-label', t('classTitle'));
  const startBtn = el('button', 'btn btn-primary', t('start'));
  startBtn.type = 'submit';
  form.append(titleInput, startBtn);
  classPanel.append(form, el('h3', '', t('myClasses')));
  const classBox = el('div');
  classPanel.appendChild(classBox);

  const roomPanel = el('section', 'panel');
  const head = el('div', 'panel-head');
  head.appendChild(el('h2', '', t('studentChats')));
  const filter = el('select');
  filter.setAttribute('aria-label', t('subjects'));
  const all = el('option', '', t('allSubjects'));
  all.value = 'all';
  filter.appendChild(all);
  EDU_SUBJECTS.forEach((s) => {
    const o = el('option', '', t(s));
    o.value = s;
    filter.appendChild(o);
  });
  head.appendChild(filter);
  const roomList = el('ul', 'room-cards');
  roomPanel.append(head, roomList);

  left.append(classPanel, roomPanel);

  // ---- right column ----
  const monitor = el('section', 'panel monitor');
  const monitorBody = el('div', 'monitor-body');
  monitorBody.appendChild(el('div', 'empty', t('pickRoom')));
  monitor.appendChild(monitorBody);

  layout.append(left, monitor);
  root.appendChild(layout);

  let activeChat = null;
  let activeId = null;
  let channel = null;

  async function loadRooms() {
    let q = sb
      .from('rooms')
      .select('id, title, subject, created_at, owner_id, profiles:owner_id(display_name)')
      .neq('subject', 'general')
      .order('created_at', { ascending: false })
      .limit(100);
    if (filter.value !== 'all') q = q.eq('subject', filter.value);
    const { data, error } = await q;
    roomList.textContent = '';
    if (error) return toast(t('error'), 'error');
    if (!data.length) return roomList.appendChild(el('li', 'empty', t('noStudentChats')));

    data.forEach((r) => {
      const li = el('li', `room-card${r.id === activeId ? ' active' : ''}`);
      const btn = el('button');
      btn.type = 'button';
      const name = (r.profiles && r.profiles.display_name) || t('student');
      btn.append(
        el('strong', '', name),
        el('span', 'tag', t(r.subject)),
        el('span', 'muted', r.title)
      );
      btn.onclick = () => openRoom(r, name);
      li.appendChild(btn);
      roomList.appendChild(li);
    });
  }

  function openRoom(r, studentName) {
    if (activeChat) activeChat.destroy();
    activeId = r.id;
    monitorBody.textContent = '';
    const bar = el('div', 'monitor-bar');
    bar.append(
      el('strong', '', `${t('monitoring')}: ${studentName}`),
      el('span', 'tag', t(r.subject))
    );
    const hint = el('p', 'muted hint', t('teacherReplyHint'));
    const chatRoot = el('div', 'chat-root');
    monitorBody.append(bar, hint, chatRoot);
    activeChat = mountChat(chatRoot, { room: r, profile, mode: 'teacher' });
    loadRooms();
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    if (!title) return;
    startBtn.disabled = true;
    try {
      await startClass(profile, title);
      titleInput.value = '';
    } catch (err) {
      console.error(err);
      toast(t('error'), 'error');
    } finally {
      startBtn.disabled = false;
    }
  });

  filter.addEventListener('change', loadRooms);

  const classList = mountClassList(classBox, profile, { mine: true });
  channel = sb
    .channel('teacher-rooms-' + Math.random().toString(36).slice(2, 7))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms' }, loadRooms)
    .subscribe();
  loadRooms();

  return {
    destroy() {
      if (activeChat) activeChat.destroy();
      classList.destroy();
      if (channel) sb.removeChannel(channel);
    },
  };
}
