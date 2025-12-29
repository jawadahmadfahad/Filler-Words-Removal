// Comprehensive filler words and phrases database
export const FILLER_WORDS = {
  en: {
    // Single word fillers - hesitation sounds
    hesitation: ['um', 'uh', 'er', 'ah', 'hmm', 'mm', 'mmm', 'hm', 'uhm', 'erm', 'umm', 'uhh', 'err', 'agh', 'mhm', 'uh-huh', 'mm-hmm', 'huh'],
    
    // Verbal crutches - common filler words
    crutches: ['like', 'so', 'well', 'right', 'okay', 'ok', 'actually', 'basically', 'literally', 'obviously', 'honestly', 'seriously', 'totally', 'definitely', 'probably', 'maybe', 'anyway', 'anyways'],
    
    // Phrases - multi-word fillers
    phrases: [
      'you know',
      'i mean',
      'you know what i mean',
      'kind of',
      'sort of',
      'or something',
      'or whatever',
      'and stuff',
      'and things',
      'i guess',
      'i suppose',
      'i think',
      'you see',
      'to be honest',
      'to be fair',
      'at the end of the day',
      'in my opinion',
      'as a matter of fact',
      'the thing is',
      'what i mean is'
    ]
  },
  ur: {
    hesitation: ['اں', 'ہاں', 'ہم'],
    crutches: ['یعنی', 'اصل میں', 'تو', 'بس', 'اچھا', 'ویسے'],
    phrases: ['آپ جانتے ہیں', 'میرا مطلب ہے']
  }
};

export type FillerCategory = 'hesitation' | 'crutches' | 'phrases';
export type RemovalLevel = 'conservative' | 'medium' | 'aggressive';

export interface DetectedFiller {
  word: string;
  category: FillerCategory;
  startIndex: number;
  endIndex: number;
}

export interface FillerAnalysis {
  originalText: string;
  cleanedText: string;
  detectedFillers: DetectedFiller[];
  stats: {
    totalFillers: number;
    hesitationCount: number;
    crutchesCount: number;
    phrasesCount: number;
    repeatedWordsCount: number;
    originalWordCount: number;
    cleanedWordCount: number;
    reductionPercentage: number;
  };
}

// Get filler words based on removal level
export function getFillersByLevel(level: RemovalLevel, language: string = 'en'): string[] {
  const lang = FILLER_WORDS[language as keyof typeof FILLER_WORDS] || FILLER_WORDS.en;
  
  switch (level) {
    case 'conservative':
      return [...lang.hesitation];
    case 'medium':
      return [...lang.hesitation, ...lang.crutches.slice(0, 5), ...lang.phrases.slice(0, 5)];
    case 'aggressive':
      return [...lang.hesitation, ...lang.crutches, ...lang.phrases];
    default:
      return [...lang.hesitation, ...lang.crutches.slice(0, 5)];
  }
}

// Detect repeated words (e.g., "I I", "the the")
function detectRepeatedWords(text: string): { word: string; index: number }[] {
  const words = text.split(/\s+/);
  const repeated: { word: string; index: number }[] = [];
  let charIndex = 0;
  
  for (let i = 0; i < words.length - 1; i++) {
    const currentWord = words[i].toLowerCase().replace(/[^\w]/g, '');
    const nextWord = words[i + 1].toLowerCase().replace(/[^\w]/g, '');
    
    if (currentWord === nextWord && currentWord.length > 1) {
      // Find the position of the second occurrence
      const firstWordEnd = charIndex + words[i].length;
      repeated.push({ word: words[i + 1], index: firstWordEnd + 1 });
    }
    
    charIndex += words[i].length + 1; // +1 for space
  }
  
  return repeated;
}

// Main analysis function
export function analyzeFillers(
  text: string,
  level: RemovalLevel = 'medium',
  detectRepeated: boolean = true,
  language: string = 'en'
): FillerAnalysis {
  const fillerList = getFillersByLevel(level, language);
  const detectedFillers: DetectedFiller[] = [];
  let cleanedText = text;
  
  const lang = FILLER_WORDS[language as keyof typeof FILLER_WORDS] || FILLER_WORDS.en;
  
  // Stats counters
  let hesitationCount = 0;
  let crutchesCount = 0;
  let phrasesCount = 0;
  
  // First, detect and mark phrases (longer patterns first to avoid partial matches)
  const sortedFillers = [...fillerList].sort((a, b) => b.length - a.length);
  
  for (const filler of sortedFillers) {
    const regex = new RegExp(`\\b${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      let category: FillerCategory = 'crutches';
      
      if (lang.hesitation.includes(filler.toLowerCase())) {
        category = 'hesitation';
        hesitationCount++;
      } else if (lang.phrases.includes(filler.toLowerCase())) {
        category = 'phrases';
        phrasesCount++;
      } else {
        crutchesCount++;
      }
      
      detectedFillers.push({
        word: match[0],
        category,
        startIndex: match.index,
        endIndex: match.index + match[0].length
      });
    }
    
    // Remove filler from cleaned text
    cleanedText = cleanedText.replace(regex, ' ');
  }
  
  // Detect repeated words
  let repeatedWordsCount = 0;
  if (detectRepeated) {
    const repeated = detectRepeatedWords(text);
    repeatedWordsCount = repeated.length;
    
    for (const rep of repeated) {
      detectedFillers.push({
        word: `${rep.word} (repeated)`,
        category: 'crutches',
        startIndex: rep.index,
        endIndex: rep.index + rep.word.length
      });
    }
    
    // Remove repeated words from cleaned text
    const words = cleanedText.split(/\s+/);
    const deduped: string[] = [];
    for (let i = 0; i < words.length; i++) {
      const current = words[i].toLowerCase().replace(/[^\w]/g, '');
      const prev = words[i - 1]?.toLowerCase().replace(/[^\w]/g, '');
      if (current !== prev || current.length <= 1) {
        deduped.push(words[i]);
      }
    }
    cleanedText = deduped.join(' ');
  }
  
  // Clean up extra spaces
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();
  
  // Calculate stats
  const originalWordCount = text.split(/\s+/).filter(w => w.length > 0).length;
  const cleanedWordCount = cleanedText.split(/\s+/).filter(w => w.length > 0).length;
  const reductionPercentage = originalWordCount > 0 
    ? Math.round(((originalWordCount - cleanedWordCount) / originalWordCount) * 100) 
    : 0;
  
  return {
    originalText: text,
    cleanedText,
    detectedFillers: detectedFillers.sort((a, b) => a.startIndex - b.startIndex),
    stats: {
      totalFillers: detectedFillers.length,
      hesitationCount,
      crutchesCount,
      phrasesCount,
      repeatedWordsCount,
      originalWordCount,
      cleanedWordCount,
      reductionPercentage
    }
  };
}

// Highlight fillers in text for display
export function highlightFillers(text: string, level: RemovalLevel = 'medium', language: string = 'en'): string {
  const fillerList = getFillersByLevel(level, language);
  let highlightedText = text;
  
  // Sort by length (longest first) to avoid partial replacements
  const sortedFillers = [...fillerList].sort((a, b) => b.length - a.length);
  
  for (const filler of sortedFillers) {
    const regex = new RegExp(`\\b(${filler.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})\\b`, 'gi');
    highlightedText = highlightedText.replace(regex, '[[FILLER:$1]]');
  }
  
  return highlightedText;
}
