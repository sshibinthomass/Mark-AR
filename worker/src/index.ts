export interface R2ObjectLike {
  body: BodyInit | null;
  httpMetadata?: { contentType?: string };
  text?(): Promise<string>;
  arrayBuffer?(): Promise<ArrayBuffer>;
}

export interface R2BucketLike {
  get(key: string): Promise<R2ObjectLike | null>;
  put(
    key: string,
    value: string | ArrayBuffer | Uint8Array | ReadableStream,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<unknown>;
  delete(key: string): Promise<unknown>;
}

export interface WorkerEnv {
  AUTH_SECRET: string;
  ADMIN_EMAIL?: string;
  ALLOWED_ORIGINS?: string;
  LEGACY_WORKER_ORIGIN?: string;
  LEGACY_WORKER?: { fetch: typeof fetch };
  PUBLIC_ORIGIN?: string;
  ASSET_BUCKET: R2BucketLike;
}

export type WorkerDeps = {
  fetch: typeof fetch;
  now: () => Date;
  randomUUID: () => string;
};

type User = {
  email: string;
  name?: string;
  role: 'admin' | 'user';
  status: 'active' | 'pending';
  password_hash: string;
  password_salt: string;
  created_at: string;
  updated_at: string;
};

type Session = {
  sub: string;
  role: 'admin' | 'user';
  jti: string;
  iat: number;
  exp: number;
};

type Target = {
  id: string;
  label: string;
  image_url: string;
  image_object_key: string;
  objects: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  owner_email: string;
  visibility: 'public' | 'private';
  scan_id: string;
  access_mode: 'anyone_with_link' | 'any_signed_in' | 'owner_only' | 'specific_accounts';
  allowed_emails: string[];
  created_at: string;
  updated_at: string;
};

type TargetRequest = {
  label?: unknown;
  image_base64?: unknown;
  image_mime_type?: unknown;
  objects?: unknown;
  groups?: unknown;
  access_mode?: unknown;
  allowed_emails?: unknown;
};

const USERS_KEY = 'auth/users/index.json';
const TARGETS_KEY = 'image-targets/index.json';
const MODELS_KEY = 'models/generated/index.json';
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const PASSWORD_ITERATIONS = 100_000;
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export default {
  fetch(request: Request, env: WorkerEnv): Promise<Response> {
    return handleRequest(request, env);
  },
};

export async function handleRequest(
  request: Request,
  env: WorkerEnv,
  partialDeps: Partial<WorkerDeps> = {},
): Promise<Response> {
  const deps: WorkerDeps = {
    fetch,
    now: () => new Date(),
    randomUUID: () => crypto.randomUUID(),
    ...partialDeps,
  };
  try {
    const response = await route(request, env, deps);
    return withCors(response, request, env);
  } catch (error) {
    return withCors(json({ error: error instanceof Error ? error.message : 'Worker request failed.' }, 500), request, env);
  }
}

async function route(request: Request, env: WorkerEnv, deps: WorkerDeps): Promise<Response> {
  const url = new URL(request.url);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (env.LEGACY_WORKER_ORIGIN && (
    url.pathname.startsWith('/auth/')
    || (request.method === 'GET' && url.pathname === '/generate-3d/models')
  )) {
    return proxyLegacyRequest(request, env.LEGACY_WORKER_ORIGIN, url, legacyFetch(env, deps));
  }
  if (url.pathname.startsWith('/auth/')) return handleAuth(request, env, deps, url.pathname);
  if (request.method === 'GET' && url.pathname === '/generate-3d/models') {
    const index = await readJson<{ models?: unknown[] }>(env, MODELS_KEY, { models: [] });
    const user = await authenticatedUser(request, env, deps);
    const models = (index.models ?? []).filter((model) => {
      if (!model || typeof model !== 'object') return false;
      const candidate = model as Record<string, unknown>;
      if (user?.role === 'admin') return true;
      if (candidate.visibility !== 'private') return true;
      return Boolean(user && candidate.owner_email === user.email);
    });
    return json({ models });
  }
  if (request.method === 'GET' && (
    url.pathname.startsWith('/image-targets/images/')
    || url.pathname.startsWith('/image-targets/media/')
    || url.pathname.startsWith('/models/generated/')
  )) {
    return serveAsset(url.pathname.slice(1), env);
  }

  const scanPrefix = '/generate-3d/image-targets/scan/';
  if (request.method === 'GET' && url.pathname.startsWith(scanPrefix)) {
    return getScanTarget(request, env, deps, url.pathname.slice(scanPrefix.length));
  }
  if (url.pathname === '/generate-3d/image-targets') {
    if (request.method === 'GET') return listTargets(request, env, deps);
    if (request.method === 'POST') return createTarget(request, env, deps, url);
    return json({ error: 'Method not allowed.' }, 405);
  }
  const targetPrefix = '/generate-3d/image-targets/';
  if (url.pathname.startsWith(targetPrefix)) {
    const targetId = decodeURIComponent(url.pathname.slice(targetPrefix.length));
    if (request.method === 'PATCH') return updateTarget(request, env, deps, url, targetId);
    if (request.method === 'DELETE') return deleteTarget(request, env, deps, targetId);
    return json({ error: 'Method not allowed.' }, 405);
  }
  return json({ error: 'Not found.' }, 404);
}

async function handleAuth(
  request: Request,
  env: WorkerEnv,
  deps: WorkerDeps,
  path: string,
): Promise<Response> {
  if (!env.AUTH_SECRET) return json({ error: 'AUTH_SECRET is not configured.' }, 500);
  if (path === '/auth/signup' && request.method === 'POST') {
    const body = await requestJson(request);
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!email || password.length < 8 || !name) {
      return json({ error: 'Name, a valid email, and a password of at least 8 characters are required.' }, 400);
    }
    const index = await readJson<{ users: User[] }>(env, USERS_KEY, { users: [] });
    if (index.users.some((user) => user.email === email)) return json({ error: 'An account already exists for this email.' }, 409);
    const now = deps.now();
    const role = email === normalizeEmail(env.ADMIN_EMAIL) ? 'admin' : 'user';
    const status = role === 'admin' ? 'active' as const : 'pending' as const;
    const salt = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(16)));
    const user: User = {
      email,
      name,
      role,
      status,
      password_salt: salt,
      password_hash: await hashPassword(password, salt),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    await writeJson(env, USERS_KEY, { users: [user, ...index.users] });
    return json({
      user: publicUser(user),
      ...(status === 'active' ? { token: await createToken(user, env, deps) } : {}),
    }, 201);
  }
  if (path === '/auth/login' && request.method === 'POST') {
    const body = await requestJson(request);
    const email = normalizeEmail(body.email);
    const password = typeof body.password === 'string' ? body.password : '';
    const index = await readJson<{ users: User[] }>(env, USERS_KEY, { users: [] });
    const user = index.users.find((candidate) => candidate.email === email);
    if (!user || !await verifyPassword(password, user)) return json({ error: 'Email or password is incorrect.' }, 401);
    if (user.status !== 'active') return json({ user: publicUser(user) }, 403);
    return json({ user: publicUser(user), token: await createToken(user, env, deps) });
  }
  if (path === '/auth/session' && request.method === 'GET') {
    const user = await authenticatedUser(request, env, deps);
    return user ? json({ user: publicUser(user) }) : json({ error: 'Invalid or expired session.' }, 401);
  }
  if (path === '/auth/logout' && request.method === 'POST') return json({ ok: true });
  return json({ error: 'Auth route not found.' }, 404);
}

