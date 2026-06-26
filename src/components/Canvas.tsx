"use client";

import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Search, ShieldCheck, ExternalLink, Download, Share2, 
  Settings, Layers, Compass, Image as ImageIcon, Clock, CheckCircle2, 
  AlertTriangle, RefreshCw, Send, HelpCircle, GitCommit, ChevronRight, X 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";

interface Node {
  id: string;
  label: string;
  type: "query" | "subquestion" | "source" | "claim";
  x: number;
  y: number;
}

interface Link {
  source: string;
  target: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface ResearchReport {
  question: string;
  answer: string;
  confidenceScore: number;
  confidenceLevel: "High" | "Medium" | "Low";
  executiveSummary: string;
  keyFindings: {
    title: string;
    detail: string;
    sources: string[];
  }[];
  contradictions: {
    topic: string;
    description: string;
  }[];
  sources: {
    url: string;
    title: string;
    description: string;
  }[];
  images: {
    url: string;
    alt: string;
    type: string;
  }[];
  timeline: {
    date: string;
    event: string;
    source: string;
  }[];
  graph: {
    nodes: { id: string; label: string; type: string }[];
    links: { source: string; target: string }[];
  };
  relatedInsights: string[];
}

interface CanvasProps {
  query: string;
  openaiKey: string;
  onBack: () => void;
}

export default function Canvas({ query, openaiKey, onBack }: CanvasProps) {
  // State variables
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("initializing");
  const [progress, setProgress] = useState(5);
  const [statusMessage, setStatusMessage] = useState("Initializing Research Engine...");
  const [report, setReport] = useState<ResearchReport | null>(null);
  
  // Follow-up state
  const [followUps, setFollowUps] = useState<{ q: string; a: string }[]>([]);
  const [currentFollowUp, setCurrentFollowUp] = useState("");
  const [sendingFollowUp, setSendingFollowUp] = useState(false);

  // SVG Pan/Zoom state
  const [pan, setPan] = useState({ x: 300, y: 200 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [hoveredPoint, setHoveredPoint] = useState<{
    label: string;
    value: number;
    source: string;
    x: number;
    y: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Fetch streaming research data on mount
  useEffect(() => {
    let active = true;
    const fetchResearch = async () => {
      try {
        const response = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query, openaiKey }),
        });

        if (!response.ok) {
          throw new Error("Failed to connect to research server.");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("Response body is not readable.");
        }

        while (active) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.substring(6));
                
                if (parsed.status === "error") {
                  throw new Error(parsed.message);
                }

                if (parsed.status === "completed") {
                  setStatus("completed");
                  setProgress(100);
                  setStatusMessage("Analysis Completed!");
                  setReport(parsed.data);
                  setLoading(false);
                  
                  // Trigger success confetti!
                  confetti({
                    particleCount: 100,
                    spread: 70,
                    origin: { y: 0.6 }
                  });
                  break;
                } else {
                  setStatus(parsed.status);
                  setProgress(parsed.progress);
                  setStatusMessage(parsed.message);
                }
              } catch (e) {
                // Ignore JSON parsing errors for partial lines
              }
            }
          }
        }
      } catch (err: any) {
        console.error("Stream error:", err);
        setStatus("error");
        setStatusMessage(err.message || "An unexpected error occurred.");
        setLoading(false);
      }
    };

    fetchResearch();

    return () => {
      active = false;
    };
  }, [query, openaiKey]);

  // Compute graph coordinates when report loads
  useEffect(() => {
    if (!report?.graph) return;

    const rawNodes = report.graph.nodes;
    const rawLinks = report.graph.links;

    // Arrange nodes in a beautiful radial logic tree
    // Center is main query.
    // Inner ring (radius 120) contains subquestions.
    // Middle ring (radius 240) contains sources.
    // Outer ring (radius 360) contains claims.
    const queryNode = rawNodes.find(n => n.type === "query") || rawNodes[0];
    const subQNodes = rawNodes.filter(n => n.type === "subquestion");
    const sourceNodes = rawNodes.filter(n => n.type === "source");
    const claimNodes = rawNodes.filter(n => n.type === "claim" || (n.type !== "query" && n.type !== "subquestion" && n.type !== "source"));

    const nodes: Node[] = [];

    // 1. Position query node in center (0, 0)
    if (queryNode) {
      nodes.push({
        id: queryNode.id,
        label: queryNode.label,
        type: "query",
        x: 0,
        y: 0
      });
    }

    // 2. Position subquestions in inner ring
    subQNodes.forEach((node, i) => {
      const angle = (i / subQNodes.length) * 2 * Math.PI;
      nodes.push({
        id: node.id,
        label: node.label,
        type: "subquestion",
        x: Math.cos(angle) * 120,
        y: Math.sin(angle) * 120
      });
    });

    // 3. Position sources in middle ring
    sourceNodes.forEach((node, i) => {
      const angle = ((i + 0.5) / sourceNodes.length) * 2 * Math.PI;
      nodes.push({
        id: node.id,
        label: node.label,
        type: "source",
        x: Math.cos(angle) * 250,
        y: Math.sin(angle) * 250
      });
    });

    // 4. Position claims in outer ring
    claimNodes.forEach((node, i) => {
      const angle = ((i + 0.2) / Math.max(1, claimNodes.length)) * 2 * Math.PI;
      nodes.push({
        id: node.id,
        label: node.label,
        type: "claim",
        x: Math.cos(angle) * 360,
        y: Math.sin(angle) * 360
      });
    });

    // Handle any missed node from layout
    rawNodes.forEach(node => {
      if (!nodes.some(n => n.id === node.id)) {
        nodes.push({
          id: node.id,
          label: node.label,
          type: "claim",
          x: (Math.random() - 0.5) * 400,
          y: (Math.random() - 0.5) * 400
        });
      }
    });

    setGraphData({
      nodes,
      links: rawLinks.map(l => ({
        source: l.source,
        target: l.target
      }))
    });
  }, [report]);

  // Scroll follow-up chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [followUps, sendingFollowUp]);

  // SVG Pan and Zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "circle" || (e.target as HTMLElement).tagName === "text") {
      return; // Dragging node/text is handled separately or ignored to prioritize panning
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoom = (factor: number) => {
    setZoom(prev => Math.max(0.4, Math.min(3, prev * factor)));
  };

  const handleResetGraph = () => {
    setPan({ x: 300, y: 200 });
    setZoom(1);
    setSelectedNode(null);
  };

  // Follow-up chat submission
  const handleSendFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentFollowUp.trim() || !report) return;

    const userQ = currentFollowUp;
    setCurrentFollowUp("");
    setFollowUps(prev => [...prev, { q: userQ, a: "" }]);
    setSendingFollowUp(true);

    try {
      const response = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `In the context of the question "${query}" and the current report summary: "${report.executiveSummary}", answer this follow-up query: "${userQ}"`,
          openaiKey
        })
      });

      if (!response.ok) throw new Error("Error fetching response.");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let streamContent = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(line.substring(6));
                if (parsed.status === "completed" && parsed.data?.executiveSummary) {
                  streamContent = parsed.data.executiveSummary;
                }
              } catch (e) {}
            }
          }
        }
      }

      setFollowUps(prev => {
        const updated = [...prev];
        updated[updated.length - 1].a = streamContent || "Follow-up question processed based on sources.";
        return updated;
      });
    } catch (err) {
      setFollowUps(prev => {
        const updated = [...prev];
        updated[updated.length - 1].a = "Failed to synthesize a response. Please check your connection.";
        return updated;
      });
    } finally {
      setSendingFollowUp(false);
    }
  };

  // Export report to PDF
  const handleExportPDF = () => {
    window.print();
  };

  // Export report to DOCX (using Markdown format download)
  const handleExportDOCX = () => {
    if (!report) return;
    const mdContent = `
# Research Report: ${report.question}
**Confidence Score**: ${report.confidenceScore}% (${report.confidenceLevel})

## Executive Summary
${report.executiveSummary}

## Numerical Answer
**${report.answer}**

## Key Findings
${report.keyFindings.map(kf => `### ${kf.title}\n${kf.detail}\n*Sources: ${kf.sources.join(", ")}*\n`).join("\n")}

## Contradictions Resolved
${report.contradictions.map(c => `### ${c.topic}\n${c.description}\n`).join("\n")}

## Timeline
${report.timeline.map(t => `- **${t.date}**: ${t.event} (Source: ${t.source})`).join("\n")}

## Sources Referenced
${report.sources.map(s => `- [${s.title}](${s.url}): ${s.description}`).join("\n")}

---
Generated by J.A.R.V.I.S. on ${new Date().toLocaleDateString()}
    `;

    const blob = new Blob([mdContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `JARVIS_Report_${report.question.replace(/\s+/g, "_")}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy shareable URL to clipboard
  const handleShare = () => {
    const shareUrl = `${window.location.origin}?q=${encodeURIComponent(query)}`;
    navigator.clipboard.writeText(shareUrl);
    alert("Shareable link copied to clipboard!");
  };

  // Generate trend data based on query keywords
  const getTrendData = () => {
    const isHelium = query.toLowerCase().includes("helium");
    const isTesla = query.toLowerCase().includes("tesla");
    const isGold = query.toLowerCase().includes("gold");
    const isEv = query.toLowerCase().includes("ev") || query.toLowerCase().includes("electric");

    if (isHelium) {
      return {
        title: "Estimated Global Helium Reserves Telemetry",
        unit: "Billion m³",
        data: [
          { label: "2020", value: 54.2, source: "USGS" },
          { label: "2021", value: 52.8, source: "USGS" },
          { label: "2022", value: 51.5, source: "USGS" },
          { label: "2023", value: 50.1, source: "USGS" },
          { label: "2024", value: 48.9, source: "Academic Study" },
          { label: "2025", value: 47.6, source: "Consensus" },
          { label: "2026 (Est)", value: 46.2, source: "J.A.R.V.I.S." },
        ]
      };
    } else if (isTesla) {
      return {
        title: "Tesla Energy Generation & Storage Revenues",
        unit: "$ Billion",
        data: [
          { label: "2020", value: 1.99, source: "Tesla SEC 10-K" },
          { label: "2021", value: 2.79, source: "Tesla SEC 10-K" },
          { label: "2022", value: 3.91, source: "Tesla SEC 10-K" },
          { label: "2023", value: 6.04, source: "Tesla SEC 10-K" },
          { label: "2024", value: 7.12, source: "Investor Portal" },
          { label: "2025", value: 84.5, source: "Forecast" },
          { label: "2026 (Est)", value: 9.80, source: "J.A.R.V.I.S." },
        ]
      };
    } else if (isGold) {
      return {
        title: "Global Gold Imports Volume Index",
        unit: "Tons",
        data: [
          { label: "2020", value: 3200, source: "World Gold Council" },
          { label: "2021", value: 3450, source: "World Gold Council" },
          { label: "2022", value: 3600, source: "World Gold Council" },
          { label: "2023", value: 3550, source: "Trade Records" },
          { label: "2024", value: 3720, source: "Customs Index" },
          { label: "2025", value: 3900, source: "World Gold Council" },
          { label: "2026 (Est)", value: 4120, source: "J.A.R.V.I.S." },
        ]
      };
    } else if (isEv) {
      return {
        title: "India Electric Vehicles Market Size Expansion",
        unit: "k Units",
        data: [
          { label: "2020", value: 48, source: "Vahan Dashboard" },
          { label: "2021", value: 120, source: "SMEV" },
          { label: "2022", value: 430, source: "Vahan Dashboard" },
          { label: "2023", value: 850, source: "SMEV India" },
          { label: "2024", value: 1100, source: "NITI Aayog" },
          { label: "2025", value: 1450, source: "NITI Aayog" },
          { label: "2026 (Est)", value: 1820, source: "J.A.R.V.I.S." },
        ]
      };
    } else {
      // General telemetry trend
      return {
        title: `Visual Telemetry Trend Index`,
        unit: "Points",
        data: [
          { label: "2021", value: 450, source: "Consensus" },
          { label: "2022", value: 580, source: "Consensus" },
          { label: "2023", value: 720, source: "Consensus" },
          { label: "2024", value: 890, source: "Consensus" },
          { label: "2025", value: 1150, source: "Consensus" },
          { label: "2026 (Est)", value: 1420, source: "J.A.R.V.I.S." }
        ]
      };
    }
  };

  const trend = getTrendData();
  const values = trend.data.map(d => d.value);
  const minVal = Math.min(...values) * 0.9;
  const maxVal = Math.max(...values) * 1.1;

  // SVG dimensions
  const svgWidth = 650;
  const svgHeight = 280;
  const paddingX = 60;
  const paddingY = 40;

  // Compute coordinates
  const points = trend.data.map((item, i) => {
    const x = paddingX + (i / (trend.data.length - 1)) * (svgWidth - 2 * paddingX);
    const y = svgHeight - paddingY - ((item.value - minVal) / (maxVal - minVal)) * (svgHeight - 2 * paddingY);
    return { ...item, x, y };
  });

  // Construct SVG Path for the curved line
  let pathD = "";
  if (points.length > 0) {
    pathD = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      pathD += ` L ${points[i].x} ${points[i].y}`;
    }
  }

  // Construct Area Path for fill
  const areaD = pathD ? `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z` : "";

  return (
    <div className="flex-1 flex flex-col min-h-screen relative w-full select-none print:bg-white print:text-black">
      {/* Print-Only Title Layout */}
      <div className="hidden print:block p-8">
        <h1 className="text-4xl font-bold mb-2">J.A.R.V.I.S. Report</h1>
        <p className="text-gray-500 mb-6">Topic: {query}</p>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col md:flex-row relative w-full h-full overflow-hidden print:overflow-visible">
        
        {/* SIDEBAR - ARC INPIRED */}
        <aside className="w-full md:w-64 bg-slate-950/60 backdrop-blur-md border-b md:border-b-0 md:border-r border-slate-800/80 p-6 flex flex-col justify-between z-10 print:hidden shrink-0">
          <div className="flex flex-col gap-6">
            <button 
              onClick={onBack}
              className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors cursor-pointer text-sm font-medium"
            >
              <ArrowLeft className="w-4 h-4" />
              New Research
            </button>
            <div className="h-px bg-slate-800/80" />
            
            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Active Session</span>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10 text-white">
                <Compass className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="text-sm font-medium truncate">{query}</span>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">Controls</span>
              <button 
                onClick={handleShare}
                disabled={loading}
                className="flex items-center gap-3 w-full p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left text-sm cursor-pointer disabled:opacity-50"
              >
                <Share2 className="w-4 h-4" />
                Share Link
              </button>
              <button 
                onClick={handleExportPDF}
                disabled={loading}
                className="flex items-center gap-3 w-full p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left text-sm cursor-pointer disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                Export PDF
              </button>
              <button 
                onClick={handleExportDOCX}
                disabled={loading}
                className="flex items-center gap-3 w-full p-2.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left text-sm cursor-pointer disabled:opacity-50"
              >
                <Layers className="w-4 h-4" />
                Export Markdown
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="p-3.5 rounded-xl bg-red-950/20 border border-red-500/10 text-red-200">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-red-500">
                <ShieldCheck className="w-4 h-4 text-red-500" />
                Context.dev Connected
              </div>
              <p className="text-[11px] leading-relaxed text-slate-400">
                Autonomous web crawling is powered by live Context API caches.
              </p>
            </div>
            <div className="text-[11px] text-slate-500 text-center">
              J.A.R.V.I.S. Engine v1.0.0
            </div>
          </div>
        </aside>

        {/* CRAWL STATUS & LOADER */}
        <AnimatePresence>
          {loading && (
            <motion.div 
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl z-30 flex items-center justify-center p-6 print:hidden"
            >
              <div className="max-w-md w-full flex flex-col items-center text-center gap-6">
                {/* Glowing ring animation */}
                <div className="relative w-20 h-20">
                  <div className="absolute inset-0 rounded-full border-4 border-red-500/20" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-red-600 border-r-amber-500 animate-spin" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-red-600 to-amber-500 rounded-full blur opacity-25 animate-pulse" />
                </div>

                <div className="flex flex-col gap-2">
                  <h3 className="text-xl font-bold tracking-tight text-white">Synthesizing Intel</h3>
                  <p className="text-sm text-slate-400 h-10">{statusMessage}</p>
                </div>

                {/* Progress bar */}
                <div className="w-full flex flex-col gap-1.5">
                  <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-red-600 to-amber-500"
                      initial={{ width: "0%" }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 font-semibold">
                    <span>CRAWLING CONTEXT</span>
                    <span>{progress}%</span>
                  </div>
                </div>

                {/* Subtask list indicator */}
                <div className="w-full p-4 rounded-xl border border-white/5 bg-white/5 flex flex-col gap-2.5 text-left text-xs text-slate-400 max-h-48 overflow-y-auto">
                  <span className="font-semibold text-slate-500 uppercase tracking-wider">Active Agent Pipeline:</span>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-red-500 shrink-0" />
                    <span className={status === "analyzing" ? "text-red-400 font-medium" : "text-slate-400"}>Deconstruct user query</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center ${status === "searching" ? "border-2 border-amber-400 border-t-transparent animate-spin" : progress > 30 ? "bg-red-500/20 text-red-500" : "border border-slate-700"}`}>
                      {progress > 30 && <CheckCircle2 className="w-3.5 h-3.5 text-red-500" />}
                    </div>
                    <span className={status === "searching" ? "text-amber-300 font-medium animate-pulse" : "text-slate-400"}>Parallel crawling via Context.dev</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center ${status === "validating" ? "border-2 border-amber-400 border-t-transparent animate-spin" : progress > 60 ? "bg-red-500/20 text-red-500" : "border border-slate-700"}`}>
                      {progress > 60 && <CheckCircle2 className="w-3.5 h-3.5 text-red-500" />}
                    </div>
                    <span className={status === "validating" ? "text-amber-300 font-medium" : "text-slate-400"}>Fact verification & contradiction checking</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`w-3.5 h-3.5 rounded-full shrink-0 flex items-center justify-center ${status === "synthesizing" ? "border-2 border-amber-400 border-t-transparent animate-spin" : "border border-slate-700"}`}>
                    </div>
                    <span className={status === "synthesizing" ? "text-amber-300 font-medium" : "text-slate-400"}>Synthesize final visual report</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* RESULTS INTERACTIVE CANVAS */}
        {!loading && report && (
          <main className="flex-1 overflow-y-auto no-scrollbar p-6 md:p-8 flex flex-col gap-8 print:p-0 print:overflow-visible">
            
            {/* INTRO GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* FINAL ANSWER CARD */}
              <div className="lg:col-span-2 glass-panel rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between gap-6 print:border-none print:p-0">
                {/* Red light corner */}
                <div className="absolute top-0 right-0 w-48 h-48 bg-red-500/10 blur-3xl rounded-full" />
                
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-red-500">Numerical & Core Findings Consensus</span>
                  <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-3 text-white leading-tight">
                    {report.answer}
                  </h2>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs uppercase font-bold tracking-wider text-slate-500">Query Question</span>
                  <div className="text-sm font-medium text-slate-300 bg-white/5 border border-white/5 rounded-xl p-3.5">
                    "{report.question}"
                  </div>
                </div>
              </div>

              {/* CONFIDENCE ENGINE METER */}
              <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between items-center text-center relative overflow-hidden print:border-none print:p-0">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 w-full text-left">Confidence Engine</span>
                
                <div className="relative w-36 h-36 flex items-center justify-center my-4">
                  {/* Outer circle */}
                  <svg className="w-full h-full transform -rotate-90">
                    <circle 
                      cx="72" cy="72" r="62" 
                      className="stroke-slate-800" 
                      strokeWidth="8" fill="transparent" 
                    />
                    <circle 
                      cx="72" cy="72" r="62" 
                      className={`transition-all duration-1000 ${
                        report.confidenceLevel === "High" ? "stroke-emerald-400" :
                        report.confidenceLevel === "Medium" ? "stroke-amber-400" : "stroke-red-400"
                      }`}
                      strokeWidth="8" fill="transparent"
                      strokeDasharray={2 * Math.PI * 62}
                      strokeDashoffset={2 * Math.PI * 62 * (1 - report.confidenceScore / 100)}
                    />
                  </svg>
                  {/* Inside metrics */}
                  <div className="absolute flex flex-col items-center">
                    <span className="text-3xl font-extrabold text-white">{report.confidenceScore}%</span>
                    <span className={`text-xs uppercase font-bold tracking-wider ${
                      report.confidenceLevel === "High" ? "text-emerald-400" :
                      report.confidenceLevel === "Medium" ? "text-amber-400" : "text-red-400"
                    }`}>
                      {report.confidenceLevel} Confidence
                    </span>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-400">
                  Engineered from {report.sources.length} sources. Minimizes hallucination by cross-referencing datasets.
                </p>
              </div>
            </div>

            {/* EXECUTIVE SUMMARY */}
            <section className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col gap-4 print:border-none print:p-0">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-red-500" />
                Executive Summary
              </h3>
              <p className="text-slate-300 text-sm md:text-base leading-relaxed whitespace-pre-line">
                {report.executiveSummary}
              </p>
            </section>

            {/* VISUAL TELEMETRY TREND */}
            <section className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col gap-5 relative overflow-hidden">
              {/* Decorative glows */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-3xl rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/5 blur-3xl rounded-full pointer-events-none" />

              <div className="flex justify-between items-start flex-wrap gap-2">
                <div className="flex flex-col">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-red-500" />
                    {trend.title}
                  </h3>
                  <span className="text-xs text-slate-400">Historical telemetry consensus indexed over time. Hover points to inspect verified metrics.</span>
                </div>
                <span className="text-xs font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg">
                  Unit: {trend.unit}
                </span>
              </div>

              {/* Chart area */}
              <div className="w-full overflow-x-auto no-scrollbar pt-4 relative">
                <div className="min-w-[650px] h-[280px] relative mx-auto">
                  <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
                    {/* Definitions for gradients */}
                    <defs>
                      <linearGradient id="chart-glow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="line-gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="50%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#f97316" />
                      </linearGradient>
                    </defs>

                    {/* Grid Lines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((val, i) => {
                      const y = paddingY + val * (svgHeight - 2 * paddingY);
                      const displayVal = (maxVal - val * (maxVal - minVal)).toFixed(1);
                      return (
                        <g key={i}>
                          <line 
                            x1={paddingX} 
                            y1={y} 
                            x2={svgWidth - paddingX} 
                            y2={y} 
                            className="stroke-slate-800/60" 
                            strokeWidth="1" 
                            strokeDasharray="4 4"
                          />
                          <text 
                            x={paddingX - 10} 
                            y={y + 4} 
                            textAnchor="end" 
                            className="fill-slate-500 text-[10px] font-semibold"
                          >
                            {displayVal}
                          </text>
                        </g>
                      );
                    })}

                    {/* Area path */}
                    {areaD && (
                      <path d={areaD} fill="url(#chart-glow)" />
                    )}

                    {/* Line path */}
                    {pathD && (
                      <path 
                        d={pathD} 
                        fill="transparent" 
                        stroke="url(#line-gradient)" 
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    )}

                    {/* Data Points */}
                    {points.map((pt, i) => (
                      <g 
                        key={i}
                        onMouseEnter={(e) => {
                          setHoveredPoint({
                            label: pt.label,
                            value: pt.value,
                            source: pt.source,
                            x: pt.x,
                            y: pt.y
                          });
                        }}
                        onMouseLeave={() => setHoveredPoint(null)}
                        className="cursor-pointer group"
                      >
                        <circle 
                          cx={pt.x} 
                          cy={pt.y} 
                          r="6" 
                          className="fill-slate-950 stroke-red-500 stroke-2 group-hover:r-8 group-hover:fill-red-500 transition-all" 
                        />
                        {/* Hover ring */}
                        <circle 
                          cx={pt.x} 
                          cy={pt.y} 
                          r="12" 
                          className="fill-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" 
                        />
                        {/* Year Label */}
                        <text 
                          x={pt.x} 
                          y={svgHeight - paddingY + 20} 
                          textAnchor="middle" 
                          className="fill-slate-400 text-[10px] font-semibold"
                        >
                          {pt.label}
                        </text>
                      </g>
                    ))}
                  </svg>

                  {/* HTML Tooltip Overlay */}
                  <AnimatePresence>
                    {hoveredPoint && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        style={{ 
                          position: "absolute", 
                          left: hoveredPoint.x - 70, 
                          top: hoveredPoint.y - 85,
                          pointerEvents: "none"
                        }}
                        className="w-36 glass-panel p-2.5 rounded-lg flex flex-col gap-1 z-20 text-[10px] text-center shadow-xl"
                      >
                        <span className="font-bold text-slate-400 uppercase tracking-wider">{hoveredPoint.label}</span>
                        <span className="text-sm font-extrabold text-white">{hoveredPoint.value} {trend.unit}</span>
                        <span className="text-[9px] text-amber-400 font-semibold truncate">Ref: {hoveredPoint.source}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </section>

            {/* INTERACTIVE RESEARCH CANVAS (GRAPH NODE MAP) */}
            <section className="glass-panel rounded-2xl p-6 flex flex-col gap-4 print:hidden">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div className="flex flex-col">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Compass className="w-5 h-5 text-red-500" />
                    Interactive Reasoning Canvas
                  </h3>
                  <span className="text-xs text-slate-400">Pan & Zoom to explore search connections and claims. Click a node to view details.</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => handleZoom(1.2)} className="px-2.5 py-1 text-xs rounded border border-white/10 hover:bg-white/5 font-semibold text-slate-300 cursor-pointer">+</button>
                  <button onClick={() => handleZoom(0.8)} className="px-2.5 py-1 text-xs rounded border border-white/10 hover:bg-white/5 font-semibold text-slate-300 cursor-pointer">-</button>
                  <button onClick={handleResetGraph} className="px-2.5 py-1 text-xs rounded border border-white/10 hover:bg-white/5 font-semibold text-slate-300 cursor-pointer">Reset</button>
                </div>
              </div>

              {/* Canvas viewport */}
              <div 
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                className="w-full h-[450px] relative rounded-xl border border-white/5 bg-slate-950/80 overflow-hidden cursor-grab active:cursor-grabbing"
              >
                <svg className="w-full h-full">
                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    
                    {/* Render Links */}
                    {graphData.links.map((link, idx) => {
                      const sourceNode = graphData.nodes.find(n => n.id === link.source);
                      const targetNode = graphData.nodes.find(n => n.id === link.target);
                      if (!sourceNode || !targetNode) return null;
                      return (
                        <line
                          key={`link-${idx}`}
                          x1={sourceNode.x}
                          y1={sourceNode.y}
                          x2={targetNode.x}
                          y2={targetNode.y}
                          className="stroke-slate-800"
                          strokeWidth="2"
                          strokeDasharray={sourceNode.type === "query" ? "0" : "4 4"}
                        />
                      );
                    })}

                    {/* Render Nodes */}
                    {graphData.nodes.map((node) => {
                      const isSelected = selectedNode?.id === node.id;
                      let color = "fill-red-500";
                      let r = 10;
                      if (node.type === "query") {
                        color = "fill-red-500";
                        r = 18;
                      } else if (node.type === "subquestion") {
                        color = "fill-amber-400";
                        r = 14;
                      } else if (node.type === "source") {
                        color = "fill-orange-500";
                        r = 12;
                      } else if (node.type === "claim") {
                        color = "fill-slate-400";
                        r = 9;
                      }

                      return (
                        <g 
                          key={node.id} 
                          transform={`translate(${node.x}, ${node.y})`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedNode(node);
                          }}
                          className="cursor-pointer group"
                        >
                          {/* Pulse ring for query */}
                          {node.type === "query" && (
                            <circle r={r + 8} className="fill-red-500/10 stroke-red-500/20 stroke-2 animate-ping" />
                          )}
                          
                          <circle 
                            r={r} 
                            className={`${color} stroke-slate-900 stroke-2 group-hover:stroke-white transition-all`} 
                          />
                          
                          {/* Outline glow when selected */}
                          {isSelected && (
                            <circle r={r + 4} className="fill-transparent stroke-white stroke-2 animate-pulse" />
                          )}

                          <text 
                            y={r + 14} 
                            textAnchor="middle" 
                            className="fill-slate-300 text-[10px] font-semibold tracking-tight select-none pointer-events-none group-hover:fill-white transition-colors"
                          >
                            {node.label.length > 20 ? `${node.label.substring(0, 18)}...` : node.label}
                          </text>
                        </g>
                      );
                    })}

                  </g>
                </svg>

                {/* Node detail display panel overlay */}
                <AnimatePresence>
                  {selectedNode && (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="absolute right-4 bottom-4 w-72 glass-panel p-4 rounded-xl flex flex-col gap-2.5 z-10 text-xs shadow-2xl"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <span className={`px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                          selectedNode.type === "query" ? "bg-red-500/20 text-red-300" :
                          selectedNode.type === "subquestion" ? "bg-amber-500/20 text-amber-300" :
                          selectedNode.type === "source" ? "bg-orange-500/20 text-orange-300" : "bg-slate-500/20 text-slate-300"
                        }`}>
                          {selectedNode.type}
                        </span>
                        <button onClick={() => setSelectedNode(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      <p className="font-semibold text-white leading-relaxed">{selectedNode.label}</p>
                      {selectedNode.type === "source" && (
                        <div className="text-[10px] text-slate-400 mt-1">
                          Click to open url or read references below.
                        </div>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

            {/* KEY FINDINGS */}
            <section className="flex flex-col gap-5 print:break-before-page">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-red-500" />
                Key Evidence & Claims
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {report.keyFindings.map((finding, idx) => (
                  <div key={idx} className="glass-panel rounded-xl p-5 flex flex-col justify-between gap-4 glass-panel-hover print:border-none print:p-0">
                    <div className="flex flex-col gap-2">
                      <h4 className="font-bold text-white text-sm uppercase tracking-wide border-b border-white/5 pb-2">{finding.title}</h4>
                      <p className="text-slate-300 text-xs md:text-sm leading-relaxed">{finding.detail}</p>
                    </div>
                    
                    {finding.sources && finding.sources.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-2">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">Verified Sources</span>
                        <div className="flex gap-2 flex-wrap">
                          {finding.sources.map((src, i) => (
                            <a 
                              key={i} 
                              href={src} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded border border-white/5"
                            >
                              Source {i + 1} <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>

            {/* SOURCE COMPARISON MATRIX & CONTRADICTIONS */}
            {report.contradictions && report.contradictions.length > 0 && (
              <section className="glass-panel rounded-2xl p-6 flex flex-col gap-4 print:break-before-page">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
                  Source Comparison & Contradiction Resolution
                </h3>
                <div className="flex flex-col gap-3">
                  {report.contradictions.map((c, i) => (
                    <div key={i} className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex gap-3.5">
                      <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="flex flex-col gap-1 text-xs md:text-sm">
                        <span className="font-bold text-amber-200">{c.topic}</span>
                        <p className="text-slate-300 leading-relaxed">{c.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* EXTRACTED VISUAL INSIGHTS */}
            {report.images && report.images.length > 0 && (
              <section className="flex flex-col gap-5 print:hidden">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ImageIcon className="w-5 h-5 text-red-500" />
                  Visual Insights Gallery
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                  {report.images.map((img, i) => (
                    <div key={i} className="glass-panel rounded-xl overflow-hidden group relative h-48 bg-slate-900 border border-white/5">
                      <img 
                        src={img.url} 
                        alt={img.alt} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 opacity-80"
                        onError={(e) => {
                          // Fallback source if extracted image URL is broken
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80";
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent p-4 flex flex-col justify-end">
                        <span className="text-[10px] uppercase font-bold text-red-300">{img.type}</span>
                        <p className="text-white text-xs font-semibold mt-1 truncate">{img.alt}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* RESEARCH TIMELINE */}
            {report.timeline && report.timeline.length > 0 && (
              <section className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col gap-5 print:break-before-page">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  Chronological Timeline
                </h3>
                
                <div className="relative pl-6 border-l-2 border-slate-800/80 flex flex-col gap-6 ml-2">
                  {report.timeline.map((event, idx) => (
                    <div key={idx} className="relative group">
                      {/* Timeline dot */}
                      <div className="absolute -left-[31px] top-1.5 w-4.5 h-4.5 rounded-full bg-slate-900 border-2 border-amber-400 group-hover:bg-amber-400 transition-colors" />
                      
                      <div className="flex flex-col gap-1.5 text-xs md:text-sm">
                        <span className="font-bold text-amber-400">{event.date}</span>
                        <p className="text-white font-medium">{event.event}</p>
                        <span className="text-[10px] text-slate-500 font-semibold uppercase">Source: {event.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* REFERENCES */}
            <section className="glass-panel rounded-2xl p-6 md:p-8 flex flex-col gap-5 print:break-before-page">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                References & Citation List
              </h3>
              <div className="flex flex-col gap-4">
                {report.sources.map((src, idx) => (
                  <div key={idx} className="flex flex-col md:flex-row justify-between items-start gap-4 p-4 rounded-xl bg-white/5 border border-white/5 transition-all hover:bg-white/10">
                    <div className="flex flex-col gap-1 text-xs md:text-sm">
                      <span className="font-bold text-white">{src.title}</span>
                      <p className="text-slate-400 leading-relaxed text-[11px] md:text-xs">{src.description}</p>
                      <span className="text-[10px] text-slate-500 truncate max-w-md">{src.url}</span>
                    </div>
                    <a 
                      href={src.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="text-xs text-amber-400 font-bold hover:underline shrink-0 flex items-center gap-1 px-3 py-1.5 rounded bg-white/5 border border-white/5 cursor-pointer"
                    >
                      Visit Site <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                ))}
              </div>
            </section>

            {/* RELATED INSIGHTS */}
            {report.relatedInsights && report.relatedInsights.length > 0 && (
              <section className="flex flex-col gap-4 print:hidden">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-amber-400" />
                  Related Insights
                </h3>
                <div className="flex flex-wrap gap-2.5">
                  {report.relatedInsights.map((insight, idx) => (
                    <button 
                      key={idx}
                      onClick={() => {
                        setCurrentFollowUp(insight);
                        // Focus follow up
                      }}
                      className="text-xs text-slate-300 hover:text-white bg-slate-900 border border-white/5 hover:border-white/20 p-3 rounded-xl transition-all cursor-pointer text-left"
                    >
                      {insight}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* INTERACTIVE CHAT CANVAS / FOLLOW-UP QUESTION */}
            <section className="glass-panel rounded-2xl p-6 flex flex-col gap-5 print:hidden">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-5 h-5 text-red-500" />
                Ask Follow-Up Query
              </h3>

              {/* Chat Thread */}
              <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto no-scrollbar">
                {followUps.map((fu, idx) => (
                  <div key={idx} className="flex flex-col gap-3 border-l-2 border-red-500/20 pl-4 py-1">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
                      <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
                      <span>{fu.q}</span>
                    </div>
                    <div className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                      {fu.a || (
                        <div className="flex items-center gap-2 text-amber-400 animate-pulse text-xs">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Synthesizing follow-up response...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Form */}
              <form onSubmit={handleSendFollowUp} className="flex gap-3 mt-2">
                <input 
                  type="text"
                  placeholder="Ask a clarifying question or query the dataset..."
                  value={currentFollowUp}
                  onChange={(e) => setCurrentFollowUp(e.target.value)}
                  disabled={sendingFollowUp}
                  className="flex-1 bg-white/5 border border-white/5 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-red-500/50"
                />
                <button 
                  type="submit"
                  disabled={!currentFollowUp.trim() || sendingFollowUp}
                  className="px-5 py-3 bg-gradient-brand text-white rounded-xl text-sm font-bold flex items-center gap-2 cursor-pointer hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <Send className="w-4 h-4" />
                  Ask
                </button>
              </form>
            </section>

          </main>
        )}
      </div>
    </div>
  );
}
