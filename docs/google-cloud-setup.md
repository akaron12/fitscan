# Google Cloud setup (one-time, for Drive sync)

The app signs in with Google directly from the browser (Google Identity Services, token model). You need your own OAuth client. It costs nothing and takes about 10 minutes. Google's console wording changes now and then; if a label differs slightly, look for the closest match.

## 1. Create a project
1. Open https://console.cloud.google.com and sign in with **the Google account whose Drive holds your `AI Memory` folder**. Create the project under that same account, to keep everything in one account.
2. Top bar project picker → **New project** → name it `meal-tracker` → **Create**. Make sure it is the selected project.

## 2. Enable the Drive API
1. Menu → **APIs & Services** → **Library**.
2. Search **Google Drive API** → **Enable**.

## 3. Configure the consent screen (Google Auth Platform)
1. Menu → **Google Auth Platform** (or **APIs & Services → OAuth consent screen**) → **Get started**.
2. App name: `Meal Tracker`. User support email and developer contact: your email.
3. Audience: **External**.
4. **Data Access** → **Add or remove scopes** → add `https://www.googleapis.com/auth/drive` (listed as "See, edit, create and delete all of your Google Drive files"). Save.
   - This is the full-Drive scope you accepted in the spec. It is the only way the app can see files Claude writes into `AI Memory`.
5. **Audience** → **Publish app** → confirm, so the status is **In production**.
   - If you leave it in "Testing", Google expires your sign-in every 7 days.
   - You do not need to submit for verification. Sign-in will show an "unverified app" warning. Click **Advanced → Go to Meal Tracker (unsafe)**. It is your own app, so that is expected.

## 4. Create the OAuth client
1. **Google Auth Platform → Clients → Create client** (or **Credentials → Create credentials → OAuth client ID**).
2. Application type: **Web application**. Name: `Meal Tracker web`.
3. **Authorized JavaScript origins** (origins only, no path, no trailing slash):
   - `https://akaron12.github.io`
   - `http://localhost:8000` (for testing on this Mac)
4. Leave **Authorized redirect URIs** empty (the token flow does not use them).
5. **Create**, then copy the **Client ID** (looks like `123456789-abc.apps.googleusercontent.com`).
   - The Client ID is not a secret and will be stored in the app's code. Ignore the "client secret"; the app never uses it.

## 5. Send me the Client ID
Paste the Client ID into the chat. Do not paste any password or secret.

## Notes
- Always sign in to the app with **the same Google account that holds `AI Memory`**. Any other account would create a separate `Meal Tracker` folder in the wrong Drive, and Claude's planned meals would not appear.
- All GitHub Pages sites under `akaron12.github.io` share one browser origin. The plan covers this with escaping and a strict Content-Security-Policy. If you host other apps there, consider a custom domain for this one later.
- On iPhone the sign-in is tested in step 6 of the build plan. If the popup does not work in the installed home-screen app, the fallback is to sign in through Safari.
