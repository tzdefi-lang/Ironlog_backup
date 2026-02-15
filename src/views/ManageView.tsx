import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Info, Monitor, Plus, Save, ShieldAlert, Trash2, UploadCloud, Youtube } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, pushToast } from '@/components/ui';
import { BODY_PART_OPTIONS, getDefaultBarbellWeight, normalizeCategory } from '@/constants';
import { useGym } from '@/hooks/useGym';
import { useI18n } from '@/i18n/useI18n';
import { isAdminUser, isDesktopViewport } from '@/services/admin';
import { mergeMarkdownWithUrls } from '@/services/markdown';
import {
  deleteOfficialExercise,
  deleteOfficialTemplate,
  normalizeYouTubeUrl,
  upsertOfficialExercise,
  upsertOfficialTemplate,
} from '@/services/officialContent';
import { uploadMediaToSupabase } from '@/services/supabase';
import { generateId, getMediaFromDB, processAndSaveMedia } from '@/services/utils';
import type { ExerciseDef, ExerciseMediaItem, WorkoutTemplate, WorkoutTemplateExercise } from '@/types';

type ManageTab = 'exercises' | 'templates';

type DraftMediaItem = {
  id: string;
  kind: 'upload';
  contentType: 'image' | 'video';
  url: string;
  title: string;
  file?: File;
};

const uploadExerciseFile = async (ownerId: string, file: File) => {
  const { id, type } = await processAndSaveMedia(file);
  const processed = await getMediaFromDB(id);
  const uploadBlob = processed ?? file;
  const mime = uploadBlob.type.toLowerCase();
  let extension = 'jpg';
  if (type === 'video') {
    extension = 'mp4';
    if (mime.includes('quicktime')) extension = 'mov';
    else if (mime.includes('webm')) extension = 'webm';
    else if (mime.includes('mp4')) extension = 'mp4';
    else {
      const fromName = file.name.split('.').pop()?.toLowerCase();
      if (fromName && ['mp4', 'mov', 'webm', 'm4v'].includes(fromName)) {
        extension = fromName === 'm4v' ? 'mp4' : fromName;
      }
    }
  }

  const uploadPath = `${ownerId}/official/${Date.now()}_${generateId()}.${extension}`;
  const url = await uploadMediaToSupabase(uploadBlob, uploadPath);
  return { url, type };
};

const toTemplateExerciseRows = (value: unknown): WorkoutTemplateExercise[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null;
      const row = entry as Record<string, unknown>;
      const defId = typeof row.defId === 'string' ? row.defId : '';
      const defaultSets = Number(row.defaultSets);
      if (!defId) return null;
      return {
        defId,
        defaultSets: Number.isFinite(defaultSets) ? Math.max(1, Math.round(defaultSets)) : 1,
      } satisfies WorkoutTemplateExercise;
    })
    .filter((row): row is WorkoutTemplateExercise => row !== null);
};

