// Virtual classroom built on PeerJS (WebRTC peer-to-peer video).
// Topology: the teacher registers a PeerJS id stored in the `meetings` table.
// Students call that id. The teacher sees every student; students see the teacher.

import { sb } from './supabaseClient.js';
import { PEER_OPTIONS } from './config.js';
import { t } from './i18n.js';
import { $, el, toast, timeLabel } from './ui.js';

let peer = null;
let local = null;
let meeting = null;
let isHost = false;
let watchTimer = null;
const calls = new Map();
const tiles = new Map();

const overlay = () => $('#meetingOverlay');
const grid = () => $('#videoGrid');

function setStatus(text) {
  const s = $('#meetingStatus');
  s.textContent = text || '';
  s.hidden = !text;
}

function addTile(id, stream, label, muted = false) {
  let tile = tiles.get(id);
  if (!tile) {
    tile = el('div', 'tile');
    const v = el('video');
    v.autoplay = true;
    v.playsInline = true;
    tile.append(v, el('span', 'tile-label', label));
    grid().appendChild(tile);
    tiles.set(id, tile);
  }
  const v = tile.querySelector('video');
  v.muted = muted;
  v.srcObject = stream;
  grid().dataset.count = String(tiles.size);
}

function removeTile(id) {
  const tile = tiles.get(id);
  if (tile) tile.remove();
  tiles.delete(id);
  grid().dataset.count = String(tiles.size);
}

