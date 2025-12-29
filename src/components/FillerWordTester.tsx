import { useState, useMemo } from 'react';
import { analyzeFillers, FILLER_WORDS, type RemovalLevel, type FillerCategory } from '@/lib/fillerWords';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Zap, 
  Trash2, 
  BarChart3, 
  Copy, 
  Check, 
  RefreshCw,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SAMPLE_TEXTS = [
  "So, um, I was thinking, you know, that like we should basically, uh, start the the project tomorrow. I mean, it's kind of important, right? Actually, I think we we need to, um, prepare everything first. You know what I mean?",
  "Well, honestly, I I think this is, like, a really good idea. So basically what we're saying is, um, you know, we should probably, uh, consider all the options. At the end of the day, it's kind of up to us, right?",
  "Okay so like I was talking to, um, Sarah and she was like 'you know we should totally do this' and I was like 'yeah definitely' but then, uh, I I realized it might be, you know, kind of difficult actually."
];

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

export default function FillerWordTester() {
  const [inputText, setInputText] = useState(SAMPLE_TEXTS[0]);
  const [level, setLevel] = useState<RemovalLevel>('medium');
  const [detectRepeated, setDetectRepeated] = useState(true);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const analysis = useMemo(() => {
    return analyzeFillers(inputText, level, detectRepeated);
  }, [inputText, level, detectRepeated]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(analysis.cleanedText);
    setCopied(true);
    toast({ title: "Copied!", description: "Cleaned text copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadSample = () => {
    const randomIndex = Math.floor(Math.random() * SAMPLE_TEXTS.length);
    setInputText(SAMPLE_TEXTS[randomIndex]);
  };

  const handleClear = () => {
    setInputText('');
  };

  // Render text with highlighted fillers
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/20 px-4 py-2 rounded-full">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">Filler Word Removal Utility</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Clean Your Speech
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Detect and remove filler words, verbal crutches, and repeated words from your text
          </p>
        </div>

        {/* Controls */}
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
                  id="detect-repeated"
                  checked={detectRepeated}
                  onCheckedChange={setDetectRepeated}
                />
                <Label htmlFor="detect-repeated" className="text-slate-300">
                  Detect repeated words
                </Label>
              </div>

              {/* Actions */}
              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadSample}
                  className="bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600"
                >
                  <RefreshCw className="w-4 h-4 mr-1" />
                  Sample
                </Button>
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

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Input */}
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2 text-white">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Original Text
              </CardTitle>
              <CardDescription className="text-slate-400">
                Paste or type text with filler words
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Enter your text here..."
                className="min-h-[200px] bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 resize-none"
              />
              <div className="mt-3 text-sm text-slate-400">
                {analysis.stats.originalWordCount} words
              </div>
            </CardContent>
          </Card>

          {/* Output */}
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

        {/* Highlighted Preview */}
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
                <span className="text-slate-500">Enter text above to see highlighted fillers...</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
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
    </div>
  );
}
