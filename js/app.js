// HAMOKSHA application entry: auth screen, navigation and views.

import { isConfigured, SUBJECTS } from './config.js';
import { sb } from './supabaseClient.js';
import { t, setLang, getLang, initLang, applyI18n } from './i18n.js';
import * as auth from './auth.js';
import { $, $$, el, toast } from './ui.js';
import { mountChat, listRooms, createRoom } from './chat.js';
import { mountTeacher } from './teacher.js';
import { mountClassList, bindMeetingControls } from './meeting.js';

const state = { profile: null, view: null, subject: 'general', room: null, mounted: null };

// ------------------------------------------------------------------
// Screens
// ------------------------------------------------------------------
function showAuth() {
  state.profile = null;
  unmount();
  $('#appView').hidden = true;
  $('#authView').hidden = false;
  $('#userBox').hidden = true;
}

async function enterApp(user) {
  try {
    state.profile = await auth.getProfile(user.id);
  } catch (err) {
    console.error('Profile load failed:', err);
    toast(`${t('error')} (${err.message || 'profile'})`, 'error');
    await auth.signOut();
    return showAuth();
  }
  $('#authView').hidden = true;
  $('#appView').hidden = false;
  $('#userBox').hidden = false;
  $('#userName').textContent = state.profile.display_name;
  $('#userRole').textContent = t(state.profile.role);
  $('#navTeacher').hidden = state.profile.role !== 'teacher';
  openView(state.profile.role === 'teacher' ? 'teacher' : 'general');
}

function unmount() {
  if (state.mounted) state.mounted.destroy();
  state.mounted = null;
}

// ------------------------------------------------------------------
// Navigation
// ------------------------------------------------------------------
function setActiveNav(view) {
  $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
}

function openView(view) {
  state.view = view;
  setActiveNav(view);
  unmount();
  $('#history').hidden = !SUBJECTS.includes(view);
  const stage = $('#stage');
  stage.textContent = '';
  $('#stageTitle').textContent = view === 'teacher' ? t('teacherDashboard') : view === 'classes' ? t('liveClasses') : t(view);

  if (SUBJECTS.includes(view)) {
    state.subject = view;
    openSubject(view);
  } else if (view === 'classes') {
    const box = el('div', 'panel');
    stage.appendChild(box);
    state.mounted = mountClassList(box, state.profile, { mine: false });
  } else if (view === 'teacher') {
    state.mounted = mountTeacher(stage, state.profile);
  }
}

async function openSubject(subject) {
  const stage = $('#stage');
  stage.textContent = '';
  const chatRoot = el('div', 'chat-root panel');
  stage.appendChild(chatRoot);
  try {
    const rooms = await listRooms(state.profile.id, subject);
    renderHistory(rooms);
    state.room = rooms[0] || (await createRoom(state.profile.id, subject));
    if (!rooms.length) renderHistory([state.room]);
    startChat(chatRoot);
  } catch (err) {
    console.error(err);
    toast(t('error'), 'error');
  }
}

function startChat(chatRoot) {
  unmount();
  state.mounted = mountChat(chatRoot, {
    room: state.room,
    profile: state.profile,
    mode: 'student',
    onTitle: (id, title) => {
      const btn = $(`#historyList [data-id="${id}"] span`);
      if (btn) btn.textContent = title;
    },
  });
  $$('#historyList li').forEach((li) => li.classList.toggle('active', li.dataset.id === state.room.id));
}

function renderHistory(rooms) {
  const ul = $('#historyList');
  ul.textContent = '';
  if (!rooms.length) ul.appendChild(el('li', 'empty', t('emptyRooms')));
  rooms.forEach((r) => {
    const li = el('li');
    li.dataset.id = r.id;
    if (state.room && state.room.id === r.id) li.classList.add('active');
    const b = el('button');
    b.type = 'button';
    b.appendChild(el('span', '', r.title));
    b.onclick = () => {
      state.room = r;
      startChat($('#stage .chat-root'));
    };
    li.appendChild(b);
    ul.appendChild(li);
  });
}

