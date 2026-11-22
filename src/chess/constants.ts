import { BoardTheme, BoardThemeId, TimeControl } from './types';

export const BOARD_THEMES: Record<BoardThemeId, BoardTheme> = {
  'classic-green': {
    id: 'classic-green',
    name: 'Klasik Yeşil',
    light: '#EBECD0',
    dark: '#739552',
    highlightLight: '#F5F682',
    highlightDark: '#B9CA43',
    coordLight: '#739552',
    coordDark: '#EBECD0',
  },
  walnut: {
    id: 'walnut',
    name: 'Ceviz Ahşap',
    light: '#F0D9B5',
    dark: '#B58863',
    highlightLight: '#F7EC74',
    highlightDark: '#DAC34B',
    coordLight: '#B58863',
    coordDark: '#F0D9B5',
  },
  slate: {
    id: 'slate',
    name: 'Koyu Grafit',
    light: '#D2D6DC',
    dark: '#4B5563',
    highlightLight: '#CBD56B',
    highlightDark: '#7C8A4B',
    coordLight: '#4B5563',
    coordDark: '#D2D6DC',
  },
  ocean: {
    id: 'ocean',
    name: 'Okyanus',
    light: '#DEE3E6',
    dark: '#6D8DA6',
    highlightLight: '#E8E98A',
    highlightDark: '#87A96B',
    coordLight: '#6D8DA6',
    coordDark: '#DEE3E6',
  },
};

export const TIME_CONTROLS: TimeControl[] = [
  { id: 'bullet-3', label: '3 dk (Yıldırım)', category: 'bullet', initialSeconds: 180, incrementSeconds: 0 },
  { id: 'blitz-5', label: '5 dk (Blitz)', category: 'blitz', initialSeconds: 300, incrementSeconds: 0 },
  { id: 'blitz-3-2', label: '3+2 (Blitz)', category: 'blitz', initialSeconds: 180, incrementSeconds: 2 },
  { id: 'rapid-10', label: '10 dk (Hızlı)', category: 'rapid', initialSeconds: 600, incrementSeconds: 0 },
  { id: 'rapid-15-10', label: '15+10 (Klasik)', category: 'rapid', initialSeconds: 900, incrementSeconds: 10 },
  { id: 'unlimited', label: 'Süresiz', category: 'unlimited', initialSeconds: 0, incrementSeconds: 0 },
];

export const AI_NAME_PRESETS = [
  'Kuzey',
  'Demir Zeka',
  'Anka',
  'Mimar',
  'Atlas',
  'Poyraz',
];
