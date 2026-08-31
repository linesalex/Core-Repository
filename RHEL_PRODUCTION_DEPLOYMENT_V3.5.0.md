# Network Inventory v3.5.0 → v3.5.3 — RHEL 7 Production Deployment Guide

**Supersedes `RHEL_PRODUCTION_DEPLOYMENT_V3.3.3.md`.** Originally rewritten against the **actual observed state** of `sni1-ipclon7`, not the assumptions the v3.3.3 guide carried forward — several of those assumptions turned out to be wrong on the real box, which is what caused the v3.5.0 deployment failures documented below.

**✅ v3.5.0 status: deployed and verified on `sni1-ipclon7`.** Every fix in this guide (Node 16.20.2, `bcryptjs`, `d3-force@2.1.1`, lazily-loaded `puppeteer@21.11.0`, and whichever PDF render option was chosen in Step 5) is live in production. Steps 0-8 and the Troubleshooting section below are kept as-is as the **historical record and reference** for that work — you should not need to repeat any of it.

**🔁 Now updating to v3.5.2 / v3.5.3.** See the new section immediately below. Unlike the v3.5.0 jump, this update is **application code only** — it does not require upgrading Node, npm, Chromium, or any system package, and does not need `g++` or a subscription. Everything the v3.5.0 effort fixed stays exactly as configured.

---

## 🔁 **Updating this host to v3.5.2 / v3.5.3**

### Why no system upgrade is needed this time

v3.5.1, v3.5.2, and v3.5.3 are pure application-code releases. None of them touch any of the runtime requirements the v3.5.0 effort fixed:

| | v3.5.1 | v3.5.2 | v3.5.3 |
|---|---|---|---|
| New npm dependency | No — reuses `all-the-cities`, already a `backend` dependency since before v3.5.0 | No | No |
| New native/compiled module | No | No | No |
| New DB migration | No | Yes — `051_add_latency_matrix_daily_low.js` (auto-applies at boot, tracked in the `migrations` table, no manual step) | No |
| Node / Puppeteer / Chromium / glibc requirement | Unchanged | Unchanged | Unchanged |

Confirm the host still matches what v3.5.0 left it in before you start — if any of these don't match, treat it as a regression and fix it first, not as an expected part of this update:

```bash
node -v                                    # still v16.20.2
npm -v                                     # still 8.x
grep '"d3-force"' backend/package.json    # still ^2.1.1, not 3.x
grep '"bcryptjs"' backend/package.json    # still present; "bcrypt" absent
npm ls puppeteer                          # still 21.11.0 (or absent if you run Option 2/3/4)
grep lockfileVersion backend/package-lock.json   # still 2
pm2 env network-backend | grep -E 'PUPPETEER_EXECUTABLE_PATH|PDF_RENDER_SIDECAR'   # still whichever Option 1-4 you set up
```

### What's actually changing (functional summary)

**v3.5.1 — Network Map Export: geographic layout & full-text Route Schedule**
- POP nodes are now positioned by real-world latitude/longitude (from `location_reference`, or auto-geocoded via the existing `all-the-cities` package) instead of pure force-directed physics, so diagrams read like an actual map instead of wherever the physics settled
- Route Schedule switched from a truncating grid table to one full-text line per route, so long carrier/UCN values are never cut off
- Several same-day rounds of spacing/curve/tag-placement tuning for dense clusters (per-edge bezier curves colored/weighted by bandwidth, badges that slide along their own line)
- New file: `backend/utils/cityGeocoder.js`

**v3.5.2 — Live Latency Matrix: 30-Day Low tab & customer-facing PDF export**
- New **"30-Day Low (1Gb)"** tab on the Home page latency matrix, tracking a rolling 30-day minimum per source/destination pair
- New **"Export PDF (Last 30 Days)"** button — renders through the **same** sidecar-or-local-Puppeteer pipeline (`backend/pdfRenderClient.js`) already set up for the Network Map export in Step 5 below, so whichever PDF option you already run needs **no reconfiguration** — just re-verification once this update is deployed
- New migration: `backend/migrations/051_add_latency_matrix_daily_low.js`
- New file: `backend/latencyMatrixPdfRenderer.js`

**v3.5.3 — Network Map Export: export by specific POPs**
- The Export Network Map dialog gets a **"By Region" / "By Specific POPs"** toggle — pick individual POPs via type-ahead search (POP code, datacenter name, or city) instead of whole regions, with off-page reference handling for routes that touch an unselected POP
- New endpoint `GET /network_routes_pop_search`; the existing export logic was refactored into a shared `finishNetworkMapExport()` so both modes render through identical code
- No new dependencies, no migration

### Update procedure

```bash
# 1. Back up first
cd /root
pm2 save
cp -a Core-Repository Core-Repository.backup.$(date +%Y%m%d)
cp Core-Repository/network_routes.db /root/network_routes.db.backup.$(date +%Y%m%d)

# 2. Deploy the new code (however you transfer it - git pull / scp / archive)
cd /root/Core-Repository
# git pull origin main

# 3. Confirm the sync actually took - same class of check as Step 3 below
grep '"version"' backend/package.json frontend/package.json    # both -> 3.5.3
grep -c "051_add_latency_matrix_daily_low" backend/migrations/*.js 2>/dev/null | grep -v ':0' || echo "MISSING v3.5.2 migration - sync did not take"

# 4. Backend deps - same install command family you used for v3.5.0; no g++/native build involved
cd backend
rm -rf node_modules
PUPPETEER_SKIP_DOWNLOAD=true npm ci    # Option 1 hosts (native el7 Chromium)
# npm ci --no-optional                 # Options 2/3/4 hosts (sidecar / disabled)

# 5. Smoke test before touching PM2
node index.js
# Expected: starts on :4000 with no errors. Watch the console for the migration
# runner applying 051_add_latency_matrix_daily_low.js - it only ever runs once
# (tracked in the `migrations` table), so this is safe against production data
# and safe to re-run if the process restarts mid-migration.
# Ctrl+C once confirmed.

# 6. Frontend rebuild - unchanged process from Step 6 below
cd ../frontend
npm install
export NODE_OPTIONS="--max-old-space-size=2048"
npm run build
unset NODE_OPTIONS
ls -lh build/index.html

# 7. Restart both apps via the config file, not by app name - see Step 7's warning
cd /root/Core-Repository
pm2 restart ecosystem.config.js --env production
pm2 save
pm2 list    # both online, 0 unexpected restarts
```

### Verification

```bash
curl -s http://localhost:4000/health
pm2 logs network-backend --lines 50 | grep -i "051_add_latency_matrix_daily_low"
```

