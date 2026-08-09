# Network Inventory v3.5.0 — RHEL 7 Production Deployment Guide

**Supersedes `RHEL_PRODUCTION_DEPLOYMENT_V3.3.3.md`.** Rewritten against the **actual observed state** of `sni1-ipclon7`, not the assumptions the v3.3.3 guide carried forward. Several of those assumptions turned out to be wrong on the real box, which is what caused the v3.5.0 deployment failures.

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

v3.5.0 added the **PDF Network Map Export** feature (`backend/networkMapRenderer.js`), which introduced `puppeteer`. That created **three independent problems** on this host:

1. **Node version.** `puppeteer@23.x` (originally pinned) requires Node ≥18; even the corrected `puppeteer@21.11.0` requires Node ≥16.13.2. This box runs **Node 14.21.3**, so `require('puppeteer')` threw `SyntaxError: Unexpected token '??='` and took the **whole backend** down over one export feature.
   **Fixed in code:** `puppeteer` is now pinned to `21.11.0`, moved to `optionalDependencies`, and **loaded lazily** — the backend now boots even if puppeteer is missing or unloadable.
2. **Chromium can't run at all here.** Puppeteer's Chromium ("Chrome for Testing") needs **glibc ≥2.27**; RHEL 7 has **2.17**. No npm version fixes this. The EPEL `chromium-headless` RPM route dead-ends too (missing `libFLAC.so.8`, `libopus.so.0`, `libatomic.so.1` — codec libs EPEL doesn't ship and base libs that need the unregistered `optional` channel).
   **Fixed in code:** rendering can be delegated over HTTP to `backend/pdf-render-sidecar/` via `PDF_RENDER_SIDECAR_URL`.
3. **`bcrypt@6.0.0`** requires Node ≥18 *and* compiles natively (needs `g++`, absent). The old guide worked around this with a `sed` on `auth.js` only — but `backend/migrations/045_add_voice_guest_account.js` also required `bcrypt`, so that migration would fail at runtime.
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

```bash
# Back up the current binary so you can roll back
cp -a /usr/local/bin/node /root/node-14.21.3.bak
node -v > /root/node-version-before-upgrade.txt

cd /tmp
wget https://nodejs.org/dist/v16.20.2/node-v16.20.2-linux-x64.tar.xz
tar -xJf node-v16.20.2-linux-x64.tar.xz

# Overlay onto /usr/local (replaces bin/node, bin/npm, lib/node_modules/npm;
# leaves lib/node_modules/pm2 and lib/node_modules/serve untouched)
sudo cp -a node-v16.20.2-linux-x64/. /usr/local/

hash -r
node -v    # v16.20.2
npm -v     # 8.x.x
```

Then refresh the PM2 daemon so it runs under the new Node, and confirm the globals survived:

```bash
pm2 update          # restarts the PM2 daemon under Node 16
pm2 -v
serve --version
```

**Rollback if anything goes wrong:** `sudo cp -a /root/node-14.21.3.bak /usr/local/bin/node && hash -r && pm2 update`

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

**⚠️ Sync discipline — this caused two failed attempts.** `package.json`, `package-lock.json`, `networkMapRenderer.js`, `ecosystem.config.js`, and `auth.js` are all **per-server files**. If you deploy by zip/scp rather than a live pull, they do **not** update themselves, and `npm install` will silently report "nothing changed" while still using the old versions. Always verify after transferring:

```bash
cd /root/Core-Repository
grep '"puppeteer"'  backend/package.json      # 21.11.0, under optionalDependencies
grep '"bcryptjs"'   backend/package.json      # present; "bcrypt" must be GONE
grep bcryptjs       backend/auth.js backend/migrations/045_add_voice_guest_account.js
grep PDF_RENDER_SIDECAR_URL ecosystem.config.js
grep lockfileVersion backend/package-lock.json # 2  (npm 6 AND npm 8 can read this)
```

---

## 🏗️ **Step 4: Backend setup**

`bcrypt` is gone from the repo, so **no `sed` on `auth.js` and no `npm uninstall bcrypt` are needed** — those steps from the v3.3.3 guide are obsolete and actively harmful (they mutate `package.json` and desync it from the lockfile).

> **Existing logins are unaffected.** `bcryptjs` reads the `$2b$` hashes `bcrypt` wrote, so stored passwords stay valid and no password resets are required. This was verified against the production database's `admin` hash.

```bash
cd /root/Core-Repository/backend
rm -rf node_modules

# Clean install straight from the lockfile.
# --no-optional skips puppeteer: its Chromium cannot run on RHEL 7 anyway, and
# rendering happens in the sidecar (Step 5). Saves ~300MB and avoids a pointless
# postinstall. The lazy loader in networkMapRenderer.js handles its absence.
npm ci --no-optional

# SQLite3 pinned build for RHEL 7 (installs a prebuilt napi-v3 binary, no compiler)
npm ls sqlite3 || npm install sqlite3@5.0.2
npm ls bcryptjs sqlite3

# Initialize database (first-time installs only — skip when upgrading!)
# node init_db.js

# Smoke test
node index.js
# Expected: starts on port 4000 with NO SyntaxError. Ctrl+C to stop.
```

If `npm ci` still complains about the lockfile, fall back to `npm install` (it will rewrite the lockfile locally, which is fine on a deployment host):

```bash
rm -f package-lock.json && npm install --no-optional
```

---

## 🖨️ **Step 5: PDF Network Map Export — pick one option**

Chromium **cannot** run natively on this host (glibc 2.17 vs ≥2.27 required), so the renderer must live somewhere else, or be left off. `backend/networkMapRenderer.js` supports all three, selected purely by environment variables.

| Option | How | PDF export works? | Effort / risk |
|---|---|---|---|
| **A. Sidecar on another host** *(recommended)* | Run `backend/pdf-render-sidecar/` on any machine with Docker or Node ≥18, point `PDF_RENDER_SIDECAR_URL` at it | ✅ Yes | Low — no changes to this RHEL 7 box |
| **B. Docker on this box** | Register the subscription, enable `rhel-7-server-extras-rpms`, then install Docker CE | ✅ Yes | Medium — needs entitlements (see below) |
| **C. Leave it disabled** | Set nothing | ❌ Export returns a clear error; everything else works | None |

### **Option A — sidecar on another host (recommended)**

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

### **Option B — Docker on this box (requires fixing entitlements first)**

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

> Grafting CentOS 7 `extras` onto RHEL to get these three packages is technically possible but **not recommended** — `container-selinux` is an SELinux policy package, and mismatched policy on RHEL is a genuine risk. Register the system instead.

### **Option C — leave it disabled**

Leave `PDF_RENDER_SIDECAR_URL` unset and don't install puppeteer (`npm ci --no-optional`). The backend boots normally; every other v3.5.0 feature works. Clicking "Export Network Map" returns HTTP 500 with `Failed to generate network map PDF.`, and the backend log shows the actionable reason:

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

Only one v3.5.0 change is needed versus v3.3.3: `PDF_RENDER_SIDECAR_URL` on `network-backend` (in **both** `env` and `env_production`). Omit it entirely for Option C.

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
        PDF_RENDER_SIDECAR_URL: 'http://127.0.0.1:5051'   // or http://<RENDER_HOST_IP>:5051
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
        ENCRYPTION_KEY: 'hidden',
        PDF_RENDER_SIDECAR_URL: 'http://127.0.0.1:5051'
      },
      /* ...logging / restart settings unchanged... */
    },
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
pm2 env network-backend | grep PDF_RENDER_SIDECAR_URL
```

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

Then in a browser at `http://172.30.252.118:3000`: log in (`admin` / `admin123`), confirm the KMZ Viewer renders the 3D globe, and — if you configured Option A or B — that **Network Routes Repository → Export Network Map** downloads a valid PDF.

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

