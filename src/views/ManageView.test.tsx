import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '@/i18n/I18nProvider';
import ManageView from '@/views/ManageView';

const adminState = {
  isAdmin: false,
  isDesktop: true,
};

const gymState = {
  user: { email: 'admin@example.com', id: 'user-1', preferences: { defaultUnit: 'lbs' } },
  exerciseDefs: [],
  templates: [],
  refreshOfficialContent: vi.fn(async () => {}),
};

vi.mock('@/hooks/useGym', () => ({
  useGym: () => gymState,
}));

vi.mock('@/services/admin', () => ({
  isAdminUser: () => adminState.isAdmin,
  isDesktopViewport: () => adminState.isDesktop,
}));

vi.mock('@/services/officialContent', () => ({
  upsertOfficialExercise: vi.fn(),
  deleteOfficialExercise: vi.fn(),
  upsertOfficialTemplate: vi.fn(),
  deleteOfficialTemplate: vi.fn(),
  normalizeYouTubeUrl: (url: string) => url,
}));

vi.mock('@/services/supabase', () => ({
  uploadMediaToSupabase: vi.fn(),
}));

vi.mock('@/services/utils', () => ({
  processAndSaveMedia: vi.fn(),
  getMediaFromDB: vi.fn(),
  generateId: () => 'generated-id',
}));

const renderView = () =>
  render(
    <MemoryRouter>
      <I18nProvider>
        <ManageView />
      </I18nProvider>
    </MemoryRouter>
  );

describe('ManageView access control', () => {
  beforeEach(() => {
    adminState.isAdmin = false;
    adminState.isDesktop = true;
    gymState.exerciseDefs = [];
    gymState.templates = [];
  });

  it('shows unauthorized state for non-admin users', () => {
    renderView();
    expect(screen.getByText('Unauthorized')).toBeInTheDocument();
  });

  it('shows desktop-only state for admin users on mobile viewport', () => {
    adminState.isAdmin = true;
    adminState.isDesktop = false;

    renderView();
    expect(screen.getByText('Desktop Required')).toBeInTheDocument();
  });

  it('renders manage workspace for admin desktop users', () => {
    adminState.isAdmin = true;
    adminState.isDesktop = true;

    renderView();
    expect(screen.getByRole('heading', { name: 'Manage' })).toBeInTheDocument();
    expect(screen.getAllByText('Official Exercises').length).toBeGreaterThan(0);
  });
});