- [ ] Home page shows the new **"30-Day Low (1Gb)"** tab next to the existing 1Gb/10Gb tabs
- [ ] **"Export PDF (Last 30 Days)"** on the Live Latency Matrix produces a one-page PDF — this exercises the same Puppeteer/sidecar path as the Network Map export; if it fails, re-check your existing Option 1-4 setup (Step 5), it did **not** need to change
- [ ] Network Routes Repository → Export Network Map dialog shows the new **"By Region" / "By Specific POPs"** toggle, and a specific-POPs export downloads correctly
- [ ] `pm2 list` shows both apps `online` with 0 unexpected restarts a few minutes after the restart

If anything fails, the **Troubleshooting** section further down still applies as-is — this update doesn't touch Node, Chromium, bcrypt, or d3-force, so none of those failure modes changed.

---

## 📜 v3.5.0 deployment reference (completed — kept for history & troubleshooting)

Everything from here through the Success checklist documents the original v3.5.0 system setup on `sni1-ipclon7`. It's the reason Node, Chromium, and the native-module choices are what they are today — read it if something in the verification table above doesn't match, or if you land here from a troubleshooting link, but you do **not** need to re-run Steps 0-2 (repo cleanup, Node upgrade, system packages) for the v3.5.2/v3.5.3 update above.

---

## 🧭 **Observed host reality (verify before you start)**

| Fact | v3.3.3 guide assumed | Actually on the box | Consequence |
|---|---|---|---|
| Node.js | 16.20.2 at `/opt/nodejs` | **14.21.3 at `/usr/local/bin/node`** | `puppeteer-core` uses `??=` (needs Node 15+) → backend crashed on boot |
| npm | 8.x | **6.14.18** | Cannot read `lockfileVersion: 3` → `npm ci` failed |
| glibc | 2.17 | 2.17 (kernel 3.10.0-1062.9.1.el7) | Node ≥18 and modern Chromium can't run here |
| `gcc-c++` / `g++` | installed (Step 1) | **not installed** | `bcrypt` native build failed (`make: g++: Command not found`) |
| Subscription | (not considered) | **not registered** | No `base` / `extras` / `optional` channels → Docker deps unavailable |
| Repos | EPEL healthy | EPEL archive-only, **`repo.ius.io` returns 404** | Every `yum` run errors; some packages unobtainable |

Run these first and confirm they match before following any step below:

```bash
cat /etc/redhat-release          # Red Hat Enterprise Linux Server release 7.x
ldd --version | head -1          # glibc 2.17
which node && node -v            # /usr/local/bin/node -> v14.21.3 (pre-upgrade)
npm -v                           # 6.14.18 (pre-upgrade)
which g++ || echo "g++ MISSING"
subscription-manager status || echo "NOT REGISTERED"
free -h && df -h /root           # >=4GB RAM, >=15GB free
```

---

## 🚨 **What v3.5.0 changed, and why it broke**

v3.5.0 added the **PDF Network Map Export** feature (`backend/networkMapRenderer.js`), which introduced `puppeteer` and `d3-force`. That created **four independent problems** on this host, each of which was masking the next — which is why the deployment appeared to fail repeatedly "for the same reason":

1. **Node version.** `puppeteer@23.x` (originally pinned) requires Node ≥18; even the corrected `puppeteer@21.11.0` requires Node ≥16.13.2. This box runs **Node 14.21.3**, so `require('puppeteer')` threw `SyntaxError: Unexpected token '??='` and took the **whole backend** down over one export feature.
   **Fixed in code:** `puppeteer` is now pinned to `21.11.0`, moved to `optionalDependencies`, and **loaded lazily** — the backend now boots even if puppeteer is missing or unloadable.
2. **Puppeteer's *bundled* Chromium can't run here.** "Chrome for Testing" needs **glibc ≥2.27**; RHEL 7 has **2.17**, and no npm version changes that. But a Chromium *compiled for el7* runs fine — EPEL ships one, and its install failed only on three missing leaf libraries, not on anything structural.
   **Two supported answers (Step 5):** point Puppeteer at EPEL's el7 Chromium via `PUPPETEER_EXECUTABLE_PATH` (recommended — stays on this box), or delegate rendering over HTTP to `backend/pdf-render-sidecar/` via `PDF_RENDER_SIDECAR_URL`.
3. **`d3-force@3.x` is ESM-only.** `require()` of an ES module only works from Node 22.12 onward, so on Node 16 the renderer threw `ERR_REQUIRE_ESM` at boot — again taking the whole backend down. This was invisible until the `puppeteer` require (one line earlier) stopped crashing first.
   **Fixed in code:** pinned to **`d3-force@^2.1.1`**, the last CommonJS release, with an identical API for the forces used here. Verified end to end by generating a real multi-page PDF under Node-16 module semantics.
4. **`bcrypt@6.0.0`** requires Node ≥18 *and* compiles natively (needs `g++`, absent). The old guide worked around this with a `sed` on `auth.js` only — but `backend/migrations/045_add_voice_guest_account.js` also required `bcrypt`, so that migration would fail at runtime.
   **Fixed in code:** the repo now uses **`bcryptjs`** (pure JS) in `package.json`, `auth.js`, **and** migration 045. **No `sed` step is needed anymore.**

---

## ✅ **Step 0: Quiet the broken repo**

The dead IUS repo injects a 404 into every `yum` transaction and makes real errors hard to read:

```bash
sudo yum-config-manager --disable ius 2>/dev/null || sudo mv /etc/yum.repos.d/ius.repo /root/ius.repo.disabled
sudo yum clean all && sudo yum repolist
```

---

## 🟢 **Step 1: Upgrade Node.js 14 → 16.20.2 (REQUIRED)**

Node 16 is the **newest Node that runs on RHEL 7**: releases up to v16 were built on CentOS 7/RHEL 7 (glibc ≥2.17), while **Node 18+ was moved to RHEL 8 and requires glibc ≥2.28**, so it can never run here. Node 16.20.2 fixes both the `??=` syntax error and the `lockfileVersion` problem (it ships npm 8).

Node 14 lives at `/usr/local`, and `pm2` / `serve` are installed as globals under `/usr/local/lib/node_modules`. Upgrading **in place at `/usr/local`** keeps those globals, their symlinks, and the PM2 systemd unit working — do **not** install to `/opt/nodejs` unless you're prepared to reinstall the global tools.

