// HAMOKSHA configuration.
// The Supabase anon key is designed to be public; security comes from the
// Row Level Security policies in supabase/schema.sql.
// Find both values in Supabase: Project Settings > API.

export const SUPABASE_URL = 'https://vyfhrkclaoiaucvlxwta.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_3Fc2L59usF14DPaEYJDxRA_bWTlGeke';

// Peer-to-peer classroom (PeerJS). Leave as {} to use the free public PeerJS cloud.
// For production, run your own PeerServer and add a TURN server, for example:
// { host: 'peer.example.com', port: 443, secure: true,
//   config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' },
//                          { urls: 'turn:turn.example.com:3478', username: 'u', credential: 'p' }] } }
export const PEER_OPTIONS = {};

export const SUBJECTS = ['general', 'math', 'languages', 'programming', 'science'];

export const isConfigured =
  !SUPABASE_URL.startsWith('YOUR_') && !SUPABASE_ANON_KEY.startsWith('YOUR_');
