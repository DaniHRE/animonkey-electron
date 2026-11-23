import { app, safeStorage } from 'electron';
import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type {
  AnimeRatingsSyncSnapshot,
  AccountDataExport,
  AccountCredentials,
  AccountRegistration,
  AccountSession,
  AccountUser,
  ActivityFeedCursor,
  ActivityFeedItem,
  ActivityFeedPage,
  EpisodeProgressInput,
  EpisodeProgressSyncSnapshot,
  FeedbackSubmissionInput,
  RemoteSyncTombstone,
  WatchLaterRemoteItem,
  WatchLaterSyncSnapshot,
} from '../types/account';
import type { EpisodeProgressRecord } from '../services/cache/local-db';
import type { AnimeRating } from '../types/anime';

declare const __DESKTOP_API_URL__: string;
declare const __SUPABASE_PUBLISHABLE_KEY__: string;

interface InternalSession {
  user: AccountUser | null;
  deviceId: string;
  refreshToken: string;
  accessToken: string | null;
  accessExpiresAt: number;
}

interface StoredSession {
  deviceId: string;
  refreshToken: string;
  user?: AccountUser | null;
}

interface AuthResponse {
  accessToken: string;
  accessTokenExpiresAt: string;
  refreshToken: string;
  user: AccountUser;
}

type ApiResponse = Record<string, unknown>;

class AccountServiceError extends Error {}

const SESSION_FILENAME = 'account-session.enc';
const DEVICE_FILENAME = 'account-device.enc';
const REQUEST_TIMEOUT_MS = 20_000;

function asObject(value: unknown): ApiResponse | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as ApiResponse)
    : null;
}

function isAccountUser(value: unknown): value is AccountUser {
  const user = asObject(value);
  return (
    typeof user?.id === 'string' &&
    typeof user.email === 'string' &&
    (user.name === null || typeof user.name === 'string') &&
    (user.image === null || typeof user.image === 'string')
  );
}

function parseAuthResponse(value: unknown): AuthResponse {
  const body = asObject(value);
  if (
    typeof body?.accessToken !== 'string' ||
    typeof body.accessTokenExpiresAt !== 'string' ||
    typeof body.refreshToken !== 'string' ||
    !isAccountUser(body.user)
  ) {
    throw new AccountServiceError(
      'O serviço de conta retornou uma resposta inválida.',
    );
  }
  return body as unknown as AuthResponse;
}

