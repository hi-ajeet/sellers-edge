# Sellers Edge v1.3
### Automatic Whatnot Labeling Extension

> Instantly print packing labels for every sale and giveaway during your Whatnot live streams — no API key required.

---

## How It Works

Two components work together:

1. **Browser Extension** (Chrome / Edge / Firefox) — watches your Whatnot live stream page for new SOLD and GIVEAWAY events using DOM observation and network interception. Connects to the desktop app via a local WebSocket.

2. **Desktop App** (Electron, Windows / macOS / Linux) — receives order events from the extension, generates a PDF label, and sends it to your Rollo (or any installed printer) instantly.

---

## Quick Start

### Requirements
- Node.js 18+
- npm 9+
- A label printer installed on your system (Rollo 4×6 recommended)

### 1. Desktop App

```bash
git clone https://github.com/yourorg/sellers-edge.git
cd sellers-edge
npm install
npm run dev          # development
npm run dist         # production installer
```

On first launch, a **setup wizard** will walk you through:
- Choosing your printer and label size
- Uploading your store logo
- Adding your Whatnot seller account
- Printing a test label to confirm everything works

### 2. Browser Extension

**Chrome / Edge:**
```bash
cd extension
npm install
npm run build:chrome
```
1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select `extension/dist-chrome/`
4. Pin the Sellers Edge icon to your toolbar

**Firefox:**
```bash
npm run build:firefox
```
1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on** → select `extension/dist-firefox/manifest.json`

---

## Usage

1. Start the **Sellers Edge** desktop app
2. Open **whatnot.com** in your browser (seller dashboard or live show page)
3. The extension icon turns **blue** and the app shows **"Extension Connected"**
4. Go live — every SOLD and GIVEAWAY automatically prints a label
5. Use the **Live Print Log** to monitor, reprint, or add orders manually
6. Click **End Session** when your show ends to see your summary and reset the counter

---

## Label Format

Each label contains:
- Your **store logo** (top, configurable position)
- **SOLD** or **GIVEAWAY** badge (color-coded, customisable)
- Buyer's **@username**
- **Item description** (wraps to 2 lines)
- **Sale price** (hidden on giveaways)
- Print **timestamp** (bottom right, small)

Default size: **4×6 inch / 101.6×152.4 mm** (Rollo standard). Fully configurable in Settings → Printer.

---

## Settings

| Tab | What you can configure |
|---|---|
| 🖨 Printer | Active printer, label width/height, test print button |
| 🏷 Label | Logo upload & position, SOLD/GIVEAWAY badge colors, font scale, live preview |
| 🔔 Sound | Enable/disable, volume, per-type sounds (sold vs giveaway), test button |
| ⚙ App | Dark mode, WebSocket port, settings PIN |

---

## Project Structure

```
sellers-edge/
├── src/
│   ├── main/
│   │   ├── index.ts          # Electron entry, IPC, WebSocket server, auto-updater
│   │   ├── preload.ts        # Secure IPC bridge
│   │   ├── database.ts       # SQLite — settings, accounts, sessions, jobs
│   │   ├── labelGenerator.ts # PDF label rendering (pdf-lib)
│   │   └── printQueue.ts     # Queue, dedup, 15s auto-retry
│   └── renderer/
│       ├── App.tsx           # Root — wizard gate, update banner, nav
│       ├── store/appState.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx      # Live print log, stats, controls
│       │   ├── Settings.tsx       # 4-tab settings screen
│       │   └── Accounts.tsx       # Multi-account manager
│       └── components/
│           ├── SetupWizard.tsx        # First-launch 5-step wizard
│           ├── ManualAddModal.tsx
│           └── SessionSummaryModal.tsx
├── extension/
│   ├── src/
│   │   ├── content.ts    # DOM watcher + fetch interceptor
│   │   └── background.ts # Service worker, WebSocket client, badge counter
│   ├── manifest.chrome.json   # Manifest V3 (Chrome/Edge)
│   ├── manifest.firefox.json  # Manifest V2 (Firefox)
│   ├── popup.html / popup.js
│   └── icons/
├── assets/          # App icons (.ico, .png set for all platforms)
├── public/          # Static assets served by Vite
│   ├── assets/logo.jpeg
│   └── sounds/      # print-beep.wav, print-beep-sold.wav, print-beep-giveaway.wav
└── package.json
```

---

## Troubleshooting

**"Extension Disconnected" in the app**
- Make sure Sellers Edge desktop app is running before opening Whatnot
- Check that port 47891 is not blocked (change in Settings → App if needed)

**Labels not printing**
- Settings → Printer → click **Test Print** to verify the printer is reachable
- Failed jobs auto-retry every 15 seconds — check the log for error details
- On macOS, grant the app permission under System Settings → Printers

**Extension not detecting sales**
- The extension uses both DOM observation and network interception — it should survive Whatnot UI updates
- Use **+ Add Manual** in the dashboard as an immediate fallback
- Check the browser console on whatnot.com for `[SE]` log messages

---

## Building for Distribution

```bash
npm run dist -- --win    # Windows .exe
npm run dist -- --mac    # macOS .dmg (requires Apple Developer cert for notarization)
npm run dist -- --linux  # AppImage + .deb
```

Auto-updates are handled by `electron-updater`. Point `electron-builder` at your GitHub Releases or S3 bucket update server, bump the version in `package.json`, and publish.

---

## Changelog

### v1.3.0
- Removed Whatnot API dependency — works entirely via browser extension
- Added first-launch setup wizard (5 steps)
- Fixed reprint for completed jobs (getJobById)
- Fixed pdf-to-printer printerName API
- Added auto-updater (silent background updates)
- Added test print button in Settings and Setup Wizard
- Fixed session end/reset flow
- Fixed extension badge counter (storage.local)
- Graceful logo fallback when file missing
- Per-type sounds (sold vs giveaway)
- Session history stored in SQLite

---

© 2026 Sellers Edge. All rights reserved.