### `npm ERR! Cannot read property 'adm-zip' of undefined` on `npm ci`

**Cause:** npm 6 cannot read `lockfileVersion: 3` (it warns `read-shrinkwrap ... generated for lockfileVersion@3`). v3 is npm 7+ only.
**Fix:** the repo lockfile is now **version 2**, readable by npm 6 and npm 8+. Verify with `grep lockfileVersion backend/package-lock.json`. If you're stuck on npm 6 with a v3 lockfile: `rm -f package-lock.json && npm install --no-optional`.

### `make: g++: Command not found` / `bcrypt@6.0.0 install: node-gyp-build` failed

**Cause:** `bcrypt` compiles natively (no `g++` here) and v6 requires Node ≥18.
**Fix:** already fixed in the repo — `bcryptjs` (pure JS) replaces it in `package.json`, `auth.js`, and `migrations/045_add_voice_guest_account.js`. If you still see this, `package.json` on the server is stale (see the sync check in Step 3). Do **not** re-run the old `npm uninstall bcrypt` / `sed` workaround.

### Docker: `Requires: container-selinux >= 2:2.74` / `fuse-overlayfs >= 0.7` / `slirp4netns >= 0.4`

**Cause:** those packages live in the RHEL 7 **extras** channel, and this system is **not registered** with an entitlement server.
**Fix:** register and enable `rhel-7-server-extras-rpms` (**Step 5, Option B**), or skip Docker on this box entirely and run the sidecar elsewhere (**Option A**). `systemctl enable --now docker` failing with `No such file or directory` simply means the package never installed.