async function proxyLegacyRequest(
  request: Request,
  legacyOrigin: string,
  sourceUrl: URL,
  fetchImpl: typeof fetch,
): Promise<Response> {
  const targetUrl = `${legacyOrigin.replace(/\/+$/, '')}${sourceUrl.pathname}${sourceUrl.search}`;
  const body = request.method === 'GET' || request.method === 'HEAD'
    ? undefined
    : await request.clone().arrayBuffer();
  const headers = new Headers(request.headers);
  headers.delete('host');
  return fetchImpl(targetUrl, {
    method: request.method,
    headers,
    ...(body ? { body } : {}),
    redirect: 'manual',
  });
}

function legacyFetch(env: WorkerEnv, deps: WorkerDeps): typeof fetch {
  return env.LEGACY_WORKER?.fetch.bind(env.LEGACY_WORKER) ?? deps.fetch;
}

async function listTargets(request: Request, env: WorkerEnv, deps: WorkerDeps): Promise<Response> {
  const user = await authenticatedUser(request, env, deps);
  const targets = await targetIndex(env, deps);
  return json({
    targets: targets.filter((target) => user && target.owner_email === user.email),
  });
}

async function getScanTarget(
  request: Request,
  env: WorkerEnv,
  deps: WorkerDeps,
  scanId: string,
): Promise<Response> {
  const targets = await targetIndex(env, deps);
  const target = targets.find((candidate) => candidate.scan_id === scanId);
  if (!target) return json({ error: 'Target not found.' }, 404);
  const user = await authenticatedUser(request, env, deps);
  if (!canScan(target, user)) return json({ error: user ? 'You do not have access to this target.' : 'Sign in to scan this target.' }, 401);
  return json({ target });
}

