// Design tokens ported 1:1 from the original web app's CSS custom properties.
export const colors = {
  paper: '#FFFFFF',
  paperWarm: '#FBFAF7',
  mint: '#E7F6EF',
  ink: '#161A20',
  inkDim: '#5B6472',
  inkFaint: '#8B93A1',
  line: 'rgba(22,26,32,0.10)',
  lineStrong: 'rgba(22,26,32,0.18)',
  accent: '#1E9E82',
  accentDeep: '#157A65',
  accentSoft: '#E7F6EF',
  red: '#D6553E',
  redSoft: '#FCEAE5',
  white: '#FFFFFF',
};

export const gradients = {
  balance: ['#E7F6EF', '#E7F6EF'] as const, // linear-gradient(160deg, accent-soft, mint) — close enough, both are near-identical mints
  dark: ['#232B33', '#12161B'] as const,
  green: ['#2BAE8C', '#0E6B54'] as const,
  blue: ['#4B7FE8', '#2A4FC4'] as const,
};

export const fonts = {
  serif: 'Fraunces_500Medium',
  serifLight: 'Fraunces_400Regular',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
};

export const radii = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  pill: 999,
};

export const categoryColors = ['#D6553E', '#E8A83E', '#1E9E82', '#5C7CE8', '#B15CE8', '#E85C9B', '#8B93A1'];