### `https://repo.ius.io/7/x86_64/repodata/repomd.xml: [Errno 14] HTTPS Error 404`

**Cause:** dead IUS repo still configured.
**Fix:** **Step 0** — disable it so it stops masking real dependency errors.

### PDF export fails: `` version `GLIBC_2.27' not found ``

**Cause:** something tried to launch Chromium locally. RHEL 7 has glibc 2.17; Chromium needs ≥2.27.
**Fix:** make sure `PDF_RENDER_SIDECAR_URL` is set and the sidecar is reachable, so the local path is never taken:

```bash
grep PDF_RENDER_SIDECAR_URL /root/Core-Repository/ecosystem.config.js
curl http://<sidecar-host>:5051/health
cd /root/Core-Repository && pm2 restart ecosystem.config.js --env production
```

### PDF export returns 500 with `Local PDF rendering is unavailable on this host`

**Cause:** working as designed for Option C — no sidecar configured and puppeteer not installed/loadable.
**Fix:** configure Option A or B, or accept that this one feature is off.

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

**Upgrading later:** stop PM2, back up `/root/Core-Repository` and `network_routes.db`, transfer the new version, restore the DB, re-run the Step 3 sync checks, `npm ci --no-optional` in `backend/`, rebuild the frontend, then `pm2 start ecosystem.config.js --env production && pm2 save`. Re-verify `node -v` is still ≥16.13.2 and that `puppeteer` didn't get bumped past `21.11.0`.

---

## ✅ **Success checklist**

**Host prep**
- [ ] Dead IUS repo disabled; `yum repolist` is clean
- [ ] `node -v` = **v16.20.2** (was 14.21.3); `npm -v` = 8.x
- [ ] `pm2 update` run after the Node upgrade; `pm2 -v` and `serve --version` still work
- [ ] Node 14 binary backed up at `/root/node-14.21.3.bak`

**Backend**
- [ ] `backend/package.json`: `bcryptjs` present, **no `bcrypt`**, `puppeteer` = `21.11.0` under `optionalDependencies`
- [ ] `backend/package-lock.json`: `lockfileVersion` = **2**
- [ ] `auth.js` **and** `migrations/045_add_voice_guest_account.js` both require `bcryptjs`
- [ ] `require('puppeteer')` appears only inside `loadPuppeteer()`
- [ ] `npm ci --no-optional` completed with no `g++` / `node-gyp` errors
- [ ] `sqlite3` = 5.0.2 with its prebuilt binary
- [ ] `node index.js` starts with **no `SyntaxError`**

**PDF export (whichever option)**
- [ ] Option chosen and recorded: A (remote sidecar) / B (Docker here) / C (disabled)
- [ ] A or B: `curl http://<host>:5051/health` returns `{"status":"ok"}` **from this box**
- [ ] A or B: `PDF_RENDER_SIDECAR_URL` set in **both** `env` and `env_production`
- [ ] A or B: port 5051 not exposed publicly (firewall or `SIDECAR_AUTH_TOKEN`)
- [ ] "Export Network Map" downloads a valid PDF (or, for C, logs the clear "unavailable" message)

**Frontend & runtime**
- [ ] Cesium assets in `frontend/public/cesium/` (~387 files) and in `build/cesium/`
- [ ] `frontend/serve.json` created; `frontend/build/index.html` > 1KB
- [ ] `ecosystem.config.js` frontend uses `npx serve` (not `npm start`)
- [ ] PM2 reloaded via `pm2 restart ecosystem.config.js --env production` (not by app name) + `pm2 save`
- [ ] Both apps `online`, 0 restarts, frontend ~50MB
- [ ] `curl localhost:4000/health` OK; `curl localhost:3000/` returns HTML
- [ ] Login works; KMZ Viewer shows the 3D globe

---

**Documentation Version:** v3.5.0 (rewritten)
**Last Updated:** August 9, 2026
**Target Host:** `sni1-ipclon7` — RHEL 7, kernel 3.10.0-1062.9.1.el7, glibc 2.17, unregistered
**Node.js:** 16.20.2 (upgraded from 14.21.3; Node 18+ impossible — needs glibc ≥2.28)
**Supersedes:** `RHEL_PRODUCTION_DEPLOYMENT_V3.3.3.md`
