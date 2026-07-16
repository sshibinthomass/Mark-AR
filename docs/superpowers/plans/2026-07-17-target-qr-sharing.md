# Target QR Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a primary `Share QR` action to the first-creation QR popup that shares the branded PNG and exact scan URL natively, with an automatic download-and-copy fallback.

**Architecture:** A focused `targetQrShare` helper owns Web Share capability detection, payload creation, cancellation classification, and fallback orchestration. The QR dialog owns the share button, busy state, result copy, accessibility, and stale-result protection. `main.ts` supplies the retained QR artifact plus existing download and clipboard operations without regenerating the QR or changing target persistence.

**Tech Stack:** TypeScript 6, DOM Web Share and Clipboard APIs, Vitest 4 with Happy DOM, existing Vite UI and CSS.

## Global Constraints

- The share action exists in the QR popup only; saved-target row actions remain unchanged.
- `Share QR` is the first and primary popup action; `Download QR` remains second and secondary.
- Native sharing uses the retained branded PNG and exact absolute `#/scan/<scan_id>` URL without regenerating the QR.
- The native payload includes one PNG `File`, title `AnchorAR — <target label>`, text `Scan this QR code to open the AR experience: <scan URL>`, and the exact URL field.
- Native sharing must be invoked synchronously from the share-button click before any awaited operation.
- If `navigator.share` or `navigator.canShare({ files: [file] })` is unavailable, false, or throws, download the PNG and copy the URL.
- `AbortError` is cancellation: no download, clipboard write, or error message.
- Native non-cancellation failure text is `The QR could not be shared. Try again or use Download QR and Copy link.`
- Complete fallback text is `QR downloaded and scan link copied. Attach the QR image and paste the link in your app.`
- Partial fallback text is `QR downloaded. Copy the scan link manually from above.`
- Native success text is `QR code and scan link shared.`
- Share is disabled until the QR is ready and while active; while active its label is `Sharing…`.
- Existing animation, reduced-motion behavior, focus trap, focus restoration, QR composition, logo alignment, and first-creation-only trigger remain unchanged.

---

### Task 1: Browser share orchestration

**Files:**
- Create: `src/app/targetQrShare.ts`
- Create: `tests/targetQrShare.test.ts`

**Interfaces:**
- Consumes: `TargetQrArtifact` from `src/app/targetQrCode.ts`, a target label, exact scan URL, synchronous artifact-download callback, and asynchronous URL-copy callback.
- Produces: `shareTargetQrArtifact(input, dependencyOverrides?) => Promise<TargetQrShareResult>` and the result union `'shared' | 'downloaded-and-copied' | 'downloaded-copy-failed' | 'cancelled' | 'failed'`.

- [ ] **Step 1: Write the failing helper tests**

Create `tests/targetQrShare.test.ts` with tests that exercise the real helper API:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  shareTargetQrArtifact,
  type TargetQrShareInput,
} from '../src/app/targetQrShare';

const scanUrl = 'https://example.com/Mark-AR/#/scan/scan-one';

function createInput(): TargetQrShareInput {
  return {
    artifact: {
      blob: new Blob(['png'], { type: 'image/png' }),
      filename: 'anchorar-product-marker-qr.png',
    },
    targetLabel: 'Product marker',
    scanUrl,
    download: vi.fn(),
    copy: vi.fn(async () => undefined),
  };
}

