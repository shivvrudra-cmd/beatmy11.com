# How to roll back beatmy11.com

Use this when a change that went live is broken and you want the previous version back quickly.
Nothing here deletes anything.

## What "live" is

Merging a pull request into `master` on GitHub makes Cloudflare build and publish the site
(Workers Builds, worker `beatmy11`). Every publish is kept by Cloudflare as a numbered **version**.

## Fastest: roll back in the Cloudflare dashboard (about one minute)

1. Open the Cloudflare dashboard → **Workers & Pages** → **beatmy11**.
2. Open the **Deployments** tab. The top entry is what is live now; older ones are below.
3. On the last version that worked, choose **Rollback to this version** (the "…" menu) and confirm.
4. Load `https://beatmy11.com/` and `https://beatmy11.com/api/health` to check.

This changes only which version Cloudflare serves. GitHub is untouched, so the **next merge to
`master` will publish the broken code again** unless it is also undone there (next section).

## Then: undo the change on GitHub

1. Open the pull request that caused the problem on GitHub.
2. Press **Revert**. GitHub opens a new pull request that undoes it.
3. Merge that pull request. Cloudflare publishes the reverted code; `master` and live match again.

From a terminal the same thing is:

```bash
git checkout master && git pull
git checkout -b revert/<what>
git revert -m 1 <merge commit>
git push -u origin revert/<what>
```

then open and merge the pull request.

## What a rollback does not undo

- **The database.** D1 (table `drafts`, table `events`) is not versioned with the code. A rollback
  keeps all rows. A database migration, once applied, is not rolled back by any of the above;
  that is why migrations are never applied unattended.
- **Visitors' browsers.** Saved drafts and streaks live on each visitor's device. An older version
  of the site reads them as it did before.
- **Caches.** Pages are served with "revalidate every time", so visitors get the rolled-back
  version on their next load. Files under `/_astro/` are cached for a year but have a unique name
  per build, so an old page always asks for its own old files, which the old version still has.

## How to tell which version is live

```bash
gh api repos/shivvrudra-cmd/beatmy11.com/commits/master/check-runs --jq '.check_runs[]|[.name,.status,.conclusion]|@tsv'
```

shows whether the build for the newest commit on `master` succeeded. The Deployments tab shows
the commit each version was built from.
