/**
 * Backend API client for Flask transcription server
 * Configure VITE_BACKEND_URL in .env to point to your local Flask server
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export interface TranscribeResponse {
  success: boolean;
  transcript?: string;
  words?: Array<{ word: string; start: number; end: number }>;
  language?: string;
  error?: string;
}

export interface AnalyzeResponse {
  success: boolean;
  originalText?: string;
  cleanedText?: string;
  fillersDetected?: number;
  detectedFillers?: Array<{ word: string; start: number; end: number }>;
  stats?: {
    originalWordCount: number;
    cleanedWordCount: number;
    reductionPercentage: number;
  };
  error?: string;
}

export interface HealthResponse {
  status: string;
  model: string;
}

/**
 * Check if backend is available
 */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${BACKEND_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Transcribe audio/video file using Flask backend
 */
export async function transcribeFile(file: File): Promise<TranscribeResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BACKEND_URL}/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Server error: ${response.status}`);
  }

  return response.json();
}

/**
 * Analyze text for filler words using Flask backend
 */
export async function analyzeText(
  text: string,
  level: 'conservative' | 'medium' | 'aggressive' = 'medium'
): Promise<AnalyzeResponse> {
  const response = await fetch(`${BACKEND_URL}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, level }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Server error: ${response.status}`);
  }

  return response.json();
}

/**
 * Get backend URL for display
 */
export function getBackendUrl(): string {
  return BACKEND_URL;
}