async function createTarget(
  request: Request,
  env: WorkerEnv,
  deps: WorkerDeps,
  url: URL,
): Promise<Response> {
  const user = await requireUser(request, env, deps);
  if (user instanceof Response) return user;
  const body = await requestJson(request) as TargetRequest;
  const label = typeof body.label === 'string' ? body.label.trim() : '';
  if (!label) return json({ error: 'Target label is required.' }, 400);
  const marker = decodeImage(body.image_base64, body.image_mime_type);
  if ('error' in marker) return json({ error: marker.error }, 400);
  if (!Array.isArray(body.objects) || body.objects.length === 0) {
    return json({ error: 'Add at least one target object.' }, 400);
  }
  const targets = await targetIndex(env, deps);
  const id = deps.randomUUID();
  const scanId = deps.randomUUID();
  const markerKey = `image-targets/images/${safe(id)}.${extension(marker.mime)}`;
  const now = deps.now().toISOString();
  const mediaResult = await persistObjects(body.objects, id, [], env, deps, url);
  if ('error' in mediaResult) return json({ error: mediaResult.error }, 400);
  await env.ASSET_BUCKET.put(markerKey, marker.bytes, { httpMetadata: { contentType: marker.mime } });
  const access = normalizeAccess(body, user.email);
  if ('error' in access) {
    await cleanupKeys(mediaResult.createdKeys, env);
    await env.ASSET_BUCKET.delete(markerKey);
    return json({ error: access.error }, 400);
  }
  const target: Target = {
    id,
    label,
    image_url: publicAssetUrl(markerKey, env, url),
    image_object_key: markerKey,
    objects: mediaResult.objects,
    groups: normalizeGroups(body.groups),
    owner_email: user.email,
    visibility: access.access_mode === 'anyone_with_link' ? 'public' : 'private',
    scan_id: scanId,
    ...access,
    created_at: now,
    updated_at: now,
  };
  await writeTargets(env, [target, ...targets]);
  return json({ target }, 201);
}

async function updateTarget(
  request: Request,
  env: WorkerEnv,
  deps: WorkerDeps,
  url: URL,
  targetId: string,
): Promise<Response> {
  const user = await requireUser(request, env, deps);
  if (user instanceof Response) return user;
  const targets = await targetIndex(env, deps);
  const index = targets.findIndex((target) => target.id === targetId);
  if (index < 0) return json({ error: 'Target not found.' }, 404);
  const existing = targets[index];
  if (existing.owner_email !== user.email) return json({ error: 'Only the target owner can edit it.' }, 403);
  const body = await requestJson(request) as TargetRequest;
  if (Array.isArray(body.objects) && body.objects.length === 0) {
    return json({ error: 'Add at least one target object.' }, 400);
  }
  let markerKey = existing.image_object_key;
  let markerUrl = existing.image_url;
  let oldMarkerKey: string | undefined;
  if (body.image_base64 !== undefined || body.image_mime_type !== undefined) {
    const marker = decodeImage(body.image_base64, body.image_mime_type);
    if ('error' in marker) return json({ error: marker.error }, 400);
    markerKey = `image-targets/images/${safe(targetId)}-${deps.now().getTime().toString(36)}.${extension(marker.mime)}`;
    await env.ASSET_BUCKET.put(markerKey, marker.bytes, { httpMetadata: { contentType: marker.mime } });
    markerUrl = publicAssetUrl(markerKey, env, url);
    oldMarkerKey = existing.image_object_key;
  }
  const oldMediaKeys = mediaKeys(existing.objects);
  const mediaResult = body.objects === undefined
    ? { objects: existing.objects, createdKeys: [] as string[] }
    : await persistObjects(body.objects, targetId, existing.objects, env, deps, url);
  if ('error' in mediaResult) {
    if (markerKey !== existing.image_object_key) await env.ASSET_BUCKET.delete(markerKey);
    return json({ error: mediaResult.error }, 400);
  }
  const access = normalizeAccess(body, user.email, existing);
  if ('error' in access) return json({ error: access.error }, 400);
  const updated: Target = {
    ...existing,
    ...(typeof body.label === 'string' && body.label.trim() ? { label: body.label.trim() } : {}),
    image_object_key: markerKey,
    image_url: markerUrl,
    objects: mediaResult.objects,
    ...(body.groups !== undefined ? { groups: normalizeGroups(body.groups) } : {}),
    visibility: access.access_mode === 'anyone_with_link' ? 'public' : 'private',
    ...access,
    updated_at: deps.now().toISOString(),
  };
  const next = [...targets];
  next[index] = updated;
  await writeTargets(env, next);
  const retainedKeys = new Set(mediaKeys(updated.objects));
  await cleanupKeys(oldMediaKeys.filter((key) => !retainedKeys.has(key)), env);
  if (oldMarkerKey) await env.ASSET_BUCKET.delete(oldMarkerKey);
  return json({ target: updated });
}

