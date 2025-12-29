import { useState, useRef } from 'react';
import { analyzeFillers, type RemovalLevel } from '@/lib/fillerWords';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  Loader2, 
  FileVideo,
  CheckCircle2,
  AlertCircle,
  Download,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

type ProcessingStatus = 'idle' | 'uploading' | 'extracting' | 'transcribing' | 'analyzing' | 'complete' | 'error';

interface TranscriptionResult {
  originalTranscript: string;
  cleanedTranscript: string;
  fillersDetected: number;
  reductionPercentage: number;
}

export default function VideoFillerRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<RemovalLevel>('medium');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4'];
      if (!validTypes.includes(selectedFile.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a video or audio file (MP4, WebM, MP3, WAV)',
          variant: 'destructive'
        });
        return;
      }
      
      // Check file size (max 100MB)
      if (selectedFile.size > 100 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 100MB',
          variant: 'destructive'
        });
        return;
      }
      
      setFile(selectedFile);
      setResult(null);
      setError(null);
      setStatus('idle');
    }
  };

  const extractAudioFromFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const processVideo = async () => {
    if (!file) return;

    try {
      setStatus('uploading');
      setProgress(10);
      setError(null);

      // Read file as base64
      setStatus('extracting');
      setProgress(30);
      const audioData = await extractAudioFromFile(file);
      
      // Send to transcription API
      setStatus('transcribing');
      setProgress(50);
      
      const { data, error: fnError } = await supabase.functions.invoke('transcribe-audio', {
        body: { 
          audio: audioData,
          mimeType: file.type
        }
      });

      if (fnError) {
        throw new Error(fnError.message || 'Transcription failed');
      }

      if (!data.success) {
        throw new Error(data.error || 'Transcription failed');
      }

      const transcript = data.transcript || '';
      
      if (!transcript) {
        throw new Error('No speech detected in the audio. Please ensure your video/audio contains clear speech.');
      }

      // Analyze and remove fillers
      setStatus('analyzing');
      setProgress(80);
      
      const analysis = analyzeFillers(transcript, level, true);
      
      setResult({
        originalTranscript: transcript,
        cleanedTranscript: analysis.cleanedText,
        fillersDetected: analysis.stats.totalFillers,
        reductionPercentage: analysis.stats.reductionPercentage
      });

      setStatus('complete');
      setProgress(100);
      
      toast({
        title: 'Analysis complete!',
        description: `Detected ${analysis.stats.totalFillers} filler words`
      });

    } catch (err: any) {
      console.error('Processing error:', err);
      setError(err.message || 'An error occurred during processing');
      setStatus('error');
      toast({
        title: 'Processing failed',
        description: err.message || 'An error occurred',
        variant: 'destructive'
      });
    }
  };

  const handleDownload = () => {
    if (!result) return;
    
    const content = `Original Transcript:\n${result.originalTranscript}\n\n---\n\nCleaned Transcript (Filler Words Removed):\n${result.cleanedTranscript}\n\n---\n\nStatistics:\n- Filler words detected: ${result.fillersDetected}\n- Reduction: ${result.reductionPercentage}%`;
    
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transcript-cleaned.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'uploading': return 'Uploading file...';
      case 'extracting': return 'Extracting audio...';
      case 'transcribing': return 'Transcribing speech (this may take a moment)...';
      case 'analyzing': return 'Analyzing filler words...';
      case 'complete': return 'Analysis complete!';
      case 'error': return 'Error occurred';
      default: return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <FileVideo className="w-5 h-5 text-primary" />
            Upload Video/Audio
          </CardTitle>
          <CardDescription className="text-slate-400">
            Upload a video or audio file to detect and remove filler words from the transcript
          </CardDescription>
        </CardHeader>
        <CardContent>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept="video/*,audio/*"
            className="hidden"
          />
          
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-slate-800/50 transition-all"
          >
            {file ? (
              <div className="space-y-2">
                <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-sm text-slate-400">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-slate-300">Click to upload or drag and drop</p>
                <p className="text-sm text-slate-500">MP4, WebM, MP3, WAV (max 100MB)</p>
              </div>
            )}
          </div>

          {/* Level Selection */}
          <div className="mt-4 flex items-center gap-3">
            <span className="text-slate-300 font-medium">Removal Level:</span>
            <div className="flex gap-1">
              {(['conservative', 'medium', 'aggressive'] as RemovalLevel[]).map((l) => (
                <Button
                  key={l}
                  variant={level === l ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLevel(l)}
                  className={level === l ? '' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'}
                >
                  {l.charAt(0).toUpperCase() + l.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          {/* Process Button */}
          <Button
            onClick={processVideo}
            disabled={!file || (status !== 'idle' && status !== 'complete' && status !== 'error')}
            className="w-full mt-4"
            size="lg"
          >
            {status === 'idle' || status === 'complete' || status === 'error' ? (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Analyze & Remove Filler Words
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {getStatusMessage()}
              </>
            )}
          </Button>

          {/* Progress */}
          {status !== 'idle' && status !== 'error' && (
            <div className="mt-4 space-y-2">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-slate-400">{getStatusMessage()}</p>
            </div>
          )}

          {/* Error */}
          {status === 'error' && error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {result && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-primary">{result.fillersDetected}</div>
                <div className="text-xs text-slate-400 mt-1">Fillers Detected</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-500">{result.reductionPercentage}%</div>
                <div className="text-xs text-slate-400 mt-1">Reduction</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-blue-500">{result.originalTranscript.split(' ').length}</div>
                <div className="text-xs text-slate-400 mt-1">Original Words</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-amber-500">{result.cleanedTranscript.split(' ').length}</div>
                <div className="text-xs text-slate-400 mt-1">Cleaned Words</div>
              </CardContent>
            </Card>
          </div>

          {/* Transcripts */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">Original Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-slate-900 border border-slate-600 rounded-md text-white max-h-[300px] overflow-y-auto">
                  {result.originalTranscript}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                  Cleaned Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-slate-900 border border-slate-600 rounded-md text-white max-h-[300px] overflow-y-auto">
                  {result.cleanedTranscript}
                </div>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="w-full mt-3 bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Transcript
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