describe('target QR sharing', () => {
  it('shares a PNG file and repeats the exact URL in text and url fields', async () => {
    const input = createInput();
    const share = vi.fn(async (_data: ShareData) => undefined);
    const canShare = vi.fn((_data: ShareData) => true);

    const result = await shareTargetQrArtifact(input, { share, canShare });

    expect(result).toBe('shared');
    expect(canShare).toHaveBeenCalledWith({ files: [expect.any(File)] });
    expect(share).toHaveBeenCalledOnce();
    const payload = share.mock.calls[0][0];
    expect(payload.title).toBe('AnchorAR — Product marker');
    expect(payload.text).toBe(`Scan this QR code to open the AR experience: ${scanUrl}`);
    expect(payload.url).toBe(scanUrl);
    expect(payload.files).toHaveLength(1);
    expect(payload.files?.[0].name).toBe('anchorar-product-marker-qr.png');
    expect(payload.files?.[0].type).toBe('image/png');
    expect(input.download).not.toHaveBeenCalled();
    expect(input.copy).not.toHaveBeenCalled();
  });

  it('downloads and copies when native file sharing is unsupported', async () => {
    const input = createInput();
    const share = vi.fn(async (_data: ShareData) => undefined);

    const result = await shareTargetQrArtifact(input, {
      share,
      canShare: vi.fn(() => false),
    });

    expect(result).toBe('downloaded-and-copied');
    expect(input.download).toHaveBeenCalledWith(input.artifact);
    expect(input.copy).toHaveBeenCalledWith(scanUrl);
    expect(share).not.toHaveBeenCalled();
  });

  it('uses fallback when capability detection throws', async () => {
    const input = createInput();

    const result = await shareTargetQrArtifact(input, {
      share: vi.fn(async (_data: ShareData) => undefined),
      canShare: vi.fn(() => {
        throw new Error('capability unavailable');
      }),
    });

    expect(result).toBe('downloaded-and-copied');
    expect(input.download).toHaveBeenCalledOnce();
    expect(input.copy).toHaveBeenCalledWith(scanUrl);
  });

  it('treats AbortError as cancellation without fallback', async () => {
    const input = createInput();

    const result = await shareTargetQrArtifact(input, {
      share: vi.fn(async () => {
        throw new DOMException('Share cancelled', 'AbortError');
      }),
      canShare: vi.fn(() => true),
    });

    expect(result).toBe('cancelled');
    expect(input.download).not.toHaveBeenCalled();
    expect(input.copy).not.toHaveBeenCalled();
  });

  it('reports native share failures without invoking fallback', async () => {
    const input = createInput();

    const result = await shareTargetQrArtifact(input, {
      share: vi.fn(async () => {
        throw new Error('share target failed');
      }),
      canShare: vi.fn(() => true),
    });

    expect(result).toBe('failed');
    expect(input.download).not.toHaveBeenCalled();
    expect(input.copy).not.toHaveBeenCalled();
  });

  it('reports a partial fallback when the image downloads but copying fails', async () => {
    const input = createInput();
    input.copy = vi.fn(async () => {
      throw new Error('clipboard denied');
    });

    const result = await shareTargetQrArtifact(input, {
      share: null,
      canShare: null,
    });

    expect(result).toBe('downloaded-copy-failed');
    expect(input.download).toHaveBeenCalledWith(input.artifact);
    expect(input.copy).toHaveBeenCalledWith(scanUrl);
  });
});
```

- [ ] **Step 2: Run the helper tests and verify RED**

Run: `npm.cmd test -- tests/targetQrShare.test.ts`

Expected: FAIL because `src/app/targetQrShare.ts` does not exist.

- [ ] **Step 3: Implement the minimal share helper**

Create `src/app/targetQrShare.ts`:

```ts
import type { TargetQrArtifact } from './targetQrCode';

export type TargetQrShareResult =
  | 'shared'
  | 'downloaded-and-copied'
  | 'downloaded-copy-failed'
  | 'cancelled'
  | 'failed';

export type TargetQrShareInput = {
  artifact: TargetQrArtifact;
  targetLabel: string;
  scanUrl: string;
  download: (artifact: TargetQrArtifact) => void;
  copy: (scanUrl: string) => Promise<void>;
};

type TargetQrShareDependencies = {
  share: ((data: ShareData) => Promise<void>) | null;
  canShare: ((data: ShareData) => boolean) | null;
  createFile: (blob: Blob, filename: string) => File;
};