async function deleteTarget(
  request: Request,
  env: WorkerEnv,
  deps: WorkerDeps,
  targetId: string,
): Promise<Response> {
  const user = await requireUser(request, env, deps);
  if (user instanceof Response) return user;
  const targets = await targetIndex(env, deps);
  const target = targets.find((candidate) => candidate.id === targetId);
  if (!target) return json({ error: 'Target not found.' }, 404);
  if (target.owner_email !== user.email) return json({ error: 'Only the target owner can delete it.' }, 403);
  await writeTargets(env, targets.filter((candidate) => candidate.id !== targetId));
  await cleanupKeys([target.image_object_key, ...mediaKeys(target.objects)], env);
  return json({ deleted: true, target });
}

async function persistObjects(
  value: unknown,
  targetId: string,
  existingObjects: Record<string, unknown>[],
  env: WorkerEnv,
  deps: WorkerDeps,
  requestUrl: URL,
): Promise<{ objects: Record<string, unknown>[]; createdKeys: string[] } | { error: string }> {
  if (!Array.isArray(value)) return { error: 'objects must be an array.' };
  const existingById = new Map(existingObjects.map((object) => [String(object.id ?? ''), object]));
  const createdKeys: string[] = [];
  const objects: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  for (let index = 0; index < value.length; index += 1) {
    const raw = value[index];
    if (!raw || typeof raw !== 'object') return cleanupError('Every target object must be an object.', createdKeys, env);
    const candidate = raw as Record<string, unknown>;
    let id = `object-${index + 1}`;
    if (candidate.id !== undefined) {
      if (
        typeof candidate.id !== 'string'
        || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(candidate.id)
      ) {
        return cleanupError(
          'Target object IDs must use only letters, numbers, dot, underscore, or hyphen.',
          createdKeys,
          env,
        );
      }
      id = candidate.id;
    }
    if (seen.has(id)) return cleanupError('Target object IDs must be unique.', createdKeys, env);
    seen.add(id);
    const base = {
      ...candidate,
      id,
      placement: normalizePlacement(candidate.placement),
    };
    if (candidate.kind === 'image') {
      const imageResult = await persistImageObject(
        candidate.image,
        targetId,
        id,
        existingById.get(id),
        env,
        deps,
        requestUrl,
      );
      if ('error' in imageResult) return cleanupError(imageResult.error, createdKeys, env);
      if (imageResult.createdKey) createdKeys.push(imageResult.createdKey);
      objects.push({ ...base, kind: 'image', image: imageResult.image });
      continue;
    }
    if (candidate.kind === 'youtube') {
      const youtube = normalizeYouTube(candidate.youtube);
      if (!youtube) return cleanupError('A valid YouTube link is required.', createdKeys, env);
      objects.push({ ...base, kind: 'youtube', youtube });
      continue;
    }
    if (candidate.kind === 'text') {
      if (!candidate.text || typeof candidate.text !== 'object') return cleanupError('Text object content is required.', createdKeys, env);
      objects.push({ ...base, kind: 'text', text: candidate.text });
      continue;
    }
    const model = candidate.model;
    if (!model || typeof model !== 'object') return cleanupError('3D model object content is required.', createdKeys, env);
    objects.push({ ...base, kind: 'model', model });
  }
  return { objects, createdKeys };
}