**⚠️ Stop every Node process first.** Linux refuses to overwrite the binary of a running executable (`cp: cannot create regular file '/usr/local/./bin/node': Text file busy`). The PM2 daemon *is itself* a Node process, so `pm2 stop all` is **not** enough — you need `pm2 kill`. The apps have to restart under the new Node anyway, so plan on a short outage here.

```bash
# Back up the current binary so you can roll back (reading a running binary is fine)
cp -a /usr/local/bin/node /root/node-14.21.3.bak
node -v > /root/node-version-before-upgrade.txt

cd /tmp
wget https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz
tar -xJf node-v16.20.2-linux-x64.tar.xz

# Release the binary: stops both apps AND the PM2 daemon itself
cd /root/Core-Repository
pm2 kill
pgrep -a node || echo "OK - no node processes running"

# Delete the OLD npm tree and CLI links first. `cp -a` merges directories - it
# overwrites what the source contains but never removes stale files, so copying
# npm 8 on top of npm 6 leaves a mix of two incompatible dependency trees and
# npm starts failing inside its own bundled modules. pm2/serve are separate
# directories under lib/node_modules and are NOT affected by this.
sudo rm -rf /usr/local/lib/node_modules/npm
sudo rm -f /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx

# Now overlay onto /usr/local
cd /tmp
sudo cp -a node-v16.20.2-linux-x64/. /usr/local/
echo "cp exit code: $?"        # must be 0

hash -r
node -v    # v16.20.2
npm -v     # 8.x.x
```

**Leave the apps stopped for now** — they're restarted in Step 7, after the v3.5.0 code and dependencies are in place. Just confirm the toolchain survived the upgrade:

```bash
pm2 -v            # PM2 responds (it will start a fresh daemon under Node 16)
serve --version
```

**Rollback if anything goes wrong:** `pm2 kill && sudo cp -a /root/node-14.21.3.bak /usr/local/bin/node && hash -r && node -v`

> **If you can't take the outage right now,** rename the binary instead of overwriting it — Linux allows renaming a running executable, just not writing into it. Running processes keep using the old inode until they restart:
>
> ```bash
> sudo rm -rf /usr/local/lib/node_modules/npm
> sudo mv /usr/local/bin/node /usr/local/bin/node-14.21.3
> sudo cp -a /tmp/node-v16.20.2-linux-x64/. /usr/local/
> hash -r && node -v
> pm2 update    # respawns the PM2 daemon under Node 16
> ```
>
> Any process spawned during the second or two between those first two commands will fail with "node: command not found", so prefer the `pm2 kill` path when you can. Note this variant still needs the `rm -rf /usr/local/lib/node_modules/npm` step above, for the same reason.

Verify the result is coherent before moving on — a merged npm tree can report a plausible version and still be broken:

```bash
node -v                        # v16.20.2
npm -v                         # 8.19.4
npm ls -g --depth=0            # must list pm2 and serve, with no errors
npm config get prefix           # /usr/local
```

---

## 📦 **Step 2: System dependencies**

The v3.3.3 guide claimed to install these, but `g++` was missing on the box — so the build toolchain was never actually installed. It's only needed if a native module has to compile from source (`sqlite3` normally installs a prebuilt binary), but install it so failures aren't silent:

```bash
sudo yum install -y epel-release
sudo yum install -y make gcc gcc-c++ autoconf automake libtool \
    python-devel openssl-devel sqlite-devel curl wget unzip tar
g++ --version   # must now succeed
```

> If `gcc-c++` is unavailable (unregistered system, no base channel), you can still proceed: with `bcryptjs` replacing `bcrypt` and `sqlite3` using its prebuilt binary, v3.5.0 no longer needs a compiler.

---

## 📁 **Step 3: Deploy the application files**

```bash
pm2 stop all && pm2 delete all

cd /root
[ -d Core-Repository ] && mv Core-Repository Core-Repository.backup.$(date +%Y%m%d)

# Transfer v3.5.0 (git archive / zip / scp)
# scp -r Core-Repository/ root@172.30.252.118:/root/

cd /root/Core-Repository

# Restore data if upgrading
# cp ../Core-Repository.backup.*/network_routes.db ./
# cp ../Core-Repository.backup.*/backend/kmz_files/*.kmz backend/kmz_files/
# cp ../Core-Repository.backup.*/backend/templates/*.kmz backend/templates/
```

**⚠️ Sync discipline — this caused two failed attempts.** If you deploy by zip/scp rather than a live pull, stale files do **not** update themselves, and `npm install` will report "nothing changed" while still using the old versions. These are the v3.5.0 files that carry the fixes:

| File | Must contain |
|---|---|
| `backend/package.json` | `bcryptjs`, no `bcrypt`, `sqlite3` = `5.0.2`, `d3-force` = `^2.1.1` (**not** 3.x, which is ESM-only), `puppeteer` under `optionalDependencies` |
| `backend/package-lock.json` | `lockfileVersion: 2` |
| `backend/auth.js` | `require('bcryptjs')` |
| `backend/migrations/045_add_voice_guest_account.js` | `require('bcryptjs')` — **missed by the old `sed` workaround** |
| `backend/networkMapRenderer.js` | `require('puppeteer')` only inside `loadPuppeteer()` |
| `backend/pdfRenderClient.js` | sidecar client (token support) |
| `backend/checkPdfRender.js` | render diagnostic (new file — used in Step 5) |
| `backend/pdf-render-sidecar/` | `Dockerfile`, `server.js`, `package.json` |
| `ecosystem.config.js` | the PDF render env var for your chosen option |

Verify all of it in one pass:

```bash
cd /root/Core-Repository
grep -E '"puppeteer"|"bcryptjs"|"bcrypt"|"sqlite3"|"d3-force"' backend/package.json
grep lockfileVersion backend/package-lock.json      # 2 (npm 6 AND npm 8 can read this)
grep -c bcryptjs backend/auth.js backend/migrations/045_add_voice_guest_account.js   # 1 and 1
grep -n "require('puppeteer')" backend/networkMapRenderer.js   # must be INSIDE loadPuppeteer()
test -f backend/checkPdfRender.js && echo "checkPdfRender.js present"
grep -E 'PUPPETEER_EXECUTABLE_PATH|PDF_RENDER_SIDECAR_URL' ecosystem.config.js
```

---

## 🏗️ **Step 4: Backend setup**

`bcrypt` is gone from the repo, so **no `sed` on `auth.js` and no `npm uninstall bcrypt` are needed** — those steps from the v3.3.3 guide are obsolete and actively harmful (they mutate `package.json` and desync it from the lockfile).

