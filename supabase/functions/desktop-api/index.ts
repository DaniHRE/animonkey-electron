import { createClient } from '@supabase/supabase-js';
import { compare, hash } from 'bcrypt-ts';

const ACCESS_TTL_MS = 10 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 64 * 1024;
const encoder = new TextEncoder();

type JsonObject = Record<string, unknown>;
type UserRecord = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  password_hash?: string | null;
};
type WatchLaterRow = {
  anime_id: string;
  title: Record<string, string | null>;
  image: string | null;
  type: string | null;
  total_episodes: number | null;
  genres: string[] | null;
  release_date: string | null;
  added_at: string;
};
type EpisodeProgressRow = {
  anime_id: string;
  episode_number: number;
  episode_id: string;
  current_time_seconds: number;
  duration_seconds: number;
  percentage: number;
  completed: boolean;
  updated_at: string;
};

class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

function response(status: number, body: JsonObject | null = null): Response {
  const headers = new Headers({
    'Cache-Control': 'no-store',
    Pragma: 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });

  if (body === null) return new Response(null, { status, headers });
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
}

function jsonError(status: number, code: string): Response {
  return response(status, { error: code });
}

function getServiceKey(): string {
  const url = Deno.env.get('SUPABASE_URL');
  const secretKeysValue = Deno.env.get('SUPABASE_SECRET_KEYS');
  let serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (secretKeysValue) {
    try {
      const secretKeys = JSON.parse(secretKeysValue) as Record<string, string>;
      serviceKey = secretKeys.default ?? serviceKey;
    } catch {
      throw new Error('Supabase secret configuration is invalid.');
    }
  }

  if (!url || !serviceKey)
    throw new Error('Supabase server credentials are missing.');
  return serviceKey;
}

const serviceKey = getServiceKey();
const supabaseUrl = Deno.env.get('SUPABASE_URL');
if (!supabaseUrl) throw new Error('Supabase server URL is missing.');

const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ApiError(400, 'invalid_request');
  }
  return value as JsonObject;
}

function stringField(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') throw new ApiError(400, 'invalid_request');
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new ApiError(400, 'invalid_request');
  }
  return normalized;
}

function optionalString(value: unknown, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  return stringField(value, maxLength);
}

function normalizeEmail(value: unknown): string {
  const email = stringField(value, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, 'invalid_request');
  }
  return email;
}

function validatePassword(value: unknown, isRegistration: boolean): string {
  if (typeof value !== 'string') throw new ApiError(400, 'invalid_request');
  const byteLength = encoder.encode(value).byteLength;
  if (byteLength > 72 || (isRegistration && byteLength < 8)) {
    throw new ApiError(400, 'invalid_password');
  }
  return value;
}

function validateDeviceId(value: unknown): string {
  const deviceId = stringField(value, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      deviceId,
    )
  ) {
    throw new ApiError(400, 'invalid_request');
  }
  return deviceId;
}

function makeToken(prefix: 'access' | 'refresh'): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  return `${prefix}_${token}`;
}

async function hashToken(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function readJson(request: Request): Promise<JsonObject> {
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, 'invalid_request');

  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    byteLength += value.byteLength;
    if (byteLength > MAX_BODY_BYTES) {
      await reader.cancel();
      throw new ApiError(413, 'request_too_large');
    }
    chunks.push(value);
  }

  try {
    const body = JSON.parse(
      new TextDecoder().decode(concatBytes(chunks, byteLength)),
    ) as unknown;
    return asObject(body);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'invalid_request');
  }
}

function concatBytes(chunks: Uint8Array[], length: number): Uint8Array {
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return joined;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization');
  if (!header) return null;
  const match = /^Bearer ([A-Za-z0-9_]+)$/.exec(header);
  return match?.[1] ?? null;
}

async function getRateLimitKey(email: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(serviceKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(email));
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}

async function consumeLoginAttempt(email: string): Promise<void> {
  const lookupHash = await getRateLimitKey(email);
  const { data, error } = await admin.rpc('desktop_consume_login_attempt', {
    p_lookup_hash: lookupHash,
  });
  if (error || data !== true) throw new ApiError(429, 'too_many_attempts');
}

async function clearLoginAttempt(email: string): Promise<void> {
  const lookupHash = await getRateLimitKey(email);
  const { error } = await admin.rpc('desktop_clear_login_attempt', {
    p_lookup_hash: lookupHash,
  });
  if (error) throw new ApiError(503, 'service_unavailable');
}

async function getUserById(userId: string): Promise<UserRecord> {
  const { data, error } = await admin.rpc('desktop_get_user_by_id', {
    p_user_id: userId,
  });
  const user = (data as UserRecord[] | null)?.[0];
  if (error || !user) throw new ApiError(401, 'invalid_session');
  return user;
}