async function persistImageObject(
  value: unknown,
  targetId: string,
  objectId: string,
  existingObject: Record<string, unknown> | undefined,
  env: WorkerEnv,
  deps: WorkerDeps,
  requestUrl: URL,
): Promise<{ image: Record<string, unknown>; createdKey?: string } | { error: string }> {
  if (!value || typeof value !== 'object') return { error: 'Image object content is required.' };
  const image = value as Record<string, unknown>;
  const label = typeof image.label === 'string' && image.label.trim() ? image.label.trim() : 'Image';
  const width = positive(image.width);
  const height = positive(image.height);
  const aspectRatio = positive(image.aspect_ratio);
  if (!width || !height || !aspectRatio) return { error: 'Image width, height, and aspect ratio must be positive.' };
  const pending = image.pending_source;
  let bytes: Uint8Array | undefined;
  let mime: string | undefined;
  if (pending && typeof pending === 'object') {
    const source = pending as Record<string, unknown>;
    if (source.source === 'upload') {
      const decoded = decodeImage(source.image_base64, source.image_mime_type);
      if ('error' in decoded) return decoded;
      bytes = decoded.bytes;
      mime = decoded.mime;
    } else if (source.source === 'url') {
      const imported = await importPublicImage(source.source_url, deps.fetch);
      if ('error' in imported) return imported;
      bytes = imported.bytes;
      mime = imported.mime;
    } else {
      return { error: 'Image pending_source is invalid.' };
    }
  }
  if (!bytes || !mime) {
    const objectKey = typeof image.object_key === 'string' ? image.object_key : existingImageKey(existingObject);
    const url = typeof image.url === 'string' ? image.url : existingImageUrl(existingObject);
    if (!objectKey || !url) return { error: 'New image objects require an upload or public URL source.' };
    return { image: { url, object_key: objectKey, label, width, height, aspect_ratio: aspectRatio } };
  }
  const key = `image-targets/media/${safe(targetId)}/${objectId}.${extension(mime)}`;
  await env.ASSET_BUCKET.put(key, bytes, { httpMetadata: { contentType: mime } });
  return {
    image: {
      url: publicAssetUrl(key, env, requestUrl),
      object_key: key,
      label,
      width,
      height,
      aspect_ratio: aspectRatio,
    },
    createdKey: key,
  };
}

async function importPublicImage(
  input: unknown,
  fetchImpl: typeof fetch,
): Promise<{ bytes: Uint8Array; mime: string } | { error: string }> {
  if (typeof input !== 'string') return { error: 'A public HTTPS image URL is required.' };
  let current = safePublicUrl(input);
  if (!current) return { error: 'A public HTTPS image URL is required.' };
  for (let redirect = 0; redirect <= 3; redirect += 1) {
    const response = await fetchImpl(current, { redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('Location');
      await cancelResponseBody(response);
      current = location ? safePublicUrl(new URL(location, current).toString()) : null;
      if (!current) return { error: 'Image URL redirected to an unsafe location.' };
      continue;
    }
    if (!response.ok) {
      await cancelResponseBody(response);
      return { error: `Unable to download image (HTTP ${response.status}).` };
    }
    const declaredLength = Number(response.headers.get('Content-Length') ?? 0);
    if (declaredLength > MAX_IMAGE_BYTES) {
      await cancelResponseBody(response);
      return { error: 'Image objects must be 5 MB or smaller.' };
    }
    const mime = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() ?? '';
    if (!IMAGE_MIME_TYPES.has(mime)) {
      await cancelResponseBody(response);
      return { error: 'Image objects must be PNG, JPEG, or WebP.' };
    }
    const downloaded = await readResponseBodyWithLimit(response, MAX_IMAGE_BYTES);
    if ('error' in downloaded) return downloaded;
    return { bytes: downloaded.bytes, mime };
  }
  return { error: 'Image URL redirected too many times.' };
}

async function cancelResponseBody(response: Response): Promise<void> {
  try {
    await response.body?.cancel();
  } catch {
    // The response has already been released or cancelled.
  }
}

async function readResponseBodyWithLimit(
  response: Response,
  maxBytes: number,
): Promise<{ bytes: Uint8Array } | { error: string }> {
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength <= maxBytes
      ? { bytes }
      : { error: 'Image objects must be 5 MB or smaller.' };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { error: 'Image objects must be 5 MB or smaller.' };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes };
}

function safePublicUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || privateIpv4(host)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeYouTube(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Record<string, unknown>;
  const id = typeof candidate.video_id === 'string' ? candidate.video_id : '';
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
  return {
    video_id: id,
    url: `https://www.youtube.com/watch?v=${id}`,
    thumbnail_url: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  };
}

function normalizePlacement(value: unknown): Record<string, number> {
  const candidate = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const number = (key: string, fallback: number, min: number, max: number) => {
    const value = candidate[key];
    return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
  };
  return {
    scale: number('scale', 1, 0.1, 5),
    offset_x: number('offset_x', 0, -2, 2),
    offset_y: number('offset_y', 0, -2, 2),
    height: number('height', 0.12, -2, 2),
    rotation_x: number('rotation_x', 0, -360, 360),
    rotation_y: number('rotation_y', 0, -360, 360),
    rotation_z: number('rotation_z', 0, -360, 360),
  };
}

function normalizeGroups(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((group): group is Record<string, unknown> => Boolean(group && typeof group === 'object')) : [];
}

function normalizeAccess(
  body: TargetRequest,
  ownerEmail: string,
  fallback?: Target,
): Pick<Target, 'access_mode' | 'allowed_emails'> | { error: string } {
  const requested = body.access_mode ?? fallback?.access_mode ?? 'owner_only';
  if (!['anyone_with_link', 'any_signed_in', 'owner_only', 'specific_accounts'].includes(String(requested))) {
    return { error: 'access_mode is invalid.' };
  }
  const emails = body.allowed_emails === undefined
    ? fallback?.allowed_emails ?? []
    : Array.isArray(body.allowed_emails)
      ? [...new Set(body.allowed_emails.flatMap((value) => {
        const email = normalizeEmail(value);
        return email && email !== ownerEmail ? [email] : [];
      }))]
      : [];
  if (requested === 'specific_accounts' && emails.length === 0) {
    return { error: 'specific_accounts requires at least one account email.' };
  }
  return {
    access_mode: requested as Target['access_mode'],
    allowed_emails: requested === 'specific_accounts' ? emails : [],
  };
}

function canScan(target: Target, user: User | null): boolean {
  if (target.access_mode === 'anyone_with_link') return true;
  if (!user || user.status !== 'active') return false;
  if (target.owner_email === user.email) return true;
  if (target.access_mode === 'any_signed_in') return true;
  return target.access_mode === 'specific_accounts' && target.allowed_emails.includes(user.email);
}

async function authenticatedUser(
  request: Request,
  env: WorkerEnv,
  deps: WorkerDeps,
): Promise<User | null> {
  const token = request.headers.get('Authorization')?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  if (env.LEGACY_WORKER_ORIGIN) {
    const response = await legacyFetch(env, deps)(
      `${env.LEGACY_WORKER_ORIGIN.replace(/\/+$/, '')}/auth/session`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!response.ok) return null;
    const body = await response.json() as { user?: Partial<User> };
    const user = body.user;
    return user
      && typeof user.email === 'string'
      && (user.role === 'admin' || user.role === 'user')
      && user.status === 'active'
      ? {
        email: user.email,
        ...(typeof user.name === 'string' ? { name: user.name } : {}),
        role: user.role,
        status: user.status,
        password_hash: '',
        password_salt: '',
        created_at: '',
        updated_at: '',
      }
      : null;
  }
  const session = await verifyToken(token, env);
  if (!session) return null;
  const index = await readJson<{ users: User[] }>(env, USERS_KEY, { users: [] });
  return index.users.find((user) => user.email === session.sub && user.status === 'active') ?? null;
}

async function requireUser(
  request: Request,
  env: WorkerEnv,
  deps: WorkerDeps,
): Promise<User | Response> {
  const user = await authenticatedUser(request, env, deps);
  return user ?? json({ error: 'Sign in with an active account.' }, 401);
}

async function createToken(user: User, env: WorkerEnv, deps: WorkerDeps): Promise<string> {
  const now = Math.floor(deps.now().getTime() / 1000);
  const session: Session = {
    sub: user.email,
    role: user.role,
    jti: deps.randomUUID(),
    iat: now,
    exp: now + SESSION_SECONDS,
  };
  const payload = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(session)));
  return `${payload}.${await sign(payload, env.AUTH_SECRET)}`;
}