const ManageView: React.FC = () => {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { exerciseDefs, templates, user, refreshOfficialContent } = useGym();

  const [activeTab, setActiveTab] = useState<ManageTab>('exercises');
  const [isDesktop, setIsDesktop] = useState(() => isDesktopViewport());

  const [isSavingExercise, setIsSavingExercise] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  const [editingExerciseId, setEditingExerciseId] = useState<string | null>(null);
  const [exerciseName, setExerciseName] = useState('');
  const [exerciseDescription, setExerciseDescription] = useState('');
  const [exerciseCategory, setExerciseCategory] = useState('Other');
  const [exerciseUsesBarbell, setExerciseUsesBarbell] = useState(false);
  const [exerciseBarbellWeight, setExerciseBarbellWeight] = useState(45);
  const [exerciseMarkdown, setExerciseMarkdown] = useState('');
  const exerciseMarkdownRef = useRef<HTMLTextAreaElement | null>(null);
  const [exerciseThumbnailUrl, setExerciseThumbnailUrl] = useState('');
  const [exerciseThumbnailFile, setExerciseThumbnailFile] = useState<File | null>(null);
  const [mediaItems, setMediaItems] = useState<DraftMediaItem[]>([]);
  const [youtubeInput, setYoutubeInput] = useState('');

  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateTagline, setTemplateTagline] = useState('');
  const [templateExercises, setTemplateExercises] = useState<WorkoutTemplateExercise[]>([]);

  const officialExercises = useMemo(
    () => exerciseDefs.filter((exercise) => exercise.source === 'official'),
    [exerciseDefs]
  );
  const officialTemplates = useMemo(
    () => templates.filter((template) => template.source === 'official'),
    [templates]
  );

  const adminUser = isAdminUser(user?.email);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const sync = () => setIsDesktop(mediaQuery.matches);
    sync();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', sync);
      return () => mediaQuery.removeEventListener('change', sync);
    }

    mediaQuery.addListener(sync);
    return () => mediaQuery.removeListener(sync);
  }, []);

  const resetExerciseForm = () => {
    setEditingExerciseId(null);
    setExerciseName('');
    setExerciseDescription('');
    setExerciseCategory('Other');
    setExerciseUsesBarbell(false);
    setExerciseBarbellWeight(45);
    setExerciseMarkdown('');
    setExerciseThumbnailUrl('');
    setExerciseThumbnailFile(null);
    setMediaItems([]);
    setYoutubeInput('');
  };

  const resetTemplateForm = () => {
    setEditingTemplateId(null);
    setTemplateName('');
    setTemplateDescription('');
    setTemplateTagline('');
    setTemplateExercises([]);
  };

  const startEditExercise = (exercise: ExerciseDef) => {
    setActiveTab('exercises');
    setEditingExerciseId(exercise.id);
    setExerciseName(exercise.name);
    setExerciseDescription(exercise.description ?? '');
    setExerciseCategory(normalizeCategory(exercise.category));
    setExerciseUsesBarbell(!!exercise.usesBarbell);
    setExerciseBarbellWeight(exercise.barbellWeight ?? getDefaultBarbellWeight(user?.preferences.defaultUnit ?? 'lbs'));
    const legacyYoutubeUrls = (exercise.mediaItems ?? [])
      .filter((item) => item.kind === 'youtube')
      .map((item) => item.url);
    setExerciseMarkdown(mergeMarkdownWithUrls(exercise.markdown ?? '', legacyYoutubeUrls));
    setExerciseThumbnailUrl(exercise.thumbnailUrl ?? '');
    setExerciseThumbnailFile(null);

    const normalizedMedia: DraftMediaItem[] = (exercise.mediaItems ?? [])
      .filter((item) => item.kind === 'upload')
      .map((item) => ({
        id: item.id,
        kind: 'upload',
        contentType: item.contentType,
        url: item.url,
        title: item.title ?? '',
      }));

    setMediaItems(normalizedMedia);
  };

  const startEditTemplate = (template: WorkoutTemplate) => {
    setActiveTab('templates');
    setEditingTemplateId(template.id);
    setTemplateName(template.name);
    setTemplateDescription(template.description ?? '');
    setTemplateTagline(template.tagline ?? '');
    setTemplateExercises(toTemplateExerciseRows(template.exercises));
  };

  const handleUploadMediaItems = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const nextItems: DraftMediaItem[] = [];
    for (const file of Array.from(files)) {
      nextItems.push({
        id: generateId(),
        kind: 'upload',
        contentType: file.type.startsWith('video/') ? 'video' : 'image',
        url: URL.createObjectURL(file),
        title: '',
        file,
      });
    }

    setMediaItems((prev) => [...prev, ...nextItems]);
  };

  const handleInsertYoutube = () => {
    const normalized = normalizeYouTubeUrl(youtubeInput);
    if (!normalized) {
      pushToast({ kind: 'error', message: t('manage.invalidYoutube') });
      return;
    }

    const el = exerciseMarkdownRef.current;
    if (!el) {
      setExerciseMarkdown((prev) => mergeMarkdownWithUrls(prev ?? '', [normalized]));
      setYoutubeInput('');
      return;
    }

    const markdown = exerciseMarkdown ?? '';
    const start = el.selectionStart ?? markdown.length;
    const end = el.selectionEnd ?? markdown.length;
    const before = markdown.slice(0, start);
    const after = markdown.slice(end);
    const prefix = before.length > 0 && !before.endsWith('\n') ? '\n' : '';
    const insert = `${prefix}${normalized}\n`;
    setExerciseMarkdown(`${before}${insert}${after}`);
    requestAnimationFrame(() => {
      el.focus();
      const pos = before.length + insert.length;
      el.setSelectionRange(pos, pos);
    });
    setYoutubeInput('');
  };

  const handleSaveExercise = async () => {
    const trimmedName = exerciseName.trim();
    if (!trimmedName) {
      pushToast({ kind: 'error', message: t('manage.exerciseNameRequired') });
      return;
    }

    if (!user?.id) {
      pushToast({ kind: 'error', message: t('manage.userRequired') });
      return;
    }

    setIsSavingExercise(true);
    try {
      let nextThumbnailUrl = exerciseThumbnailUrl.trim();
      if (exerciseThumbnailFile) {
        const uploadedThumbnail = await uploadExerciseFile(user.id, exerciseThumbnailFile);
        nextThumbnailUrl = uploadedThumbnail.url;
      }

      const finalizedMediaItems: ExerciseMediaItem[] = [];
      for (const item of mediaItems) {
        if (item.file) {
          const uploaded = await uploadExerciseFile(user.id, item.file);
          finalizedMediaItems.push({
            id: item.id,
            kind: 'upload',
            contentType: uploaded.type,
            url: uploaded.url,
            title: item.title.trim() || undefined,
          });
          continue;
        }

        if (!item.url.trim()) continue;
        finalizedMediaItems.push({
          id: item.id,
          kind: 'upload',
          contentType: item.contentType,
          url: item.url.trim(),
          title: item.title.trim() || undefined,
        });
      }

      const officialExercise: ExerciseDef = {
        id: editingExerciseId ?? generateId(),
        name: trimmedName,
        description: exerciseDescription.trim(),
        source: 'official',
        readOnly: true,
        category: exerciseCategory,
        usesBarbell: exerciseUsesBarbell,
        barbellWeight: exerciseUsesBarbell ? Math.max(0, exerciseBarbellWeight) : 0,
        thumbnailUrl: nextThumbnailUrl || undefined,
        markdown: exerciseMarkdown,
        mediaItems: finalizedMediaItems,
        mediaUrl: finalizedMediaItems.find((item) => item.kind === 'upload')?.url,
        mediaType: finalizedMediaItems.find((item) => item.kind === 'upload')?.contentType,
      };

      await upsertOfficialExercise(officialExercise);
      await refreshOfficialContent();
      resetExerciseForm();
      pushToast({ kind: 'success', message: t('manage.exerciseSaved') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('manage.saveFailed');
      pushToast({ kind: 'error', message });
    } finally {
      setIsSavingExercise(false);
    }
  };

  const handleDeleteExercise = async (id: string) => {
    try {
      await deleteOfficialExercise(id);
      await refreshOfficialContent();
      if (editingExerciseId === id) resetExerciseForm();
      pushToast({ kind: 'success', message: t('manage.exerciseDeleted') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('manage.deleteFailed');
      pushToast({ kind: 'error', message });
    }
  };

  const handleSaveTemplate = async () => {
    const trimmedName = templateName.trim();
    if (!trimmedName) {
      pushToast({ kind: 'error', message: t('manage.templateNameRequired') });
      return;
    }

    const normalizedExercises = templateExercises
      .map((exercise) => ({
        defId: exercise.defId,
        defaultSets: Number.isFinite(exercise.defaultSets)
          ? Math.max(1, Math.round(exercise.defaultSets))
          : 1,
      }))
      .filter((exercise) => !!exercise.defId);

    if (normalizedExercises.length === 0) {
      pushToast({ kind: 'error', message: t('manage.templateExerciseRequired') });
      return;
    }

    setIsSavingTemplate(true);
    try {
      const template: WorkoutTemplate = {
        id: editingTemplateId ?? generateId(),
        name: trimmedName,
        source: 'official',
        readOnly: true,
        description: templateDescription.trim(),
        tagline: templateTagline.trim(),
        exercises: normalizedExercises,
        createdAt: new Date().toISOString(),
      };

      await upsertOfficialTemplate(template);
      await refreshOfficialContent();
      resetTemplateForm();
      pushToast({ kind: 'success', message: t('manage.templateSaved') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('manage.saveFailed');
      pushToast({ kind: 'error', message });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    try {
      await deleteOfficialTemplate(id);
      await refreshOfficialContent();
      if (editingTemplateId === id) resetTemplateForm();
      pushToast({ kind: 'success', message: t('manage.templateDeleted') });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('manage.deleteFailed');
      pushToast({ kind: 'error', message });
    }
  };

  if (!adminUser) {
    return (
      <div className="h-full bg-white dark:bg-gray-950 flex items-center justify-center px-6 text-center">
        <div className="max-w-lg rounded-3xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-8">
          <ShieldAlert size={28} className="mx-auto text-red-500 mb-3" />
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">{t('manage.unauthorizedTitle')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{t('manage.unauthorizedMessage')}</p>
          <Button className="mt-6" onClick={() => navigate('/profile/settings')}>
            {t('manage.backToSettings')}
          </Button>
        </div>
      </div>
    );
  }

  if (!isDesktop) {
    return (
      <div className="h-full bg-white dark:bg-gray-950 flex items-center justify-center px-6 text-center">
        <div className="max-w-lg rounded-3xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-8">
          <Monitor size={28} className="mx-auto text-brand mb-3" />
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-100">{t('manage.desktopOnlyTitle')}</h1>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{t('manage.desktopOnlyMessage')}</p>
          <Button className="mt-6" onClick={() => navigate('/profile/settings')}>
            {t('manage.backToSettings')}
          </Button>
        </div>
      </div>
    );
  }

  const renderExercisesSection = () => (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 xl:col-span-5 rounded-3xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-5">
        <h2 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-4">
          {editingExerciseId ? t('manage.editOfficialExercise') : t('manage.newOfficialExercise')}
        </h2>

        <div className="space-y-3">
          <Input
            placeholder={t('manage.exerciseName')}
            value={exerciseName}
            onChange={(event) => setExerciseName(event.target.value)}
          />
          <Input
            placeholder={t('manage.exerciseDescription')}
            value={exerciseDescription}
            onChange={(event) => setExerciseDescription(event.target.value)}
          />

          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
              {t('manage.category')}
            </p>
            <select
              value={exerciseCategory}
              onChange={(event) => setExerciseCategory(event.target.value)}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-100"
            >
              {BODY_PART_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
            <input
              type="checkbox"
              checked={exerciseUsesBarbell}
              onChange={(event) => setExerciseUsesBarbell(event.target.checked)}
            />
            {t('manage.usesBarbell')}
          </label>

          {exerciseUsesBarbell && (
            <Input
              type="number"
              placeholder={t('manage.barbellWeight')}
              value={String(exerciseBarbellWeight)}
              onChange={(event) => setExerciseBarbellWeight(Number(event.target.value))}
            />
          )}

          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
              {t('manage.thumbnail')}
            </p>
            <Input
              placeholder={t('manage.thumbnailUrl')}
              value={exerciseThumbnailUrl}
              onChange={(event) => setExerciseThumbnailUrl(event.target.value)}
            />
            <label className="mt-2 inline-flex items-center gap-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 px-3 py-2 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
              <UploadCloud size={14} /> {t('manage.uploadThumbnail')}
              <input
                type="file"
                accept="image/*,video/*"
                className="hidden"
                onChange={(event) => setExerciseThumbnailFile(event.target.files?.[0] ?? null)}
              />
            </label>
            {exerciseThumbnailFile && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{exerciseThumbnailFile.name}</p>
            )}
          </div>

          <div>
            <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">
              {t('manage.markdown')}
            </p>
            <textarea
              ref={exerciseMarkdownRef}
              value={exerciseMarkdown}
              onChange={(event) => setExerciseMarkdown(event.target.value)}
              rows={5}
              placeholder={t('manage.markdownPlaceholder')}
              className="w-full rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm text-gray-800 dark:text-gray-100 outline-none"
            />
            <div className="mt-2">
              <div className="flex gap-2 items-start">
                <Input
                  placeholder={t('manage.youtubeUrl')}
                  value={youtubeInput}
                  onChange={(event) => setYoutubeInput(event.target.value)}
                  className="mb-0"
                />
                <button
                  type="button"
                  onClick={handleInsertYoutube}
                  className="w-10 h-10 mt-1 rounded-xl bg-brand text-gray-900 flex items-center justify-center hover:brightness-95"
                  aria-label={t('manage.addYoutube')}
                  title={t('manage.addYoutube')}
                >
                  <Youtube size={14} />
                </button>
              </div>
              <p className="text-[11px] text-gray-400 dark:text-gray-500 -mt-2">
                {t('manage.youtubeEmbedHint')}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                {t('manage.mediaItems')}
              </p>
              <label className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 cursor-pointer">
                <Plus size={12} /> {t('manage.addUpload')}
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(event) => {
                    void handleUploadMediaItems(event.target.files);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>

            <div className="mt-3 space-y-2 max-h-40 overflow-y-auto">
              {mediaItems.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">{t('manage.noMediaItems')}</p>
              ) : (
                mediaItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-gray-700 dark:text-gray-200 truncate">
                        {item.file?.name || item.url}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMediaItems((prev) => prev.filter((entry) => entry.id !== item.id))}
                        className="text-red-500"
                        aria-label={t('manage.removeMedia')}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <Input
                      placeholder={t('manage.mediaTitle')}
                      value={item.title}
                      onChange={(event) =>
                        setMediaItems((prev) =>
                          prev.map((entry) =>
                            entry.id === item.id
                              ? {
                                  ...entry,
                                  title: event.target.value,
                                }
                              : entry
                          )
                        )
                      }
                    />
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button onClick={() => void handleSaveExercise()} disabled={isSavingExercise} className="w-full">
              <Save size={14} />
              {isSavingExercise ? t('manage.saving') : t('manage.saveExercise')}
            </Button>
            <Button variant="secondary" className="w-full" onClick={resetExerciseForm}>
              {t('manage.clearForm')}
            </Button>
          </div>
        </div>
      </section>

      <section className="col-span-12 xl:col-span-7 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-4">{t('manage.officialExercises')}</h2>
        <div className="space-y-2">
          {officialExercises.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('manage.noOfficialExercises')}
            </div>
          ) : (
            officialExercises.map((exercise) => (
              <div
                key={exercise.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{exercise.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{normalizeCategory(exercise.category)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => startEditExercise(exercise)} className="!px-3 !py-2 text-xs">
                    {t('manage.edit')}
                  </Button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteExercise(exercise.id)}
                    className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-500 flex items-center justify-center"
                    aria-label={t('manage.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );

  const renderTemplatesSection = () => (
    <div className="grid grid-cols-12 gap-6">
      <section className="col-span-12 xl:col-span-5 rounded-3xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 p-5">
        <h2 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-4">
          {editingTemplateId ? t('manage.editOfficialTemplate') : t('manage.newOfficialTemplate')}
        </h2>

        <div className="space-y-3">
          <Input
            placeholder={t('manage.templateName')}
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
          />
          <Input
            placeholder={t('manage.templateDescription')}
            value={templateDescription}
            onChange={(event) => setTemplateDescription(event.target.value)}
          />
          <Input
            placeholder={t('manage.templateTagline')}
            value={templateTagline}
            onChange={(event) => setTemplateTagline(event.target.value)}
          />

          <div className="rounded-2xl border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                {t('manage.templateExercises')}
              </p>
              <button
                type="button"
                onClick={() =>
                  setTemplateExercises((prev) => [...prev, { defId: officialExercises[0]?.id ?? '', defaultSets: 3 }])
                }
                className="text-xs font-semibold text-brand"
              >
                + {t('manage.addExercise')}
              </button>
            </div>

            <div className="mt-2 space-y-2">
              {templateExercises.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">{t('manage.noTemplateExercises')}</p>
              ) : (
                templateExercises.map((exercise, index) => (
                  <div key={`${exercise.defId}-${index}`} className="grid grid-cols-[1fr_90px_34px] gap-2 items-center">
                    <select
                      value={exercise.defId}
                      onChange={(event) =>
                        setTemplateExercises((prev) =>
                          prev.map((entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  defId: event.target.value,
                                }
                              : entry
                          )
                        )
                      }
                      className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm"
                    >
                      <option value="">{t('manage.selectExercise')}</option>
                      {officialExercises.map((officialExercise) => (
                        <option key={officialExercise.id} value={officialExercise.id}>
                          {officialExercise.name}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="number"
                      min={1}
                      value={String(exercise.defaultSets)}
                      onChange={(event) =>
                        setTemplateExercises((prev) =>
                          prev.map((entry, entryIndex) =>
                            entryIndex === index
                              ? {
                                  ...entry,
                                  defaultSets: Math.max(1, Number(event.target.value) || 1),
                                }
                              : entry
                          )
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setTemplateExercises((prev) => prev.filter((_, entryIndex) => entryIndex !== index))
                      }
                      className="w-8 h-8 rounded-lg text-red-500 bg-red-50 dark:bg-red-950/40"
                      aria-label={t('manage.removeExercise')}
                    >
                      <Trash2 size={14} className="mx-auto" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <Button onClick={() => void handleSaveTemplate()} disabled={isSavingTemplate} className="w-full">
              <Save size={14} />
              {isSavingTemplate ? t('manage.saving') : t('manage.saveTemplate')}
            </Button>
            <Button variant="secondary" className="w-full" onClick={resetTemplateForm}>
              {t('manage.clearForm')}
            </Button>
          </div>
        </div>
      </section>

      <section className="col-span-12 xl:col-span-7 rounded-3xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5">
        <h2 className="text-lg font-black text-gray-900 dark:text-gray-100 mb-4">{t('manage.officialTemplates')}</h2>
        <div className="space-y-2">
          {officialTemplates.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-700 p-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('manage.noOfficialTemplates')}
            </div>
          ) : (
            officialTemplates.map((template) => (
              <div
                key={template.id}
                className="rounded-2xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{template.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {template.exercises.length} {t('manage.exercises')}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" onClick={() => startEditTemplate(template)} className="!px-3 !py-2 text-xs">
                    {t('manage.edit')}
                  </Button>
                  <button
                    type="button"
                    onClick={() => void handleDeleteTemplate(template.id)}
                    className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-500 flex items-center justify-center"
                    aria-label={t('manage.delete')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );

  return (
    <div className="h-full bg-white dark:bg-gray-950 overflow-y-auto scroll-area px-8 pt-8 pb-12">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate('/profile/settings')}
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <ArrowLeft size={16} /> {t('manage.backToSettings')}
          </button>
          <h1 className="text-4xl font-black text-gray-900 dark:text-gray-100 tracking-tight mt-2">{t('manage.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('manage.subtitle')}</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-brand px-3 py-1.5 bg-brand-tint">
          <Info size={14} className="text-brand" />
          <span className="text-xs font-semibold text-brand">{t('manage.instantPublish')}</span>
        </div>
      </header>

      <div className="mb-5 inline-flex rounded-2xl bg-gray-100 dark:bg-gray-800 p-1">
        <button
          type="button"
          onClick={() => setActiveTab('exercises')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            activeTab === 'exercises'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-300'
          }`}
        >
          {t('manage.officialExercises')}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            activeTab === 'templates'
              ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100'
              : 'text-gray-500 dark:text-gray-300'
          }`}
        >
          {t('manage.officialTemplates')}
        </button>
      </div>

      {activeTab === 'exercises' ? renderExercisesSection() : renderTemplatesSection()}
    </div>
  );
};

export default ManageView;
