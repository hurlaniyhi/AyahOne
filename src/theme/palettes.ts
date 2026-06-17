export type AccentId = 'purple' | 'emerald' | 'rose' | 'amber' | 'sky' | 'indigo';

export interface AccentPalette {
  id: AccentId;
  label: string;
  primary: string;       // main accent (button bg, active tab)
  primarySoft: string;   // tinted background variant
  onPrimary: string;     // text on accent
  gradient: [string, string]; // for hero cards
}

export const ACCENTS: AccentPalette[] = [
  { id: 'purple',  label: 'Purple',  primary: '#7C5CFF', primarySoft: '#C8B8FF', onPrimary: '#FFFFFF', gradient: ['#C8B8FF', '#7C5CFF'] },
  { id: 'emerald', label: 'Emerald', primary: '#10B981', primarySoft: '#A7F3D0', onPrimary: '#FFFFFF', gradient: ['#A7F3D0', '#10B981'] },
  { id: 'rose',    label: 'Rose',    primary: '#F43F5E', primarySoft: '#FECDD3', onPrimary: '#FFFFFF', gradient: ['#FECDD3', '#F43F5E'] },
  { id: 'amber',   label: 'Amber',   primary: '#F59E0B', primarySoft: '#FDE68A', onPrimary: '#1F1300', gradient: ['#FDE68A', '#F59E0B'] },
  { id: 'sky',     label: 'Sky',     primary: '#0EA5E9', primarySoft: '#BAE6FD', onPrimary: '#FFFFFF', gradient: ['#BAE6FD', '#0EA5E9'] },
  { id: 'indigo',  label: 'Indigo',  primary: '#6366F1', primarySoft: '#C7D2FE', onPrimary: '#FFFFFF', gradient: ['#C7D2FE', '#6366F1'] },
];

export interface ThemeColors {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  success: string;
  danger: string;
  // Card accent borders used in stat tiles
  tileRose: string;
  tileBlue: string;
  tileAmber: string;
  tileEmerald: string;
}

export const LIGHT: ThemeColors = {
  background: '#FFFFFF',
  surface: '#F5F5F7',
  surfaceElevated: '#FFFFFF',
  border: '#E5E5EA',
  text: '#0B0B0F',
  textMuted: '#6B7280',
  textInverse: '#FFFFFF',
  success: '#10B981',
  danger: '#EF4444',
  tileRose: '#FB7185',
  tileBlue: '#60A5FA',
  tileAmber: '#F59E0B',
  tileEmerald: '#34D399',
};

export const DARK: ThemeColors = {
  background: '#0B0B0F',
  surface: '#16161D',
  surfaceElevated: '#1F1F28',
  border: '#2A2A33',
  text: '#FFFFFF',
  textMuted: '#9CA3AF',
  textInverse: '#0B0B0F',
  success: '#34D399',
  danger: '#F87171',
  tileRose: '#FB7185',
  tileBlue: '#60A5FA',
  tileAmber: '#F59E0B',
  tileEmerald: '#34D399',
};

export function getAccent(id: AccentId): AccentPalette {
  return ACCENTS.find(a => a.id === id) ?? ACCENTS[0];
}
