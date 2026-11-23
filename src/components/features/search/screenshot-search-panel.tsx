import { ImagePlus, Search, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouterState } from '@tanstack/react-router';
import { AnimeCard } from '@/components/shared/anime-card';
import { useAdultContentPreference } from '@/hooks/use-adult-content-preference';
import { animeQueries } from '@/services/anime-queries';
import type {
  ScreenshotImageType,
  ScreenshotSearchMatch,
} from '@/types/screenshot-search';
import './screenshot-search-widget.css';

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

export function ScreenshotSearchPanel() {
  const { includeAdult } = useAdultContentPreference();
  const routeLocation = useRouterState({
    select: (state) => state.location.href,
  });
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropZoneRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const activeRequestId = useRef<string | null>(null);
  const previousLocation = useRef(routeLocation);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
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
    ...animeQueries.search('', 1, { idsIn: animeIds }, includeAdult),
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

  useEffect(() => {
    if (isOpen) dropZoneRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (previousLocation.current === routeLocation) return;
    previousLocation.current = routeLocation;
    setIsOpen(false);
  }, [routeLocation]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        widgetRef.current &&
        !widgetRef.current.contains(target)
      )
        setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    };
    window.addEventListener('pointerdown', closeOnPointerDown);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.removeEventListener('pointerdown', closeOnPointerDown);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen]);

  const selectImage = useCallback(
    (file: File | undefined) => {
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
    },
    [cancelActiveSearch],
  );

  const onSelectImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    selectImage(file);
  };

  const onPasteImage = (event: ClipboardEvent<HTMLElement>) => {
    const file = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .find((item): item is File => item !== null);
    if (!file) return;
    event.preventDefault();
    selectImage(file);
  };

  const onDropImage = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    selectImage(event.dataTransfer.files[0]);
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

  const clearSelectedImage = () => {
    cancelActiveSearch();
    setSelectedImage(null);
    setMatches([]);
    setError(null);
    setStatus(null);
  };

  const searchingCatalog = matches.length > 0 && catalogQuery.isPending;
  const catalogError = matches.length > 0 && catalogQuery.isError;
  const noVisibleMatches =
    matches.length > 0 &&
    !catalogQuery.isPending &&
    !catalogQuery.isError &&
    displayMatches.length === 0;

  return (
    <div ref={widgetRef} className="screenshot-search-widget">
      <button
        ref={triggerRef}
        type="button"
        className="screenshot-search-widget__trigger"
        aria-label="Buscar anime por screenshot"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        title="Buscar anime por screenshot"
        onClick={() => setIsOpen((open) => !open)}
      >
        <ImagePlus size={18} strokeWidth={1.9} aria-hidden="true" />
      </button>

      {isOpen && (
        <section
          id="screenshot-search-widget-popover"
          role="dialog"
          aria-modal="false"
          aria-labelledby="screenshot-search-widget-title"
          className="screenshot-search-widget__popover"
          onPaste={onPasteImage}
        >
          <header className="screenshot-search-widget__heading">
            <div>
              <p className="screenshot-search-widget__eyebrow">BUSCA VISUAL</p>
              <h2 id="screenshot-search-widget-title">
                Descubra de qual anime é a cena
              </h2>
            </div>
            <button
              type="button"
              className="screenshot-search-widget__close"
              aria-label="Fechar busca por screenshot"
              onClick={() => {
                setIsOpen(false);
                triggerRef.current?.focus();
              }}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </header>

          <p className="screenshot-search-widget__hint">
            Cole uma imagem, solte um arquivo ou escolha uma captura PNG, JPG ou
            WebP de até 10 MB.
          </p>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            aria-label="Selecionar captura de anime"
            onChange={onSelectImage}
          />

          <div
            ref={dropZoneRef}
            role="group"
            tabIndex={0}
            aria-label="Área para colar ou soltar uma captura de anime"
            className={`screenshot-search-widget__dropzone${isDragging ? ' is-dragging' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              if (
                event.relatedTarget instanceof Node &&
                event.currentTarget.contains(event.relatedTarget)
              )
                return;
              setIsDragging(false);
            }}
            onDrop={onDropImage}
          >
            {selectedImage ? (
              <>
                <img
                  src={selectedImage.previewUrl}
                  alt="Prévia local da captura selecionada"
                  className="screenshot-search-widget__preview"
                />
                <span className="screenshot-search-widget__file-name">
                  {selectedImage.file.name || 'Imagem da área de transferência'}
                </span>
              </>
            ) : (
              <>
                <span className="screenshot-search-widget__drop-icon">
                  <ImagePlus size={20} aria-hidden="true" />
                </span>
                <span className="screenshot-search-widget__drop-title">
                  Cole ou solte sua captura aqui
                </span>
                <span className="screenshot-search-widget__drop-copy">
                  A imagem fica neste dispositivo até você iniciar a busca.
                </span>
              </>
            )}
          </div>

          <div className="screenshot-search-widget__actions">
            <button
              type="button"
              className="screenshot-search-widget__secondary-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImagePlus size={14} aria-hidden="true" />
              Escolher arquivo
            </button>
            {selectedImage && (
              <button
                type="button"
                className="screenshot-search-widget__secondary-button"
                aria-label="Remover imagem selecionada"
                onClick={clearSelectedImage}
              >
                <X size={14} aria-hidden="true" />
                Remover
              </button>
            )}
            {isSearching && (
              <button
                type="button"
                className="screenshot-search-widget__secondary-button"
                onClick={cancelActiveSearch}
              >
                <X size={14} aria-hidden="true" /> Cancelar
              </button>
            )}
            <button
              type="button"
              disabled={!selectedImage || isSearching}
              onClick={() => void searchByImage()}
              className="screenshot-search-widget__search-button"
            >
              <Search size={14} aria-hidden="true" />
              {isSearching ? 'Buscando…' : 'Buscar'}
            </button>
          </div>

          <p className="screenshot-search-widget__privacy">
            Ao buscar, a imagem será enviada ao trace.moe para análise. A
            Animonkey não salva o arquivo; o trace.moe informa que imagens
            enviadas para busca são excluídas imediatamente.
          </p>

          {error && (
            <p role="alert" className="screenshot-search-widget__error">
              {error}
            </p>
          )}
          {(status || searchingCatalog) && (
            <p
              role="status"
              aria-live="polite"
              className="screenshot-search-widget__status"
            >
              {searchingCatalog ? 'Carregando títulos do AniList…' : status}
            </p>
          )}
          {catalogError && (
            <p role="alert" className="screenshot-search-widget__error">
              A busca encontrou cenas, mas não foi possível carregar os títulos
              do AniList.
            </p>
          )}
          {noVisibleMatches && (
            <p role="status" className="screenshot-search-widget__status">
              Nenhum resultado corresponde à preferência de conteúdo adulto
              atual.
            </p>
          )}
          {displayMatches.length > 0 && (
            <div className="screenshot-search-widget__results">
              <div className="screenshot-search-widget__results-heading">
                <h3>Cenas correspondentes</h3>
                <span>
                  {String(displayMatches.length)}{' '}
                  {displayMatches.length === 1 ? 'anime' : 'animes'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
      )}
    </div>
  );
}