export async function shareTargetQrArtifact(
  input: TargetQrShareInput,
  dependencyOverrides: Partial<TargetQrShareDependencies> = {},
): Promise<TargetQrShareResult> {
  const dependencies = {
    ...browserShareDependencies(),
    ...dependencyOverrides,
  };

  let file: File;
  try {
    file = dependencies.createFile(input.artifact.blob, input.artifact.filename);
  } catch {
    return runFallback(input);
  }

  let canShareFile = false;
  try {
    canShareFile = Boolean(
      dependencies.share
      && dependencies.canShare?.({ files: [file] }),
    );
  } catch {
    return runFallback(input);
  }

  if (!canShareFile || !dependencies.share) {
    return runFallback(input);
  }

  try {
    await dependencies.share({
      title: `AnchorAR — ${input.targetLabel}`,
      text: `Scan this QR code to open the AR experience: ${input.scanUrl}`,
      url: input.scanUrl,
      files: [file],
    });
    return 'shared';
  } catch (error) {
    return isAbortError(error) ? 'cancelled' : 'failed';
  }
}

function browserShareDependencies(): TargetQrShareDependencies {
  const browserNavigator = typeof navigator === 'undefined' ? undefined : navigator;
  return {
    share: typeof browserNavigator?.share === 'function'
      ? browserNavigator.share.bind(browserNavigator)
      : null,
    canShare: typeof browserNavigator?.canShare === 'function'
      ? browserNavigator.canShare.bind(browserNavigator)
      : null,
    createFile: (blob, filename) => new File(
      [blob],
      filename,
      { type: blob.type || 'image/png' },
    ),
  };
}

async function runFallback(input: TargetQrShareInput): Promise<TargetQrShareResult> {
  try {
    input.download(input.artifact);
  } catch {
    return 'failed';
  }

  try {
    await input.copy(input.scanUrl);
    return 'downloaded-and-copied';
  } catch {
    return 'downloaded-copy-failed';
  }
}

