# The sync helper: set-up for the owner

Cloud sync of the Eveniunt Tracker keeps its copy in **your own OneDrive** and signs in **once per device**. For that, a small program of yours runs on Cloudflare's free plan: it holds the Microsoft app's secret and each device's long-lived sign-in, and hands the Tracker a fresh one-hour key whenever it needs one. The Tracker talks to OneDrive directly; the helper never sees your data. This is the owner decision of 2026-11-09 ("sign-in: B (OneDrive)").

Everything below is done once, by you, in about 30 minutes. Nothing here is typed into a chat: the two values the Tracker needs (the application ID and the helper's address) are not secrets; the one secret (the client secret) goes only into the Worker, through the Cloudflare command line.

## 1. Register the app with Microsoft (about 10 minutes)

1. Open https://entra.microsoft.com and sign in with your personal Microsoft account (the one whose OneDrive will hold the copy). If it asks you to create a directory or a free Azure account, accept the free option; no payment method is needed for an app registration.
2. In the left menu, go to **Entra ID → App registrations → New registration** (older layouts show it as Identity → Applications → App registrations).
   - Name: `Eveniunt Command Center`.
   - Supported account types: **Personal Microsoft accounts only**.
   - Redirect URI: choose the platform **Web** and enter exactly:
     `https://splitzhappen.github.io/Eveniunt-Command-Center/tracker/oauth.html`
   - Register.
3. On the app's **Overview** page, copy the **Application (client) ID** (a long code with dashes). This is value 1.
4. In the app's own left menu (the one that appears after you open the app, under **Manage**), **Certificates & secrets → Client secrets → New client secret** (the link **Add a certificate or secret** on the app's Overview page opens the same place): description `sync helper`, expiry **24 months** (the longest offered). Copy the secret's **Value** right away (it is shown once). Keep it for step 2.7; it goes nowhere else.
5. **API permissions → Add a permission → Microsoft Graph → Delegated permissions**: tick `Files.ReadWrite.AppFolder`, `offline_access` and `openid`; **Add permissions**. No admin consent is needed for a personal account.
6. **Authentication** (shown as **Authentication (Preview)** in the current portal): on the **Redirect URI configuration** tab, make sure the redirect URI from step 2 is listed under **Web**; on the **Settings** tab, under "Implicit grant and hybrid flows", make sure **Access tokens** and **ID tokens** stay **unticked**, and leave "Allow public client flows" disabled. Save only if you changed something.

Note for later: the secret expires in 24 months; the Tracker will then say the helper cannot reach Microsoft, and a new secret (step 4, then step 2.7) fixes it.

## 2. Put the helper on Cloudflare (about 15 minutes)

