import { useState, useRef, useEffect, useMemo } from 'react';
import { analyzeFillers, FILLER_WORDS, type RemovalLevel, type FillerCategory, type CategoryFilter, type DetectedFiller } from '@/lib/fillerWords';
import { checkBackendHealth, transcribeFile, getBackendUrl } from '@/lib/backendApi';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Upload, 
  Loader2, 
  FileVideo,
  CheckCircle2,
  AlertCircle,
  Download,
  Sparkles,
  Server,
  Wifi,
  WifiOff,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ProcessingStatus = 'idle' | 'checking-backend' | 'transcribing' | 'analyzing' | 'complete' | 'error';

interface TranscriptionResult {
  originalTranscript: string;
  cleanedTranscript: string;
  detectedFillers: DetectedFiller[];
  stats: {
    totalFillers: number;
    hesitationCount: number;
    crutchesCount: number;
    phrasesCount: number;
    repeatedWordsCount: number;
    reductionPercentage: number;
  };
}

const categoryColors: Record<FillerCategory, string> = {
  hesitation: 'bg-red-100 text-red-800 border-red-200',
  crutches: 'bg-amber-100 text-amber-800 border-amber-200',
  phrases: 'bg-purple-100 text-purple-800 border-purple-200'
};

const categoryLabels: Record<FillerCategory, string> = {
  hesitation: 'Hesitation',
  crutches: 'Verbal Crutch',
  phrases: 'Filler Phrase'
};

