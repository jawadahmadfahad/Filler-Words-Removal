import { useState } from 'react';
import FillerWordTester from '@/components/FillerWordTester';
import VideoFillerRemover from '@/components/VideoFillerRemover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, FileVideo, Sparkles } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-primary/20 px-4 py-2 rounded-full">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-medium text-primary">Filler Word Removal</span>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
            Clean Your Speech
          </h1>
          <p className="text-slate-400 max-w-xl mx-auto">
            Remove filler words from text or upload video/audio for automatic transcription and cleaning
          </p>
        </div>

        {/* Mode Tabs */}
        <Tabs defaultValue="video" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 bg-slate-800/50 border border-slate-700">
            <TabsTrigger 
              value="video" 
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <FileVideo className="w-4 h-4" />
              Video/Audio
            </TabsTrigger>
            <TabsTrigger 
              value="text"
              className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-white"
            >
              <FileText className="w-4 h-4" />
              Text
            </TabsTrigger>
          </TabsList>

          <TabsContent value="video" className="mt-6">
            <VideoFillerRemover />
          </TabsContent>

          <TabsContent value="text" className="mt-6">
            <FillerWordTester embedded />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;
