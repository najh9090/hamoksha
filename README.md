# HAMOKSHA

A cat-themed, bilingual (English and colloquial Arabic) educational AI platform.

- General chat and subject chats (Mathematics, Languages, Programming, Science)
- Teacher accounts with a dashboard to watch student chats and reply as the teacher
- Live classes with peer-to-peer video (PeerJS / WebRTC)
- Supabase for accounts, rooms, messages and live classes
- Vercel serverless function (`api/chat.js`) keeps the AI key off the browser; replies are persona-styled and stripped of emojis

```
index.html          page shell
css/style.css       cat theme, RTL aware
js/                 app, auth, chat, teacher, meeting, i18n, config
api/chat.js         Vercel function: POST /api/chat
supabase/schema.sql tables, RLS policies, realtime
```

## 1. Connect Supabase

1. Create a project at https://supabase.com.
2. Open SQL Editor, paste all of `supabase/schema.sql`, and run it.
3. Open Project Settings > API. Copy the Project URL and the anon public key into `js/config.js`:
   ```js
   export const SUPABASE_URL = 'https://xxxx.supabase.co';
   export const SUPABASE_ANON_KEY = 'eyJ...';
   ```
4. Authentication > Providers: keep Email enabled. For quick testing you can turn off "Confirm email".
5. Optional: stop anyone from registering as a teacher by setting a secret code, then share it with real teachers:
   ```sql
   update public.app_config set value = 'choose-a-secret-code' where key = 'teacher_code';
   ```

## 2. AI key

Create an API key at https://console.anthropic.com. It is used only on the server, in these environment variables:

| Variable | Value |
| --- | --- |
| `ANTHROPIC_API_KEY` | your key |
| `SUPABASE_URL` | same URL as in `js/config.js` |
| `SUPABASE_ANON_KEY` | same anon key as in `js/config.js` |
| `ANTHROPIC_MODEL` | optional, defaults to `claude-sonnet-5-5` |

## 3. Run locally

```bash
npm i -g vercel
vercel dev        # serves the site and /api/chat on http://localhost:3000
```
Put the variables in a local `.env` file (already git-ignored). Camera and microphone need `localhost` or HTTPS.

## 4. Push to GitHub

```bash
git init
git add .
git commit -m "HAMOKSHA first version"
git branch -M main
git remote add origin https://github.com/YOUR_USER/hamoksha.git
git push -u origin main
```

## 5. Deploy on Vercel

1. Go to https://vercel.com/new and import the GitHub repository.
2. Framework Preset: **Other**. Leave build command and output directory empty.
3. Add the environment variables from step 2, then click Deploy.
4. Every later `git push` redeploys automatically.

## Notes

- **Classroom (PeerJS):** the teacher opens a class, students join from the Live classes page. The teacher sees all students; students see the teacher and join muted. Mesh peer-to-peer works for small classes. For production, run your own PeerServer and add a TURN server via `PEER_OPTIONS` in `js/config.js`.
- **Privacy:** the General chat is private to its owner. Educational subject chats are readable by teachers by design (see the RLS policies).
- **Arabic:** the AI answers in simple colloquial Arabic when the interface is Arabic or the student writes in Arabic.