async function getMedia() {
  try {
    return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  } catch (_) {
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
}

function openOverlay(title) {
  $('#meetingTitle').textContent = title;
  $('#btnLeave').textContent = isHost ? t('endForAll') : t('leave');
  overlay().hidden = false;
  document.body.classList.add('in-meeting');
}

function cleanup() {
  clearInterval(watchTimer);
  watchTimer = null;
  calls.forEach((c) => c.close());
  calls.clear();
  if (peer) peer.destroy();
  peer = null;
  if (local) local.getTracks().forEach((tr) => tr.stop());
  local = null;
  tiles.forEach((tile) => tile.remove());
  tiles.clear();
  overlay().hidden = true;
  document.body.classList.remove('in-meeting');
  $('#btnMic').setAttribute('aria-pressed', 'true');
  $('#btnCam').setAttribute('aria-pressed', 'true');
}

export async function leaveClass() {
  const m = meeting;
  const wasHost = isHost;
  meeting = null;
  isHost = false;
  cleanup();
  if (wasHost && m) {
    await sb.from('meetings').update({ active: false }).eq('id', m.id);
    window.dispatchEvent(new Event('meetingschanged'));
  }
}

function bindPeerErrors(p) {
  p.on('error', (err) => {
    console.error(err);
    toast(t('peerError'), 'error');
  });
}

async function enterHost(m, profile) {
  cleanup();
  isHost = true;
  meeting = m;
  openOverlay(m.title);
  try {
    local = await getMedia();
  } catch (err) {
    toast(t('mediaError'), 'error');
    meeting = null;
    isHost = false;
    cleanup();
    return;
  }
  addTile('me', local, profile.display_name, true);
  setStatus(t('waitingStudents'));

  peer = new Peer(m.peer_id, PEER_OPTIONS);
  bindPeerErrors(peer);
  peer.on('call', (call) => {
    call.answer(local);
    calls.set(call.peer, call);
    call.on('stream', (s) => {
      addTile(call.peer, s, t('student'));
      setStatus('');
    });
    call.on('close', () => removeTile(call.peer));
    call.on('error', () => removeTile(call.peer));
  });
}

export async function startClass(profile, title) {
  const peerId = 'hamoksha-' + crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  const { data, error } = await sb
    .from('meetings')
    .insert({ teacher_id: profile.id, teacher_name: profile.display_name, title, peer_id: peerId })
    .select()
    .single();
  if (error) throw error;
  window.dispatchEvent(new Event('meetingschanged'));
  await enterHost(data, profile);
}

export const reopenClass = (m, profile) => enterHost(m, profile);

export async function joinClass(m, profile) {
  cleanup();
  isHost = false;
  meeting = m;
  openOverlay(m.title);
  setStatus(t('connecting'));
  try {
    local = await getMedia();
  } catch (err) {
    toast(t('mediaError'), 'error');
    meeting = null;
    cleanup();
    return;
  }
  // Students join with the microphone muted; they can unmute with the Mic button.
  local.getAudioTracks().forEach((tr) => (tr.enabled = false));
  $('#btnMic').setAttribute('aria-pressed', 'false');
  addTile('me', local, profile.display_name, true);

  peer = new Peer(PEER_OPTIONS);
  bindPeerErrors(peer);
  peer.on('open', () => {
    const call = peer.call(m.peer_id, local);
    calls.set(m.peer_id, call);
    call.on('stream', (s) => {
      addTile('host', s, m.teacher_name || t('teacherLabel'));
      setStatus('');
    });
    call.on('close', () => {
      if (meeting) {
        toast(t('classEnded'));
        leaveClass();
      }
    });
  });

  // Poll: students cannot receive realtime updates for a class that is no longer active.
  watchTimer = setInterval(async () => {
    const { data } = await sb.from('meetings').select('id').eq('id', m.id).eq('active', true).maybeSingle();
    if (!data && meeting) {
      toast(t('classEnded'));
      leaveClass();
    }
  }, 15000);
}

export function bindMeetingControls() {
  $('#btnMic').addEventListener('click', (e) => {
    if (!local) return;
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    local.getAudioTracks().forEach((tr) => (tr.enabled = on));
    e.currentTarget.setAttribute('aria-pressed', String(on));
  });
  $('#btnCam').addEventListener('click', (e) => {
    if (!local) return;
    const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
    local.getVideoTracks().forEach((tr) => (tr.enabled = on));
    e.currentTarget.setAttribute('aria-pressed', String(on));
  });
  $('#btnLeave').addEventListener('click', () => leaveClass());
  window.addEventListener('beforeunload', () => {
    if (peer) peer.destroy();
  });
}

/**
 * Renders the list of classes.
 * Students: every active class with a Join button.
 * Teachers (mine=true): their own active classes with Open and End buttons.
 */
export function mountClassList(root, profile, { mine = false } = {}) {
  const list = el('ul', 'class-list');
  root.textContent = '';
  root.appendChild(list);
  let channel = null;

  async function load() {
    let q = sb.from('meetings').select('*').eq('active', true).order('created_at', { ascending: false });
    if (mine) q = q.eq('teacher_id', profile.id);
    const { data, error } = await q;
    list.textContent = '';
    if (error || !data || !data.length) {
      list.appendChild(el('li', 'empty', t('noClasses')));
      return;
    }
    data.forEach((m) => {
      const li = el('li', 'class-item');
      const info = el('div', 'class-info');
      info.append(
        el('strong', '', m.title),
        el('span', 'muted', `${t('hostedBy')} ${m.teacher_name} - ${timeLabel(m.created_at)}`)
      );
      const actions = el('div', 'class-actions');
      if (mine) {
        const open = el('button', 'btn btn-primary btn-sm', t('rejoin'));
        open.onclick = () => reopenClass(m, profile);
        const end = el('button', 'btn btn-ghost btn-sm', t('endClass'));
        end.onclick = async () => {
          await sb.from('meetings').update({ active: false }).eq('id', m.id);
          load();
        };
        actions.append(open, end);
      } else {
        const join = el('button', 'btn btn-primary btn-sm', t('join'));
        join.onclick = () => joinClass(m, profile);
        actions.append(join);
      }
      li.append(info, actions);
      list.appendChild(li);
    });
  }

  const reload = () => load();
  window.addEventListener('meetingschanged', reload);
  const timer = setInterval(load, 20000);
  channel = sb
    .channel('meetings-list-' + Math.random().toString(36).slice(2, 7))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'meetings' }, load)
    .subscribe();
  load();

  return {
    destroy() {
      clearInterval(timer);
      window.removeEventListener('meetingschanged', reload);
      if (channel) sb.removeChannel(channel);
    },
  };
}
