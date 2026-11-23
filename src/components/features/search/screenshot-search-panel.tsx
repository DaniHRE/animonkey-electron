import { ImagePlus, Search, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimeCard } from '@/components/shared/anime-card';
import { useAdultContentPreference } from '@/hooks/use-adult-content-preference';
import { animeQueries } from '@/services/anime-queries';
import type { AnimeSearchFilters } from '@/types/anime';
import type {
  ScreenshotImageType,
  ScreenshotSearchMatch,
} from '@/types/screenshot-search';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_TYPES = new Set<ScreenshotImageType>([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

interface SelectedImage {
  file: File;
  previewUrl: string;
}

interface ScreenshotSearchPanelProps {
  adultMode: NonNullable<AnimeSearchFilters['adultMode']>;
}

function formatTime(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;
  if (hours > 0)
    return (
      String(hours) +
      ':' +
      String(minutes).padStart(2, '0') +
      ':' +
      String(remainingSeconds).padStart(2, '0')
    );
  return String(minutes) + ':' + String(remainingSeconds).padStart(2, '0');
}

function matchDescription(match: ScreenshotSearchMatch): string {
  const episode = match.episode ? 'Episódio ' + match.episode + ' · ' : '';
  const similarity = String(Math.round(match.similarity * 100)) + '%';
  return (
    episode +
    formatTime(match.startTime) +
    ' · ' +
    similarity +
    ' de similaridade'
  );
}

export function ScreenshotSearchPanel({
  adultMode,
}: ScreenshotSearchPanelProps) {
  const { includeAdult } = useAdultContentPreference();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeRequestId = useRef<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(
    null,
  );
  const [matches, setMatches] = useState<ScreenshotSearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const animeIds = useMemo(
    () => matches.map((match) => Number(match.animeId)),
    [matches],
  );
  const catalogQuery = useQuery({
    ...animeQueries.search('', 1, { idsIn: animeIds, adultMode }, includeAdult),
    enabled: animeIds.length > 0,
  });
  const animeById = useMemo(
    () =>
      new Map(
        (catalogQuery.data?.results ?? []).map((anime) => [anime.id, anime]),
      ),
    [catalogQuery.data],
  );
  const displayMatches = matches.flatMap((match) => {
    const anime = animeById.get(match.animeId);
    return anime ? [{ anime, match }] : [];
  });

  const cancelActiveSearch = useCallback(() => {
    const requestId = activeRequestId.current;
    if (!requestId) return;
    activeRequestId.current = null;
    window.animonkey.screenshotSearch.cancel(requestId);
    setIsSearching(false);
    setStatus('Busca cancelada.');
  }, []);

  useEffect(
    () => () => {
      const requestId = activeRequestId.current;
      if (requestId) window.animonkey.screenshotSearch.cancel(requestId);
    },
    [],
  );

  useEffect(() => {
    const previewUrl = selectedImage?.previewUrl;
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [selectedImage?.previewUrl]);

  const onSelectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    cancelActiveSearch();
    setMatches([]);
    setStatus(null);
    setError(null);
    if (!SUPPORTED_IMAGE_TYPES.has(file.type as ScreenshotImageType)) {
      setSelectedImage(null);
      setError('Escolha uma imagem PNG, JPG ou WebP.');
      return;
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      setSelectedImage(null);
      setError('A imagem precisa ter até 10 MB.');
      return;
    }
    setSelectedImage({ file, previewUrl: URL.createObjectURL(file) });
  };

  const searchByImage = async () => {
    if (!selectedImage || isSearching) return;
    const requestId = crypto.randomUUID();
    activeRequestId.current = requestId;
    setError(null);
    setStatus(null);
    setMatches([]);
    setIsSearching(true);
    try {
      const bytes = new Uint8Array(await selectedImage.file.arrayBuffer());
      if (activeRequestId.current !== requestId) return;
      const result = await window.animonkey.screenshotSearch.search(
        { contentType: selectedImage.file.type as ScreenshotImageType, bytes },
        requestId,
      );
      if (activeRequestId.current !== requestId) return;
      setMatches(result);
      setStatus(result.length ? null : 'Nenhuma correspondência encontrada.');
    } catch (cause) {
      if (activeRequestId.current !== requestId) return;
      setError(
        cause instanceof Error
          ? cause.message
          : 'Não foi possível buscar esta imagem agora.',
      );
    } finally {
      if (activeRequestId.current === requestId) {
        activeRequestId.current = null;
        setIsSearching(false);
      }
    }
  };

  const searchingCatalog = matches.length > 0 && catalogQuery.isPending;
  const catalogError = matches.length > 0 && catalogQuery.isError;
  const noVisibleMatches =
    matches.length > 0 &&
    !catalogQuery.isPending &&
    !catalogQuery.isError &&
    displayMatches.length === 0;

  return (
    <section
      aria-labelledby="screenshot-search-title"
      className="mb-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(73,215,122,0.055),rgba(255,255,255,0.012)_55%)] p-4 shadow-[0_16px_50px_rgba(0,0,0,0.14)] sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="mb-2 flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-[#65e48e] uppercase">
            <ImagePlus size={14} /> Busca por imagem
          </p>
          <h2
            id="screenshot-search-title"
            className="text-lg font-semibold text-white/90"
          >
            Descubra de qual anime é a cena
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-white/45">
            Selecione uma captura em PNG, JPG ou WebP de até 10 MB.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          aria-label="Selecionar captura de anime"
          onChange={onSelectImage}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.035] px-3 text-xs font-semibold text-white/75 transition hover:bg-white/[0.07] hover:text-white"
        >
          <ImagePlus size={15} />
          Escolher imagem
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-4 border-t border-white/[0.07] pt-4 sm:flex-row sm:items-center">
        {selectedImage && (
          <div className="h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-black/30">
            <img
              src={selectedImage.previewUrl}
              alt="Prévia local da captura selecionada"
              className="size-full object-contain"
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          {selectedImage ? (
            <p className="truncate text-xs font-medium text-white/70">
              {selectedImage.file.name}
            </p>
          ) : (
            <p className="text-xs text-white/45">
              A imagem fica neste dispositivo até você iniciar a busca.
            </p>
          )}
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-white/40">
            Ao buscar, a imagem será enviada ao trace.moe para análise. A
            Animonkey não salva o arquivo; o trace.moe informa que imagens
            enviadas para busca são excluídas imediatamente.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {isSearching && (
            <button
              type="button"
              onClick={cancelActiveSearch}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/65 transition hover:bg-white/[0.05] hover:text-white"
            >
              <X size={14} /> Cancelar
            </button>
          )}
          <button
            type="button"
            disabled={!selectedImage || isSearching}
            onClick={() => void searchByImage()}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#49d77a] px-3 text-xs font-bold text-[#07120a] transition hover:bg-[#63e38e] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Search size={14} />
            {isSearching ? 'Buscando…' : 'Enviar imagem e buscar'}
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-300/10 bg-red-400/[0.04] px-3 py-2 text-xs text-red-200/85"
        >
          {error}
        </p>
      )}
      {(status || searchingCatalog) && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 text-xs text-white/50"
        >
          {searchingCatalog
            ? 'Carregando os dados dos títulos no AniList…'
            : status}
        </p>
      )}
      {catalogError && (
        <p role="alert" className="mt-4 text-xs text-red-200/80">
          A busca encontrou cenas, mas não foi possível carregar os títulos do
          AniList.
        </p>
      )}
      {noVisibleMatches && (
        <p role="status" className="mt-4 text-xs text-white/50">
          Nenhum resultado corresponde ao filtro de conteúdo adulto atual.
        </p>
      )}
      {displayMatches.length > 0 && (
        <div className="mt-5 border-t border-white/[0.07] pt-4">
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h3 className="text-sm font-semibold text-white/85">
              Cenas correspondentes
            </h3>
            <p className="text-xs text-white/40">
              {String(displayMatches.length)}{' '}
              {displayMatches.length === 1 ? 'anime' : 'animes'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
            {displayMatches.map(({ anime, match }) => (
              <div
                key={match.animeId}
                role="group"
                aria-label={
                  'Correspondência de ' +
                  String(Math.round(match.similarity * 100)) +
                  ' por cento'
                }
                className="min-w-0"
              >
                <AnimeCard anime={anime} />
                <p className="mt-2 px-0.5 text-[11px] leading-relaxed text-white/45">
                  {matchDescription(match)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
