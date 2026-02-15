export type Unit = 'kg' | 'lbs';
export type ThemeMode = 'light' | 'dark' | 'system';
export type ContentSource = 'personal' | 'official';
export type ExerciseMediaKind = 'upload' | 'youtube';

export interface ExerciseMediaItem {
  id: string;
  kind: ExerciseMediaKind;
  contentType: 'image' | 'video';
  url: string;
  title?: string;
}

export interface Set {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
}

export interface ExerciseDef {
  id: string;
  name: string;
  description: string;
  source: ContentSource;
  readOnly: boolean;
  thumbnailUrl?: string;
  markdown?: string;
  mediaItems: ExerciseMediaItem[];
  mediaUrl?: string; // Legacy/External URL
  mediaId?: string;  // Reference to IndexedDB Blob
  mediaType?: 'image' | 'video';
  category?: string;
  usesBarbell?: boolean;
  barbellWeight?: number;
}

export interface ExerciseInstance {
  id: string;
  defId: string; // References ExerciseDef.id
  sets: Set[];
}

export interface Workout {
  id: string;
  date: string; // ISO Date String YYYY-MM-DD
  title: string;
  note: string;
  exercises: ExerciseInstance[];
  completed: boolean;
  // Timer fields
  elapsedSeconds: number; 
  startTimestamp: number | null; // Date.now() when started, null if paused
}

export interface WorkoutTemplateExercise {
  defId: string;
  defaultSets: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  source: ContentSource;
  readOnly: boolean;
  description?: string;
  tagline?: string;
  exercises: WorkoutTemplateExercise[];
  createdAt: string;
}

export interface UserProfile {
  id: string;             // Deterministic UUID derived from Privy DID
  privyDid?: string;      // Original Privy DID (e.g. "did:privy:cmxxxxxxxxx")
  name: string;
  email: string;
  photoUrl?: string;
  walletAddress?: string;  // EVM wallet address (if connected)
  solanaAddress?: string;  // Solana wallet address (if connected)
  loginMethod?: 'google' | 'email' | 'wallet';
  preferences: {
    defaultUnit: Unit;
    restTimerSeconds: number;
    themeMode: ThemeMode;
    notificationsEnabled: boolean;
  };
}
