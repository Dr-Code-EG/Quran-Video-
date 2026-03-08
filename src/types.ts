export interface Surah {
  id: number;
  name_simple: string;
  name_arabic: string;
  verses_count: number;
}

export interface Reciter {
  id: number;
  name: string;
  server: string;
}

export interface Verse {
  id: number;
  verse_key: string;
  text_uthmani: string;
  translation?: string;
  audio_url?: string;
}

export const RECITERS: Reciter[] = [
  { id: 7, name: "مشاري راشد العفاسي", server: "https://download.quranicaudio.com/qdc/mishari_al_afasy/murattal/" },
  { id: 1, name: "عبد الباسط عبد الصمد", server: "https://download.quranicaudio.com/qdc/abdul_baset/murattal/" },
  { id: 3, name: "عبد الرحمن السديس", server: "https://download.quranicaudio.com/qdc/abdurrahmaan_as_sudais/murattal/" },
  { id: 4, name: "أبو بكر الشاطري", server: "https://download.quranicaudio.com/qdc/abu_bakr_shatri/murattal/" },
  { id: 12, name: "محمود خليل الحصري", server: "https://download.quranicaudio.com/qdc/khalil_al_husary/murattal/" },
];

export const ASPECT_RATIOS = [
  { id: '9-16', name: "ستوري / ريلز (9:16)", width: 1080, height: 1920, ratio: 9/16 },
  { id: '1-1', name: "منشور (1:1)", width: 1080, height: 1080, ratio: 1 },
  { id: '16-9', name: "يوتيوب (16:9)", width: 1920, height: 1080, ratio: 16/9 },
];

export const ARABIC_FONTS = [
  { id: 'amiri', name: 'خط أميري', family: '"Amiri", serif' },
  { id: 'noto', name: 'خط النسخ', family: '"Noto Naskh Arabic", serif' },
  { id: 'reem', name: 'خط ريم', family: '"Reem Kufi", sans-serif' },
];

export const AMBIENT_SOUNDS = [
  { id: 'none', name: 'بدون', url: '' },
  { id: 'rain', name: 'مطر', url: 'https://www.soundjay.com/nature/rain-01.mp3' },
  { id: 'nature', name: 'طبيعة', url: 'https://www.soundjay.com/nature/forest-wind-01.mp3' },
];

export const TEMPLATES = [
  {
    id: 'modern',
    name: 'عصري',
    bgColor: '#000000',
    textColor: '#ffffff',
    fontSize: 55,
    bgImage: 'https://images.unsplash.com/photo-1519817650390-64a93db51149?auto=format&fit=crop&q=80&w=1080',
  },
  {
    id: 'classic',
    name: 'تراثي',
    bgColor: '#1a1a1a',
    textColor: '#f3e5ab',
    fontSize: 50,
    bgImage: 'https://images.unsplash.com/photo-1542810634-71277d95dcbb?auto=format&fit=crop&q=80&w=1080',
  },
  {
    id: 'nature',
    name: 'طبيعة',
    bgColor: '#000000',
    textColor: '#ffffff',
    fontSize: 48,
    bgImage: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=1080',
  },
  {
    id: 'editorial',
    name: 'إنستغرام (راقي)',
    bgColor: '#fdfcf8',
    textColor: '#1a1a1a',
    fontSize: 60,
    bgImage: '',
  },
];