function isAbortError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'name' in error
    && (error as { name: unknown }).name === 'AbortError';
}
```

- [ ] **Step 4: Run the helper tests and verify GREEN**

Run: `npm.cmd test -- tests/targetQrShare.test.ts`

Expected: 6 tests pass with 0 failures.

- [ ] **Step 5: Commit Task 1**

```powershell
git add -- src/app/targetQrShare.ts tests/targetQrShare.test.ts
git commit -m "feat: add target QR share orchestration"
```

---

### Task 2: QR dialog share interaction and status UI

**Files:**
- Modify: `src/ui/targetQrDialog.ts:1-190`
- Modify: `src/style.css:2138-2237`
- Modify: `tests/targetQrDialog.test.ts:1-195`
- Modify: `tests/targetQrStyles.test.ts:1-35`

**Interfaces:**
- Consumes: `TargetQrShareResult` and an `onShare(scanUrl, targetLabel)` handler returning that result.
- Produces: a primary `[data-target-qr-share]` action, a polite `[data-target-qr-share-status]` region, and public `setShareBusy`, `setShareStatus`, and `clearShareStatus` dialog methods.

- [ ] **Step 1: Write failing dialog behavior tests**

Update `createHandlers()` so `onShare` resolves to `'shared'`, then add tests asserting loading/ready/error state, primary action order, handler routing, busy guarding, success copy, cancellation silence, failure copy, and stale-result protection. Use this deferred-share test verbatim:

```ts
it('guards repeated shares, reports success, and restores the ready state', async () => {
  const host = document.createElement('main');
  document.body.append(host);
  let resolveShare = (_result: 'shared') => undefined;
  const handlers = createHandlers();
  handlers.onShare.mockImplementation(() => new Promise((resolve) => {
    resolveShare = resolve;
  }));
  const dialog = createTargetQrDialog(host, handlers);
  dialog.open(openInput());
  dialog.setReady('blob:target-preview');
  const share = host.querySelector<HTMLButtonElement>('[data-target-qr-share]')!;

  share.click();
  share.click();

  expect(handlers.onShare).toHaveBeenCalledOnce();
  expect(handlers.onShare).toHaveBeenCalledWith(
    'https://example.com/Mark-AR/#/scan/scan-one',
    'Product marker',
  );
  expect(share.disabled).toBe(true);
  expect(share.textContent).toBe('Sharing…');
  expect(share.getAttribute('aria-busy')).toBe('true');

  resolveShare('shared');
  await Promise.resolve();
  await Promise.resolve();

  expect(share.disabled).toBe(false);
  expect(share.textContent).toBe('Share QR');
  expect(share.hasAttribute('aria-busy')).toBe(false);
  expect(host.querySelector('[data-target-qr-share-status]')?.textContent).toBe(
    'QR code and scan link shared.',
  );
});
```

Add a parameterized result-copy test:

```ts
it.each([
  ['downloaded-and-copied', 'QR downloaded and scan link copied. Attach the QR image and paste the link in your app.'],
  ['downloaded-copy-failed', 'QR downloaded. Copy the scan link manually from above.'],
  ['failed', 'The QR could not be shared. Try again or use Download QR and Copy link.'],
] as const)('renders the %s share result', async (result, message) => {
  const host = document.createElement('main');
  document.body.append(host);
  const handlers = createHandlers();
  handlers.onShare.mockResolvedValue(result);
  const dialog = createTargetQrDialog(host, handlers);
  dialog.open(openInput());
  dialog.setReady('blob:target-preview');

  host.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.click();
  await Promise.resolve();
  await Promise.resolve();

  expect(host.querySelector('[data-target-qr-share-status]')?.textContent).toBe(message);
});
```

Add cancellation assertions and a same-object close/reopen regression:

```ts
it('keeps cancellation silent and ignores a result after close', async () => {
  const host = document.createElement('main');
  document.body.append(host);
  let resolveShare = (_result: 'cancelled' | 'shared') => undefined;
  const handlers = createHandlers();
  handlers.onShare.mockImplementation(() => new Promise((resolve) => {
    resolveShare = resolve;
  }));
  const dialog = createTargetQrDialog(host, handlers);
  dialog.open(openInput());
  dialog.setReady('blob:target-preview');
  host.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.click();
  resolveShare('cancelled');
  await Promise.resolve();
  await Promise.resolve();
  expect(host.querySelector<HTMLElement>('[data-target-qr-share-status]')?.hidden).toBe(true);

  host.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.click();
  dialog.close();
  resolveShare('shared');
  await Promise.resolve();
  await Promise.resolve();
  expect(dialog.isOpen()).toBe(false);
  expect(host.querySelector<HTMLElement>('[data-target-qr-share-status]')?.hidden).toBe(true);
});