> **Existing logins are unaffected.** `bcryptjs` reads the `$2b$` hashes `bcrypt` wrote, so stored passwords stay valid and no password resets are required. This was verified against the production database's `admin` hash.

**Decide your PDF render option (Step 5) before installing**, because it determines whether `puppeteer` is needed. Run **one** of these, not both:

```bash
cd /root/Core-Repository/backend
rm -rf node_modules

# Option 1 (native el7 Chromium - recommended): puppeteer IS needed. The env var
# is essential - it prevents downloading the bundled Chromium that glibc 2.17
# can't run, while still installing the library that drives your local browser.
PUPPETEER_SKIP_DOWNLOAD=true npm ci

# --- OR ---

# Options 2/3/4 (sidecar or disabled): puppeteer is not needed at all. Skips a
# ~300MB package; the lazy loader in networkMapRenderer.js handles its absence.
npm ci --no-optional
```

Then verify and smoke-test, regardless of which you ran:

```bash
# sqlite3 is pinned to 5.0.2 in package.json, so no manual install step is
# needed - it fetches a prebuilt napi-v3 binary and never invokes a compiler.
npm ls bcryptjs sqlite3

# Initialize database (first-time installs only — skip when upgrading!)
# node init_db.js

# Smoke test - this is the check that the v3.5.0 boot crash is gone
node index.js
# Expected: starts on port 4000 with NO SyntaxError, and no "Cannot find module
# 'bcrypt'" from migration 045. Ctrl+C to stop.
```

If `npm ci` still complains about the lockfile, fall back to `npm install` with the same option-appropriate flags (it will rewrite the lockfile locally, which is fine on a deployment host):

```bash
rm -f package-lock.json
PUPPETEER_SKIP_DOWNLOAD=true npm install     # Option 1
# or
npm install --no-optional                    # Options 2/3/4
```

---

## 🖨️ **Step 5: PDF Network Map Export — pick one option**

Puppeteer's **own bundled** Chromium can't run here (it needs glibc ≥2.27; this host has 2.17), but that does **not** mean no Chromium can run here — EPEL ships a Chromium *compiled for el7*, which is the basis of the recommended option below. `backend/networkMapRenderer.js` supports all four paths, selected purely by environment variables, with **no code changes**.

| Option | How | Needs | Effort / risk |
|---|---|---|---|
| **1. Native el7 Chromium** *(recommended)* | Install EPEL's `chromium-headless` + 3 leaf libs, point `PUPPETEER_EXECUTABLE_PATH` at it | Nothing extra | Low — stays on this box, no subscription, no Docker |
| **2. Remote sidecar** | Run `backend/pdf-render-sidecar/` elsewhere, point `PDF_RENDER_SIDECAR_URL` at it | A second host with Docker or Node ≥18 | Low — but needs another machine |
| **3. Local Docker sidecar** | Register the subscription, enable `rhel-7-server-extras-rpms`, install Docker CE | RHEL entitlements | Medium — Docker won't install without them |
| **4. Disabled** | Set neither variable | Nothing | None — export returns a clear error, everything else works |

**Do the setup for your chosen option below first**, then prove it with the bundled diagnostic before wiring anything into PM2. `checkPdfRender.js` runs the exact same code path as the real export, so a `PASS` means the feature works:

```bash
cd /root/Core-Repository/backend
PUPPETEER_EXECUTABLE_PATH=<path from the setup below> node checkPdfRender.js
# or:  PDF_RENDER_SIDECAR_URL=http://<host>:5051 node checkPdfRender.js
# PASS -> wrote NNNNN bytes to /tmp/pdf-render-check.pdf
```

> Running this **before** installing Chromium fails with `PUPPETEER_EXECUTABLE_PATH does not exist`. That's expected — the diagnostic will list any browsers it can find on the host, or the commands to install one. Don't guess the path; get it from `rpm -ql` as shown below.

### **Option 1 — native el7 Chromium (recommended)**

Your own failed `yum install chromium-headless` output is the evidence this works: it offered **`chromium-headless-126.0.6478.114-1.el7.x86_64`** — a Chromium *built for el7 against glibc 2.17*. It failed only on three missing libraries, none of which are Chromium itself:

| Missing | Provided by | What it is |
|---|---|---|
| `libFLAC.so.8` | `flac-libs` | audio codec |
| `libopus.so.0` | `opus` | audio codec |
| `libatomic.so.1(LIBATOMIC_1.0)` | `libatomic` | GCC runtime library |

These are ordinary public CentOS 7 packages, and unlike Docker's `container-selinux` they're harmless leaf libraries — no SELinux policy, no kernel or container interaction. Pull just those three from the CentOS vault using a repo that stays **disabled by default**, so it can never affect any other transaction:

```bash
sudo tee /etc/yum.repos.d/centos7-vault.repo > /dev/null << 'EOF'
[centos7-vault]
name=CentOS 7.9 base (vault) - disabled, for explicit --enablerepo use only
baseurl=http://vault.centos.org/7.9.2009/os/x86_64/
enabled=0
gpgcheck=1
gpgkey=http://vault.centos.org/7.9.2009/os/x86_64/RPM-GPG-KEY-CentOS-7
EOF

# Only these three, only from that repo
sudo yum --enablerepo=centos7-vault install -y libatomic flac-libs opus

# Now Chromium's dependencies resolve
sudo yum install -y chromium-headless
```

**Now find the actual binary path — do not assume it.** The exact filename varies between EPEL builds, so read it from the installed package rather than copying a path from this guide:

```bash
# 1. Confirm the package is actually installed (if this fails, the install above didn't work)
rpm -q chromium-headless

# 2. List every executable file it shipped
rpm -ql chromium-headless | while read f; do [ -f "$f" ] && [ -x "$f" ] && echo "$f"; done

# 3. Widen the net if nothing obvious appears
ls -la /usr/lib64/chromium-browser/ 2>/dev/null
find /usr -name 'headless_shell' -o -name 'chrome-headless' -o -name 'chromium-browser' 2>/dev/null
```

Most builds use `/usr/lib64/chromium-browser/headless_shell`. If yours ships the full browser instead (`chromium-browser`), that works too — Puppeteer launches it with `headless: true`. Export whichever you found and confirm it resolves its libraries:

```bash
CHROME=/usr/lib64/chromium-browser/headless_shell     # <-- substitute YOUR path
ldd "$CHROME" | grep -i "not found" \
  && echo "STILL MISSING LIBS (above)" || echo "OK - all libraries resolved"
```

Make sure Puppeteer itself is installed — **without** its unusable bundled browser — then run the diagnostic:

