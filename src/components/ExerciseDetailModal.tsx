import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Info, Play, X } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import { useI18n } from '@/i18n/useI18n';
import { mergeMarkdownWithUrls } from '@/services/markdown';
import { calculateExercisePRStats, computeExerciseInstanceStats, findLastCompletedExerciseStats } from '@/services/exerciseDetailStats';
import { normalizeYouTubeUrl } from '@/services/officialContent';
import { inferMediaTypeFromUrl } from '@/services/mediaType';
import type { ExerciseDef, ExerciseInstance, Workout } from '@/types';

type ExerciseDetailModalProps = {
  isOpen: boolean;
  exercise: ExerciseDef | null;
  currentExercise?: ExerciseInstance | null;
  currentWorkoutId?: string | null;
  workouts?: Workout[];
  onClose: () => void;
};

type CarouselItem = {
  id: string;
  contentType: 'image' | 'video';
  url: string;
  title?: string;
};

const CLOSE_MS = 460;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const buildCarouselItems = (exercise: ExerciseDef): CarouselItem[] => {
  const items: CarouselItem[] = [];

  if (exercise.thumbnailUrl) {
    const inferred = inferMediaTypeFromUrl(exercise.thumbnailUrl) ?? 'image';
    items.push({
      id: `thumb-${exercise.id}`,
      contentType: inferred,
      url: exercise.thumbnailUrl,
      title: exercise.name,
    });
  }

  const uploads = Array.isArray(exercise.mediaItems)
    ? exercise.mediaItems.filter((item) => item.kind === 'upload')
    : [];

  for (const item of uploads) {
    items.push({
      id: item.id,
      contentType: item.contentType,
      url: item.url,
      title: item.title,
    });
  }

  if (
    items.length === 0 &&
    exercise.mediaUrl &&
    (exercise.mediaType === 'image' || exercise.mediaType === 'video')
  ) {
    items.push({
      id: `legacy-${exercise.id}`,
      contentType: exercise.mediaType,
      url: exercise.mediaUrl,
      title: exercise.name,
    });
  }

  const seen = new Set<string>();
  return items.filter((item) => {
    const url = item.url?.trim();
    if (!url) return false;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
};

const GifVideo: React.FC<{ src: string; title: string; className?: string }> = ({ src, title, className }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [showPlayOverlay, setShowPlayOverlay] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = true;
    const playPromise = video.play();
    if (playPromise && typeof (playPromise as Promise<void>).catch === 'function') {
      (playPromise as Promise<void>)
        .then(() => setShowPlayOverlay(false))
        .catch(() => setShowPlayOverlay(true));
    }
  }, [src]);

  const togglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (video.paused) {
        await video.play();
        setShowPlayOverlay(false);
      } else {
        video.pause();
        setShowPlayOverlay(true);
      }
    } catch {
      setShowPlayOverlay(true);
    }
  };

  return (
    <button
      type="button"
      onClick={togglePlayback}
      className={`relative h-full w-full ${className ?? ''}`}
      aria-label={title}
    >
      <video
        ref={videoRef}
        className="h-full w-full object-cover"
        src={src}
        autoPlay
        muted
        loop
        playsInline
        controls={false}
        preload="metadata"
        disablePictureInPicture
      />
      {showPlayOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <span className="w-14 h-14 rounded-full bg-black/60 text-white flex items-center justify-center">
            <Play size={20} fill="currentColor" className="ml-0.5" />
          </span>
        </div>
      )}
    </button>
  );
};