function publicUser(user: UserRecord) {
  return { id: user.id, email: user.email, name: user.name, image: user.image };
}

async function createSession(
  user: UserRecord,
  deviceId: string,
  deviceName: string,
): Promise<Response> {
  const revoked = await admin.rpc('desktop_revoke_device_sessions', {
    p_device_id: deviceId,
  });
  if (revoked.error) throw new ApiError(503, 'service_unavailable');

  const accessToken = makeToken('access');
  const refreshToken = makeToken('refresh');
  const now = Date.now();
  const accessExpiresAt = new Date(now + ACCESS_TTL_MS).toISOString();
  const refreshExpiresAt = new Date(now + REFRESH_TTL_MS).toISOString();
  const { error } = await admin.from('desktop_sessions').insert({
    user_id: user.id,
    device_id: deviceId,
    device_name: deviceName,
    family_id: crypto.randomUUID(),
    access_token_hash: await hashToken(accessToken),
    access_expires_at: accessExpiresAt,
    refresh_token_hash: await hashToken(refreshToken),
    refresh_expires_at: refreshExpiresAt,
  });
  if (error) throw new ApiError(503, 'service_unavailable');

  return response(200, {
    accessToken,
    accessTokenExpiresAt: accessExpiresAt,
    refreshToken,
    refreshTokenExpiresAt: refreshExpiresAt,
    user: publicUser(user),
  });
}

async function register(body: JsonObject): Promise<Response> {
  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password, true);
  const name = optionalString(body.name, 80);
  const deviceId = validateDeviceId(body.deviceId);
  const deviceName = optionalString(body.deviceName, 80) ?? 'Animonkey Desktop';

  await consumeLoginAttempt(email);
  const passwordHash = await hash(password, 10);
  const { data, error } = await admin.rpc('desktop_register_user', {
    p_email: email,
    p_name: name,
    p_password_hash: passwordHash,
  });
  const user = (data as UserRecord[] | null)?.[0];
  if (error || !user) throw new ApiError(400, 'registration_failed');

  await clearLoginAttempt(email);
  return await createSession(user, deviceId, deviceName);
}

async function login(body: JsonObject): Promise<Response> {
  const email = normalizeEmail(body.email);
  const password = validatePassword(body.password, false);
  const deviceId = validateDeviceId(body.deviceId);
  const deviceName = optionalString(body.deviceName, 80) ?? 'Animonkey Desktop';

  await consumeLoginAttempt(email);
  const { data, error } = await admin.rpc('desktop_get_user_by_email', {
    p_email: email,
  });
  if (error) throw new ApiError(503, 'service_unavailable');
  const user = (data as UserRecord[] | null)?.[0];
  let valid = false;
  if (user?.password_hash) {
    try {
      valid = await compare(password, user.password_hash);
    } catch {
      valid = false;
    }
  }
  if (!user || !valid) throw new ApiError(401, 'invalid_credentials');

  await clearLoginAttempt(email);
  return await createSession(user, deviceId, deviceName);
}

async function refresh(body: JsonObject): Promise<Response> {
  const refreshToken = stringField(body.refreshToken, 100);
  if (!refreshToken.startsWith('refresh_'))
    throw new ApiError(401, 'invalid_session');

  const accessToken = makeToken('access');
  const newRefreshToken = makeToken('refresh');
  const now = Date.now();
  const accessExpiresAt = new Date(now + ACCESS_TTL_MS).toISOString();
  const refreshExpiresAt = new Date(now + REFRESH_TTL_MS).toISOString();
  const { data, error } = await admin.rpc('desktop_rotate_session_tokens', {
    p_refresh_token_hash: await hashToken(refreshToken),
    p_new_access_token_hash: await hashToken(accessToken),
    p_new_access_expires_at: accessExpiresAt,
    p_new_refresh_token_hash: await hashToken(newRefreshToken),
    p_new_refresh_expires_at: refreshExpiresAt,
  });
  if (error) throw new ApiError(503, 'service_unavailable');
  const rotated = (
    data as Array<{
      session_id: string | null;
      user_id: string | null;
      device_id: string | null;
      device_name: string | null;
      token_status: string;
    }> | null
  )?.[0];
  if (!rotated || rotated.token_status !== 'rotated' || !rotated.user_id) {
    throw new ApiError(401, 'invalid_session');
  }

  const user = await getUserById(rotated.user_id);
  return response(200, {
    accessToken,
    accessTokenExpiresAt: accessExpiresAt,
    refreshToken: newRefreshToken,
    refreshTokenExpiresAt: refreshExpiresAt,
    user: publicUser(user),
  });
}