```bash
cd /root/Core-Repository/backend
npm ls puppeteer || PUPPETEER_SKIP_DOWNLOAD=true npm ci

PUPPETEER_EXECUTABLE_PATH="$CHROME" node checkPdfRender.js
```

> Use `npm ci`, **not** `npm install puppeteer@21.11.0`. The latter would move `puppeteer` from `optionalDependencies` into `dependencies`, rewriting `package.json` and desyncing it from the lockfile — the same class of drift that broke the earlier attempts.

A `PASS` means you're done — add **your** path to `ecosystem.config.js` (both `env` and `env_production`) and **remove `PDF_RENDER_SIDECAR_URL`**, since a configured sidecar takes precedence over the local browser:

```javascript
        PUPPETEER_EXECUTABLE_PATH: '/usr/lib64/chromium-browser/headless_shell'
```

> **On version drift:** `puppeteer@21.11.0` normally pairs with Chrome 121, so driving Chromium 126 is a mismatch in principle. In practice this renderer only uses `setContent()` and `page.pdf()`, which are stable across releases — verified by driving Chrome 148 with this exact Puppeteer version successfully. `checkPdfRender.js` tells you definitively in a few seconds; if it fails on protocol errors, use Option 2.

### **Option 2 — remote sidecar**

`backend/pdf-render-sidecar/` is a small Express + Puppeteer service that turns HTML into a PDF. It only needs to be reachable from this box over HTTP.

On the **render host** (any Linux/Windows machine with Docker, or plain Node ≥18):

```bash
# With Docker:
cd Core-Repository/backend/pdf-render-sidecar
docker build -t network-inventory-pdf-sidecar .
docker run -d --name pdf-sidecar --restart unless-stopped \
  -p 5051:5051 -e HOST=0.0.0.0 network-inventory-pdf-sidecar

# Without Docker (Node >= 18 host):
cd Core-Repository/backend/pdf-render-sidecar
npm install
HOST=0.0.0.0 PORT=5051 node server.js

curl http://localhost:5051/health     # {"status":"ok"}
```

Then on **this** box, point the backend at it and lock the port down to that host only:

```bash
# In /root/Core-Repository/ecosystem.config.js, network-backend env:
#   PDF_RENDER_SIDECAR_URL: 'http://<RENDER_HOST_IP>:5051'
curl http://<RENDER_HOST_IP>:5051/health   # must succeed from this box
```

Because the sidecar has no authentication by default, either keep it on a trusted internal network, restrict it with a firewall rule to this server's IP, or enable the shared token — **both sides must be set or you'll get a 401**:

```bash
# On the sidecar host:
docker run -d --name pdf-sidecar --restart unless-stopped -p 5051:5051 \
  -e SIDECAR_AUTH_TOKEN='<long-random-string>' network-inventory-pdf-sidecar

# In ecosystem.config.js, network-backend env (both env and env_production):
#   PDF_RENDER_SIDECAR_TOKEN: '<the same long-random-string>'
```

### **Option 3 — local Docker sidecar (requires fixing entitlements first)**

Docker CE **will not install** while this system is unregistered. It needs `container-selinux`, `fuse-overlayfs`, and `slirp4netns`, which live in the RHEL 7 **extras** channel:

```bash
sudo subscription-manager register --username <user> --auto-attach
sudo subscription-manager repos --enable=rhel-7-server-extras-rpms
sudo yum install -y yum-utils
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
sudo yum install -y docker-ce docker-ce-cli containerd.io
sudo systemctl enable --now docker
docker --version
```

Then build/run the sidecar locally and use `PDF_RENDER_SIDECAR_URL: 'http://127.0.0.1:5051'`:

```bash
cd /root/Core-Repository/backend/pdf-render-sidecar
docker build -t network-inventory-pdf-sidecar .
docker run -d --name pdf-sidecar --restart unless-stopped \
  -p 127.0.0.1:5051:5051 network-inventory-pdf-sidecar
curl http://127.0.0.1:5051/health
```

> Grafting CentOS 7 `extras` onto RHEL to get Docker's three missing packages is technically possible but **not recommended** — `container-selinux` is an SELinux policy package, and mismatched policy on RHEL is a genuine risk. That's a very different proposition from the three leaf libraries in Option 1 (two audio codecs and a GCC runtime library). Register the system instead.

### **Option 4 — leave it disabled**

Leave both `PUPPETEER_EXECUTABLE_PATH` and `PDF_RENDER_SIDECAR_URL` unset and don't install puppeteer (`npm ci --no-optional`). The backend boots normally; every other v3.5.0 feature works. Clicking "Export Network Map" returns HTTP 500 with `Failed to generate network map PDF.`, and the backend log shows the actionable reason:

```
Local PDF rendering is unavailable on this host (Cannot find module 'puppeteer').
Set PDF_RENDER_SIDECAR_URL to render via the sidecar service instead...
```

---

## 🌐 **Step 6: Frontend setup (production build)**

Unchanged from v3.3.3 — production builds are mandatory; `npm start` will die with "JavaScript heap out of memory".

```bash
cd /root/Core-Repository/frontend
npm install

echo "REACT_APP_API_URL=http://172.30.252.118:4000" > .env

# Cesium assets for the KMZ Viewer (~50MB)
chmod +x setup-cesium.sh && ./setup-cesium.sh
ls public/cesium/            # ~387 files: Workers/ Assets/ Widgets/

# Production build (2-3 min; needs the temporary memory bump)
export NODE_OPTIONS="--max-old-space-size=2048"
npm run build
unset NODE_OPTIONS
ls -lh build/index.html      # must exist and be >1KB
```

Create `serve.json` (without it you get directory listings instead of the app):

```bash
cd /root/Core-Repository/frontend
cat > serve.json << 'EOF'
{
  "public": "build",
  "rewrites": [
    { "source": "**", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "**",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=0, must-revalidate" }
      ]
    },
    {
      "source": "static/**",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ],
  "directoryListing": false,
  "cleanUrls": false,
  "trailingSlash": false
}
EOF

npm install -g serve && serve --version
```

---

## 🚀 **Step 7: PM2 configuration**

Only one v3.5.0 change is needed versus v3.3.3: the PDF render setting on `network-backend`, in **both** `env` and `env_production`. Use `PUPPETEER_EXECUTABLE_PATH` for Option 1, `PDF_RENDER_SIDECAR_URL` for Options 2/3, or neither for Option 4. **Never set both** — a configured sidecar takes precedence over the local browser.