function getFriendlyError(
  status: number,
  code: unknown,
  action: string,
): string {
  if (code === 'too_many_feedback_submissions') {
    return 'Você já enviou três mensagens nas últimas 24 horas. Tente novamente mais tarde.';
  }
  if (code === 'invalid_feedback') {
    return 'Confira os campos do feedback e tente novamente.';
  }
  if (status === 429 || code === 'too_many_attempts') {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  if (status === 401 && action === 'login') {
    return 'E-mail ou senha inválidos.';
  }
  if (code === 'invalid_current_password') return 'Senha atual incorreta.';
  if (code === 'password_not_available')
    return 'Esta conta não possui senha configurada.';
  if (status === 401)
    return 'Sua sessão expirou. Entre novamente para sincronizar.';
  if (code === 'invalid_password') {
    return 'A senha precisa ter ao menos 8 bytes e no máximo 72 bytes.';
  }
  if (code === 'registration_failed') {
    return 'Não foi possível criar a conta com esses dados.';
  }
  if (status >= 500) {
    return 'O serviço de conta está indisponível. Seus dados locais continuam disponíveis.';
  }
  return 'Não foi possível concluir a operação da conta.';
}

class DesktopAccountService {
  private session: InternalSession | null = null;
  private deviceId: string | null = null;
  private initialization: Promise<void> | null = null;
  private refreshInFlight: Promise<boolean> | null = null;

  private get sessionPath(): string {
    return path.join(app.getPath('userData'), SESSION_FILENAME);
  }

  private get devicePath(): string {
    return path.join(app.getPath('userData'), DEVICE_FILENAME);
  }

  private get apiUrl(): string {
    const url = new URL(__DESKTOP_API_URL__);
    if (url.protocol !== 'https:' || !url.pathname.endsWith('/desktop-api')) {
      throw new AccountServiceError(
        'A configuração segura do serviço de conta está inválida.',
      );
    }
    if (!__SUPABASE_PUBLISHABLE_KEY__) {
      throw new AccountServiceError(
        'A configuração do serviço de conta está incompleta.',
      );
    }
    return url.toString();
  }

  private async send(
    action: string,
    payload: ApiResponse = {},
    accessToken?: string,
  ): Promise<ApiResponse> {
    let url: string;
    try {
      url = this.apiUrl;
    } catch {
      throw new AccountServiceError(
        'O serviço de conta ainda não está configurado para este aplicativo.',
      );
    }

    let result: Response;
    try {
      result = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          apikey: __SUPABASE_PUBLISHABLE_KEY__,
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ action, ...payload }),
      });
    } catch {
      throw new AccountServiceError(
        'Não foi possível conectar ao serviço de conta. Tente novamente quando estiver online.',
      );
    }

    const body = asObject(await result.json().catch(() => null));
    if (!result.ok) {
      throw new AccountServiceError(
        getFriendlyError(result.status, body?.error, action),
      );
    }
    return body ?? {};
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialization) {
      this.initialization = this.restoreSession();
    }
    await this.initialization;
  }

  private async restoreSession(): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) {
      await this.clearSavedSession();
      return;
    }

    try {
      const encrypted = await fs.readFile(this.sessionPath, 'utf8');
      const saved = JSON.parse(
        safeStorage.decryptString(Buffer.from(encrypted, 'base64')),
      ) as Partial<StoredSession>;
      if (
        typeof saved.deviceId !== 'string' ||
        typeof saved.refreshToken !== 'string' ||
        !saved.refreshToken.startsWith('refresh_')
      ) {
        await this.clearSavedSession();
        return;
      }

      this.session = {
        user: isAccountUser(saved.user) ? saved.user : null,
        deviceId: saved.deviceId,
        refreshToken: saved.refreshToken,
        accessToken: null,
        accessExpiresAt: 0,
      };
      this.deviceId = saved.deviceId;
      await this.persistDeviceId(saved.deviceId);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      await this.clearSavedSession();
    }
  }

  private async persistSession(): Promise<void> {
    if (!this.session) return;
    if (!safeStorage.isEncryptionAvailable()) {
      await this.clearSavedSession();
      return;
    }
    const serialized = JSON.stringify({
      deviceId: this.session.deviceId,
      refreshToken: this.session.refreshToken,
      user: this.session.user,
    } satisfies StoredSession);
    const encrypted = safeStorage.encryptString(serialized).toString('base64');
    const directory = path.dirname(this.sessionPath);
    const temporaryPath = `${this.sessionPath}.tmp`;
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(temporaryPath, encrypted, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await fs.rename(temporaryPath, this.sessionPath);
  }

  private async clearSavedSession(): Promise<void> {
    await fs.rm(this.sessionPath, { force: true }).catch(() => undefined);
    await fs
      .rm(`${this.sessionPath}.tmp`, { force: true })
      .catch(() => undefined);
  }

  private async clearSession(): Promise<void> {
    this.session = null;
    await this.clearSavedSession();
  }

  private async persistDeviceId(deviceId: string): Promise<void> {
    if (!safeStorage.isEncryptionAvailable()) return;
    const encrypted = safeStorage.encryptString(deviceId).toString('base64');
    const temporaryPath = `${this.devicePath}.tmp`;
    await fs.mkdir(path.dirname(this.devicePath), { recursive: true });
    await fs.writeFile(temporaryPath, encrypted, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await fs.rename(temporaryPath, this.devicePath);
  }

  private async getDeviceId(): Promise<string> {
    if (this.deviceId) return this.deviceId;
    if (safeStorage.isEncryptionAvailable()) {
      try {
        const encrypted = await fs.readFile(this.devicePath, 'utf8');
        const deviceId = safeStorage.decryptString(
          Buffer.from(encrypted, 'base64'),
        );
        if (/^[0-9a-f-]{36}$/i.test(deviceId)) {
          this.deviceId = deviceId;
          return deviceId;
        }
      } catch {
        // Create a fresh local device identifier when the stored value is absent or invalid.
      }
    }
    this.deviceId = randomUUID();
    await this.persistDeviceId(this.deviceId);
    return this.deviceId;
  }

  private applyAuthResponse(
    response: AuthResponse,
    deviceId: string,
  ): AccountSession {
    const expiresAt = Date.parse(response.accessTokenExpiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
      throw new AccountServiceError(
        'O serviço de conta retornou uma sessão inválida.',
      );
    }
    this.session = {
      user: response.user,
      deviceId,
      refreshToken: response.refreshToken,
      accessToken: response.accessToken,
      accessExpiresAt: expiresAt,
    };
    return { user: response.user, expiresAt: response.accessTokenExpiresAt };
  }

  async register(input: AccountRegistration): Promise<AccountSession> {
    await this.ensureInitialized();
    const deviceId = await this.getDeviceId();
    const response = parseAuthResponse(
      await this.send('register', {
        email: input.email,
        password: input.password,
        name: input.name,
        deviceId,
        deviceName: `Animonkey Desktop (${process.platform})`,
      }),
    );
    const session = this.applyAuthResponse(response, deviceId);
    await this.persistSession();
    return session;
  }

  async login(input: AccountCredentials): Promise<AccountSession> {
    await this.ensureInitialized();
    const deviceId = await this.getDeviceId();
    const response = parseAuthResponse(
      await this.send('login', {
        email: input.email,
        password: input.password,
        deviceId,
        deviceName: `Animonkey Desktop (${process.platform})`,
      }),
    );
    const session = this.applyAuthResponse(response, deviceId);
    await this.persistSession();
    return session;
  }

  private async refreshSession(): Promise<boolean> {
    if (!this.session?.refreshToken) return false;
    if (this.refreshInFlight) return await this.refreshInFlight;

    this.refreshInFlight = (async () => {
      const deviceId = this.session?.deviceId;
      const refreshToken = this.session?.refreshToken;
      if (!deviceId || !refreshToken) return false;
      try {
        const response = parseAuthResponse(
          await this.send('refresh', { refreshToken }),
        );
        this.applyAuthResponse(response, deviceId);
        await this.persistSession();
        return true;
      } catch (error) {
        if (
          error instanceof AccountServiceError &&
          error.message ===
            'Sua sessão expirou. Entre novamente para sincronizar.'
        ) {
          await this.clearSession();
          return false;
        }
        throw error;
      } finally {
        this.refreshInFlight = null;
      }
    })();
    return await this.refreshInFlight;
  }

  private async getAccessToken(): Promise<string> {
    await this.ensureInitialized();
    if (!this.session) {
      throw new AccountServiceError('Entre na sua conta para sincronizar.');
    }
    if (
      this.session.accessToken &&
      this.session.accessExpiresAt > Date.now() + 30_000
    ) {
      return this.session.accessToken;
    }
    if (!(await this.refreshSession()) || !this.session?.accessToken) {
      throw new AccountServiceError('Entre na sua conta para sincronizar.');
    }
    return this.session.accessToken;
  }

  private async authenticatedRequest(
    action: string,
    payload: ApiResponse = {},
  ): Promise<ApiResponse> {
    let accessToken = await this.getAccessToken();
    try {
      return await this.send(action, payload, accessToken);
    } catch (error) {
      if (
        !(error instanceof AccountServiceError) ||
        error.message !==
          'Sua sessão expirou. Entre novamente para sincronizar.'
      ) {
        throw error;
      }
      if (!(await this.refreshSession()) || !this.session?.accessToken)
        throw error;
      accessToken = this.session.accessToken;
      return await this.send(action, payload, accessToken);
    }
  }

  async getSession(): Promise<AccountSession | null> {
    await this.ensureInitialized();
    if (!this.session) return null;
    if (
      !this.session.accessToken ||
      this.session.accessExpiresAt <= Date.now() + 30_000
    ) {
      const user = this.session.user;
      if (user) {
        const cachedSession = {
          user,
          expiresAt: new Date(this.session.accessExpiresAt).toISOString(),
        };
        void this.refreshSession().catch(() => undefined);
        return cachedSession;
      }
      try {
        if (!(await this.refreshSession())) return null;
      } catch {
        return this.session.user
          ? { user: this.session.user, expiresAt: new Date(0).toISOString() }
          : null;
      }
    }
    if (!this.session?.user || !this.session.accessToken) return null;
    return {
      user: this.session.user,
      expiresAt: new Date(this.session.accessExpiresAt).toISOString(),
    };
  }

  async logout(): Promise<void> {
    await this.ensureInitialized();
    const session = this.session;
    if (session) {
      await this.send(
        'logout',
        { refreshToken: session.refreshToken },
        session.accessToken ?? undefined,
      ).catch(() => undefined);
    }
    await this.clearSession();
  }

  async listWatchLater(): Promise<WatchLaterSyncSnapshot> {
    const body = await this.authenticatedRequest('watch-later.list');
    return {
      items: Array.isArray(body.items)
        ? (body.items as WatchLaterRemoteItem[])
        : [],
      tombstones: Array.isArray(body.tombstones)
        ? (body.tombstones as RemoteSyncTombstone[])
        : [],
    };
  }

  async upsertWatchLater(item: WatchLaterRemoteItem): Promise<void> {
    await this.authenticatedRequest('watch-later.upsert', { item });
  }

  async removeWatchLater(animeId: string, deletedAt: number): Promise<void> {
    await this.authenticatedRequest('watch-later.remove', {
      animeId,
      deletedAt,
    });
  }

  async listEpisodeProgress(): Promise<EpisodeProgressSyncSnapshot> {
    const body = await this.authenticatedRequest('episode-progress.list');
    return {
      records: Array.isArray(body.records)
        ? (body.records as EpisodeProgressRecord[])
        : [],
      tombstones: Array.isArray(body.tombstones)
        ? (body.tombstones as RemoteSyncTombstone[])
        : [],
    };
  }

  async upsertEpisodeProgress(
    input: EpisodeProgressInput,
  ): Promise<EpisodeProgressRecord> {
    const body = await this.authenticatedRequest('episode-progress.upsert', {
      record: input,
    });
    const record = body.record as EpisodeProgressRecord | undefined;
    if (!record || typeof record.key !== 'string') {
      throw new AccountServiceError(
        'O serviço de sync retornou dados inválidos.',
      );
    }
    return record;
  }

  async removeEpisodeProgressForAnime(
    animeId: string,
    deletedAt: number,
  ): Promise<void> {
    await this.authenticatedRequest('episode-progress.remove-anime', {
      animeId,
      deletedAt,
    });
  }

  async listAnimeRatings(): Promise<AnimeRatingsSyncSnapshot> {
    const body = await this.authenticatedRequest('anime-ratings.list');
    return {
      ratings: Array.isArray(body.ratings)
        ? (body.ratings as AnimeRating[])
        : [],
      tombstones: Array.isArray(body.tombstones)
        ? (body.tombstones as RemoteSyncTombstone[])
        : [],
    };
  }

  async upsertAnimeRating(rating: AnimeRating): Promise<AnimeRating> {
    const body = await this.authenticatedRequest('anime-ratings.upsert', {
      rating,
    });
    if (!body.rating || typeof body.rating !== 'object') {
      throw new AccountServiceError(
        'O serviço de sync retornou dados inválidos.',
      );
    }
    return body.rating as AnimeRating;
  }

  async removeAnimeRating(animeId: string, deletedAt: number): Promise<void> {
    await this.authenticatedRequest('anime-ratings.remove', {
      animeId,
      deletedAt,
    });
  }

  async updateProfile(name: string): Promise<AccountUser> {
    const normalizedName = name.trim().slice(0, 60) || null;
    const body = await this.authenticatedRequest('profile.update', {
      name: normalizedName,
    });
    if (!isAccountUser(body.user)) {
      throw new AccountServiceError(
        'O serviço de conta retornou dados inválidos.',
      );
    }
    if (this.session) {
      this.session.user = body.user;
      await this.persistSession();
    }
    return body.user;
  }

  async exportAccountData(): Promise<AccountDataExport> {
    const body = await this.authenticatedRequest('account.export');
    const user = asObject(body.user);
    if (
      typeof body.exportedAt !== 'string' ||
      !isAccountUser(user) ||
      (typeof user['displayName'] !== 'string' &&
        user['displayName'] !== null) ||
      typeof user['showActivity'] !== 'boolean' ||
      !Array.isArray(body.watchLater) ||
      !Array.isArray(body.episodeProgress) ||
      !Array.isArray(body.ratings) ||
      !Array.isArray(body.activity)
    ) {
      throw new AccountServiceError(
        'O serviço de conta retornou dados inválidos.',
      );
    }
    return body as unknown as AccountDataExport;
  }

  private async applyUpdatedAccountUser(value: unknown): Promise<AccountUser> {
    const body = asObject(value);
    if (!body || !isAccountUser(body.user)) {
      throw new AccountServiceError(
        'O serviço de conta retornou dados inválidos.',
      );
    }
    if (this.session) {
      this.session.user = body.user;
      await this.persistSession();
    }
    return body.user;
  }

  async uploadAvatar(
    contentType: string,
    base64: string,
  ): Promise<AccountUser> {
    const body = await this.authenticatedRequest('avatar.upload', {
      contentType,
      base64,
    });
    return await this.applyUpdatedAccountUser(body);
  }

  async removeAvatar(): Promise<AccountUser> {
    const body = await this.authenticatedRequest('avatar.remove');
    return await this.applyUpdatedAccountUser(body);
  }

  async getActivityPrivacy(): Promise<boolean> {
    const body = await this.authenticatedRequest('activity-privacy.get');
    if (!body || typeof body.showActivity !== 'boolean') {
      throw new AccountServiceError(
        'O serviço de conta retornou dados inválidos.',
      );
    }
    return body.showActivity;
  }

  async setActivityPrivacy(showActivity: boolean): Promise<void> {
    await this.authenticatedRequest('activity-privacy.set', { showActivity });
  }

  async listActivity(
    cursor: ActivityFeedCursor | null,
    limit: number,
  ): Promise<ActivityFeedPage> {
    const body = await this.authenticatedRequest('activity.list', {
      cursor,
      limit,
    });
    if (!Array.isArray(body.items)) {
      throw new AccountServiceError(
        'O serviço de feed retornou dados inválidos.',
      );
    }
    return {
      items: body.items as ActivityFeedItem[],
      nextCursor:
        body.nextCursor && typeof body.nextCursor === 'object'
          ? (body.nextCursor as ActivityFeedCursor)
          : null,
    };
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    await this.authenticatedRequest('password.change', {
      currentPassword,
      newPassword,
    });
  }

  async submitFeedback(input: FeedbackSubmissionInput): Promise<void> {
    await this.authenticatedRequest('feedback.submit', {
      submission: input,
    });
  }
}

export const accountService = new DesktopAccountService();
