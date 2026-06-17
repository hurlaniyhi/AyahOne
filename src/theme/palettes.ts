export type AccentId = 'mihrab' | 'purple' | 'emerald' | 'rose' | 'amber' | 'sky' | 'indigo';

export interface AccentPalette {
  id: AccentId;
  label: string;
  primary: string;       // main accent (button bg, active tab)
  primarySoft: string;   // tinted background variant
  onPrimary: string;     // text on accent
  gradient: [string, string]; // for hero cards
}

export const ACCENTS: AccentPalette[] = [
  { id: 'mihrab',  label: 'Mihrab',  primary: '#0F6B5C', primarySoft: '#CFE7DF', onPrimary: '#FFFFFF', gradient: ['#0F6B5C', '#062F2A'] },
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
  surfaceMuted: string;  // softer panel — between background and surface
  border: string;
  hairline: string;      // subtle 0.5px divider
  text: string;
  textMuted: string;
  textInverse: string;
  brass: string;         // warm metallic highlight for ornaments
  success: string;
  danger: string;
  // Card accent borders used in legacy stat tiles
  tileRose: string;
  tileBlue: string;
  tileAmber: string;
  tileEmerald: string;
}

// Mihrab: warm parchment background, deep emerald primary, brass highlights
export const LIGHT: ThemeColors = {
  background: '#FBF7F0',
  surface: '#F4EEE2',
  surfaceElevated: '#FFFFFF',
  surfaceMuted: '#EFE8D8',
  border: '#E2D9C3',
  hairline: '#D9CFB6',
  text: '#1B1A17',
  textMuted: '#6C6557',
  textInverse: '#FFFFFF',
  brass: '#B08641',
  success: '#0F6B5C',
  danger: '#B23A48',
  tileRose: '#C2526B',
  tileBlue: '#3F6E8C',
  tileAmber: '#B08641',
  tileEmerald: '#0F6B5C',
};

// Midnight ink: deep night-blue background, warm parchment text, brass highlights
export const DARK: ThemeColors = {
  background: '#0B1115',
  surface: '#121A20',
  surfaceElevated: '#16212A',
  surfaceMuted: '#0E161C',
  border: '#1F2C36',
  hairline: '#243340',
  text: '#F1E8D5',
  textMuted: '#8C9AA6',
  textInverse: '#0B1115',
  brass: '#D1A24A',
  success: '#3CC2A1',
  danger: '#E26A78',
  tileRose: '#D27989',
  tileBlue: '#7FA6C0',
  tileAmber: '#D1A24A',
  tileEmerald: '#3CC2A1',
};

export function getAccent(id: AccentId): AccentPalette {
  return ACCENTS.find(a => a.id === id) ?? ACCENTS[0];
}