export default function VideoFillerRemover() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [rawTranscript, setRawTranscript] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<RemovalLevel>('medium');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>({
    hesitation: true,
    crutches: true,
    phrases: true
  });
  const [detectRepeated, setDetectRepeated] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Check backend health on mount and periodically
  useEffect(() => {
    const checkBackend = async () => {
      const isOnline = await checkBackendHealth();
      setBackendOnline(isOnline);
    };
    
    checkBackend();
    const interval = setInterval(checkBackend, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // Re-analyze when filters change
  const analysis = useMemo(() => {
    if (!rawTranscript) return null;
    return analyzeFillers(rawTranscript, level, detectRepeated, 'en', categoryFilter);
  }, [rawTranscript, level, detectRepeated, categoryFilter]);

  // Update result when analysis changes
  useEffect(() => {
    if (analysis && rawTranscript) {
      setResult({
        originalTranscript: rawTranscript,
        cleanedTranscript: analysis.cleanedText,
        detectedFillers: analysis.detectedFillers,
        stats: {
          totalFillers: analysis.stats.totalFillers,
          hesitationCount: analysis.stats.hesitationCount,
          crutchesCount: analysis.stats.crutchesCount,
          phrasesCount: analysis.stats.phrasesCount,
          repeatedWordsCount: analysis.stats.repeatedWordsCount,
          reductionPercentage: analysis.stats.reductionPercentage
        }
      });
    }
  }, [analysis, rawTranscript]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4'];
      if (!validTypes.includes(selectedFile.type)) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload a video or audio file (MP4, WebM, MP3, WAV)',
          variant: 'destructive'
        });
        return;
      }
      
      if (selectedFile.size > 500 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Maximum file size is 500MB',
          variant: 'destructive'
        });
        return;
      }
      
      setFile(selectedFile);
      setResult(null);
      setRawTranscript('');
      setError(null);
      setStatus('idle');
    }
  };

  const toggleCategory = (category: keyof CategoryFilter) => {
    setCategoryFilter(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const processVideo = async () => {
    if (!file) return;

    try {
      setError(null);

      // Check backend
      setStatus('checking-backend');
      setProgress(10);
      
      const isOnline = await checkBackendHealth();
      setBackendOnline(isOnline);
      
      if (!isOnline) {
        throw new Error(`Backend not available at ${getBackendUrl()}. Please start the Flask server.`);
      }

      // Transcribe via backend
      setStatus('transcribing');
      setProgress(30);
      
      toast({
        title: 'Transcribing',
        description: 'Sending file to your local Whisper backend...',
      });

      const transcribeResult = await transcribeFile(file);
      
      if (!transcribeResult.success || !transcribeResult.transcript) {
        throw new Error(transcribeResult.error || 'Transcription failed');
      }

      const transcript = transcribeResult.transcript.trim();
      
      if (transcript.length === 0) {
        throw new Error('No speech detected in the audio.');
      }

      setRawTranscript(transcript);
      setProgress(70);

      // Analyze and remove fillers
      setStatus('analyzing');
      setProgress(80);
      
      const analysisResult = analyzeFillers(transcript, level, detectRepeated, 'en', categoryFilter);
      
      setResult({
        originalTranscript: transcript,
        cleanedTranscript: analysisResult.cleanedText,
        detectedFillers: analysisResult.detectedFillers,
        stats: {
          totalFillers: analysisResult.stats.totalFillers,
          hesitationCount: analysisResult.stats.hesitationCount,
          crutchesCount: analysisResult.stats.crutchesCount,
          phrasesCount: analysisResult.stats.phrasesCount,
          repeatedWordsCount: analysisResult.stats.repeatedWordsCount,
          reductionPercentage: analysisResult.stats.reductionPercentage
        }
      });

      setStatus('complete');
      setProgress(100);
      
      toast({
        title: 'Analysis complete!',
        description: `Detected ${analysisResult.stats.totalFillers} filler words`
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
    
    const content = `Original Transcript:\n${result.originalTranscript}\n\n---\n\nCleaned Transcript (Filler Words Removed):\n${result.cleanedTranscript}\n\n---\n\nStatistics:\n- Total fillers detected: ${result.stats.totalFillers}\n- Hesitations: ${result.stats.hesitationCount}\n- Crutches: ${result.stats.crutchesCount}\n- Phrases: ${result.stats.phrasesCount}\n- Repeated words: ${result.stats.repeatedWordsCount}\n- Reduction: ${result.stats.reductionPercentage}%`;
    
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
      case 'checking-backend': return 'Connecting to backend...';
      case 'transcribing': return 'Transcribing with Whisper (this may take a few minutes)...';
      case 'analyzing': return 'Analyzing filler words...';
      case 'complete': return 'Analysis complete!';
      case 'error': return 'Error occurred';
      default: return '';
    }
  };

  // Render text with highlighted fillers
  const renderHighlightedText = () => {
    if (!result || !result.originalTranscript) return null;
    
    let lastIndex = 0;
    const elements: JSX.Element[] = [];
    
    // Sort fillers by start index
    const sortedFillers = [...result.detectedFillers].sort((a, b) => a.startIndex - b.startIndex);
    
    // Remove overlapping fillers (keep the longer ones)
    const nonOverlapping = sortedFillers.filter((filler, index) => {
      for (let i = 0; i < index; i++) {
        const prev = sortedFillers[i];
        if (filler.startIndex >= prev.startIndex && filler.startIndex < prev.endIndex) {
          return false;
        }
      }
      return true;
    });
    
    for (const filler of nonOverlapping) {
      // Add text before filler
      if (filler.startIndex > lastIndex) {
        elements.push(
          <span key={`text-${lastIndex}`}>
            {result.originalTranscript.slice(lastIndex, filler.startIndex)}
          </span>
        );
      }
      
      // Add highlighted filler
      elements.push(
        <mark 
          key={`filler-${filler.startIndex}`}
          className={`px-1 py-0.5 rounded font-medium ${categoryColors[filler.category]}`}
          title={categoryLabels[filler.category]}
        >
          {result.originalTranscript.slice(filler.startIndex, filler.endIndex)}
        </mark>
      );
      
      lastIndex = filler.endIndex;
    }
    
    // Add remaining text
    if (lastIndex < result.originalTranscript.length) {
      elements.push(
        <span key={`text-end`}>{result.originalTranscript.slice(lastIndex)}</span>
      );
    }
    
    return elements;
  };

  return (
    <div className="space-y-6">
      {/* Backend Status Badge */}
      <div className="flex justify-center">
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
          backendOnline === true
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : backendOnline === false
            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
            : 'bg-slate-700/50 text-slate-400 border border-slate-600'
        }`}>
          {backendOnline === true ? (
            <>
              <Wifi className="w-4 h-4" />
              Backend Connected
            </>
          ) : backendOnline === false ? (
            <>
              <WifiOff className="w-4 h-4" />
              Backend Offline
            </>
          ) : (
            <>
              <Server className="w-4 h-4" />
              Checking backend...
            </>
          )}
        </div>
      </div>

      {/* Backend URL Info */}
      <div className="text-center text-sm text-slate-400">
        Backend URL: <code className="bg-slate-800 px-2 py-0.5 rounded">{getBackendUrl()}</code>
      </div>

      {/* Upload Section */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-white">
            <FileVideo className="w-5 h-5 text-primary" />
            Upload Video/Audio
          </CardTitle>
          <CardDescription className="text-slate-400">
            Upload a file — it will be sent to your local Flask backend running Whisper
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
                <p className="text-sm text-slate-500">MP4, WebM, MP3, WAV (max 500MB)</p>
              </div>
            )}
          </div>

          {/* Category Filters */}
          <div className="mt-4 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
            <Label className="text-slate-300 font-medium mb-3 block">Detection Categories:</Label>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cat-hesitation"
                  checked={categoryFilter.hesitation}
                  onCheckedChange={() => toggleCategory('hesitation')}
                  className="border-red-500 data-[state=checked]:bg-red-500"
                />
                <Label htmlFor="cat-hesitation" className="text-red-400 cursor-pointer">
                  Hesitation (um, uh, er)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cat-crutches"
                  checked={categoryFilter.crutches}
                  onCheckedChange={() => toggleCategory('crutches')}
                  className="border-amber-500 data-[state=checked]:bg-amber-500"
                />
                <Label htmlFor="cat-crutches" className="text-amber-400 cursor-pointer">
                  Crutches (like, basically)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="cat-phrases"
                  checked={categoryFilter.phrases}
                  onCheckedChange={() => toggleCategory('phrases')}
                  className="border-purple-500 data-[state=checked]:bg-purple-500"
                />
                <Label htmlFor="cat-phrases" className="text-purple-400 cursor-pointer">
                  Phrases (you know, I mean)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="detect-repeated"
                  checked={detectRepeated}
                  onCheckedChange={() => setDetectRepeated(!detectRepeated)}
                  className="border-blue-500 data-[state=checked]:bg-blue-500"
                />
                <Label htmlFor="detect-repeated" className="text-blue-400 cursor-pointer">
                  Repeated words
                </Label>
              </div>
            </div>
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
            disabled={!file || !backendOnline || (status !== 'idle' && status !== 'complete' && status !== 'error')}
            className="w-full mt-4"
            size="lg"
          >
            {status === 'idle' || status === 'complete' || status === 'error' ? (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                {backendOnline ? 'Analyze & Remove Filler Words' : 'Start Backend First'}
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
              <div>
                <p className="text-red-400 text-sm">{error}</p>
                {!backendOnline && (
                  <p className="text-red-400/70 text-xs mt-1">
                    Run <code className="bg-red-500/20 px-1 rounded">python app.py</code> in the backend folder
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {result && (
        <>
          {/* Transcripts - Original & Cleaned */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg text-white">Original Transcript</CardTitle>
                <CardDescription className="text-slate-400">
                  {result.originalTranscript.split(' ').length} words
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-slate-900 border border-slate-600 rounded-md text-white max-h-[200px] overflow-y-auto">
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
                <CardDescription className="text-slate-400">
                  {result.cleanedTranscript.split(' ').length} words
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-3 bg-slate-900 border border-slate-600 rounded-md text-white max-h-[200px] overflow-y-auto">
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

          {/* Detected Fillers - Highlighted Preview */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <BarChart3 className="w-5 h-5 text-blue-500" />
                Detected Fillers
              </CardTitle>
              <CardDescription className="text-slate-400">
                Filler words highlighted by category
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Legend */}
              <div className="flex flex-wrap gap-3 mb-4">
                <Badge className={`${categoryColors.hesitation} border`}>
                  Hesitation (um, uh, er)
                </Badge>
                <Badge className={`${categoryColors.crutches} border`}>
                  Verbal Crutch (like, basically)
                </Badge>
                <Badge className={`${categoryColors.phrases} border`}>
                  Filler Phrase (you know, I mean)
                </Badge>
              </div>
              
              {/* Highlighted Text */}
              <div className="p-4 bg-slate-900 border border-slate-600 rounded-md text-white leading-relaxed">
                {result.originalTranscript ? renderHighlightedText() : (
                  <span className="text-slate-500">No transcript available...</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-primary">{result.stats.totalFillers}</div>
                <div className="text-xs text-slate-400 mt-1">Total Fillers</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-red-500">{result.stats.hesitationCount}</div>
                <div className="text-xs text-slate-400 mt-1">Hesitations</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-amber-500">{result.stats.crutchesCount}</div>
                <div className="text-xs text-slate-400 mt-1">Crutches</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-purple-500">{result.stats.phrasesCount}</div>
                <div className="text-xs text-slate-400 mt-1">Phrases</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-blue-500">{result.stats.repeatedWordsCount}</div>
                <div className="text-xs text-slate-400 mt-1">Repeated</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-green-500">{result.stats.reductionPercentage}%</div>
                <div className="text-xs text-slate-400 mt-1">Reduction</div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-4 text-center">
                <div className="text-3xl font-bold text-slate-300">
                  {result.originalTranscript.split(' ').length - result.cleanedTranscript.split(' ').length}
                </div>
                <div className="text-xs text-slate-400 mt-1">Words Saved</div>
              </CardContent>
            </Card>
          </div>

          {/* Filler Words Reference */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-white">Filler Words Reference</CardTitle>
              <CardDescription className="text-slate-400">
                Words detected at each removal level
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className={!categoryFilter.hesitation ? 'opacity-40' : ''}>
                  <h4 className="font-medium text-red-400 mb-2">Hesitation Sounds</h4>
                  <div className="flex flex-wrap gap-1">
                    {FILLER_WORDS.en.hesitation.slice(0, 12).map((word) => (
                      <Badge key={word} variant="outline" className="bg-red-500/10 border-red-500/30 text-red-300">
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className={!categoryFilter.crutches ? 'opacity-40' : ''}>
                  <h4 className="font-medium text-amber-400 mb-2">Verbal Crutches</h4>
                  <div className="flex flex-wrap gap-1">
                    {FILLER_WORDS.en.crutches.slice(0, 12).map((word) => (
                      <Badge key={word} variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-300">
                        {word}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className={!categoryFilter.phrases ? 'opacity-40' : ''}>
                  <h4 className="font-medium text-purple-400 mb-2">Filler Phrases</h4>
                  <div className="flex flex-wrap gap-1">
                    {FILLER_WORDS.en.phrases.slice(0, 8).map((phrase) => (
                      <Badge key={phrase} variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-300">
                        {phrase}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
