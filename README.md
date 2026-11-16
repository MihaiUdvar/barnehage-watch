# barnehage-watch

Checks [oslo.kommune.no/barnehage/ledige-barnehageplasser](https://www.oslo.kommune.no/barnehage/ledige-barnehageplasser/)
at 09:00 and 16:00 Oslo time for kindergarten places for children **under 3 år**, across all
bydeler, and emails you **only when the list changes**.

Runs on GitHub Actions for free. No server, no dependencies (plain Node 20+).

## What counts as "under 3 år"

A kindergarten is included when its text contains any of:

- `under 3 år` or `under tre år`
- `småbarnsplass` / `småbarn`
- an age range that starts below 3: `0-3 år`, `1–3 år`, `2–6 år`
- a birth year of a child who is still under 3: `født 2024`, `født i 2025`
  (born in the current year minus 2, or later)

Edit `mentionsUnder3()` in `ledige_parser.mjs` to change the rules, and
`test.mjs` to cover your change.

## How change detection works

Every run saves the matching kindergartens to `state/last.json` and the
workflow commits that file back to the repo. The next run compares against it.
You get an email when:

- a kindergarten appears that was not in the list before
- a kindergarten's text changes (for example 2 places becomes 3)
- a kindergarten disappears from the list

The very first run has no previous state and sends one email with the full
current list. That email also confirms the setup works.

## Files

| File | Purpose |
|------|---------|
| `check.mjs` | Main script: fetch, parse, compare, email, save state |
| `ledige_parser.mjs` | HTML parser and the "under 3" matcher |
| `email.mjs` | Sends email through Resend or Brevo |
| `test.mjs` | Unit tests, run with `node test.mjs` |
| `.github/workflows/check.yml` | Schedule (09:00 and 16:00 Oslo time) and the commit-back step |
| `state/last.json` | Last seen list, written by the workflow |

## Setup

### 1. Push this folder to a new GitHub repository

```bash
cd barnehage-watch
git init
git add .
git commit -m "Initial barnehage watcher"
git branch -M main
git remote add origin https://github.com/<your-user>/barnehage-watch.git
git push -u origin main
```

A private repo is fine. Private repos get 2000 free Actions minutes per month,
and this uses roughly 20 seconds per run, so around 20 minutes per month.

### 2. Choose an email provider and get an API key

You need one of the two. Both have a free tier that is far more than enough.

#### Option A: Resend

1. Sign up at <https://resend.com> **using freeride.mihai@gmail.com**.
   Without a verified domain, Resend only delivers to the address you
   signed up with. That is fine here because you are the only recipient.
2. Go to **API Keys**, create a key with "Sending access", copy it.
3. Use these secret values:

   | Secret | Value |
   |--------|-------|
   | `EMAIL_PROVIDER` | `resend` |
   | `EMAIL_API_KEY` | the key, starts with `re_` |
   | `EMAIL_FROM` | `onboarding@resend.dev` |
   | `EMAIL_TO` | `freeride.mihai@gmail.com` |

   If you own a domain and verify it in Resend, you can set `EMAIL_FROM` to
   an address on that domain and send to anyone.

#### Option B: Brevo

1. Sign up at <https://www.brevo.com> (free plan, 300 emails per day).
2. Go to **Senders & IP** (under your profile menu) and add
   `freeride.mihai@gmail.com` as a sender. Brevo emails you a confirmation
   link. Click it. You can use any address you can read mail at, it does not
   need a custom domain.
3. Go to **SMTP & API**, tab **API Keys**, generate a new key, copy it.
4. Use these secret values:

   | Secret | Value |
   |--------|-------|
   | `EMAIL_PROVIDER` | `brevo` |
   | `EMAIL_API_KEY` | the key, starts with `xkeysib-` |
   | `EMAIL_FROM` | `freeride.mihai@gmail.com` (the sender you verified) |
   | `EMAIL_TO` | `freeride.mihai@gmail.com` |

Brevo may land in the Gmail spam folder the first time because the sender
and recipient are the same Gmail address. Mark it "Not spam" once.

### 3. Add the four secrets to GitHub

In the repository: **Settings → Secrets and variables → Actions →
New repository secret**. Add `EMAIL_PROVIDER`, `EMAIL_API_KEY`, `EMAIL_FROM`
and `EMAIL_TO` with the values from the table above.

### 4. Run it once by hand

**Actions → Check ledige barnehageplasser → Run workflow → Run workflow**.

Within a minute you should get the "første oversikt" email, and a new
commit "Update state ..." appears in the repo. From then on it runs on
schedule and only emails when something changes.

Tick the **force** box when running by hand if you want an email even
though nothing changed, for example to test a new provider.

## Running locally

```bash
node test.mjs                    # unit tests
node check.mjs --dry-run         # fetch live page, print the email, save state
node check.mjs --dry-run --no-save
```

To really send from your machine, set the four variables first:

```powershell
$env:EMAIL_PROVIDER="resend"; $env:EMAIL_API_KEY="re_..."; $env:EMAIL_FROM="onboarding@resend.dev"; $env:EMAIL_TO="freeride.mihai@gmail.com"
node check.mjs --force
```

## Things to know

- **Schedule drift.** GitHub runs cron jobs when it has capacity. Expect
  runs 5 to 30 minutes after the scheduled time, and occasionally a skipped
  run during peak load. For a twice-daily check this does not matter.
- **Inactive repos.** GitHub disables scheduled workflows after 60 days
  without any commits by a person. The state commits made by the workflow may
  not count. If the page is quiet for two months, GitHub emails you that the
  workflow was disabled, and you re-enable it with one click under Actions.
  Any small commit of your own also resets the clock.
- **Page layout changes.** If the kommune redesigns the page and the parser
  finds zero kindergartens, the run fails with exit code 2 instead of
  silently saving an empty list. GitHub emails you about failed runs.
- **Changing the schedule.** The workflow runs at 09:00 and 16:00 Oslo time.
  GitHub cron only knows UTC, so the cron line lists both possible UTC hours
  for each Oslo hour (`0 7,8,14,15 * * *`) and the "Oslo time gate" step
  skips the runs where the Oslo clock is not 9 or 16. To change the times,
  edit both the cron line and the two hours in that step. The skipped runs
  take a few seconds and cost nothing.
