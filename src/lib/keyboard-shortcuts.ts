export const SHORTCUT_PREFERENCE_KEY = 'keyboard-shortcuts-v1';

export interface KeyboardShortcutBinding {
  key: string;
  shift: boolean;
  alt: boolean;
}

export type ShortcutCommandId =
  'toggleSidebar' | 'focusSearch' | 'openSettings';

export type ShortcutPreferences = Record<
  ShortcutCommandId,
  KeyboardShortcutBinding | null
>;

export const SHORTCUT_COMMANDS = [
  {
    id: 'toggleSidebar',
    label: 'Mostrar ou ocultar a navegação',
    description: 'Alterna a barra lateral do aplicativo.',
  },
  {
    id: 'focusSearch',
    label: 'Focar a busca',
    description: 'Move o foco para a busca atual.',
  },
  {
    id: 'openSettings',
    label: 'Abrir configurações',
    description: 'Abre as configurações do aplicativo.',
  },
] as const satisfies ReadonlyArray<{
  id: ShortcutCommandId;
  label: string;
  description: string;
}>;

export const DEFAULT_SHORTCUT_PREFERENCES = {
  toggleSidebar: { key: 'b', shift: false, alt: false },
  focusSearch: { key: 'k', shift: false, alt: false },
  openSettings: { key: ',', shift: false, alt: false },
} as const satisfies ShortcutPreferences;

const SUPPORTED_KEYS = new Set([
  ...'abcdefghijklmnopqrstuvwxyz0123456789',
  ',',
  '.',
  '/',
  ';',
  '-',
  '=',
  '[',
  ']',
]);
const RESERVED_KEYS = new Set([
  'a',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'j',
  'l',
  'n',
  'o',
  'p',
  'q',
  'r',
  's',
  't',
  'u',
  'v',
  'w',
  'x',
  'y',
  'z',
]);

function normalizeKey(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const key = value.toLowerCase();
  return SUPPORTED_KEYS.has(key) ? key : null;
}

function isAllowedBinding(binding: KeyboardShortcutBinding): boolean {
  return (
    !RESERVED_KEYS.has(binding.key) &&
    !(binding.key === 'i' && (binding.shift || binding.alt))
  );
}

function bindingsMatch(
  first: KeyboardShortcutBinding,
  second: KeyboardShortcutBinding,
): boolean {
  return (
    first.key === second.key &&
    first.shift === second.shift &&
    first.alt === second.alt
  );
}

function findStoredCollision(
  binding: KeyboardShortcutBinding,
  assigned: Partial<ShortcutPreferences>,
): boolean {
  return Object.values(assigned).some(
    (existing) =>
      existing !== null &&
      existing !== undefined &&
      bindingsMatch(binding, existing),
  );
}

function readStoredBinding(
  value: unknown,
): KeyboardShortcutBinding | null | undefined {
  if (value === null) return null;
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return undefined;

  const candidate = value as Record<string, unknown>;
  const key = normalizeKey(candidate.key);
  if (
    key === null ||
    typeof candidate.shift !== 'boolean' ||
    typeof candidate.alt !== 'boolean'
  )
    return undefined;

  const binding = {
    key,
    shift: candidate.shift,
    alt: candidate.alt,
  } satisfies KeyboardShortcutBinding;
  return isAllowedBinding(binding) ? binding : undefined;
}

export function normalizeShortcutPreferences(
  value: unknown,
): ShortcutPreferences {
  const stored =
    typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const normalized: Partial<ShortcutPreferences> = {};

  for (const command of SHORTCUT_COMMANDS) {
    const parsed = readStoredBinding(stored[command.id]);
    let binding =
      parsed === undefined ? DEFAULT_SHORTCUT_PREFERENCES[command.id] : parsed;

    if (binding && findStoredCollision(binding, normalized)) {
      const defaultBinding = DEFAULT_SHORTCUT_PREFERENCES[command.id];
      binding = findStoredCollision(defaultBinding, normalized)
        ? null
        : defaultBinding;
    }

    normalized[command.id] = binding;
  }

  return normalized as ShortcutPreferences;
}

export function isShortcutPreferences(
  value: unknown,
): value is ShortcutPreferences {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    return false;
  const stored = value as Record<string, unknown>;
  const commandIds = SHORTCUT_COMMANDS.map(({ id }) => id);
  if (
    Object.keys(stored).length !== commandIds.length ||
    Object.keys(stored).some(
      (key) => !commandIds.includes(key as ShortcutCommandId),
    )
  )
    return false;

  const normalized: Partial<ShortcutPreferences> = {};
  for (const { id } of SHORTCUT_COMMANDS) {
    const rawBinding = stored[id];
    const parsed = readStoredBinding(rawBinding);
    if (parsed === undefined) return false;
    if (parsed && findStoredCollision(parsed, normalized)) return false;
    if (
      parsed &&
      typeof rawBinding === 'object' &&
      rawBinding !== null &&
      !Array.isArray(rawBinding) &&
      Object.keys(rawBinding).length !== 3
    )
      return false;
    normalized[id] = parsed;
  }
  return true;
}

export function createShortcutBinding(
  event: globalThis.KeyboardEvent,
  platform: string,
): KeyboardShortcutBinding | null {
  const usesMeta = platform === 'darwin';
  const primaryModifierPressed = usesMeta
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  if (
    !primaryModifierPressed ||
    event.isComposing ||
    event.getModifierState('AltGraph')
  )
    return null;

  const key = normalizeKey(event.key);
  if (key === null) return null;
  const binding = {
    key,
    shift: event.shiftKey,
    alt: event.altKey,
  } satisfies KeyboardShortcutBinding;
  return isAllowedBinding(binding) ? binding : null;
}

export function matchesShortcut(
  event: globalThis.KeyboardEvent,
  binding: KeyboardShortcutBinding | null,
  platform: string,
): boolean {
  if (!binding || event.isComposing) return false;
  const usesMeta = platform === 'darwin';
  const primaryModifierPressed = usesMeta
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey;
  return (
    primaryModifierPressed &&
    event.key.toLowerCase() === binding.key &&
    event.shiftKey === binding.shift &&
    event.altKey === binding.alt &&
    isAllowedBinding(binding)
  );
}

export function findShortcutCollision(
  binding: KeyboardShortcutBinding,
  preferences: ShortcutPreferences,
  excludedCommand: ShortcutCommandId,
): ShortcutCommandId | null {
  return (
    SHORTCUT_COMMANDS.find(({ id }) => {
      const existing = preferences[id];
      return (
        id !== excludedCommand &&
        existing !== null &&
        bindingsMatch(binding, existing)
      );
    })?.id ?? null
  );
}

export function formatShortcutBinding(
  binding: KeyboardShortcutBinding | null,
  platform: string,
): string {
  if (!binding) return 'Desativado';
  const key = binding.key.toUpperCase();
  if (platform === 'darwin')
    return `⌘${binding.alt ? '⌥' : ''}${binding.shift ? '⇧' : ''}${key}`;

  return [
    'Ctrl',
    ...(binding.alt ? ['Alt'] : []),
    ...(binding.shift ? ['Shift'] : []),
    key,
  ].join('+');
}

export function isShortcutEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest(
      'input, textarea, select, [contenteditable="true"], [role="textbox"]',
    ) !== null
  );
}