it('ignores an old share result after reopening with the same input object', async () => {
  const host = document.createElement('main');
  document.body.append(host);
  let resolveOldShare = (_result: 'shared') => undefined;
  let resolveNewShare = (_result: 'downloaded-copy-failed') => undefined;
  const handlers = createHandlers();
  handlers.onShare
    .mockImplementationOnce(() => new Promise((resolve) => {
      resolveOldShare = resolve;
    }))
    .mockImplementationOnce(() => new Promise((resolve) => {
      resolveNewShare = resolve;
    }));
  const dialog = createTargetQrDialog(host, handlers);
  const input = openInput();
  const share = host.querySelector<HTMLButtonElement>('[data-target-qr-share]')!;
  const status = host.querySelector<HTMLElement>('[data-target-qr-share-status]')!;

  dialog.open(input);
  dialog.setReady('blob:old-target-preview');
  share.click();
  dialog.close();

  dialog.open(input);
  dialog.setReady('blob:new-target-preview');
  share.click();

  resolveOldShare('shared');
  await Promise.resolve();
  await Promise.resolve();
  expect(status.hidden).toBe(true);
  expect(status.textContent).toBe('');
  expect(share.disabled).toBe(true);
  expect(share.textContent).toBe('Sharing\u2026');

  resolveNewShare('downloaded-copy-failed');
  await Promise.resolve();
  await Promise.resolve();
  expect(status.textContent).toBe('QR downloaded. Copy the scan link manually from above.');
  expect(share.disabled).toBe(false);
  expect(share.textContent).toBe('Share QR');
});
```

Update the focus-trap expectation so Tab from `Done` wraps to `[data-target-qr-share]`, and Shift+Tab from share wraps to `Done`. Assert the share button is disabled in loading/error and enabled in ready state, appears before download, has `action-control--primary`, and download has `action-control--secondary`.

Update `tests/targetQrStyles.test.ts` to assert `.target-qr-share-status` spans the full dialog grid and that `.target-qr-actions` still wraps.

- [ ] **Step 2: Run dialog and style tests and verify RED**

Run: `npm.cmd test -- tests/targetQrDialog.test.ts tests/targetQrStyles.test.ts`

Expected: FAIL because the share action, share handler, busy state, status region, and status styles do not exist.

- [ ] **Step 3: Implement the dialog share state**

In `src/ui/targetQrDialog.ts`, import `TargetQrShareResult`, extend `TargetQrDialogHandlers`, and extend `TargetQrDialog`:

```ts
import type { TargetQrShareResult } from '../app/targetQrShare';

export type TargetQrDialogHandlers = {
  onShare: (scanUrl: string, targetLabel: string) => Promise<TargetQrShareResult>;
  onDownload: () => void;
  onCopy: (scanUrl: string) => void | Promise<void>;
  onOpenScanner: (scanHref: string) => void;
  onRetry: () => void;
  onClose: () => void;
};

export type TargetQrDialog = {
  open: (input: TargetQrDialogOpenInput) => void;
  setLoading: () => void;
  setReady: (previewUrl: string) => void;
  setError: (message: string) => void;
  setShareBusy: (busy: boolean) => void;
  setShareStatus: (message: string, tone?: 'success' | 'error') => void;
  clearShareStatus: () => void;
  close: () => void;
  isOpen: () => boolean;
  destroy: () => void;
};
```

Render these controls immediately after the scan URL block, before the existing download/copy/open actions:

```html
<p
  class="target-qr-share-status"
  data-target-qr-share-status
  role="status"
  aria-live="polite"
  hidden
></p>
<div class="target-qr-actions">
  <button
    class="action-control action-control--primary"
    type="button"
    data-target-qr-share
    disabled
  >Share QR</button>
  <button
    class="action-control action-control--secondary"
    type="button"
    data-target-qr-download
    disabled
  >Download QR</button>
```

Keep the existing copy, open, retry, and done buttons after that snippet and close the existing action container normally.

Use these exact result messages:

```ts
const SHARE_RESULT_COPY: Record<Exclude<TargetQrShareResult, 'cancelled'>, {
  message: string;
  tone: 'success' | 'error';
}> = {
  shared: {
    message: 'QR code and scan link shared.',
    tone: 'success',
  },
  'downloaded-and-copied': {
    message: 'QR downloaded and scan link copied. Attach the QR image and paste the link in your app.',
    tone: 'success',
  },
  'downloaded-copy-failed': {
    message: 'QR downloaded. Copy the scan link manually from above.',
    tone: 'error',
  },
  failed: {
    message: 'The QR could not be shared. Try again or use Download QR and Copy link.',
    tone: 'error',
  },
};
```

Track `imageReady`, `shareBusy`, and a monotonically increasing dialog session token. Increment the token on every `open` and `close`. `setShareBusy(true)` must synchronously disable share, set `Sharing…`, and set `aria-busy="true"`; false restores `Share QR`, removes `aria-busy`, and enables only when `imageReady` is true. `setLoading`, `setError`, `open`, and `close` clear share status and reset busy state. `setReady` enables share and download.

The click handler must capture both the current input object and current dialog session token, synchronously enter busy state, clear status, and invoke `handlers.onShare(scanUrl, targetLabel)` immediately. On resolution or rejection, update status only when the captured token still matches, the same input is still current, and the dialog is open; treat rejection as `failed`. Apply the same three-part guard in `finally` before restoring busy state, so a result from a closed or reopened session cannot affect the current session even when the caller reuses the exact same input object. Register and remove the share listener with the existing listeners.

Add status styling in `src/style.css`:

```css
.target-qr-share-status {
  grid-column: 1 / -1;
  min-height: 1.3em;
  margin: -2px 2px 0;
  color: var(--teal-dark);
  font-size: 0.78rem;
  font-weight: 800;
}

