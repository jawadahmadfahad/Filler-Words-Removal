import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Process base64 in chunks to prevent memory issues
function processBase64Chunks(base64String: string, chunkSize = 32768): Uint8Array {
  const chunks: Uint8Array[] = [];
  let position = 0;
  
  while (position < base64String.length) {
    const chunk = base64String.slice(position, position + chunkSize);
    const binaryChunk = atob(chunk);
    const bytes = new Uint8Array(binaryChunk.length);
    
    for (let i = 0; i < binaryChunk.length; i++) {
      bytes[i] = binaryChunk.charCodeAt(i);
    }
    
    chunks.push(bytes);
    position += chunkSize;
  }

  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, mimeType = 'audio/webm' } = await req.json();
    
    if (!audio) {
      throw new Error('No audio data provided');
    }

    console.log('Received audio data, processing...');
    console.log('MIME type:', mimeType);

    const apiKey = Deno.env.get('GOOGLE_SPEECH_API_KEY');
    if (!apiKey) {
      throw new Error('Google Speech API key not configured');
    }

    // Process base64 audio
    const audioContent = audio.includes(',') ? audio.split(',')[1] : audio;
    
    // Determine encoding from mimeType
    let encoding = 'WEBM_OPUS';
    let sampleRateHertz = 48000;
    
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
      encoding = 'MP3';
      sampleRateHertz = 44100;
    } else if (mimeType.includes('wav')) {
      encoding = 'LINEAR16';
      sampleRateHertz = 44100;
    } else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
      encoding = 'MP3';
      sampleRateHertz = 44100;
    }

    console.log('Using encoding:', encoding, 'sample rate:', sampleRateHertz);

    // Call Google Speech-to-Text API
    const speechUrl = `https://speech.googleapis.com/v1/speech:recognize?key=${apiKey}`;
    
    const requestBody = {
      config: {
        encoding,
        sampleRateHertz,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        model: 'latest_long',
        useEnhanced: true,
        speechContexts: [{
          phrases: ['um', 'uh', 'er', 'ah', 'hmm', 'like', 'you know', 'basically', 'actually', 'literally']
        }]
      },
      audio: {
        content: audioContent
      }
    };

    console.log('Sending request to Google Speech API...');
    
    const response = await fetch(speechUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google API error:', errorText);
      throw new Error(`Google Speech API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('Google API response:', JSON.stringify(result));

    // Extract transcription
    let transcript = '';
    if (result.results) {
      transcript = result.results
        .map((r: any) => r.alternatives?.[0]?.transcript || '')
        .join(' ')
        .trim();
    }

    console.log('Transcription:', transcript);

    return new Response(
      JSON.stringify({ 
        transcript,
        success: true 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in transcribe-audio:', error);
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
