import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js to use browser cache
env.allowLocalModels = false;
env.useBrowserCache = true;

let transcriber: any = null;
let isLoading = false;
let loadProgress = 0;

export type TranscriberStatus = 'idle' | 'loading' | 'ready' | 'transcribing' | 'error';

export interface TranscriberState {
  status: TranscriberStatus;
  progress: number;
  error?: string;
}

const listeners: Set<(state: TranscriberState) => void> = new Set();

function notifyListeners(state: TranscriberState) {
  listeners.forEach(listener => listener(state));
}

export function subscribeToTranscriber(listener: (state: TranscriberState) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function loadTranscriber(
  onProgress?: (progress: number) => void
): Promise<boolean> {
  if (transcriber) return true;
  if (isLoading) return false;

  isLoading = true;
  notifyListeners({ status: 'loading', progress: 0 });

  try {
    console.log('Loading Whisper small.en model...');
    
    transcriber = await pipeline(
      'automatic-speech-recognition',
      'onnx-community/whisper-small.en',
      {
        device: 'webgpu',
        progress_callback: (progress: any) => {
          if (progress.status === 'progress') {
            const pct = Math.round((progress.loaded / progress.total) * 100);
            loadProgress = pct;
            onProgress?.(pct);
            notifyListeners({ status: 'loading', progress: pct });
          }
        },
      }
    );

    console.log('Whisper model loaded successfully');
    isLoading = false;
    notifyListeners({ status: 'ready', progress: 100 });
    return true;
  } catch (error) {
    console.error('Failed to load Whisper model:', error);
    isLoading = false;
    
    // Try fallback without WebGPU
    try {
      console.log('Falling back to WASM...');
      transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-small.en',
        {
          progress_callback: (progress: any) => {
            if (progress.status === 'progress') {
              const pct = Math.round((progress.loaded / progress.total) * 100);
              loadProgress = pct;
              onProgress?.(pct);
              notifyListeners({ status: 'loading', progress: pct });
            }
          },
        }
      );
      console.log('Whisper model loaded with WASM fallback');
      notifyListeners({ status: 'ready', progress: 100 });
      return true;
    } catch (fallbackError) {
      console.error('WASM fallback also failed:', fallbackError);
      const errorMessage = fallbackError instanceof Error ? fallbackError.message : 'Unknown error';
      notifyListeners({ status: 'error', progress: 0, error: errorMessage });
      return false;
    }
  }
}

export async function transcribeAudio(
  audioData: Float32Array | ArrayBuffer,
  onProgress?: (progress: number) => void
): Promise<string> {
  if (!transcriber) {
    const loaded = await loadTranscriber(onProgress);
    if (!loaded) {
      throw new Error('Failed to load transcription model');
    }
  }

  notifyListeners({ status: 'transcribing', progress: 0 });

  try {
    console.log('Starting transcription with filler word preservation...');
    
    // Use word-level timestamps to preserve more original speech patterns
    // and reduce aggressive normalization that removes filler words
    const result = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: 'word',
      // Reduce temperature to get more literal transcription
      temperature: 0,
      // Don't suppress tokens - helps preserve filler words
      suppress_tokens: [],
    });

    console.log('Transcription complete:', result);
    notifyListeners({ status: 'ready', progress: 100 });
    
    // Extract text from word-level timestamps if available
    let transcribedText = '';
    if (result.chunks && Array.isArray(result.chunks)) {
      transcribedText = result.chunks.map((chunk: any) => chunk.text).join('');
    } else {
      transcribedText = result.text || '';
    }
    
    return transcribedText;
  } catch (error) {
    console.error('Transcription error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    notifyListeners({ status: 'error', progress: 0, error: errorMessage });
    throw error;
  }
}

export function isTranscriberReady(): boolean {
  return transcriber !== null;
}

export function getLoadProgress(): number {
  return loadProgress;
}
