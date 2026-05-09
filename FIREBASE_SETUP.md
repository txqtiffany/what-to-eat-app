# Firebase setup — one-time steps

Phase 1 of the cloud sharing migration is in the code. Before you can run it,
you need to create a Firebase project and paste its config into `.env.local`.
This is a one-time, ~10-minute task you do in the browser. Phases 2+ will not
require any further Firebase console steps.

## 1. Create the Firebase project

1. Go to <https://console.firebase.google.com/> and sign in with the same Google
   account you want as the app owner.
2. Click **Add project**. Name it whatever you like (e.g. `whattoeat`). Google
   Analytics is optional — you can skip it.
3. When the project is ready, click **Continue**.

## 2. Enable the services we use

In the left sidebar of the Firebase console for your new project:

- **Build → Authentication → Get started**, then under *Sign-in method* enable
  **Google** and pick a public-facing project name.
- **Build → Firestore Database → Create database**.
  - Pick **Start in production mode** (we ship our own rules).
  - Choose a region close to you (e.g. `nam5` or `asia-east1`). This cannot be
    changed later, but for a household-sized app it doesn't matter much.
- **Build → Storage → Get started**, accept defaults, same region.

## 3. Register a Web App and copy the config

1. In the project overview page, click the **`</>`** (Web) icon to register a
   web app. Give it a nickname (e.g. `whattoeat-web`). You do **not** need to
   enable Firebase Hosting from this dialog — we'll do that separately later.
2. Firebase will show you a snippet that looks like:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "whattoeat-xxxxx.firebaseapp.com",
     projectId: "whattoeat-xxxxx",
     storageBucket: "whattoeat-xxxxx.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abcdef123456"
   };
   ```

3. Copy these values into a new file at the project root called `.env.local`
   (start by copying `.env.example`):

   ```
   GEMINI_API_KEY=your-existing-gemini-key

   FIREBASE_API_KEY=AIza...
   FIREBASE_AUTH_DOMAIN=whattoeat-xxxxx.firebaseapp.com
   FIREBASE_PROJECT_ID=whattoeat-xxxxx
   FIREBASE_STORAGE_BUCKET=whattoeat-xxxxx.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=1234567890
   FIREBASE_APP_ID=1:1234567890:web:abcdef123456
   ```

4. Open `.firebaserc` and replace `REPLACE_WITH_YOUR_FIREBASE_PROJECT_ID` with
   your real `projectId` (the same value as `FIREBASE_PROJECT_ID` above).

`.env.local` is in `.gitignore` so it won't be committed.

## 4. Deploy the security rules

The rules in `firestore.rules` and `storage.rules` enforce who can read/write
what. They need to be uploaded once.

```sh
# Install the Firebase CLI globally (one time)
npm install -g firebase-tools

# Sign in (opens a browser window once)
firebase login

# Deploy just the rules to your project (uses .firebaserc + firebase.json)
firebase deploy --only firestore:rules,storage
```

If you ever change the rules files, re-run that command.

## 5. Run the app locally

```sh
npm install        # if you haven't already
npm run dev
```

Visit <http://localhost:3000>. You should see the login screen. Sign in with
Google. On first login:

- A `users/<your-uid>` doc and a `folders/<id>` named "我的菜谱" are created.
- Any recipes you previously saved on this device (in IndexedDB) are uploaded
  to the cloud and added to that folder.
- After that, the app behaves exactly as before — the difference is your data
  is now in Firestore, not IndexedDB, so it follows you across devices.

## 6. (Later) Deploy to Firebase Hosting

Once you're happy with Phase 1 locally:

```sh
npm run build
firebase deploy --only hosting
```

The CLI will print a `https://<projectId>.web.app` URL.

> ⚠️ Heads-up about the Gemini API key: today it's bundled into the client
> JavaScript, so anyone visiting the deployed site can extract it. This is the
> same as the current AI Studio app. Phase 4 of the plan moves Gemini calls
> behind a Firebase Cloud Function so the key stays server-side. If you plan
> to share the deployed URL with anyone outside trusted household members
> before then, rotate the Gemini key after they're done — or wait for Phase 4.

## Troubleshooting

- **"Firebase config is incomplete" warning in the console.** You haven't
  filled in `.env.local`, or the dev server was started before you saved it.
  Stop and re-run `npm run dev` after editing `.env.local`.
- **`auth/unauthorized-domain` when signing in.** Firebase Auth → Settings →
  *Authorized domains* — add `localhost` (it's there by default) and any
  Firebase Hosting / custom domains you deploy to.
- **Permission denied writes / reads.** The security rules haven't been
  deployed yet — re-run the `firebase deploy --only firestore:rules,storage`
  command above.
- **Migration didn't pick up old recipes.** The flag
  `cloud-migration-claimed` in localStorage marks the device's IndexedDB data
  as migrated (whichever user signed in first). Clear it via DevTools →
  Application → Local Storage and reload to retry.