async function revokeSession(
  body: JsonObject,
  request: Request,
): Promise<Response> {
  const refreshToken =
    typeof body.refreshToken === 'string' ? body.refreshToken : null;
  const accessToken = getBearerToken(request);
  const { error } = await admin.rpc('desktop_revoke_session', {
    p_refresh_token_hash: refreshToken ? await hashToken(refreshToken) : null,
    p_access_token_hash: accessToken ? await hashToken(accessToken) : null,
  });
  if (error) throw new ApiError(503, 'service_unavailable');
  return response(200, { success: true });
}

async function authenticate(
  request: Request,
): Promise<{ token: string; userId: string }> {
  const token = getBearerToken(request);
  if (!token || !token.startsWith('access_'))
    throw new ApiError(401, 'invalid_session');
  const { data, error } = await admin
    .from('desktop_sessions')
    .select('user_id')
    .eq('access_token_hash', await hashToken(token))
    .gt('access_expires_at', new Date().toISOString())
    .is('revoked_at', null)
    .maybeSingle();
  if (error || !data?.user_id) throw new ApiError(401, 'invalid_session');
  return { token, userId: data.user_id as string };
}

function stringList(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value) || value.length > maxItems) {
    throw new ApiError(400, 'invalid_request');
  }
  return value.map((entry) => stringField(entry, maxLength));
}

function validateAnimeId(value: unknown): string {
  const id = stringField(value, 20);
  if (!/^\d+$/.test(id)) throw new ApiError(400, 'invalid_request');
  return id;
}

function validateTitle(value: unknown): Record<string, string | null> {
  const title = asObject(value);
  const result: Record<string, string | null> = {};
  for (const key of ['english', 'romaji', 'native'] as const) {
    const entry = title[key];
    if (entry === undefined || entry === null) result[key] = null;
    else result[key] = stringField(entry, 300);
  }
  if (!result.english && !result.romaji && !result.native) {
    throw new ApiError(400, 'invalid_request');
  }
  return result;
}

async function watchLaterList(userId: string): Promise<Response> {
  const { data, error } = await admin
    .from('watch_later')
    .select(
      'anime_id,title,image,type,total_episodes,genres,release_date,added_at',
    )
    .eq('user_id', userId)
    .order('added_at', { ascending: false });
  if (error) throw new ApiError(503, 'service_unavailable');

  const rows = (data ?? []) as unknown as WatchLaterRow[];
  const items = rows.map((row) => ({
    animeId: row.anime_id,
    title: row.title,
    image: row.image ?? undefined,
    type: row.type ?? undefined,
    totalEpisodes: row.total_episodes ?? undefined,
    genres: row.genres ?? [],
    releaseDate: row.release_date
      ? Number(row.release_date) || undefined
      : undefined,
    addedAt: Date.parse(row.added_at),
  }));
  return response(200, { items });
}

async function watchLaterUpsert(
  userId: string,
  value: unknown,
): Promise<Response> {
  const item = asObject(value);
  const animeId = validateAnimeId(item.animeId);
  const title = validateTitle(item.title);
  const image = optionalString(item.image, 2048);
  if (image) {
    try {
      if (new URL(image).protocol !== 'https:') {
        throw new ApiError(400, 'invalid_request');
      }
    } catch {
      throw new ApiError(400, 'invalid_request');
    }
  }

  const type = optionalString(item.type, 40);
  const totalEpisodes = item.totalEpisodes;
  if (
    totalEpisodes !== undefined &&
    totalEpisodes !== null &&
    (!Number.isSafeInteger(totalEpisodes) || (totalEpisodes as number) < 0)
  ) {
    throw new ApiError(400, 'invalid_request');
  }
  const genres =
    item.genres === undefined ? [] : stringList(item.genres, 32, 60);
  const releaseDate = item.releaseDate;
  if (
    releaseDate !== undefined &&
    releaseDate !== null &&
    (!Number.isSafeInteger(releaseDate) ||
      (releaseDate as number) < 1900 ||
      (releaseDate as number) > 3000)
  ) {
    throw new ApiError(400, 'invalid_request');
  }
  const addedAt = item.addedAt;
  if (
    addedAt !== undefined &&
    (!Number.isFinite(addedAt) || (addedAt as number) > Date.now() + 5 * 60_000)
  ) {
    throw new ApiError(400, 'invalid_request');
  }

  const { error } = await admin.from('watch_later').upsert(
    {
      user_id: userId,
      anime_id: animeId,
      title,
      japanese_title: title.native,
      image,
      type,
      total_episodes: totalEpisodes ?? null,
      genres,
      release_date:
        releaseDate === undefined || releaseDate === null
          ? null
          : String(releaseDate),
      added_at: addedAt
        ? new Date(addedAt as number).toISOString()
        : new Date().toISOString(),
    },
    { onConflict: 'user_id,anime_id' },
  );
  if (error) throw new ApiError(503, 'service_unavailable');
  return response(200, { success: true });
}

