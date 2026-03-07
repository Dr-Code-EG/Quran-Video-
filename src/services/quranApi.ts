import { Surah, Verse } from '../types';

const BASE_URL = 'https://api.quran.com/api/v4';

export const fetchSurahs = async (): Promise<Surah[]> => {
  const response = await fetch(`${BASE_URL}/chapters?language=en`);
  const data = await response.json();
  return data.chapters;
};

export const fetchVerses = async (surahId: number, start: number, end: number): Promise<Verse[]> => {
  // Fetch Arabic text
  const arabicResponse = await fetch(`${BASE_URL}/quran/verses/uthmani?chapter_number=${surahId}`);
  const arabicData = await arabicResponse.json();
  
  // Fetch English translation (ID 131 is Clear Quran)
  const translationResponse = await fetch(`${BASE_URL}/quran/translations/131?chapter_number=${surahId}`);
  const translationData = await translationResponse.json();
  
  const allVerses = arabicData.verses;
  const allTranslations = translationData.translations;

  const rangeVerses = allVerses.filter((v: any) => {
    const verseNum = parseInt(v.verse_key.split(':')[1]);
    return verseNum >= start && verseNum <= end;
  });

  return rangeVerses.map((v: any) => {
    const translation = allTranslations.find((t: any) => t.resource_id === 131 && t.verse_id === v.id);
    return {
      id: v.id,
      verse_key: v.verse_key,
      text_uthmani: v.text_uthmani,
      translation: translation?.text.replace(/<[^>]*>?/gm, '') || '', // Remove HTML tags
    };
  });
};

export const fetchVerseAudio = async (reciterId: number, surahId: number): Promise<any> => {
  const response = await fetch(`${BASE_URL}/chapter_recitations/${reciterId}/${surahId}`);
  const data = await response.json();
  return data.audio_file;
};

// For verse-by-verse audio and timing
export const fetchVerseByVerseData = async (reciterId: number, surahId: number, start: number, end: number) => {
  // We'll use the recitations API which provides verse-by-verse audio
  // Note: Some reciters might not have verse-by-verse timing in the public API easily accessible
  // We'll try to get the audio for each verse if possible or the whole surah and slice it if we had timestamps.
  // Actually, api.quran.com has /recitations/{recitation_id}/by_chapter/{chapter_id}
  const response = await fetch(`${BASE_URL}/recitations/${reciterId}/by_chapter/${surahId}?from=${start}&to=${end}`);
  const data = await response.json();
  return data.audio_files; // Array of { verse_key, url }
};