async function newChat() {
  if (!SUBJECTS.includes(state.view)) return;
  try {
    state.room = await createRoom(state.profile.id, state.subject);
    const rooms = await listRooms(state.profile.id, state.subject);
    renderHistory(rooms);
    startChat($('#stage .chat-root'));
  } catch (err) {
    console.error(err);
    toast(t('error'), 'error');
  }
}

function authErrorMessage(err, mode, role) {
  const m = String(err && err.message || '');
  const code = err && err.code;
  if (/database error/i.test(m) && mode === 'signup' && role === 'teacher') return t('badCode');
  if (code === 'email_not_confirmed' || /email not confirmed/i.test(m)) return t('emailNotConfirmed');
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(m)) return t('badLogin');
  if (code === 'user_already_exists' || /already registered/i.test(m)) return t('alreadyRegistered');
  if (code === 'weak_password' || /at least 6/i.test(m)) return t('weakPassword');
  if (err && err.status === 429 || /rate limit/i.test(m)) return t('rateLimited');
  return m || t('error');
}

// ------------------------------------------------------------------
// Auth form wiring
// ------------------------------------------------------------------
function bindAuth() {
  let mode = 'login';
  const form = $('#authForm');

  function setMode(next) {
    mode = next;
    $$('[data-auth-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.authTab === next)));
    $$('.signup-only').forEach((n) => (n.hidden = next !== 'signup'));
    $('#authSubmit').textContent = next === 'signup' ? t('createAccount') : t('login');
    $('#password').autocomplete = next === 'signup' ? 'new-password' : 'current-password';
    syncTeacherCode();
  }

  function syncTeacherCode() {
    const role = form.elements.role.value;
    $('#teacherCodeRow').hidden = !(mode === 'signup' && role === 'teacher');
  }

  $$('[data-auth-tab]').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.authTab)));
  $$('input[name="role"]').forEach((r) => r.addEventListener('change', syncTeacherCode));
  window.addEventListener('langchange', () => setMode(mode));
  setMode('login');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isConfigured) return toast(t('configMissing'), 'error');
    const btn = $('#authSubmit');
    btn.disabled = true;
    const v = form.elements;
    try {
      if (mode === 'signup') {
        const res = await auth.signUp({
          email: v.email.value.trim(),
          password: v.password.value,
          name: v.name.value.trim(),
          role: v.role.value,
          teacherCode: v.teacherCode.value.trim(),
        });
        await enterApp(res.user);
      } else {
        const res = await auth.signIn({ email: v.email.value.trim(), password: v.password.value });
        await enterApp(res.user);
      }
      form.reset();
    } catch (err) {
      console.error(err);
      toast(authErrorMessage(err, mode, v.role.value), 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

// ------------------------------------------------------------------
// Boot
// ------------------------------------------------------------------
async function boot() {
  initLang();
  bindAuth();
  bindMeetingControls();

  $('#langToggle').addEventListener('click', () => setLang(getLang() === 'ar' ? 'en' : 'ar'));
  window.addEventListener('langchange', () => {
    $('#langToggle').textContent = getLang() === 'ar' ? 'EN' : 'عربي';
    if (state.profile) {
      $('#userRole').textContent = t(state.profile.role);
      openView(state.view || 'general');
    }
  });
  $('#langToggle').textContent = getLang() === 'ar' ? 'EN' : 'عربي';

  $('#nav').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) openView(b.dataset.view);
  });
  $('#newChatBtn').addEventListener('click', newChat);
  $('#logoutBtn').addEventListener('click', async () => {
    await auth.signOut();
    showAuth();
  });

  if (!isConfigured) {
    $('#configBanner').hidden = false;
    return showAuth();
  }

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') showAuth();
  });

  const user = await auth.getSessionUser();
  if (user) await enterApp(user);
  else showAuth();
}

applyI18n();
boot();
