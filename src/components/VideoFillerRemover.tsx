import { useState, useRef, useEffect, useMemo } from 'react';
import { analyzeFillers, FILLER_WORDS, type RemovalLevel, type FillerCategory, type DetectedFiller } from '@/lib/fillerWords';
import { checkBackendHealth, transcribeFile, getBackendUrl } from '@/lib/backendApi';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Upload, 
  Loader2, 
  FileVideo,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Server,
  Wifi,
  WifiOff,
  Zap,
  Trash2,
  BarChart3,
  Copy,
  Check,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

type ProcessingStatus = 'idle' | 'checking-backend' | 'transcribing' | 'analyzing' | 'complete' | 'error';

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
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<RemovalLevel>('medium');
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);
  const [detectRepeated, setDetectRepeated] = useState(true);
  const [copied, setCopied] = useState(false);
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

  // Analyze text with useMemo like text tab
  const analysis = useMemo(() => {
    return analyzeFillers(inputText, level, detectRepeated);
  }, [inputText, level, detectRepeated]);

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
      setInputText('');
      setError(null);
      setStatus('idle');
    }
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

      setInputText(transcript);
      setProgress(70);

      // Analyzing
      setStatus('analyzing');
      setProgress(90);

      setStatus('complete');
      setProgress(100);
      
      const analysisResult = analyzeFillers(transcript, level, detectRepeated);
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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(analysis.cleanedText);
    setCopied(true);
    toast({ title: "Copied!", description: "Cleaned text copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setInputText('');
    setFile(null);
    setStatus('idle');
    setError(null);
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

  // Render text with highlighted fillers - exact same as text tab
  const renderHighlightedText = () => {
    if (!inputText) return null;
    
    let lastIndex = 0;
    const elements: JSX.Element[] = [];
    
    // Sort fillers by start index
    const sortedFillers = [...analysis.detectedFillers].sort((a, b) => a.startIndex - b.startIndex);
    
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
            {inputText.slice(lastIndex, filler.startIndex)}
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
          {inputText.slice(filler.startIndex, filler.endIndex)}
        </mark>
      );
      
      lastIndex = filler.endIndex;
    }
    
    // Add remaining text
    if (lastIndex < inputText.length) {
      elements.push(
        <span key={`text-end`}>{inputText.slice(lastIndex)}</span>
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
                {backendOnline ? 'Transcribe & Analyze' : 'Start Backend First'}
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {getStatusMessage()}
              </>
            )}
          </Button>

          {/* Progress */}
          {status !== 'idle' && status !== 'error' && status !== 'complete' && (
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

      {/* Controls - Same as Text Tab */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* Removal Level */}
            <div className="flex items-center gap-3">
              <Label className="text-slate-300 font-medium">Level:</Label>
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

            {/* Detect Repeated */}
            <div className="flex items-center gap-2">
              <Switch
                id="detect-repeated-video"
                checked={detectRepeated}
                onCheckedChange={setDetectRepeated}
              />
              <Label htmlFor="detect-repeated-video" className="text-slate-300">
                Detect repeated words
              </Label>
            </div>

            {/* Actions */}
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content - Same as Text Tab */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Input / Original */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Original Text
            </CardTitle>
            <CardDescription className="text-slate-400">
              Transcribed text from video/audio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Transcribed text will appear here after processing..."
              className="min-h-[200px] bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 resize-none"
            />
            <div className="mt-3 text-sm text-slate-400">
              {analysis.stats.originalWordCount} words
            </div>
          </CardContent>
        </Card>

        {/* Output / Cleaned */}
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-white">
              <Zap className="w-5 h-5 text-green-500" />
              Cleaned Text
            </CardTitle>
            <CardDescription className="text-slate-400">
              Text with filler words removed
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="min-h-[200px] p-3 bg-slate-900 border border-slate-600 rounded-md text-white">
              {analysis.cleanedText || <span className="text-slate-500">Cleaned text will appear here...</span>}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm text-slate-400">
                {analysis.stats.cleanedWordCount} words
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!analysis.cleanedText}
                className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
              >
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Highlighted Preview - Same as Text Tab */}
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
            {inputText ? renderHighlightedText() : (
              <span className="text-slate-500">Upload and process a file to see highlighted fillers...</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats - Same as Text Tab */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-primary">{analysis.stats.totalFillers}</div>
            <div className="text-xs text-slate-400 mt-1">Total Fillers</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-red-500">{analysis.stats.hesitationCount}</div>
            <div className="text-xs text-slate-400 mt-1">Hesitations</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-amber-500">{analysis.stats.crutchesCount}</div>
            <div className="text-xs text-slate-400 mt-1">Crutches</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-purple-500">{analysis.stats.phrasesCount}</div>
            <div className="text-xs text-slate-400 mt-1">Phrases</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-blue-500">{analysis.stats.repeatedWordsCount}</div>
            <div className="text-xs text-slate-400 mt-1">Repeated</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-green-500">{analysis.stats.reductionPercentage}%</div>
            <div className="text-xs text-slate-400 mt-1">Reduction</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4 text-center">
            <div className="text-3xl font-bold text-slate-300">
              {analysis.stats.originalWordCount - analysis.stats.cleanedWordCount}
            </div>
            <div className="text-xs text-slate-400 mt-1">Words Saved</div>
          </CardContent>
        </Card>
      </div>

      {/* Filler Words Reference - Same as Text Tab */}
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-white">Filler Words Reference</CardTitle>
          <CardDescription className="text-slate-400">
            Words detected at each removal level
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <h4 className="font-medium text-red-400 mb-2">Hesitation Sounds</h4>
              <div className="flex flex-wrap gap-1">
                {FILLER_WORDS.en.hesitation.slice(0, 12).map((word) => (
                  <Badge key={word} variant="outline" className="bg-red-500/10 border-red-500/30 text-red-300">
                    {word}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <h4 className="font-medium text-amber-400 mb-2">Verbal Crutches</h4>
              <div className="flex flex-wrap gap-1">
                {FILLER_WORDS.en.crutches.slice(0, 12).map((word) => (
                  <Badge key={word} variant="outline" className="bg-amber-500/10 border-amber-500/30 text-amber-300">
                    {word}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
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
    </div>
  );
}