async function verifyToken(token: string, env: WorkerEnv): Promise<Session | null> {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra || !constantTimeEqual(await sign(payload, env.AUTH_SECRET), signature)) return null;
  try {
    const session = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as Session;
    return session.exp > Math.floor(Date.now() / 1000) ? session : null;
  } catch {
    return null;
  }
}

async function sign(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))));
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits({
    name: 'PBKDF2',
    hash: 'SHA-256',
    salt: arrayBuffer(base64UrlToBytes(salt)),
    iterations: PASSWORD_ITERATIONS,
  }, key, 256);
  return bytesToBase64Url(new Uint8Array(bits));
}

async function verifyPassword(password: string, user: User): Promise<boolean> {
  return constantTimeEqual(await hashPassword(password, user.password_salt), user.password_hash);
}

function decodeImage(base64: unknown, mimeValue: unknown): { bytes: Uint8Array; mime: string } | { error: string } {
  if (typeof base64 !== 'string' || typeof mimeValue !== 'string' || !IMAGE_MIME_TYPES.has(mimeValue)) {
    return { error: 'Image objects must be PNG, JPEG, or WebP.' };
  }
  try {
    const normalized = base64.replace(/^data:[^;]+;base64,/, '');
    const binary = atob(normalized);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    if (bytes.byteLength === 0) return { error: 'Image data is empty.' };
    if (bytes.byteLength > MAX_IMAGE_BYTES) return { error: 'Image objects must be 5 MB or smaller.' };
    return { bytes, mime: mimeValue };
  } catch {
    return { error: 'Image data is not valid base64.' };
  }
}

async function serveAsset(key: string, env: WorkerEnv): Promise<Response> {
  const object = await env.ASSET_BUCKET.get(key);
  if (!object) return json({ error: 'Asset not found.' }, 404);
  const body = object.body ?? (object.arrayBuffer ? await object.arrayBuffer() : null);
  return new Response(body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}

async function targetIndex(env: WorkerEnv, deps: WorkerDeps): Promise<Target[]> {
  const index = await readJson<{ targets?: unknown[] }>(env, TARGETS_KEY, { targets: [] });
  let changed = false;
  const targets = (index.targets ?? []).flatMap((value) => {
    const normalized = normalizeStoredTarget(value, deps);
    if (!normalized) return [];
    changed ||= normalized.changed;
    return [normalized.target];
  });
  if (changed) {
    await writeTargets(env, targets);
  }
  return targets;
}

function normalizeStoredTarget(
  value: unknown,
  deps: WorkerDeps,
): { target: Target; changed: boolean } | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.id !== 'string'
    || typeof raw.label !== 'string'
    || typeof raw.image_url !== 'string'
    || typeof raw.image_object_key !== 'string'
  ) {
    return null;
  }
  const visibility = raw.visibility === 'public' ? 'public' : 'private';
  const accessMode = isAccessMode(raw.access_mode)
    ? raw.access_mode
    : visibility === 'public' ? 'anyone_with_link' : 'owner_only';
  const allowedEmails = Array.isArray(raw.allowed_emails)
    ? [...new Set(raw.allowed_emails.flatMap((email) => normalizeEmail(email) ? [normalizeEmail(email)] : []))]
    : [];
  const groups = Array.isArray(raw.groups)
    ? raw.groups.filter((group): group is Record<string, unknown> => Boolean(group && typeof group === 'object'))
    : [];
  const storedObjects = Array.isArray(raw.objects)
    ? raw.objects.filter((object): object is Record<string, unknown> => Boolean(object && typeof object === 'object'))
    : [];
  const legacyModel = raw.model && typeof raw.model === 'object'
    ? raw.model as Record<string, unknown>
    : undefined;
  const objects = storedObjects.length > 0
    ? storedObjects
    : legacyModel
      ? [{
        kind: 'model',
        id: 'object-1',
        model: legacyModel,
        placement: normalizePlacement(raw.placement),
      }]
      : [];
  const scanId = typeof raw.scan_id === 'string' && raw.scan_id.trim()
    ? raw.scan_id
    : deps.randomUUID();
  const now = deps.now().toISOString();
  const target: Target = {
    id: raw.id,
    label: raw.label,
    image_url: raw.image_url,
    image_object_key: raw.image_object_key,
    objects,
    groups,
    owner_email: typeof raw.owner_email === 'string' ? raw.owner_email.trim().toLowerCase() : '',
    visibility,
    scan_id: scanId,
    access_mode: accessMode,
    allowed_emails: accessMode === 'specific_accounts' ? allowedEmails : [],
    created_at: typeof raw.created_at === 'string' ? raw.created_at : now,
    updated_at: typeof raw.updated_at === 'string' ? raw.updated_at : now,
  };
  return {
    target,
    changed:
      raw.scan_id !== target.scan_id
      || raw.access_mode !== target.access_mode
      || !Array.isArray(raw.allowed_emails)
      || !Array.isArray(raw.groups)
      || !Array.isArray(raw.objects),
  };
}