```javascript
    {
      name: 'network-backend',
      cwd: './backend',
      script: 'index.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 4000,
        JWT_SECRET: 'your-super-secure-jwt-secret-change-this-in-production',
        ENCRYPTION_KEY: 'hidden',

        // Option 1 (recommended on RHEL 7) - the local el7 Chromium. Use YOUR path.
        PUPPETEER_EXECUTABLE_PATH: '/usr/lib64/chromium-browser/headless_shell',

        // Options 2/3 instead - comment out the line above and uncomment these:
        // PDF_RENDER_SIDECAR_URL: 'http://<RENDER_HOST_IP>:5051',
        // PDF_RENDER_SIDECAR_TOKEN: '<matches the sidecar SIDECAR_AUTH_TOKEN>',

        // Option 4 - comment out all of the above; export reports itself unavailable.
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        ENCRYPTION_KEY: 'hidden',
        PUPPETEER_EXECUTABLE_PATH: '/usr/lib64/chromium-browser/headless_shell',
      },
      /* ...logging / restart settings unchanged... */
    },
```

Two things that bite here:

**Note every line ends with a comma**, including the last one before `}`. Trailing commas are valid JavaScript, and keeping them means you can comment or uncomment any single line without producing a malformed config. The usual failure is adding `PUPPETEER_EXECUTABLE_PATH` after a final property that has no comma.

**`env_production` must carry the same setting.** `--env production` makes PM2 use that block, so a variable present only in `env` is silently dropped.

This file is JavaScript, not JSON, so validate it before starting PM2 — this prints the exact line and column of any syntax error:

```bash
cd /root/Core-Repository
node --check ecosystem.config.js && echo "syntax OK"
node -e "const c=require('./ecosystem.config.js'); console.log(c.apps[0].env_production)"
```

The frontend app must keep using `npx serve` against the production build — **never** `npm start`:

```javascript
    {
      name: 'network-frontend',
      cwd: './frontend',
      script: 'npx',
      args: ['serve', '-p', '3000', '--no-clipboard'],
      /* ... */
    }
```

**⚠️ `pm2 restart network-backend` does NOT re-read `ecosystem.config.js`.** PM2 restarts from its own cached process list, so env changes are ignored. You must pass the config file:

```bash
cd /root/Core-Repository
mkdir -p logs
pm2 restart ecosystem.config.js --env production   # re-reads the file
pm2 save
pm2 env network-backend | grep -E 'PUPPETEER_EXECUTABLE_PATH|PDF_RENDER_SIDECAR'
```

That last command is the one that proves PM2 actually picked up your render setting — if it prints nothing, the app is running with the old environment and PDF export will fail no matter how the diagnostic behaved.

First-time setup instead:

```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup      # run the command it prints
```

---

## 🔍 **Step 8: Verification**

```bash
pm2 list
# network-backend  online   ~150MB   0 restarts
# network-frontend online   ~50MB    0 restarts   (NOT ~900MB)

pm2 logs network-backend --lines 30 | grep -i syntaxerror   # must be empty
curl http://localhost:4000/health                           # {"status":"ok"}
curl -I http://localhost:3000/                              # HTTP/1.1 200 OK
curl http://localhost:3000/ | head -5                       # <!DOCTYPE html>
```

Then in a browser at `http://172.30.252.118:3000`: log in (`admin` / `admin123`), confirm the KMZ Viewer renders the 3D globe, and — unless you chose Option 4 — that **Network Routes Repository → Export Network Map** downloads a valid PDF.

---

## 🛠️ **Troubleshooting (every error hit during this deployment)**

### `SyntaxError: Unexpected token '??='` in `puppeteer-core/lib/cjs/puppeteer/util/disposable.js`

**Cause:** Node < 15 (this box was on **14.21.3**) parsing logical-assignment syntax. Pinning puppeteer alone does **not** fix it — `puppeteer@21.11.0` still requires Node ≥16.13.2.
**Fix:** upgrade to Node 16.20.2 (**Step 1**). With the current code the backend no longer crashes either way, because puppeteer is loaded lazily — but confirm the version:

```bash
node -v                                    # must be >= v16.13.2
npm ls puppeteer                           # 21.11.0, or absent with --no-optional
grep -n "require('puppeteer')" backend/networkMapRenderer.js
# must appear INSIDE loadPuppeteer(), never at the top of the file
```

### PM2: `File ecosystem.config.js malformed` after adding `PUPPETEER_EXECUTABLE_PATH`

**Cause:** a JavaScript syntax error, virtually always a **missing comma** on the line *before* the one you added. `ecosystem.config.js` is JS, not JSON, and PM2's message doesn't name the line.

**Fix:** get the real error, which includes the line and column:

```bash
cd /root/Core-Repository
node --check ecosystem.config.js
```

Then check these, in order of likelihood:

1. The property before your new line lacks a trailing comma (`ENCRYPTION_KEY: 'hidden'` → `ENCRYPTION_KEY: 'hidden',`).
2. You added `PUPPETEER_EXECUTABLE_PATH` but left `PDF_RENDER_SIDECAR_URL` on the following line with no comma between them. Only one should be active anyway — a configured sidecar takes precedence, so the local browser would be ignored.
3. A single-quoted path containing an apostrophe, or a smart quote (`'`) pasted from a document instead of a plain `'`.

The shipped `ecosystem.config.js` already has the Option 1 setting in both `env` and `env_production`, with a trailing comma on every line so you can comment lines in and out safely. If you overwrite it with the repo copy, you only need to correct the path if yours differs. Confirm PM2 actually received it:

```bash
pm2 restart ecosystem.config.js --env production
pm2 env network-backend | grep -E 'PUPPETEER_EXECUTABLE_PATH|PDF_RENDER_SIDECAR'
```

### `FAIL - PUPPETEER_EXECUTABLE_PATH does not exist: /usr/lib64/chromium-browser/headless_shell`

**Cause:** either Chromium isn't installed yet, or it is installed but its binary has a different name/location in your EPEL build. The path in this guide is the common case, **not** a guarantee.

**Fix:** determine the real path instead of guessing. `checkPdfRender.js` prints every browser it can find in standard locations; if it finds none, work through this:

```bash
# Is it installed at all?
rpm -q chromium-headless || echo "NOT INSTALLED - do the Option 1 yum steps first"

# What executables did it ship?
rpm -ql chromium-headless | while read f; do [ -f "$f" ] && [ -x "$f" ] && echo "$f"; done

# Anything Chromium-ish anywhere?
ls -la /usr/lib64/chromium-browser/ 2>/dev/null
find /usr /opt -name 'headless_shell' -o -name 'chromium-browser' -o -name 'chrome' 2>/dev/null
```

