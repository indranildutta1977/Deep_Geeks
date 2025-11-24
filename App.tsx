import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { 
  Send, 
  Paperclip, 
  Bot, 
  Briefcase, 
  FileText, 
  Image as ImageIcon, 
  X, 
  Cpu, 
  Sparkles, 
  Menu, 
  Plus,
  ArrowRight,
  Globe,
  Settings
} from 'lucide-react';
import { AppMode, Message, ModelType, Attachment } from './types';
import { generateResponseStream, fileToGenerativePart, enhancePrompt } from './services/geminiService';
import MarkdownRenderer from './components/MarkdownRenderer';

const App = () => {
  // -- State --
  const [mode, setMode] = useState<AppMode>(AppMode.GENERAL_CHAT);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>(ModelType.GEMINI_FLASH);
  const [showModelSelect, setShowModelSelect] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);

  // Refs for auto-scrolling
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Constants --
  const CAREER_SYSTEM_INSTRUCTION = `You are an expert Career Counselor and HR Specialist. 
  Your goal is to analyze user inputs (resumes, portfolios, questions) and provide concrete, actionable data.
  
  When analyzing a resume/profile:
  1. **Job Prospects**: Identify roles they fit immediately.
  2. **Applicability Count**: Estimate how many relevant open roles might exist currently (ballpark based on trends).
  3. **Eligibility**: Highlight "SLAM DUNK" roles vs. "STRETCH" roles.
  4. **Skill Gaps**: What specific hard/soft skills are missing for the next level?
  5. **Market Trends**: Is this role growing or shrinking?
  6. **Resources**: Provide REAL links to job boards (LinkedIn, Indeed, Glassdoor), specific company career pages, or certification courses.
  
  ALWAYS use the Search Tool to find current vacancies and links when asked for jobs or trends. 
  Format output clearly with Markdown, using tables for comparisons and bullet points for lists.`;

  const GENERAL_SYSTEM_INSTRUCTION = `You are a helpful, witty, and highly intelligent AI assistant called NexAI. 
  You can process text, images, audio, and video. 
  Provide accurate, helpful, and concise responses. Use Markdown for formatting.`;

  // -- Effects --
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // -- Handlers --

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleModeSwitch = (newMode: AppMode) => {
    setMode(newMode);
    setMessages([]); // Clear chat on mode switch for clean context
    setAttachments([]);
    // Select appropriate model for the mode
    if (newMode === AppMode.CAREER_ANALYSIS) {
        setSelectedModel(ModelType.GEMINI_FLASH); // Flash is good for search tool speed
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newAttachments: Attachment[] = [];
      for (let i = 0; i < e.target.files.length; i++) {
        const file = e.target.files[i];
        const base64Data = await fileToGenerativePart(file);
        
        let type: Attachment['type'] = 'application';
        if (file.type.startsWith('image/')) type = 'image';
        else if (file.type.startsWith('video/')) type = 'video';
        else if (file.type.startsWith('audio/')) type = 'audio';

        newAttachments.push({
          file,
          previewUrl: URL.createObjectURL(file),
          type,
          base64: base64Data.data,
          mimeType: base64Data.mimeType
        });
      }
      setAttachments(prev => [...prev, ...newAttachments]);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleEnhancePrompt = async () => {
    if (!input.trim()) return;
    setIsEnhancing(true);
    const enhanced = await enhancePrompt(input);
    setInput(enhanced);
    setIsEnhancing(false);
  };

  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || isGenerating) return;

    const userMsgId = Date.now().toString();
    const newUserMessage: Message = {
      id: userMsgId,
      role: 'user',
      content: input,
      attachments: [...attachments],
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInput('');
    setAttachments([]);
    setIsGenerating(true);

    const botMsgId = (Date.now() + 1).toString();
    const initBotMessage: Message = {
      id: botMsgId,
      role: 'model',
      content: '',
      timestamp: Date.now(),
      isThinking: true
    };
    setMessages(prev => [...prev, initBotMessage]);

    try {
      // Determine configuration based on mode
      const sysInstruction = mode === AppMode.CAREER_ANALYSIS ? CAREER_SYSTEM_INSTRUCTION : GENERAL_SYSTEM_INSTRUCTION;
      const useSearch = mode === AppMode.CAREER_ANALYSIS || selectedModel === ModelType.GEMINI_PRO_IMAGE; 
      
      // If in career mode and there are attachments, we might need to prompt specifically if the user didn't write much
      let finalPrompt = newUserMessage.content;
      if (mode === AppMode.CAREER_ANALYSIS && attachments.length > 0 && finalPrompt.length < 10) {
        finalPrompt = "Analyze these files regarding my career. Tell me about job prospects, eligibility, trends, and provide application links.";
      }

      const streamResult = await generateResponseStream(
        selectedModel,
        finalPrompt,
        newUserMessage.attachments || [],
        sysInstruction,
        useSearch
      );

      let accumulatedText = '';
      
      for await (const chunk of streamResult) {
        const text = chunk.text();
        accumulatedText += text;
        
        setMessages(prev => prev.map(msg => 
          msg.id === botMsgId 
            ? { ...msg, content: accumulatedText, isThinking: false } 
            : msg
        ));
      }

    } catch (error) {
      console.error("Chat Error", error);
      setMessages(prev => prev.map(msg => 
        msg.id === botMsgId 
          ? { ...msg, content: "**Error:** Failed to generate response. Please check your API key or connection.", isThinking: false } 
          : msg
      ));
    } finally {
      setIsGenerating(false);
    }
  };

  // -- Render Helpers --

  const renderAttachmentsPreview = () => {
    if (attachments.length === 0) return null;
    return (
      <div className="flex gap-2 overflow-x-auto p-2 mb-2">
        {attachments.map((att, idx) => (
          <div key={idx} className="relative group shrink-0">
            <div className="w-16 h-16 rounded-lg border border-slate-600 overflow-hidden bg-slate-800 flex items-center justify-center">
              {att.type === 'image' && <img src={att.previewUrl} className="w-full h-full object-cover" alt="preview" />}
              {att.type === 'video' && <div className="text-xs text-center p-1 text-slate-400"><ImageIcon size={20} className="mx-auto mb-1"/>Video</div>}
              {att.type === 'audio' && <div className="text-xs text-center p-1 text-slate-400">Audio</div>}
              {att.type === 'application' && <div className="text-xs text-center p-1 text-slate-400"><FileText size={20} className="mx-auto mb-1"/>File</div>}
            </div>
            <button 
              onClick={() => removeAttachment(idx)}
              className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen bg-background text-gray-100 font-sans overflow-hidden">
      
      {/* --- HEADER --- */}
      <header className="h-16 border-b border-slate-700 bg-surface/50 backdrop-blur-md flex items-center justify-between px-4 lg:px-8 z-20">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${mode === AppMode.GENERAL_CHAT ? 'bg-primary' : 'bg-accent'} transition-colors duration-500`}>
            {mode === AppMode.GENERAL_CHAT ? <Bot size={24} className="text-white" /> : <Briefcase size={24} className="text-white" />}
          </div>
          <h1 className="text-xl font-bold tracking-tight hidden md:block">
            Nex<span className={mode === AppMode.GENERAL_CHAT ? "text-blue-400" : "text-purple-400"}>AI</span>
          </h1>
          
          {/* Perplexity-style Model Switcher */}
          <div className="relative ml-4">
            <button 
              onClick={() => setShowModelSelect(!showModelSelect)}
              className="flex items-center gap-2 text-xs md:text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-full transition-colors border border-slate-600"
            >
              <Cpu size={14} />
              <span className="max-w-[100px] truncate">
                {selectedModel === ModelType.GEMINI_FLASH ? 'Flash 2.5 (Fast)' : 
                 selectedModel === ModelType.GEMINI_PRO ? 'Pro 3.0 (Smart)' : 'Pro 3.0 (Image)'}
              </span>
              <Settings size={12} className="opacity-50" />
            </button>
            
            {showModelSelect && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-surface border border-slate-600 rounded-xl shadow-xl z-50 p-1">
                <div className="text-xs font-semibold text-slate-400 px-3 py-2 uppercase tracking-wider">Select Model</div>
                <button 
                  onClick={() => { setSelectedModel(ModelType.GEMINI_FLASH); setShowModelSelect(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-slate-700 ${selectedModel === ModelType.GEMINI_FLASH ? 'text-primary bg-slate-800/50' : 'text-slate-300'}`}
                >
                  <div className="w-2 h-2 rounded-full bg-yellow-400"></div> Gemini 2.5 Flash
                </button>
                <button 
                  onClick={() => { setSelectedModel(ModelType.GEMINI_PRO); setShowModelSelect(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-slate-700 ${selectedModel === ModelType.GEMINI_PRO ? 'text-primary bg-slate-800/50' : 'text-slate-300'}`}
                >
                   <div className="w-2 h-2 rounded-full bg-blue-500"></div> Gemini 3.0 Pro
                </button>
                <button 
                  onClick={() => { setSelectedModel(ModelType.GEMINI_PRO_IMAGE); setShowModelSelect(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 hover:bg-slate-700 ${selectedModel === ModelType.GEMINI_PRO_IMAGE ? 'text-primary bg-slate-800/50' : 'text-slate-300'}`}
                >
                   <div className="w-2 h-2 rounded-full bg-purple-500"></div> Gemini 3.0 Pro Image
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Mode Toggle Switch */}
        <div className="flex items-center gap-3">
          <span className={`text-xs font-medium ${mode === AppMode.GENERAL_CHAT ? 'text-white' : 'text-slate-500'}`}>Chat</span>
          <button 
            onClick={() => handleModeSwitch(mode === AppMode.GENERAL_CHAT ? AppMode.CAREER_ANALYSIS : AppMode.GENERAL_CHAT)}
            className={`w-14 h-7 rounded-full p-1 transition-colors duration-300 relative ${mode === AppMode.CAREER_ANALYSIS ? 'bg-accent' : 'bg-slate-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${mode === AppMode.CAREER_ANALYSIS ? 'translate-x-7' : 'translate-x-0'}`} />
          </button>
          <span className={`text-xs font-medium ${mode === AppMode.CAREER_ANALYSIS ? 'text-white' : 'text-slate-500'}`}>Career</span>
        </div>
      </header>

      {/* --- MAIN AREA --- */}
      <main className="flex-1 overflow-y-auto relative p-4 flex flex-col items-center">
        {messages.length === 0 ? (
          // Empty State
          <div className="flex flex-col items-center justify-center mt-20 md:mt-32 text-center max-w-2xl animate-fade-in px-4">
            <div className={`p-6 rounded-2xl mb-6 bg-surface/30 backdrop-blur border border-slate-700 shadow-2xl ${mode === AppMode.CAREER_ANALYSIS ? 'shadow-purple-500/20' : 'shadow-blue-500/20'}`}>
               {mode === AppMode.GENERAL_CHAT ? <Bot size={64} className="text-primary mb-0 mx-auto" /> : <Briefcase size={64} className="text-accent mb-0 mx-auto" />}
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
              {mode === AppMode.GENERAL_CHAT ? "How can I help you today?" : "Career & Resume Analysis"}
            </h2>
            <p className="text-slate-400 text-lg mb-8">
              {mode === AppMode.GENERAL_CHAT 
                ? "Ask me anything, upload images, folders, or analyze code." 
                : "Upload your resume/CV to get a comprehensive analysis of job prospects, market trends, and real vacancies."}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg">
              {mode === AppMode.GENERAL_CHAT ? (
                <>
                  <button onClick={() => setInput("Explain quantum computing in simple terms")} className="p-4 bg-surface hover:bg-slate-700 border border-slate-700 rounded-xl text-left text-sm transition-all hover:scale-[1.02]">
                    <span className="font-semibold block mb-1 text-blue-300">Explain Concepts</span>
                    "Explain quantum computing..."
                  </button>
                  <button onClick={() => setInput("Write a Python script to scrape a website")} className="p-4 bg-surface hover:bg-slate-700 border border-slate-700 rounded-xl text-left text-sm transition-all hover:scale-[1.02]">
                     <span className="font-semibold block mb-1 text-green-300">Generate Code</span>
                    "Write a Python script..."
                  </button>
                </>
              ) : (
                 <>
                  <button onClick={() => setInput("What are the highest paying remote jobs right now?")} className="p-4 bg-surface hover:bg-slate-700 border border-slate-700 rounded-xl text-left text-sm transition-all hover:scale-[1.02]">
                    <span className="font-semibold block mb-1 text-purple-300">Market Trends</span>
                    "Highest paying remote jobs?"
                  </button>
                  <button onClick={() => { 
                    if(fileInputRef.current) fileInputRef.current.click(); 
                  }} className="p-4 bg-surface hover:bg-slate-700 border border-slate-700 rounded-xl text-left text-sm transition-all hover:scale-[1.02] flex items-center justify-between group">
                     <div>
                       <span className="font-semibold block mb-1 text-pink-300">Upload Resume</span>
                       Analyze my CV
                     </div>
                     <ArrowRight size={16} className="opacity-0 group-hover:opacity-100 transition-opacity transform -translate-x-2 group-hover:translate-x-0" />
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          // Message List
          <div className="w-full max-w-4xl space-y-6 pb-4">
             {messages.map((msg) => (
               <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                 {msg.role === 'model' && (
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${mode === AppMode.CAREER_ANALYSIS ? 'bg-accent' : 'bg-primary'}`}>
                      {mode === AppMode.CAREER_ANALYSIS ? <Briefcase size={14} className="text-white"/> : <Bot size={14} className="text-white"/>}
                   </div>
                 )}
                 
                 <div className={`max-w-[85%] md:max-w-[75%] rounded-2xl p-4 ${
                   msg.role === 'user' 
                     ? 'bg-slate-700 text-white rounded-tr-sm' 
                     : 'bg-transparent text-gray-100 rounded-tl-sm pl-0'
                 }`}>
                   {/* User Attachments Display */}
                   {msg.role === 'user' && msg.attachments && msg.attachments.length > 0 && (
                     <div className="flex flex-wrap gap-2 mb-3">
                       {msg.attachments.map((att, i) => (
                         <div key={i} className="bg-slate-900/50 rounded p-2 text-xs flex items-center gap-2 border border-slate-600">
                           {att.type === 'image' ? <ImageIcon size={12}/> : <FileText size={12}/>}
                           <span className="truncate max-w-[150px]">{att.file.name}</span>
                         </div>
                       ))}
                     </div>
                   )}

                   {/* Content */}
                   {msg.role === 'model' && msg.isThinking ? (
                     <div className="flex items-center gap-2 text-slate-400">
                       <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse"></span>
                       <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-150"></span>
                       <span className="w-2 h-2 bg-slate-400 rounded-full animate-pulse delay-300"></span>
                       <span className="text-sm font-mono ml-2">Analyzing...</span>
                     </div>
                   ) : (
                     <MarkdownRenderer content={msg.content} />
                   )}
                 </div>

                 {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center shrink-0 mt-1">
                      <span className="text-xs font-bold">YOU</span>
                    </div>
                 )}
               </div>
             ))}
             <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* --- INPUT AREA --- */}
      <footer className="w-full bg-background border-t border-slate-700 p-4 flex justify-center z-10">
        <div className="w-full max-w-4xl bg-surface border border-slate-600 rounded-2xl p-2 relative shadow-lg focus-within:ring-1 focus-within:ring-primary/50 transition-shadow">
          
          {/* Previews */}
          {renderAttachmentsPreview()}

          {/* Text Area */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={mode === AppMode.GENERAL_CHAT ? "Ask anything..." : "Ask about your career or upload resume..."}
            className="w-full bg-transparent text-white placeholder-slate-400 p-3 resize-none outline-none max-h-40 min-h-[50px] text-sm md:text-base scrollbar-hide"
            rows={1}
            style={{ minHeight: '56px' }}
          />

          {/* Controls Bar */}
          <div className="flex justify-between items-center px-2 pb-1">
            <div className="flex items-center gap-2">
              <input 
                type="file" 
                multiple 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileSelect} 
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-full transition-colors"
                title="Attach files, images, videos"
              >
                <Plus size={20} />
              </button>
              
              <button 
                onClick={handleEnhancePrompt}
                disabled={!input.trim() || isEnhancing}
                className={`p-2 rounded-full transition-colors flex items-center gap-1 ${isEnhancing ? 'text-yellow-400 animate-pulse' : 'text-slate-400 hover:text-yellow-400 hover:bg-slate-700'}`}
                title="Enhance Prompt (AI Rewrite)"
              >
                <Sparkles size={18} />
                {isEnhancing && <span className="text-xs">Enhancing...</span>}
              </button>
              
              {mode === AppMode.CAREER_ANALYSIS && (
                <div className="flex items-center gap-1 ml-2 text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded border border-green-400/20">
                  <Globe size={12} />
                  <span>Live Search Active</span>
                </div>
              )}
            </div>

            <button 
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || isGenerating}
              className={`p-2 rounded-xl transition-all duration-200 ${
                (!input.trim() && attachments.length === 0) || isGenerating 
                  ? 'bg-slate-700 text-slate-500 cursor-not-allowed' 
                  : 'bg-primary text-white hover:bg-blue-600 shadow-md hover:shadow-lg'
              }`}
            >
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Mount
const rootElement = document.getElementById('root');
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}

export default App;
