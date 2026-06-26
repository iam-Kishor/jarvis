"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Settings, Shield, Trash2, Clock, Globe, ArrowRight } from "lucide-react";
import Canvas from "@/components/Canvas";

interface HistoryItem {
  query: string;
  timestamp: string;
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [isResearching, setIsResearching] = useState(false);
  const [activeQuery, setActiveQuery] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [openaiKey, setOpenaiKey] = useState("");

  // Load history and settings from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("researchx_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {}
    }

    const savedKey = localStorage.getItem("researchx_openai_key");
    if (savedKey) {
      setOpenaiKey(savedKey);
    }
  }, []);

  // Save key change
  const handleSaveSettings = (key: string) => {
    setOpenaiKey(key);
    localStorage.setItem("researchx_openai_key", key);
    setShowSettings(false);
  };

  // Submit search query
  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return;

    // Add to history
    const newHistoryItem: HistoryItem = {
      query: searchQuery.trim(),
      timestamp: new Date().toLocaleDateString(),
    };

    const updatedHistory = [
      newHistoryItem,
      ...history.filter((h) => h.query.toLowerCase() !== searchQuery.trim().toLowerCase()),
    ].slice(0, 8); // Keep top 8 searches

    setHistory(updatedHistory);
    localStorage.setItem("researchx_history", JSON.stringify(updatedHistory));

    setActiveQuery(searchQuery.trim());
    setIsResearching(true);
  };

  // Clear search history
  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("researchx_history");
  };

  // Sample suggestions
  const suggestions = [
    { text: "How much helium gas still left on earth?", category: "Geopolitics" },
    { text: "How much revenue did Tesla generate from energy products?", category: "Automotive/Energy" },
    { text: "Which country imports the most gold?", category: "Trade" },
    { text: "What is the market size of electric vehicles in India?", category: "EV Market" },
  ];

  if (isResearching) {
    return (
      <Canvas 
        query={activeQuery} 
        openaiKey={openaiKey} 
        onBack={() => setIsResearching(false)} 
      />
    );
  }

  return (
    <div className="flex-1 flex flex-col relative w-full h-full min-h-screen overflow-x-hidden">
      
      {/* HEADER NAVBAR */}
      <header className="w-full max-w-7xl mx-auto px-6 py-5 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-red-500 animate-pulse" />
          <span className="text-xl font-black tracking-wider text-red-500">
            JARVIS
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl border border-red-500/10 bg-white/5 text-slate-400 hover:text-white transition-all hover:bg-red-500/10 hover:border-red-500/20 cursor-pointer"
            title="Configuration Settings"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>
        </div>
      </header>

      {/* HERO SECTION & SEARCH BOX */}
      <main className="flex-grow flex flex-col justify-center items-center px-6 py-12 relative z-10 max-w-4xl mx-auto w-full">
        
        <div className="text-center flex flex-col gap-4 mb-10">
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-none">
            Research anything with <br />
            <span className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]">JARVIS</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-400 max-w-xl mx-auto font-medium">
            Stark Industries Autonomous Evidence Synthesis & Analysis Portal. Ask any question to retrieve cross-validated facts instantly.
          </p>
        </div>

        {/* SEARCH BOX CARD */}
        <div className="w-full glass-panel rounded-2xl p-4 md:p-6 shadow-2xl relative group">
          {/* Glowing border effects */}
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-amber-500/10 rounded-2xl blur opacity-30 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
          
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleSearch(query);
            }}
            className="flex flex-col sm:flex-row gap-3 relative"
          >
            <div className="flex-1 relative flex items-center">
              <Search className="w-5 h-5 text-slate-500 absolute left-4.5" />
              <input
                type="text"
                placeholder="What is the market size of electric vehicles in India?"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-slate-900/60 border border-white/5 focus:border-red-500/50 rounded-xl py-4 pl-12 pr-4 text-sm md:text-base text-white placeholder-slate-500 focus:outline-none focus:ring-0 transition-all font-medium"
              />
            </div>
            
            <button
              type="submit"
              disabled={!query.trim()}
              className="px-6 py-4 bg-red-600 text-white hover:bg-red-700 active:bg-red-800 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)] text-sm md:text-base font-bold rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Research
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Autocomplete suggestions chips */}
          <div className="mt-5 flex flex-col gap-2.5">
            <span className="text-xs uppercase tracking-wider text-slate-500 font-bold">Suggested Topics</span>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuery(s.text);
                    handleSearch(s.text);
                  }}
                  className="text-xs text-slate-300 bg-white/5 border border-red-500/10 rounded-full px-3.5 py-1.5 transition-all hover:bg-red-500/10 hover:border-red-500/30 hover:text-white text-left font-medium cursor-pointer"
                >
                  <span className="text-red-500 font-bold mr-1.5">{s.category}</span>
                  {s.text}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* RECENT RESEARCH HISTORY */}
        {history.length > 0 && (
          <div className="w-full mt-10 flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/5 pb-2">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-bold flex items-center gap-2">
                <Clock className="w-3.5 h-3.5" />
                Recent Investigations
              </span>
              <button 
                onClick={handleClearHistory}
                className="text-xs text-slate-500 hover:text-red-400 font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Clear History
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {history.map((h, idx) => (
                <div 
                  key={idx}
                  onClick={() => handleSearch(h.query)}
                  className="p-3.5 rounded-xl border border-red-500/10 bg-white/5 flex justify-between items-center cursor-pointer transition-all hover:bg-red-500/5 hover:border-red-500/25"
                >
                  <span className="text-xs md:text-sm font-medium text-slate-300 truncate max-w-[90%]">
                    {h.query}
                  </span>
                  <span className="text-[10px] text-slate-500 shrink-0 uppercase tracking-wider font-semibold">
                    {h.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* FOOTER */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-10 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 border-t border-white/5 z-10 shrink-0 font-medium">
        <span>© 2026 J.A.R.V.I.S. • Powered by Context.dev</span>
      </footer>

      {/* CONFIGURATION SETTINGS MODAL */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md glass-panel p-6 rounded-2xl flex flex-col gap-4 relative"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Shield className="w-4.5 h-4.5 text-red-500" />
                  Configuration Settings
                </h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-slate-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="h-px bg-slate-800" />

              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">OpenAI API Key (Optional)</label>
                <input
                  type="password"
                  placeholder="sk-proj-..."
                  defaultValue={openaiKey}
                  id="openai-key-input"
                  className="w-full bg-slate-900 border border-white/5 focus:border-red-500/50 rounded-xl py-3 px-4 text-sm text-white placeholder-slate-600 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Used for GPT-4o synthesis and report formatting. If left empty, J.A.R.V.I.S. uses a client-side pattern matching engine to synthesize Context.dev scraped Markdown.
                </p>
              </div>

              <div className="flex gap-3 justify-end mt-4">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-slate-300 text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const inputEl = document.getElementById("openai-key-input") as HTMLInputElement;
                    handleSaveSettings(inputEl?.value || "");
                  }}
                  className="px-4 py-2.5 bg-gradient-brand text-white rounded-lg text-xs font-bold cursor-pointer hover:opacity-90"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
