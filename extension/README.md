# ReproBug Chrome extension

This Manifest V3 extension captures JavaScript `error` and `unhandledrejection` events on the current tab only after the user clicks **Enable capture on this tab**.

## Load unpacked

1. Open `chrome://extensions` in Chrome and enable Developer mode.
2. Select **Load unpacked** and choose this directory.
3. Open the extension popup, enter your ReproBug API URL, and sign in with your ReproBug account.
4. Click **Enable capture on this tab** on the webpage you want to debug.

The popup requests permission for the configured API host at sign-in. The extension stores a session token locally; it expires after 12 hours, after which you must sign in again. This MVP does not silently capture all sites and does not collect network request bodies.

## Privacy

The extension limits captured text and redacts common password, token, secret, API-key, and Bearer-token patterns. Redaction is best-effort, not a guarantee; use only on pages you're authorized to debug and avoid sensitive workflows.