If the `yum install chromium-headless` step failed, the three library prerequisites are probably still missing — re-run `sudo yum --enablerepo=centos7-vault install -y libatomic flac-libs opus` and read its output carefully. If only the **full** browser is available (`chromium-browser` rather than `headless_shell`), use it: Puppeteer launches it with `headless: true` and it renders identically.

### `Error [ERR_REQUIRE_ESM]: require() of ES Module .../d3-force/src/index.js not supported`

**Cause:** `d3-force@3.x` is **ESM-only**, and `require()` of ESM only works from Node 22.12 onward. On Node 16 it throws at boot — and because `routes.js` requires `networkMapRenderer.js`, it takes the whole backend down, exactly like the `??=` crash did. This error was *hidden* until now: `puppeteer` was required one line earlier and crashed first, so fixing that exposed this.

**Fix:** already fixed in the repo — `d3-force` is pinned to `^2.1.1`, the last CommonJS release, with an identical API for the forces this renderer uses. Verify the server has the fix:

```bash
grep '"d3-force"' backend/package.json     # ^2.1.1 - NOT ^3.x
npm ls d3-force                            # 2.1.1
```

Never bump `d3-force` to 3.x while this host runs Node 16. To catch this class of bug on a newer machine before deploying, boot with ESM-require disabled to emulate Node 16 module resolution:

```bash
node --no-experimental-require-module index.js
```

### `cp: cannot create regular file '/usr/local/./bin/node': Text file busy`

**Cause:** the Node upgrade tried to overwrite a binary that running processes are executing (`ETXTBSY`). The PM2 daemon, the backend, and `npx serve` all run this exact file, and `pm2 stop all` leaves the daemon itself alive.

**Fix:** `pm2 kill`, confirm with `pgrep -a node`, then re-run the copy (**Step 1**). To find any non-PM2 holders:

```bash
pgrep -a node
fuser -v /usr/local/bin/node      # or: lsof /usr/local/bin/node
```

**Important:** `cp` copies what it can and only fails on the busy file, so a failed run leaves a **mixed install** — typically npm 8 from the new tarball alongside the old Node 14 binary. Always re-run the full `cp -a` to completion and confirm both `node -v` and `npm -v` afterwards; don't assume a partial copy did nothing.

### `npm -v` fails with a `SyntaxError` / error inside `socks-proxy-agent` (or another bundled npm module)

**Cause:** `/usr/local/lib/node_modules/npm` contains a **merged** npm tree. `cp -a` overwrites files it has in the source but never deletes stale ones, so overlaying npm 8 onto npm 6 leaves both dependency trees interleaved and npm crashes inside its own bundled modules. A `node` binary left at v14 by a `Text file busy` failure makes it worse, since the newer npm code then runs on an older engine.

**Fix:** replace the npm tree wholesale instead of merging it.

```bash
pm2 kill && pgrep -a node

sudo rm -rf /usr/local/lib/node_modules/npm
sudo rm -f /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx
sudo cp -a /tmp/node-v16.20.2-linux-x64/. /usr/local/

hash -r
node -v && npm -v && npm ls -g --depth=0
```

`pm2` and `serve` live in their own directories under `/usr/local/lib/node_modules/` and survive this untouched. If `npm ls -g` no longer lists them: `npm install -g pm2 serve`.

### `npm ERR! Cannot read property 'adm-zip' of undefined` on `npm ci`

**Cause:** npm 6 cannot read `lockfileVersion: 3` (it warns `read-shrinkwrap ... generated for lockfileVersion@3`). v3 is npm 7+ only.
**Fix:** the repo lockfile is now **version 2**, readable by npm 6 and npm 8+. Verify with `grep lockfileVersion backend/package-lock.json`. If you're stuck on npm 6 with a v3 lockfile: `rm -f package-lock.json && npm install --no-optional`.

### `make: g++: Command not found` / `bcrypt@6.0.0 install: node-gyp-build` failed

**Cause:** `bcrypt` compiles natively (no `g++` here) and v6 requires Node ≥18.
**Fix:** already fixed in the repo — `bcryptjs` (pure JS) replaces it in `package.json`, `auth.js`, and `migrations/045_add_voice_guest_account.js`. If you still see this, `package.json` on the server is stale (see the sync check in Step 3). Do **not** re-run the old `npm uninstall bcrypt` / `sed` workaround.

### Docker: `Requires: container-selinux >= 2:2.74` / `fuse-overlayfs >= 0.7` / `slirp4netns >= 0.4`

**Cause:** those packages live in the RHEL 7 **extras** channel, and this system is **not registered** with an entitlement server.
**Fix:** you probably don't need Docker at all — **Step 5, Option 1** renders on this box using EPEL's el7-built Chromium, no entitlements required. Otherwise register and enable `rhel-7-server-extras-rpms` (Option 3), or run the sidecar on another host (Option 2). `systemctl enable --now docker` failing with `No such file or directory` simply means the package never installed.

### `https://repo.ius.io/7/x86_64/repodata/repomd.xml: [Errno 14] HTTPS Error 404`

**Cause:** dead IUS repo still configured.
**Fix:** **Step 0** — disable it so it stops masking real dependency errors.

### PDF export fails: `` version `GLIBC_2.27' not found ``

**Cause:** Puppeteer launched **its own bundled** Chrome-for-Testing build, which needs glibc ≥2.27. This host has 2.17. It means `PUPPETEER_EXECUTABLE_PATH` is unset (or wrong), so Puppeteer fell back to its own download.
**Fix:** point it at the el7-built Chromium instead (Option 1) — that binary is compiled against glibc 2.17 and is unaffected:

```bash
rpm -ql chromium-headless | grep headless_shell
grep -E 'PUPPETEER_EXECUTABLE_PATH|PDF_RENDER_SIDECAR_URL' /root/Core-Repository/ecosystem.config.js
cd /root/Core-Repository/backend && \
  PUPPETEER_EXECUTABLE_PATH=/usr/lib64/chromium-browser/headless_shell node checkPdfRender.js
cd /root/Core-Repository && pm2 restart ecosystem.config.js --env production
```

### PDF export returns 500 with `Local PDF rendering is unavailable on this host`

**Cause:** working as designed for Option 4 — no render path configured and puppeteer not installed/loadable.
**Fix:** configure Option 1, 2, or 3, or accept that this one feature is off.

### PDF export fails with `PDF render sidecar at ... failed: HTTP 401 - {"error":"Unauthorized"}`