const ExerciseDetailModal: React.FC<ExerciseDetailModalProps> = ({
  isOpen,
  exercise,
  currentExercise,
  currentWorkoutId,
  workouts = [],
  onClose,
}) => {
  const { t } = useI18n();
  const [isMounted, setIsMounted] = useState(false);
  const [phase, setPhase] = useState<'opening' | 'open' | 'closing'>('opening');
  const [renderExercise, setRenderExercise] = useState<ExerciseDef | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const openRafRef = useRef<number | null>(null);

  const [dragY, setDragY] = useState(0);
  const dragYRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ pointerId: number; startY: number } | null>(null);

  const carouselRef = useRef<HTMLDivElement | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    if (isOpen && exercise) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (openRafRef.current) window.cancelAnimationFrame(openRafRef.current);

      setRenderExercise(exercise);
      setIsMounted(true);
      setIsDragging(false);
      setDragY(0);
      dragYRef.current = 0;
      setCarouselIndex(0);
      if (carouselRef.current) carouselRef.current.scrollLeft = 0;

      setPhase('opening');
      openRafRef.current = window.requestAnimationFrame(() => {
        openRafRef.current = window.requestAnimationFrame(() => {
          // Force a layout read so iOS reliably animates from translateY(100%) -> 0.
          sheetRef.current?.getBoundingClientRect();
          setPhase('open');
        });
      });
      return;
    }

    if (!isOpen && isMounted) {
      if (openRafRef.current) window.cancelAnimationFrame(openRafRef.current);
      setIsDragging(false);
      setDragY(0);
      dragYRef.current = 0;
      setPhase('closing');
      closeTimerRef.current = window.setTimeout(() => {
        setIsMounted(false);
        setRenderExercise(null);
        closeTimerRef.current = null;
      }, CLOSE_MS);
    }
  }, [exercise, isOpen, isMounted]);

  useEffect(() => {
    if (!isMounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMounted]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
      if (openRafRef.current) window.cancelAnimationFrame(openRafRef.current);
      if (scrollRafRef.current) window.cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  const requestClose = () => {
    if (phase === 'closing') return;
    setPhase('closing');
    onClose();
  };

  const carouselItems = useMemo(() => {
    if (!renderExercise) return [];
    return buildCarouselItems(renderExercise);
  }, [renderExercise]);

  const mergedMarkdown = useMemo(() => {
    if (!renderExercise) return '';

    const legacyYoutubeUrls = (renderExercise.mediaItems ?? [])
      .filter((item) => item.kind === 'youtube')
      .map((item) => normalizeYouTubeUrl(item.url) ?? item.url);

    return mergeMarkdownWithUrls(renderExercise.markdown ?? '', legacyYoutubeUrls);
  }, [renderExercise]);

  const showStatsStrip = !!currentExercise && !!renderExercise;
  const thisStats = useMemo(() => computeExerciseInstanceStats(currentExercise), [currentExercise]);
  const lastStats = useMemo(() => {
    if (!renderExercise) return null;
    return findLastCompletedExerciseStats(workouts, renderExercise.id, currentWorkoutId);
  }, [currentWorkoutId, renderExercise, workouts]);
  const prStats = useMemo(() => {
    if (!renderExercise) return { maxWeight: 0, maxVolume: 0, maxEstimated1RM: 0 };
    return calculateExercisePRStats(workouts, renderExercise.id, currentWorkoutId);
  }, [currentWorkoutId, renderExercise, workouts]);

  const numberFormatter = useMemo(() => new Intl.NumberFormat(), []);

  const handleBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    requestClose();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (phase !== 'open') return;
    setIsDragging(true);
    dragStartRef.current = { pointerId: event.pointerId, startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStartRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const delta = event.clientY - drag.startY;
    const next = Math.max(0, delta);
    dragYRef.current = next;
    setDragY(next);
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStartRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragStartRef.current = null;
    setIsDragging(false);

    const sheetHeight =
      (event.currentTarget.parentElement as HTMLElement | null)?.getBoundingClientRect()?.height ?? 0;
    const threshold = Math.max(72, sheetHeight * 0.12);
    const finalDragY = dragYRef.current;
    if (finalDragY > threshold) {
      window.requestAnimationFrame(() => requestClose());
      return;
    }
    dragYRef.current = 0;
    setDragY(0);
  };

  const handleCarouselScroll = () => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = window.requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const el = carouselRef.current;
      if (!el) return;
      const width = el.clientWidth || 1;
      const next = clamp(Math.round(el.scrollLeft / width), 0, Math.max(0, carouselItems.length - 1));
      setCarouselIndex(next);
    });
  };

  if (!isMounted || !renderExercise) return null;

  const hasCarousel = carouselItems.length > 0;
  const hasMarkdown = !!mergedMarkdown.trim();
  const hasDescription = !!renderExercise.description?.trim();

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center"
      onClick={handleBackdropClick}
      aria-hidden={phase === 'closing'}
    >
      <div
        className={`exercise-detail-backdrop pointer-events-none absolute inset-0 bg-black/70 backdrop-blur-sm ${phase === 'open' ? 'is-open' : ''}`}
      />

      <div
        ref={sheetRef}
        className={`exercise-detail-sheet relative w-full max-w-4xl rounded-t-[28px] border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-2xl flex flex-col ${phase === 'open' ? 'is-open' : ''} ${
          isDragging ? 'is-dragging' : ''
        }`}
        style={{
          maxHeight: 'calc(100dvh - var(--standalone-safe-top) - 56px)',
          transform:
            phase === 'open'
              ? `translate3d(0, ${dragY}px, 0)`
              : phase === 'opening'
                ? 'translate3d(0, 100%, 0)'
                : 'translate3d(0, 100%, 0)',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          className="px-4 pt-3 pb-2 flex items-center justify-between select-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          style={{ touchAction: 'none' }}
          aria-label={t('exerciseDetail.dragHandle')}
        >
          <div className="flex-1 flex items-center justify-center">
            <div className="h-1.5 w-12 rounded-full bg-gray-200 dark:bg-gray-800" />
          </div>
          <button
            type="button"
            onClick={requestClose}
            onPointerDown={(event) => event.stopPropagation()}
            className="w-10 h-10 -mr-1 rounded-full bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-300 flex items-center justify-center"
            aria-label={t('exerciseDetail.close')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto scroll-area px-5 pb-[calc(2rem+env(safe-area-inset-bottom))]">
          {hasCarousel && (
            <section className="relative mt-1 mb-4 overflow-hidden rounded-3xl border border-gray-100 dark:border-gray-800 bg-black">
              <div
                ref={carouselRef}
                onScroll={handleCarouselScroll}
                data-testid="exercise-detail-carousel"
                className="flex w-full overflow-x-auto snap-x snap-mandatory hide-scrollbar"
                style={{ WebkitOverflowScrolling: 'touch' }}
              >
                {carouselItems.map((item) => (
                  <div key={item.id} className="min-w-full snap-center">
                    <div className="aspect-video w-full">
                      {item.contentType === 'video' ? (
                        <GifVideo src={item.url} title={item.title || renderExercise.name} />
                      ) : (
                        <img
                          className="h-full w-full object-cover"
                          src={item.url}
                          alt={item.title || renderExercise.name}
                          loading="lazy"
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {carouselItems.length > 1 && (
                <div className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-full bg-black/55 backdrop-blur-sm text-white/90 text-xs font-black tabular-nums px-2 py-1">
                  {carouselIndex + 1}/{carouselItems.length}
                </div>
              )}
            </section>
          )}

            <section className="pt-1">
            <div className="flex items-center gap-2">
              <Info size={16} className="text-brand" />
              <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                {renderExercise.name}
              </h2>
            </div>

            {hasDescription && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed">
                {renderExercise.description}
              </p>
            )}

            {showStatsStrip && (
              <div className="mt-4 -mx-5 px-5">
                <div
                  data-testid="exercise-detail-stats"
                  className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                >
                  <div className="min-w-[220px] snap-start rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      {t('exerciseDetail.statsVolume')}
                    </p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-end justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          {t('exerciseDetail.statsThis')}
                        </span>
                        <span className="text-sm font-black text-gray-900 dark:text-gray-100 tabular-nums">
                          {numberFormatter.format(thisStats.volume)}
                        </span>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          {t('exerciseDetail.statsLast')}
                        </span>
                        <span className="text-sm font-black text-gray-900 dark:text-gray-100 tabular-nums">
                          {lastStats ? numberFormatter.format(lastStats.volume) : '—'}
                        </span>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          {t('exerciseDetail.statsPR')}
                        </span>
                        <span className="text-sm font-black text-gray-900 dark:text-gray-100 tabular-nums">
                          {numberFormatter.format(Math.round(prStats.maxVolume))}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-[220px] snap-start rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      {t('exerciseDetail.statsMaxWeight')}
                    </p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-end justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          {t('exerciseDetail.statsThis')}
                        </span>
                        <span className="text-sm font-black text-gray-900 dark:text-gray-100 tabular-nums">
                          {thisStats.maxWeight > 0 ? numberFormatter.format(thisStats.maxWeight) : '—'}
                        </span>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          {t('exerciseDetail.statsPR')}
                        </span>
                        <span className="text-sm font-black text-gray-900 dark:text-gray-100 tabular-nums">
                          {prStats.maxWeight > 0 ? numberFormatter.format(prStats.maxWeight) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-[220px] snap-start rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 px-4 py-3">
                    <p className="text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400">
                      {t('exerciseDetail.statsEstimated1RM')}
                    </p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-end justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          {t('exerciseDetail.statsThis')}
                        </span>
                        <span className="text-sm font-black text-gray-900 dark:text-gray-100 tabular-nums">
                          {thisStats.maxEstimated1RM > 0 ? numberFormatter.format(thisStats.maxEstimated1RM) : '—'}
                        </span>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                          {t('exerciseDetail.statsPR')}
                        </span>
                        <span className="text-sm font-black text-gray-900 dark:text-gray-100 tabular-nums">
                          {prStats.maxEstimated1RM > 0 ? numberFormatter.format(Math.round(prStats.maxEstimated1RM * 10) / 10) : '—'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {hasMarkdown && (
              <article className="prose prose-sm max-w-none dark:prose-invert prose-a:text-[var(--brand-yellow-text)] dark:prose-a:text-[var(--brand-yellow)] prose-a:font-semibold mt-4">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeSanitize]}
                  components={{
                    a: ({ node: _node, ...props }) => (
                      <a {...props} target="_blank" rel="noreferrer noopener" />
                    ),
                    p: ({ node: _node, children }) => {
                      const parts = React.Children.toArray(children).filter((child) => {
                        if (typeof child === 'string') return child.trim().length > 0;
                        return true;
                      });

                      if (parts.length === 1) {
                        const only = parts[0];
                        const maybeUrl =
                          typeof only === 'string'
                            ? only.trim()
                            : React.isValidElement(only)
                              ? String((only.props as Record<string, unknown>)?.href ?? '').trim()
                              : '';

                        const embedUrl = normalizeYouTubeUrl(maybeUrl);
                        if (embedUrl) {
                          return (
                            <div className="my-4 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-black">
                              <div className="aspect-video w-full">
                                <iframe
                                  className="h-full w-full"
                                  src={embedUrl}
                                  title={renderExercise.name}
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                  referrerPolicy="strict-origin-when-cross-origin"
                                  allowFullScreen
                                />
                              </div>
                            </div>
                          );
                        }

                        const inferred = inferMediaTypeFromUrl(maybeUrl);
                        if (inferred === 'video') {
                          return (
                            <div className="my-4 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-black">
                              <div className="aspect-video w-full">
                                <video
                                  className="h-full w-full object-cover"
                                  src={maybeUrl}
                                  controls
                                  playsInline
                                  preload="metadata"
                                />
                              </div>
                            </div>
                          );
                        }

                        if (inferred === 'image') {
                          return (
                            <div className="my-4 overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-black">
                              <div className="aspect-video w-full">
                                <img className="h-full w-full object-cover" src={maybeUrl} alt={renderExercise.name} />
                              </div>
                            </div>
                          );
                        }
                      }

                      return <p>{children}</p>;
                    },
                  }}
                >
                  {mergedMarkdown}
                </ReactMarkdown>
              </article>
            )}
          </section>

          {!hasCarousel && !hasDescription && !hasMarkdown && (
            <div className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">
              {t('exerciseDetail.empty')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExerciseDetailModal;
