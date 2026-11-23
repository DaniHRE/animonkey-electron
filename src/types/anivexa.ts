export type AnivexaDesktopRequest =
  | { kind: 'episodes'; animeId: string }
  | {
      kind: 'watch';
      provider: string;
      animeId: string;
      audio: 'sub' | 'dub';
      episodeId: string;
    };

export interface AnivexaDesktopResponse {
  status: number;
  body: string;
}

export type AnivexaDiagnosticLevel = 'info' | 'warning' | 'error';
export type AnivexaRuntimeStatus = 'stopped' | 'starting' | 'ready' | 'error';

export interface AnivexaDiagnosticEntry {
  id: number;
  timestamp: number;
  level: AnivexaDiagnosticLevel;
  message: string;
}

export interface AnivexaDiagnosticsSnapshot {
  revision: number;
  status: AnivexaRuntimeStatus;
  entries: AnivexaDiagnosticEntry[];
}

export type AnivexaDiagnosticsExportResult =
  { status: 'saved' } | { status: 'cancelled' };

export function isAnivexaDiagnosticsExportResult(
  value: unknown,
): value is AnivexaDiagnosticsExportResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const result = value as Record<string, unknown>;
  return result.status === 'saved' || result.status === 'cancelled';
}

export function isAnivexaDiagnosticsSnapshot(
  value: unknown,
): value is AnivexaDiagnosticsSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const snapshot = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(snapshot.revision) ||
    !['stopped', 'starting', 'ready', 'error'].includes(
      String(snapshot.status),
    ) ||
    !Array.isArray(snapshot.entries) ||
    snapshot.entries.length > 100
  ) {
    return false;
  }
  return snapshot.entries.every((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry))
      return false;
    const record = entry as Record<string, unknown>;
    return (
      Number.isSafeInteger(record.id) &&
      Number.isSafeInteger(record.timestamp) &&
      ['info', 'warning', 'error'].includes(String(record.level)) &&
      typeof record.message === 'string' &&
      record.message.length <= 300
    );
  });
}

export interface AnivexaBridge {
  request: (
    request: AnivexaDesktopRequest,
    requestId: string,
  ) => Promise<AnivexaDesktopResponse>;
  cancel: (requestId: string) => void;
  getDiagnostics: () => Promise<AnivexaDiagnosticsSnapshot>;
  clearDiagnostics: () => Promise<AnivexaDiagnosticsSnapshot>;
  exportDiagnostics: () => Promise<AnivexaDiagnosticsExportResult>;
  onDiagnosticsChanged: (
    callback: (snapshot: AnivexaDiagnosticsSnapshot) => void,
  ) => () => void;
}