You need a free Cloudflare account (https://dash.cloudflare.com/sign-up) and Node.js on your computer.

1. On your computer, open a terminal in this folder (`tracker/helper/` in the public repository, or `projects/eveniunt-completionist-tracker/helper/` in Continuity). No clone is needed: the three files `worker.js`, `entry.js` and `wrangler.toml` in one folder are enough (download them, or ask the session for a zip). On Windows, unzipping can leave a folder inside a folder of the same name; run `dir` and go one level deeper until you see the three files.
2. Install Cloudflare's command line and sign in (a browser window opens):

   ```bash
   npm install -g wrangler
   ```

   ```bash
   wrangler login
   ```

   The install may warn that the install scripts of `esbuild` and `workerd` were not run; the deploy works without them.

3. Create the device store:

   ```bash
   wrangler kv namespace create DEVICES
   ```

   It prints a snippet with an `id` (32 letters and digits). Open `wrangler.toml` and paste the id where it says `PASTE-THE-KV-NAMESPACE-ID-HERE`.
4. In `wrangler.toml`, paste the **Application (client) ID** from step 1.3 where it says `PASTE-THE-APPLICATION-CLIENT-ID-HERE`. Leave `ALLOWED_ORIGINS` as it is.
5. Deploy:

   ```bash
   wrangler deploy
   ```

   The first time, it asks for your account's `workers.dev` subdomain: type one short name only (lowercase letters, digits, dashes; for example `eveniunt-sync`), not a whole address. "is invalid" also means the name is already taken; try another. It then prints the helper's address, like `https://eveniunt-sync-helper.<your-subdomain>.workers.dev`. This is value 2.
6. Open that address in a browser: it should show one line, "Eveniunt Command Center sync helper. Nothing to see here…". With a brand-new subdomain the secure connection can fail for the first 5 to 15 minutes; wait and reload.
7. Give the helper the client secret (you are asked to paste it; it is stored encrypted on Cloudflare and never written to a file):

   ```bash
   wrangler secret put MS_CLIENT_SECRET
   ```

That is all on Cloudflare. The free plan allows 100,000 requests a day; the Tracker uses a few dozen.

## 3. Tell the Tracker (the session does this)

Send the two values with your `ship`, for example:

```text
ship: clientId 11111111-2222-3333-4444-555555555555, helper https://eveniunt-sync-helper.example.workers.dev
```

The session writes them into `site-src/sync-config.json`, rebuilds the Tracker's site files, publishes, and merges. Then, on each device, open the Tracker, Settings → Cloud sync → **Sign in with Microsoft**: one sign-in, and that device syncs by itself from then on.

## 4. Phone notifications (Submersibles, once, about 15 minutes)

The helper can also tell your devices when submarines are back, even with the app closed. It keeps only the alert times, short labels ("Alpha Company · Sub One is back") and each device's notification address. You do this once, in the same folder as section 2.

1. Get the new helper files: download `worker.js`, `entry.js` and `make-push-key.js` from `tracker/helper/` in the public repository and put them in your helper folder, replacing the old `worker.js` and `entry.js`. Keep your own `wrangler.toml` (it has your ids).
2. Make the notification signing key on your computer and give it to the helper as a secret. The first command prints one long line starting with `{"kty":"EC"`; copy it, run the second command and paste the line when it asks for the value:

   ```bash
   node make-push-key.js
   ```

   ```bash
   wrangler secret put VAPID_JWK
   ```

   The key exists only on your computer's screen and, encrypted, on Cloudflare. Do not paste it anywhere else.
3. Open your `wrangler.toml` and add these lines: the first under `[vars]` (next to `ALLOWED_ORIGINS`), the other two at the end of the file:

   ```toml
   VAPID_SUBJECT = "https://splitzhappen.github.io/Eveniunt-Command-Center/"
   ```

   ```toml
   [triggers]
   crons = ["* * * * *"]
   ```

   The second part is a timer that runs the helper once a minute to send what is due.
4. Deploy again:

   ```bash
   wrangler deploy
   ```

5. On each device that should be told: open the Command Center → **Submersibles** → **Setup** → **Phone notifications** → **Turn on for this device**, allow notifications, then **Send a test**. The device needs cloud sync signed in once (Tracker, Settings, Cloud sync). On an iPhone or iPad, do this from the Command Center added to the home screen.

Free plan: the timer reads the schedule once a minute (about 1,440 reads a day of the 100,000 allowed) and writes only when something changed or was sent (well under the 1,000 writes a day allowed, even with 32 subs sent separately twice a day). If Cloudflare ever refuses, the app's own alerts and calendar entries keep working.

## What to expect afterwards

- A device that signed in never asks again, unless you sign out on it (Settings → Cloud sync), remove the app from your Microsoft account (account.microsoft.com → Privacy → Apps and services), or the device's browser storage is cleared. Then it asks for one tap.
- On an iPhone or iPad, each installed app (Safari, the installed Tracker, the installed Command Center) signs in separately once.
- Your old Google Drive copy is left where it is; it is not read any more. The first device that signs in creates the OneDrive copy from its own data, so sign in first on the device that has your fullest save.

## Files

| File | What it is |
|---|---|
| `worker.js` | The helper itself (also run by the tests in Node) |
| `entry.js` | Cloudflare's entry point, which loads `worker.js` |
| `wrangler.toml` | The helper's settings: name, the application ID, the allowed origin, the device store, the notification timer |
| `make-push-key.js` | Makes the signing key for phone notifications (section 4), on your computer |
| `../tests/helper.test.js` | Its tests, against a stand-in Microsoft |