.target-qr-share-status[data-tone='error'] {
  color: var(--danger);
}
```

- [ ] **Step 4: Run dialog and style tests and verify GREEN**

Run: `npm.cmd test -- tests/targetQrDialog.test.ts tests/targetQrStyles.test.ts`

Expected: all target QR dialog and style tests pass with 0 failures.

- [ ] **Step 5: Commit Task 2**

```powershell
git add -- src/ui/targetQrDialog.ts src/style.css tests/targetQrDialog.test.ts tests/targetQrStyles.test.ts
git commit -m "feat: add QR popup share action"
```

---

### Task 3: Retained-artifact integration and fallback clipboard flow

**Files:**
- Modify: `src/main.ts:53-62,275-312,2378-2390`
- Modify: `tests/targetQrIntegration.test.ts:35-190`

**Interfaces:**
- Consumes: `shareTargetQrArtifact`, the retained `targetQrPromptArtifact`, `downloadTargetQrArtifact`, and a raw clipboard writer that rejects on failure.
- Produces: the dialog `onShare` handler that shares the exact retained artifact and URL without QR regeneration.

- [ ] **Step 1: Write failing integration tests**

Extend `browserMocks` with `share` and `canShare`, reset them in `beforeEach`, default `share` to a resolved promise and `canShare` to true, and install both functions on `navigator` with configurable `Object.defineProperty` calls.

Add the native-path integration test:

```ts
it('shares the retained QR image and exact scan URL from the prompt', async () => {
  await import('../src/main');
  await createNewTarget();
  await waitFor(() => isQrDialogOpen());

  document.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.click();
  await waitFor(() => browserMocks.share.mock.calls.length === 1);

  const payload = browserMocks.share.mock.calls[0][0] as ShareData;
  expect(payload.title).toBe('AnchorAR — New marker');
  expect(payload.text).toBe(
    'Scan this QR code to open the AR experience: https://example.com/Mark-AR/#/scan/scan-new',
  );
  expect(payload.url).toBe('https://example.com/Mark-AR/#/scan/scan-new');
  expect(payload.files?.[0].name).toBe('anchorar-new-marker-qr.png');
  expect(payload.files?.[0].type).toBe('image/png');
  expect(qrMocks.createTargetQrArtifact).toHaveBeenCalledTimes(1);
  expect(qrMocks.downloadTargetQrArtifact).not.toHaveBeenCalled();
  expect(browserMocks.writeText).not.toHaveBeenCalled();
  await waitFor(() => document.querySelector('[data-target-qr-share-status]')?.textContent === (
    'QR code and scan link shared.'
  ));
});
```

Add the unsupported-path integration test:

```ts
it('downloads the retained QR and copies its URL when file sharing is unsupported', async () => {
  browserMocks.canShare.mockReturnValue(false);
  await import('../src/main');
  await createNewTarget();
  await waitFor(() => isQrDialogOpen());

  document.querySelector<HTMLButtonElement>('[data-target-qr-share]')?.click();
  await waitFor(() => qrMocks.downloadTargetQrArtifact.mock.calls.length === 1);
  await waitFor(() => browserMocks.writeText.mock.calls.length === 1);

  expect(qrMocks.downloadTargetQrArtifact).toHaveBeenCalledWith(expect.objectContaining({
    filename: 'anchorar-new-marker-qr.png',
  }));
  expect(browserMocks.writeText).toHaveBeenCalledWith(
    'https://example.com/Mark-AR/#/scan/scan-new',
  );
  expect(browserMocks.share).not.toHaveBeenCalled();
  expect(qrMocks.createTargetQrArtifact).toHaveBeenCalledTimes(1);
  await waitFor(() => document.querySelector('[data-target-qr-share-status]')?.textContent === (
    'QR downloaded and scan link copied. Attach the QR image and paste the link in your app.'
  ));
});
```

- [ ] **Step 2: Run the integration tests and verify RED**

Run: `npm.cmd test -- tests/targetQrIntegration.test.ts`

Expected: FAIL because `main.ts` does not supply `onShare` and the popup cannot invoke the helper.

- [ ] **Step 3: Integrate sharing in `main.ts`**

Add the helper import:

```ts
import { shareTargetQrArtifact } from './app/targetQrShare';
```

Add `onShare` before `onDownload` in the dialog handlers:

```ts
  onShare: async (scanUrl, targetLabel) => {
    if (!targetQrPromptArtifact) {
      return 'failed';
    }
    return shareTargetQrArtifact({
      artifact: targetQrPromptArtifact,
      targetLabel,
      scanUrl,
      download: downloadTargetQrArtifact,
      copy: writeTargetScanUrl,
    });
  },
