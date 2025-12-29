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

    console.log('Received audio data, processing with Hugging Face Whisper...');
    console.log('MIME type:', mimeType);

    const apiKey = Deno.env.get('HUGGINGFACE_API_KEY');
    if (!apiKey) {
      throw new Error('Hugging Face API key not configured');
    }

    // Extract base64 content (remove data URL prefix if present)
    const audioContent = audio.includes(',') ? audio.split(',')[1] : audio;
    
    // Process base64 audio
    const binaryAudio = processBase64Chunks(audioContent);
    
    console.log('Audio size:', binaryAudio.length, 'bytes');
    console.log('Sending request to Hugging Face Whisper API...');
    
    // Use Hugging Face Inference API with Whisper large-v3 model (free tier available)
    const response = await fetch(
      'https://api-inference.huggingface.co/models/openai/whisper-large-v3',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: binaryAudio.buffer as ArrayBuffer,
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Hugging Face API error:', response.status, errorText);
      
      // Check if model is loading
      if (response.status === 503) {
        const errorData = JSON.parse(errorText);
        if (errorData.error && errorData.error.includes('loading')) {
          return new Response(
            JSON.stringify({ 
              error: 'Model is loading, please try again in about 20 seconds.',
              success: false,
              retryAfter: errorData.estimated_time || 20
            }),
            {
              status: 503,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }
      }
      
      throw new Error(`Hugging Face API error: ${errorText}`);
    }

    const result = await response.json();
    console.log('Whisper transcription successful');
    console.log('Result:', JSON.stringify(result));

    // Handle different response formats
    let transcript = '';
    if (typeof result === 'string') {
      transcript = result;
    } else if (result.text) {
      transcript = result.text;
    } else if (Array.isArray(result) && result[0]?.text) {
      transcript = result[0].text;
    }

    console.log('Transcript length:', transcript.length, 'characters');

    return new Response(
      JSON.stringify({ 
        transcript: transcript.trim(),
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