**Cause:** the sidecar has `SIDECAR_AUTH_TOKEN` set but the backend's `PDF_RENDER_SIDECAR_TOKEN` is missing or different.
**Fix:** set both to the same value, then `pm2 restart ecosystem.config.js --env production`.

### PDF export times out on very large maps

**Fix:** raise the client timeout (default 120000 ms) by adding `PDF_RENDER_SIDECAR_TIMEOUT_MS` to the backend env in `ecosystem.config.js`, then `pm2 restart ecosystem.config.js --env production`.

### Frontend: `FATAL ERROR: JavaScript heap out of memory`

**Cause:** PM2 running the dev server (`npm start`) instead of serving the build.
**Fix:** `ecosystem.config.js` must use `script: 'npx'` with `args: ['serve', '-p', '3000', '--no-clipboard']`.

### Frontend shows a directory listing (`build/cesium`)

**Fix:** create `frontend/serve.json` (**Step 6**), then `pm2 restart network-frontend`.

### `getaddrinfo ENOTFOUND -l`

**Cause:** `args` given as a string instead of an array.
**Fix:** use the array form shown in Step 7.

### Cesium globe is black / `Not allowed to load local resource`

**Fix:** assets weren't copied before the build. `cd frontend && ./setup-cesium.sh && npm run build && pm2 restart network-frontend`, then confirm `build/cesium/Workers/` is populated.

### `npm run build` runs out of memory

**Fix:** `export NODE_OPTIONS="--max-old-space-size=2048"` (or `4096`) before `npm run build`, and unset it afterwards.

---

## 🔒 **Security & maintenance**

```bash
# Firewall: app ports only. Do NOT open 5051 to the world.
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=4000/tcp
sudo firewall-cmd --reload && sudo firewall-cmd --list-ports

# Change JWT_SECRET in ecosystem.config.js to a long random string, then:
pm2 restart ecosystem.config.js --env production

# Database backup + integrity
cd /root/Core-Repository
cp network_routes.db backups/network_routes.db.$(date +%Y%m%d)
sqlite3 network_routes.db "PRAGMA integrity_check;"

# Routine monitoring
pm2 list && pm2 monit && pm2 logs --lines 50
```

**Upgrading later:** stop PM2, back up `/root/Core-Repository` and `network_routes.db`, transfer the new version, restore the DB, re-run the Step 3 sync checks, reinstall in `backend/` with the Step 4 command matching your render option, rebuild the frontend, then `pm2 start ecosystem.config.js --env production && pm2 save`. Re-verify `node -v` is still ≥16.13.2, that `puppeteer` didn't get bumped past `21.11.0`, and re-run `node checkPdfRender.js` if the export path matters.

---

## ✅ **Success checklist**

**Host prep**
- [ ] Dead IUS repo disabled; `yum repolist` is clean
- [ ] `pm2 kill` run **before** overlaying Node (otherwise: "Text file busy"); `cp -a` finished with exit code 0
- [ ] `node -v` = **v16.20.2** (was 14.21.3); `npm -v` = 8.x — both, to rule out a partial copy
- [ ] `pm2 -v` and `serve --version` still work after the upgrade
- [ ] Node 14 binary backed up at `/root/node-14.21.3.bak`

**Backend**
- [ ] `backend/package.json`: `bcryptjs` present, **no `bcrypt`**, `d3-force` = `^2.1.1` (**not** 3.x), `puppeteer` = `21.11.0` under `optionalDependencies`
- [ ] `backend/package-lock.json`: `lockfileVersion` = **2**
- [ ] `auth.js` **and** `migrations/045_add_voice_guest_account.js` both require `bcryptjs`
- [ ] `require('puppeteer')` appears only inside `loadPuppeteer()`
- [ ] `npm ci` completed with no `g++` / `node-gyp` errors, using the Step 4 command that matches your render option (`PUPPETEER_SKIP_DOWNLOAD=true npm ci` for Option 1, `npm ci --no-optional` for Options 2/3/4)
- [ ] `sqlite3` = 5.0.2 (pinned in `package.json`) and loads via its prebuilt binary
- [ ] `node index.js` starts with **no `SyntaxError`**

**PDF export (whichever option)**
- [ ] Option chosen and recorded: 1 (native el7 Chromium) / 2 (remote sidecar) / 3 (Docker here) / 4 (disabled)
- [ ] `node checkPdfRender.js` printed **PASS** with the same env vars PM2 will use
- [ ] Only **one** of `PUPPETEER_EXECUTABLE_PATH` / `PDF_RENDER_SIDECAR_URL` is set, in **both** `env` and `env_production`
- [ ] Option 1: `ldd <headless_shell>` reports no missing libraries; `centos7-vault` repo left `enabled=0`
- [ ] Option 1: puppeteer installed **with** `PUPPETEER_SKIP_DOWNLOAD=true` (no bundled Chromium)
- [ ] Options 2/3: `curl http://<host>:5051/health` returns `{"status":"ok"}` **from this box**, and port 5051 isn't publicly exposed (firewall or matching `SIDECAR_AUTH_TOKEN` / `PDF_RENDER_SIDECAR_TOKEN`)
- [ ] "Export Network Map" downloads a valid PDF (or, for Option 4, logs the clear "unavailable" message)

**Frontend & runtime**
- [ ] Cesium assets in `frontend/public/cesium/` (~387 files) and in `build/cesium/`
- [ ] `frontend/serve.json` created; `frontend/build/index.html` > 1KB
- [ ] `ecosystem.config.js` frontend uses `npx serve` (not `npm start`)
- [ ] PM2 reloaded via `pm2 restart ecosystem.config.js --env production` (not by app name) + `pm2 save`
- [ ] Both apps `online`, 0 restarts, frontend ~50MB
- [ ] `curl localhost:4000/health` OK; `curl localhost:3000/` returns HTML
- [ ] Login works; KMZ Viewer shows the 3D globe

---

**Documentation Version:** v3.5.0 (rewritten) + v3.5.2/v3.5.3 update section (application-only, no system changes)
**Last Updated:** August 31, 2026 — added the "Updating this host to v3.5.2 / v3.5.3" section; v3.5.0 system-setup content below is unchanged and historical
**Target Host:** `sni1-ipclon7` — RHEL 7, kernel 3.10.0-1062.9.1.el7, glibc 2.17, unregistered
**Node.js:** 16.20.2 (upgraded from 14.21.3 for v3.5.0; Node 18+ impossible — needs glibc ≥2.28; unchanged through v3.5.3)
**Supersedes:** `RHEL_PRODUCTION_DEPLOYMENT_V3.3.3.md`