async function watchLaterRemove(
  userId: string,
  value: unknown,
): Promise<Response> {
  const body = asObject(value);
  const animeId = validateAnimeId(body.animeId);
  const { error } = await admin
    .from('watch_later')
    .delete()
    .eq('user_id', userId)
    .eq('anime_id', animeId);
  if (error) throw new ApiError(503, 'service_unavailable');
  return response(200, { success: true });
}

async function episodeProgressList(userId: string): Promise<Response> {
  const { data, error } = await admin
    .from('episode_progress')
    .select(
      'anime_id,episode_number,episode_id,current_time_seconds,duration_seconds,percentage,completed,updated_at',
    )
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });
  if (error) throw new ApiError(503, 'service_unavailable');

  const rows = (data ?? []) as unknown as EpisodeProgressRow[];
  const records = rows.map((row) => ({
    key: `${row.anime_id}:${row.episode_number}`,
    animeId: row.anime_id,
    episodeNumber: row.episode_number,
    episodeId: row.episode_id,
    currentTime: row.current_time_seconds,
    duration: row.duration_seconds,
    percentage: row.percentage,
    completed: row.completed,
    updatedAt: Date.parse(row.updated_at),
  }));
  return response(200, { records });
}

async function episodeProgressUpsert(
  userId: string,
  value: unknown,
): Promise<Response> {
  const item = asObject(value);
  const animeId = validateAnimeId(item.animeId);
  const episodeId = stringField(item.episodeId, 200);
  const episodeNumber = item.episodeNumber;
  const currentTime = item.currentTime;
  const duration = item.duration;
  if (
    !Number.isSafeInteger(episodeNumber) ||
    (episodeNumber as number) < 0 ||
    !Number.isFinite(currentTime) ||
    (currentTime as number) < 0 ||
    !Number.isFinite(duration) ||
    (duration as number) <= 0 ||
    (duration as number) > 24 * 60 * 60
  ) {
    throw new ApiError(400, 'invalid_request');
  }
  const safeCurrentTime = Math.min(currentTime as number, duration as number);
  const percentage = (safeCurrentTime / (duration as number)) * 100;
  const { error } = await admin.from('episode_progress').upsert(
    {
      user_id: userId,
      anime_id: animeId,
      episode_number: episodeNumber,
      episode_id: episodeId,
      current_time_seconds: safeCurrentTime,
      duration_seconds: duration,
      percentage,
      completed: percentage >= 90,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,anime_id,episode_number' },
  );
  if (error) throw new ApiError(503, 'service_unavailable');
  return response(200, {
    record: {
      key: `${animeId}:${episodeNumber}`,
      animeId,
      episodeNumber,
      episodeId,
      currentTime: safeCurrentTime,
      duration,
      percentage,
      completed: percentage >= 90,
      updatedAt: Date.now(),
    },
  });
}

async function episodeProgressRemoveAnime(
  userId: string,
  value: unknown,
): Promise<Response> {
  const body = asObject(value);
  const animeId = validateAnimeId(body.animeId);
  const { error } = await admin
    .from('episode_progress')
    .delete()
    .eq('user_id', userId)
    .eq('anime_id', animeId);
  if (error) throw new ApiError(503, 'service_unavailable');
  return response(200, { success: true });
}

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return response(204);
  if (request.method !== 'POST') return jsonError(405, 'method_not_allowed');

  const body = await readJson(request);
  const action = stringField(body.action, 40);
  if (action === 'register') return await register(body);
  if (action === 'login') return await login(body);
  if (action === 'refresh') return await refresh(body);
  if (action === 'logout') return await revokeSession(body, request);

  if (action === 'session') {
    const auth = await authenticate(request);
    return response(200, { user: publicUser(await getUserById(auth.userId)) });
  }

  const auth = await authenticate(request);
  switch (action) {
    case 'watch-later.list':
      return await watchLaterList(auth.userId);
    case 'watch-later.upsert':
      return await watchLaterUpsert(auth.userId, body.item);
    case 'watch-later.remove':
      return await watchLaterRemove(auth.userId, body);
    case 'episode-progress.list':
      return await episodeProgressList(auth.userId);
    case 'episode-progress.upsert':
      return await episodeProgressUpsert(auth.userId, body.record);
    case 'episode-progress.remove-anime':
      return await episodeProgressRemoveAnime(auth.userId, body);
    default:
      throw new ApiError(404, 'not_found');
  }
}

Deno.serve(async (request) => {
  try {
    return await handle(request);
  } catch (error) {
    if (error instanceof ApiError) return jsonError(error.status, error.code);
    return jsonError(500, 'internal_error');
  }
});