```

Split raw clipboard writing from the existing user-facing copy action:

```ts
async function writeTargetScanUrl(scanUrl: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error('Clipboard access is unavailable in this browser.');
  }
  await navigator.clipboard.writeText(scanUrl);
}

async function copyTargetScanUrl(scanUrl: string): Promise<void> {
  try {
    await writeTargetScanUrl(scanUrl);
    updateImageTargetStatus('Scan link copied.', false);
  } catch (error) {
    updateImageTargetStatus(errorMessage(error, 'Unable to copy scan link'), true);
  }
}
```

Do not change the existing prompt-generation, row-download, target-create, or target-update flows.

- [ ] **Step 4: Run focused QR tests and verify GREEN**

Run: `npm.cmd test -- tests/targetQrShare.test.ts tests/targetQrDialog.test.ts tests/targetQrStyles.test.ts tests/targetQrIntegration.test.ts`

Expected: all focused QR tests pass with 0 failures.

- [ ] **Step 5: Run complete pre-commit verification**

Run each command and require exit code 0:

```powershell
npm.cmd test
npm.cmd run build
$env:GITHUB_PAGES='true'; npm.cmd run build
git diff --check
```

- [ ] **Step 6: Commit Task 3**

```powershell
git add -- src/main.ts tests/targetQrIntegration.test.ts
git commit -m "feat: share target QR from creation prompt"
```

---

## Final Verification and Release Gate

After all three task reviews are clean:

1. Run `npm.cmd test` and record the exact file/test counts.
2. Run `npm.cmd run build` and record exit code 0 plus emitted asset names.
3. Run `$env:GITHUB_PAGES='true'; npm.cmd run build` and confirm `/Mark-AR/` asset paths.
4. Run `git diff --check` and inspect `git status --short` so unrelated untracked files remain untouched.
5. Exercise the popup in a browser: verify Share is primary, Download is secondary, unsupported fallback downloads the image and copies the URL, and the popup remains open.
6. Request a whole-branch code review against the merge base and fix all Critical or Important findings.
7. Fast-forward merge the feature branch into `main`, rerun the full test suite and Pages build on the merged result, push `main`, watch the GitHub Pages workflow to completion, and verify the live HTML plus emitted JavaScript asset return HTTP 200 and contain `Share QR`.