function isAccessMode(value: unknown): value is Target['access_mode'] {
  return value === 'anyone_with_link'
    || value === 'any_signed_in'
    || value === 'owner_only'
    || value === 'specific_accounts';
}

function writeTargets(env: WorkerEnv, targets: Target[]): Promise<void> {
  return writeJson(env, TARGETS_KEY, { targets });
}

async function readJson<T>(env: WorkerEnv, key: string, fallback: T): Promise<T> {
  const object = await env.ASSET_BUCKET.get(key);
  if (!object) return fallback;
  const text = object.text ? await object.text() : new TextDecoder().decode(await object.arrayBuffer?.());
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(env: WorkerEnv, key: string, value: unknown): Promise<void> {
  await env.ASSET_BUCKET.put(key, JSON.stringify(value), { httpMetadata: { contentType: 'application/json' } });
}

async function requestJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const value = await request.json();
    return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function publicAssetUrl(key: string, env: WorkerEnv, requestUrl: URL): string {
  return `${(env.PUBLIC_ORIGIN?.trim() || requestUrl.origin).replace(/\/+$/, '')}/${key}`;
}

function publicUser(user: User) {
  return { email: user.email, ...(user.name ? { name: user.name } : {}), role: user.role, status: user.status };
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function extension(mime: string): string {
  return mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
}

function safe(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'asset';
}

function positive(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function mediaKeys(objects: Record<string, unknown>[]): string[] {
  return objects.flatMap((object) => {
    const image = object.kind === 'image' && object.image && typeof object.image === 'object'
      ? object.image as Record<string, unknown>
      : undefined;
    return typeof image?.object_key === 'string' ? [image.object_key] : [];
  });
}

function existingImageKey(object: Record<string, unknown> | undefined): string {
  const image = object?.image;
  return image && typeof image === 'object' && typeof (image as Record<string, unknown>).object_key === 'string'
    ? String((image as Record<string, unknown>).object_key)
    : '';
}

function existingImageUrl(object: Record<string, unknown> | undefined): string {
  const image = object?.image;
  return image && typeof image === 'object' && typeof (image as Record<string, unknown>).url === 'string'
    ? String((image as Record<string, unknown>).url)
    : '';
}

async function cleanupError(
  error: string,
  keys: string[],
  env: WorkerEnv,
): Promise<{ error: string }> {
  await cleanupKeys(keys, env);
  return { error };
}

async function cleanupKeys(keys: string[], env: WorkerEnv): Promise<void> {
  await Promise.all([...new Set(keys)].map((key) => env.ASSET_BUCKET.delete(key)));
}

function privateIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const values = parts.map(Number);
  if (values.some((value) => value > 255)) return false;
  return values[0] === 10
    || values[0] === 127
    || (values[0] === 169 && values[1] === 254)
    || (values[0] === 172 && values[1] >= 16 && values[1] <= 31)
    || (values[0] === 192 && values[1] === 168);
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4);
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function arrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function withCors(response: Response, request: Request, env: WorkerEnv): Response {
  const origin = request.headers.get('Origin');
  const allowed = (env.ALLOWED_ORIGINS ?? '*').split(',').map((value) => value.trim());
  let allowOrigin = '';
  if (allowed.includes('*')) allowOrigin = '*';
  else if (origin && allowed.includes(origin)) allowOrigin = origin;
  const headers = new Headers(response.headers);
  headers.delete('Access-Control-Allow-Origin');
  if (allowOrigin) headers.set('Access-Control-Allow-Origin', allowOrigin);
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Vary', 'Origin');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
