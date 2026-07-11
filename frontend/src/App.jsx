import React, { useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  UploadCloud, 
  Bot, 
  Sparkles, 
  Layers, 
  GitBranch, 
  ArrowRight, 
  BookOpen, 
  Activity, 
  Play, 
  Check, 
  X, 
  ChevronRight, 
  ChevronDown, 
  Trash2, 
  HelpCircle, 
  RefreshCw, 
  Award, 
  Search,
  Scale,
  MessageSquare,
  Eye
} from 'lucide-react';
import confetti from 'canvas-confetti';
import './App.css';

// ==========================================
// FALLBACK DATASETS & DATABASES (IF OFFLINE)
// ==========================================

const API_BASE = "http://localhost:8000/api";

const INITIAL_DOCUMENTS = [
  {
    id: 'doc-1',
    name: 'Financial_Report_Q2_2026.pdf',
    size: '2.4 MB',
    date: '2026-07-10',
    status: 'INGESTED',
    pages: 14,
    content: `Executive Summary: Q2 2026 financial performance showed a 14% revenue increase quarter-over-quarter...`
  },
  {
    id: 'doc-2',
    name: 'AI_Safety_Policy_v4.pdf',
    size: '1.8 MB',
    date: '2026-07-11',
    status: 'INGESTED',
    pages: 8,
    content: `Safety Standards & Ethics Charter...`
  },
  {
    id: 'doc-3',
    name: 'Groq_Llama3_System_Architecture.txt',
    size: '940 KB',
    date: '2026-07-11',
    status: 'INGESTED',
    pages: 5,
    content: `System Architecture Specifications...`
  }
];

const INITIAL_CHATS = [
  {
    id: 'chat-1',
    title: 'Q2 2026 Profitability',
    messages: [
      { sender: 'user', text: 'What was our revenue growth in Q2 2026, and what drove it?' },
      { 
        sender: 'ai', 
        text: 'According to our financial records, the revenue in Q2 2026 increased by **14% quarter-over-quarter**, reaching a total of **$48.2 Million** [Doc-1, p. 1]. This growth was primarily driven by our cloud infrastructure intelligence suite and enterprise API integrations [Doc-1, p. 1]. In addition, we saw operating cost optimizations, including lowering infrastructure bills through Redis caching architectures [Doc-1, p. 2].',
        citations: [
          { id: 'cit-1', docId: 'doc-1', docName: 'Financial_Report_Q2_2026.pdf', page: 1, text: 'Q2 2026 financial performance showed a 14% revenue increase quarter-over-quarter, driven primarily by our cloud infrastructure intelligence suite and enterprise API integrations. Total Revenue: $48.2 Million.' },
          { id: 'cit-2', docId: 'doc-1', docName: 'Financial_Report_Q2_2026.pdf', page: 2, text: 'profitability improvements due to cost optimizations and Redis-based caching architectures which lowered API latency and infrastructure bills.' }
        ],
        steps: [
          { name: 'Query Parsing & Intent Routing', desc: 'Classified query as financial analytic. Router selected Doc-1 (Financial Report).' },
          { name: 'Hybrid Retrieval (Dense + Sparse)', desc: 'ChromaDB vector lookup (score: 0.88) + BM25 keyword query for "revenue growth, Q2 2026" (score: 1.45).' },
          { name: 'Reciprocal Rank Fusion (RRF)', desc: 'Fused lists. Top chunk: Financial_Report_Q2_2026.pdf [Page 1] ranked #1.' },
          { name: 'Cross-Encoder Reranking', desc: 'Reranked top 10 chunks. Relevance score of top chunk elevated to 0.94.' },
          { name: 'Llama 3.1 Generation', desc: 'Prompt constructed with context. Streaming output response containing citations.' }
        ]
      }
    ]
  }
];

const MOCK_SUMMARIES = {
  'doc-1': {
    exec: 'Detailed Q2 2026 financial analysis reporting 14% growth in quarterly revenues, landing at $48.2 Million. The business experienced positive operating margins due to cloud suite sales and database caching optimization.',
    sections: [
      { title: 'Revenue & Margins', bullets: ['Total Revenue of $48.2 Million represents a 14% QoQ increase.', 'Net Profit Margin reached 22.4% after optimization of technology overhead.', 'Primary drivers are Cloud Infrastructure Intelligence and B2B API Integrations.'] },
      { title: 'Operating Expenses', bullets: ['Research & Development stood at $12.4M to support ongoing agentic development.', 'Marketing expenditures reduced by 8% to $6.2M.', 'Hardware hosting expenses minimized by caching queries in Redis.'] },
      { title: 'Future Forecasts', bullets: ['Estimated Q3 revenues between $50M and $53M.', 'Emphasis on deploying financial multi-document agents next quarter.'] }
    ]
  }
};

const MOCK_FLASHCARDS = {
  'doc-1': [
    { term: 'Quarterly Revenue Growth', definition: '14% increase quarter-over-quarter, resulting in $48.2 Million in Q2 2026.' },
    { term: 'R&D Investment', definition: 'Expenditure of $12.4 Million dedicated to Agentic AI development.' },
    { term: 'Infrastructure Cost Control', definition: 'Implementing Redis-based caching architectures to lower API latency and reduce database hardware bills.' },
    { term: 'Net Margin', definition: '22.4% net profit margin, achieved through cost optimizations and cloud growth.' }
  ]
};

const MOCK_QUIZZES = {
  'doc-1': [
    {
      q: 'By what percentage did Q2 2026 revenue increase quarter-over-quarter?',
      options: ['8%', '14%', '22.4%', '30%'],
      answer: 1,
      exp: 'The report states: "Q2 2026 financial performance showed a 14% revenue increase quarter-over-quarter".'
    },
    {
      q: 'Which technology was credited with lowering API latency and database bills?',
      options: ['Redis Caching', 'ChromaDB indexes', 'Groq LPUs', 'Celery Workers'],
      answer: 0,
      exp: 'The document explicitly cites "Redis-based caching architectures which lowered API latency and infrastructure bills".'
    }
  ]
};

const DEFAULT_RAG_ANALYSIS = {
  query: 'search',
  denseResults: [
    { text: 'ChromaDB vector database hosting BAAI/bge-base-en-v1.5 embeddings...', source: 'Groq_Llama3_System_Architecture.txt', score: 0.72, parent: 'System Architecture Specifications: - Vector Database: ChromaDB, hosting BAAI/bge-base-en-v1.5 embeddings for fast cosine similarity scoring.' }
  ],
  sparseResults: [
    { text: 'ChromaDB vector database hosting BAAI/bge-base-en-v1.5 embeddings...', source: 'Groq_Llama3_System_Architecture.txt', score: 1.10 }
  ],
  rrfResults: [
    { rank: 1, doc: 'Groq_Llama3_System_Architecture.txt', text: 'ChromaDB vector database hosting BAAI/bge-base-en-v1.5 embeddings...', score: 0.033, beforeRank: { dense: 1, sparse: 1 } }
  ],
  crossEncoderResults: [
    { doc: 'Groq_Llama3_System_Architecture.txt', text: 'ChromaDB vector database hosting BAAI/bge-base-en-v1.5 embeddings...', final_score: 0.82 }
  ]
};

// ==========================================
// CORE APP IMPLEMENTATION
// ==========================================

function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Database States
  const [documents, setDocuments] = useState([]);
  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  
  // Drag and Drop State
  const [dragActive, setDragActive] = useState(false);
  
  // Celery Worker Monitor States
  const [celeryTasks, setCeleryTasks] = useState([]);
  const [workerLogs, setWorkerLogs] = useState([
    { time: '11:02:15', level: 'SYSTEM', msg: 'PostgreSQL Relational DB Connected.' },
    { time: '11:02:16', level: 'SYSTEM', msg: 'ChromaDB persistent vector storage online.' },
    { time: '11:02:16', level: 'SYSTEM', msg: 'Ready for background Celery worker connection...' }
  ]);
  
  // Chat Interface States
  const [messageInput, setMessageInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [activeCitation, setActiveCitation] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [expandedTraceIndex, setExpandedTraceIndex] = useState(null);
  
  // RAG Analyzer Sandbox States
  const [ragQuery, setRagQuery] = useState('revenue');
  const [ragResult, setRagResult] = useState(null);
  const [activeNode, setActiveNode] = useState('Query');
  
  // Document Compare States
  const [compareDocA, setCompareDocA] = useState('');
  const [compareDocB, setCompareDocB] = useState('');
  const [compareAnalysis, setCompareAnalysis] = useState(null);
  const [isComparing, setIsComparing] = useState(false);
  
  // Document Viewer States
  const [viewerDocId, setViewerDocId] = useState('');
  const [viewerData, setViewerData] = useState(null);
  const [isViewerLoading, setIsViewerLoading] = useState(false);
  const [viewerError, setViewerError] = useState(null);
  const [viewerSearch, setViewerSearch] = useState('');
  
  // Study Hub States
  const [studyDocId, setStudyDocId] = useState('');
  const [studyActiveTab, setStudyActiveTab] = useState('summary');
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardScores, setFlashcardScores] = useState({ correct: 0, incorrect: 0 });
  const [markedCards, setMarkedCards] = useState({});
  const [quizScore, setQuizScore] = useState(null);
  const [selectedQuizAnswers, setSelectedQuizAnswers] = useState({});
  const [showQuizExpl, setShowQuizExpl] = useState({});

  // Dynamic state overlays loaded from API
  const [studySummary, setStudySummary] = useState(null);
  const [studyFlashcards, setStudyFlashcards] = useState([]);
  const [studyQuizzes, setStudyQuizzes] = useState([]);

  // Chat scroll anchors
  const messagesEndRef = useRef(null);
  const logsEndRef = useRef(null);

  // Auto-scroll windows
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chats, isTyping, activeChatId]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollTop = logsEndRef.current.scrollHeight;
    }
  }, [workerLogs]);

  // Add line to celery log viewer
  const addLogLine = (level, msg) => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setWorkerLogs(prev => [...prev, { time, level, msg }]);
  };

  // ==========================================
  // API LOADERS (REAL DATABASE INTEGRATION)
  // ==========================================

  // Load documents lists from backend
  const fetchDocuments = async () => {
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const data = await res.json();
      if (data && data.length > 0) {
        setDocuments(data.map(d => ({
          id: d.id,
          name: d.name,
          size: d.size,
          date: d.upload_date ? d.upload_date.split('T')[0] : '',
          status: d.status,
          pages: d.pages
        })));
        // Auto-select files for comparison & context
        const ingestedIds = data.filter(d => d.status === 'INGESTED').map(d => d.id);
        setSelectedDocIds(ingestedIds);
        if (ingestedIds.length > 0) {
          if (!compareDocA) setCompareDocA(ingestedIds[0]);
          if (!compareDocB) setCompareDocB(ingestedIds[1] || ingestedIds[0]);
          if (!studyDocId) setStudyDocId(ingestedIds[0]);
        }
      } else {
        setDocuments([]);
      }
    } catch (err) {
      console.warn("Backend not active, defaulting to mock documents library.", err);
      setDocuments(INITIAL_DOCUMENTS);
      setSelectedDocIds(['doc-1', 'doc-2', 'doc-3']);
      setCompareDocA('doc-1');
      setCompareDocB('doc-3');
      setStudyDocId('doc-1');
    }
  };

  // Load chat sessions from backend
  const fetchChatSessions = async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/sessions`);
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const data = await res.json();
      if (data && data.length > 0) {
        const chatsList = [];
        for (const sess of data) {
          // Fetch messages for each session
          const msgRes = await fetch(`${API_BASE}/chat/sessions/${sess.id}/messages`);
          const msgData = await msgRes.json();
          chatsList.push({
            id: sess.id,
            title: sess.title,
            messages: msgData.map(m => ({
              sender: m.sender,
              text: m.text,
              citations: m.citations || [],
              steps: m.steps || []
            }))
          });
        }
        setChats(chatsList);
        setActiveChatId(chatsList[0].id);
      } else {
        // Create initial session if database is empty
        handleCreateChat();
      }
    } catch (err) {
      console.warn("Backend not active, loading mock chat memory.", err);
      setChats(INITIAL_CHATS);
      setActiveChatId(INITIAL_CHATS[0].id);
    }
  };

  // Fetch initial data on mount
  useEffect(() => {
    fetchDocuments();
    fetchChatSessions();
  }, []);

  // Poll progress for uploaded processing docs
  const pollDocStatus = (docId) => {
    const taskId = 'task-' + Math.random().toString(36).substr(2, 5);
    
    // Add active task visual in sidebar
    setCeleryTasks(prev => [...prev, { id: taskId, name: `ingest_doc:polling_${docId}`, progress: 20, status: 'PROGRESS' }]);
    addLogLine('INFO', `Dispatched ingestion task wrapper: Polling backend DB status for Doc ID: ${docId}`);

    let progressVal = 20;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/documents`);
        const data = await res.json();
        const doc = data.find(d => d.id === docId);
        
        if (doc) {
          progressVal = Math.min(progressVal + 25, 95);
          setCeleryTasks(prev => prev.map(t => t.name.includes(docId) ? { ...t, progress: progressVal } : t));
          
          if (doc.status === 'INGESTED') {
            clearInterval(interval);
            setDocuments(prev => prev.map(d => d.id === docId ? { 
              ...d, 
              status: 'INGESTED', 
              pages: doc.pages 
            } : d));
            
            setCeleryTasks(prev => prev.map(t => t.name.includes(docId) ? { ...t, progress: 100, status: 'SUCCESS' } : t));
            addLogLine('SUCCESS', `Task Success: Ingestion pipeline for ${doc.name} finished indexing successfully.`);
            
            setTimeout(() => {
              setCeleryTasks(prev => prev.filter(t => !t.name.includes(docId)));
            }, 3000);
          } else if (doc.status === 'ERROR') {
            clearInterval(interval);
            setDocuments(prev => prev.map(d => d.id === docId ? { ...d, status: 'ERROR' } : d));
            setCeleryTasks(prev => prev.filter(t => !t.name.includes(docId)));
            addLogLine('ERROR', `Task Failure: Ingestion parsing script failed for Doc ID: ${docId}. Check server log.`);
          }
        } else {
          clearInterval(interval);
          setCeleryTasks(prev => prev.filter(t => !t.name.includes(docId)));
        }
      } catch (err) {
        clearInterval(interval);
        setCeleryTasks(prev => prev.filter(t => !t.name.includes(docId)));
      }
    }, 2000);
  };

  // ==========================================
  // REAL API HANDLERS
  // ==========================================

  // Document Upload
  const handleIngestUpload = async (file) => {
    const sizeStr = (file.size / (1024 * 1024)).toFixed(1) + ' MB';
    addLogLine('INFO', `Uploading ${file.name} to FastAPI endpoints...`);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${API_BASE}/documents/upload`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const data = await res.json();
      
      // Append processing doc locally
      const newDoc = {
        id: data.id,
        name: file.name,
        size: sizeStr,
        date: new Date().toISOString().split('T')[0],
        status: 'PROCESSING',
        pages: 0
      };
      setDocuments(prev => [newDoc, ...prev]);
      
      // Poll document status
      pollDocStatus(data.id);
    } catch (err) {
      console.warn("FastAPI upload call failed. Running local client ingestion mock.", err);
      // Fallback local mock simulation
      handleMockIngestSimulation(file.name, sizeStr);
    }
  };

  // Mock Ingestion Fallback (if backend offline)
  const handleMockIngestSimulation = (fileName, fileSizeStr) => {
    const tempId = 'doc-mock-' + Math.random().toString(36).substr(2, 5);
    const mockDoc = {
      id: tempId,
      name: fileName,
      size: fileSizeStr,
      date: new Date().toISOString().split('T')[0],
      status: 'PROCESSING',
      pages: 6
    };
    setDocuments(prev => [mockDoc, ...prev]);
    
    // Simulates worker tasks
    let step = 0;
    const progressInterval = setInterval(() => {
      step += 20;
      setCeleryTasks(prev => {
        const list = prev.filter(t => t.id !== tempId);
        if (step < 100) {
          return [...list, { id: tempId, name: `ingest_doc:${fileName}`, progress: step, status: 'PROGRESS' }];
        }
        return list;
      });
      addLogLine('INFO', `[Local Mock Ingest] processing step: ${step}%`);

      if (step >= 100) {
        clearInterval(progressInterval);
        setDocuments(prev => prev.map(d => d.id === tempId ? { ...d, status: 'INGESTED' } : d));
        addLogLine('SUCCESS', `[Local Mock Ingest] Indexed successfully in client ChromaDB mock.`);
      }
    }, 1500);
  };

  // Document Delete
  const handleDeleteDoc = async (docId, docName) => {
    try {
      const res = await fetch(`${API_BASE}/documents/${docId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("HTTP error " + res.status);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      addLogLine('WARNING', `Document ${docName} deleted. Vectors removed from ChromaDB.`);
    } catch (err) {
      console.warn("Delete API failed. Removing document from local state.", err);
      setDocuments(prev => prev.filter(d => d.id !== docId));
    }
  };

  // Create Chat Session
  const handleCreateChat = async () => {
    try {
      const res = await fetch(`${API_BASE}/chat/sessions`, { method: "POST" });
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const data = await res.json();
      
      const newChat = {
        id: data.id,
        title: data.title,
        messages: [
          { sender: 'ai', text: "Hello! I am DocMind AI. Select the documents you'd like to context-query in the sidebar, and ask me anything about them! I can provide summaries, run searches, and cite pages." }
        ]
      };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(data.id);
      addLogLine('INFO', `Created session context: ${data.id}`);
    } catch (err) {
      // Mock session fallback
      const tempId = 'chat-mock-' + Date.now();
      const mockChat = {
        id: tempId,
        title: `Conversation ${chats.length + 1}`,
        messages: [{ sender: 'ai', text: "[Mock Mode] Backend down. Ready for queries." }]
      };
      setChats(prev => [mockChat, ...prev]);
      setActiveChatId(tempId);
    }
  };

  // Clear/Reset active conversation
  const handleResetConversation = async () => {
    if (!window.confirm("Are you sure you want to reset and clear all messages in this conversation?")) return;
    
    try {
      const res = await fetch(`${API_BASE}/chat/sessions/${activeChatId}/messages`, { method: "DELETE" });
      if (!res.ok) throw new Error("HTTP error " + res.status);
      
      setChats(prev => prev.map(c => c.id === activeChatId ? {
        ...c,
        messages: [
          { sender: 'ai', text: "Conversation cleared. Select documents in the sidebar and ask any new questions." }
        ]
      } : c));
      addLogLine('WARNING', `Cleared conversation memory context: ${activeChatId}`);
    } catch (err) {
      console.warn("Reset API failed. Clearing locally.", err);
      setChats(prev => prev.map(c => c.id === activeChatId ? {
        ...c,
        messages: [{ sender: 'ai', text: "Conversation cleared locally." }]
      } : c));
    }
  };

  // Delete specific conversation
  const handleDeleteConversation = async (sessId) => {
    if (!window.confirm("Are you sure you want to delete this conversation session?")) return;
    
    try {
      const res = await fetch(`${API_BASE}/chat/sessions/${sessId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("HTTP error " + res.status);
      
      const filteredChats = chats.filter(c => c.id !== sessId);
      setChats(filteredChats);
      addLogLine('WARNING', `Deleted conversation session: ${sessId}`);
      
      if (activeChatId === sessId) {
        if (filteredChats.length > 0) {
          setActiveChatId(filteredChats[0].id);
        } else {
          handleCreateChat();
        }
      }
    } catch (err) {
      console.warn("Delete session API failed. Removing locally.", err);
      const filteredChats = chats.filter(c => c.id !== sessId);
      setChats(filteredChats);
      if (activeChatId === sessId) {
        if (filteredChats.length > 0) {
          setActiveChatId(filteredChats[0].id);
        } else {
          const tempId = 'chat-mock-' + Date.now();
          const mockChat = {
            id: tempId,
            title: "Conversation 1",
            messages: [{ sender: 'ai', text: "[Mock Mode] Chat memory reset." }]
          };
          setChats([mockChat]);
          setActiveChatId(tempId);
        }
      }
    }
  };

  // Streaming Chat query (REAL SSE STREAMS)
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!messageInput.trim() || isTyping) return;

    const userText = messageInput;
    setMessageInput('');

    // Save user message in local state
    setChats(prev => prev.map(c => c.id === activeChatId ? {
      ...c,
      messages: [...c.messages, { sender: 'user', text: userText }]
    } : c));
    setIsTyping(true);

    try {
      const formData = new FormData();
      formData.append("session_id", activeChatId);
      formData.append("query", userText);
      formData.append("doc_ids_str", JSON.stringify(selectedDocIds));

      // Fetch SSE connection
      const response = await fetch(`${API_BASE}/chat/query`, {
        method: "POST",
        body: formData
      });

      if (!response.ok) throw new Error("HTTP error " + response.status);

      // Read SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      // Add empty placeholder message for typing
      setChats(prev => prev.map(c => c.id === activeChatId ? {
        ...c,
        messages: [...c.messages, { sender: 'ai', text: '', citations: [], steps: [] }]
      } : c));

      let aiText = "";
      let citations = [];
      let steps = [];

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const textBuffer = decoder.decode(value, { stream: true });
        const lines = textBuffer.split("\n");
        
        for (let line of lines) {
          line = line.trim();
          if (line.startsWith("data: ")) {
            try {
              const eventData = JSON.parse(line.substring(6));
              
              if (eventData.type === "meta") {
                citations = eventData.citations;
                steps = eventData.steps;
              } else if (eventData.type === "content") {
                aiText += eventData.text;
              }

              // Update state message in real time
              setChats(prev => prev.map(c => {
                if (c.id === activeChatId) {
                  const msgs = [...c.messages];
                  msgs[msgs.length - 1] = {
                    sender: 'ai',
                    text: aiText,
                    citations: citations,
                    steps: steps
                  };
                  return { ...c, messages: msgs };
                }
                return c;
              }));
            } catch (pErr) {
              // ignore partial line JSON parse errors
            }
          }
        }
      }
      setIsTyping(false);
      addLogLine('SUCCESS', `Llama 3.1 stream reading completed.`);
    } catch (err) {
      console.warn("RAG query API failed. Running local streaming simulation.", err);
      // Run fallback typing simulation
      handleMockTypingSimulation(userText);
    }
  };

  // Mock Typing Fallback (if backend offline)
  const handleMockTypingSimulation = (userText) => {
    let aiText = `This is a simulated response in mock mode. The FastAPI server could not be contacted at ${API_BASE}. To run with actual vector databases and LLM streaming, activate your Python virtual environment and start the uvicorn API.`;
    let citations = [{ id: 'cit-m', docId: 'mock', docName: 'LocalFallback.txt', page: 1, text: 'This text is generated by the client interface wrapper when the uvicorn backend fails to respond.' }];
    let steps = [
      { name: 'Connection Check', desc: 'Failed connection to FastAPI endpoint. Routed to client mock fallback.' },
      { name: 'Local Response compile', desc: 'Loaded fallback templates.' }
    ];

    setChats(prev => prev.map(c => c.id === activeChatId ? {
      ...c,
      messages: [...c.messages, { sender: 'ai', text: '', citations: [], steps: [] }]
    } : c));

    let index = 0;
    const interval = setInterval(() => {
      index += 5;
      const slice = aiText.substring(0, index);
      setChats(prev => prev.map(c => {
        if (c.id === activeChatId) {
          const msgs = [...c.messages];
          msgs[msgs.length - 1] = {
            sender: 'ai',
            text: slice,
            citations: index >= aiText.length ? citations : [],
            steps: index >= aiText.length ? steps : []
          };
          return { ...c, messages: msgs };
        }
        return c;
      }));
      
      if (index >= aiText.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 30);
  };

  // RAG Search Analyzer Endpoint
  const handleRagSearchSubmit = async (e) => {
    e.preventDefault();
    if (!ragQuery.trim()) return;

    addLogLine('INFO', `Calling Analyzer pipeline metrics for term: "${ragQuery}"`);
    try {
      const res = await fetch(`${API_BASE}/analyzer?query=${ragQuery}&doc_ids_str=${JSON.stringify(selectedDocIds)}`);
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const data = await res.json();
      
      setRagResult({
        query: data.query,
        denseChunks: data.dense_results,
        sparseChunks: data.sparse_results,
        rrf: data.rrf_results,
        crossEncoder: data.cross_encoder_results
      });
    } catch (err) {
      console.warn("Analyzer API failed. Yielding static analyzer mocks.", err);
      setRagResult(DEFAULT_RAG_ANALYSIS);
    }
  };

  // Load analyzer on first navigation
  useEffect(() => {
    if (activeTab === 'analyzer' && !ragResult) {
      // Simulate click
      const event = { preventDefault: () => {} };
      handleRagSearchSubmit(event);
    }
  }, [activeTab]);

  // Document Compare Endpoint
  const handleCompareSubmit = async () => {
    if (!compareDocA || !compareDocB) return;
    if (compareDocA === compareDocB) {
      alert("Please select two different documents to compare.");
      return;
    }

    setIsComparing(true);
    addLogLine('INFO', `Calling cross-document compare: Doc A: ${compareDocA} | Doc B: ${compareDocB}`);
    
    try {
      const formData = new FormData();
      formData.append("doc_a_id", compareDocA);
      formData.append("doc_b_id", compareDocB);
      
      const res = await fetch(`${API_BASE}/compare`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) throw new Error("HTTP error " + res.status);
      const data = await res.json();
      setCompareAnalysis(data);
    } catch (err) {
      console.warn("Compare API failed. Loading static compare metrics.", err);
      // Fallback mock comparison
      setTimeout(() => {
        setCompareAnalysis({
          titleA: documents.find(d => d.id === compareDocA)?.name || 'Doc A',
          titleB: documents.find(d => d.id === compareDocB)?.name || 'Doc B',
          similarities: "Mock Similarity: Both documents reside in the persistent databases.",
          differences: "Mock Differences: They represent different content scopes.",
          contradictions: "Mock Contradictions: None detected.",
          takeaway: "Activate backend services to run semantic comparison models."
        });
        setIsComparing(false);
      }, 1000);
      return;
    }
    setIsComparing(false);
  };

  // Load study items from API
  const loadStudyData = async () => {
    if (!studyDocId) return;
    try {
      const sumRes = await fetch(`${API_BASE}/study/summary/${studyDocId}`);
      const sumData = await sumRes.json();
      setStudySummary(sumData);

      const fcRes = await fetch(`${API_BASE}/study/flashcards/${studyDocId}`);
      const fcData = await fcRes.json();
      setStudyFlashcards(fcData);

      const qzRes = await fetch(`${API_BASE}/study/quiz/${studyDocId}`);
      const qzData = await qzRes.json();
      setStudyQuizzes(qzData);
      
      setFlashcardIndex(0);
      setIsFlipped(false);
      handleResetQuiz();
    } catch (err) {
      console.warn("Study API failed. Defaulting to mock items.", err);
      setStudySummary(MOCK_SUMMARIES[studyDocId] || MOCK_SUMMARIES['doc-1']);
      setStudyFlashcards(MOCK_FLASHCARDS[studyDocId] || MOCK_FLASHCARDS['doc-1']);
      setStudyQuizzes(MOCK_QUIZZES[studyDocId] || MOCK_QUIZZES['doc-1']);
    }
  };

  useEffect(() => {
    loadStudyData();
  }, [studyDocId]);

  // Fetch document full text for Viewer page
  const fetchViewerContent = async () => {
    if (!viewerDocId) return;
    setIsViewerLoading(true);
    setViewerError(null);
    try {
      const res = await fetch(`${API_BASE}/documents/${viewerDocId}/content`);
      if (!res.ok) throw new Error("Could not load document text content.");
      const data = await res.json();
      setViewerData(data);
    } catch (err) {
      console.warn("Failed to fetch doc content from backend.", err);
      // Fallback matching INITIAL_DOCUMENTS
      const docMatch = documents.find(d => d.id === viewerDocId) || INITIAL_DOCUMENTS.find(d => d.id === viewerDocId);
      if (docMatch) {
        setViewerData({
          name: docMatch.name,
          pages: docMatch.pages || 4,
          content: `--- Page 1 ---\nThis is fallback representation of ${docMatch.name}.\n\n[Fallback Content: Backend offline or raw file was removed]`
        });
      } else {
        setViewerError("Failed to connect to the backend server to extract document text.");
      }
    } finally {
      setIsViewerLoading(false);
    }
  };

  useEffect(() => {
    fetchViewerContent();
  }, [viewerDocId]);

  const handleViewDocumentContent = (docId) => {
    setViewerDocId(docId);
    setActiveTab('viewer');
  };

  // File selectors dropzone handle
  const handleDrag = (e) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleIngestUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleIngestUpload(e.target.files[0]);
    }
  };

  const handleFlashcardNav = (direction) => {
    setIsFlipped(false);
    setTimeout(() => {
      if (direction === 'next') {
        setFlashcardIndex(prev => (prev + 1) % studyFlashcards.length);
      } else if (direction === 'prev') {
        setFlashcardIndex(prev => (prev - 1 + studyFlashcards.length) % studyFlashcards.length);
      }
    }, 150);
  };

  const handleMarkCard = (index, status) => {
    setMarkedCards(prev => ({ ...prev, [`${studyDocId}-${index}`]: status }));
    if (status === 'correct') {
      setFlashcardScores(prev => ({ ...prev, correct: prev.correct + 1 }));
    } else {
      setFlashcardScores(prev => ({ ...prev, incorrect: prev.incorrect + 1 }));
    }
    handleFlashcardNav('next');
  };

  const handleResetFlashcards = () => {
    setFlashcardScores({ correct: 0, incorrect: 0 });
    setMarkedCards({});
    setFlashcardIndex(0);
    setIsFlipped(false);
  };

  const handleSelectQuizAnswer = (qIdx, optIdx) => {
    if (quizScore !== null) return;
    setSelectedQuizAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const handleGradeQuiz = () => {
    let correctCount = 0;
    studyQuizzes.forEach((q, idx) => {
      if (selectedQuizAnswers[idx] === q.answer) {
        correctCount++;
      }
    });

    setQuizScore(correctCount);
    const expls = {};
    studyQuizzes.forEach((_, idx) => { expls[idx] = true; });
    setShowQuizExpl(expls);

    addLogLine('SUCCESS', `Quiz completed: Score ${correctCount}/${studyQuizzes.length}`);

    confetti({
      particleCount: 120,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#6366f1', '#8b5cf6', '#10b981']
    });
  };

  const handleResetQuiz = () => {
    setQuizScore(null);
    setSelectedQuizAnswers({});
    setShowQuizExpl({});
  };

  const activeChat = chats.find(c => c.id === activeChatId) || { messages: [] };

  return (
    <div className="app-container">
      
      {/* ==========================================
          SIDEBAR NAVIGATION & MONITOR
          ========================================== */}
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <Bot className="logo-icon" />
          <h1>DocMind AI</h1>
        </div>

        <nav className="sidebar-menu">
          <div 
            className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            <Activity size={18} />
            Dashboard
          </div>
          <div 
            className={`menu-item ${activeTab === 'chat' ? 'active' : ''}`}
            onClick={() => setActiveTab('chat')}
          >
            <MessageSquare size={18} />
            Multi-Doc Chat
          </div>
          <div 
            className={`menu-item ${activeTab === 'analyzer' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyzer')}
          >
            <Layers size={18} />
            RAG Analyzer
          </div>
          <div 
            className={`menu-item ${activeTab === 'compare' ? 'active' : ''}`}
            onClick={() => setActiveTab('compare')}
          >
            <Scale size={18} />
            Doc Comparison
          </div>
          <div 
            className={`menu-item ${activeTab === 'viewer' ? 'active' : ''}`}
            onClick={() => setActiveTab('viewer')}
          >
            <Eye size={18} />
            Doc Viewer
          </div>
          <div 
            className={`menu-item ${activeTab === 'study' ? 'active' : ''}`}
            onClick={() => setActiveTab('study')}
          >
            <BookOpen size={18} />
            Study Hub
          </div>
        </nav>

        {/* Background worker monitor */}
        <div className="worker-monitor">
          <div className="monitor-header">
            <span>Ingestion Queue</span>
            <div className="monitor-status-dot"></div>
          </div>
          <div className="monitor-tasks">
            {celeryTasks.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontStyle: 'italic', textAlign: 'center', padding: '10px 0' }}>
                Workers Idle (Redis Broker Ready)
              </div>
            ) : (
              celeryTasks.map(t => (
                <div key={t.id} className="monitor-task-item">
                  <div className="monitor-task-meta">
                    <span className="monitor-task-name">{t.name}</span>
                    <span style={{ fontSize: '0.65rem', color: t.status === 'SUCCESS' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                      {t.progress}%
                    </span>
                  </div>
                  <div className="monitor-task-bar-container">
                    <div 
                      className="monitor-task-bar" 
                      style={{ 
                        width: `${t.progress}%`,
                        background: t.status === 'SUCCESS' ? 'var(--color-success)' : 'linear-gradient(90deg, var(--accent-primary), var(--accent-secondary))'
                      }}
                    ></div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* ==========================================
          MAIN VIEWPORT
          ========================================== */}
      <main className="main-viewport">
        
        {/* VIEW: DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Dashboard & Ingestion</h2>
              <p>Upload documentation to start Parent-Child chunking, BGE vector compilation, and ChromaDB/PostgreSQL indexing.</p>
            </div>

            <div className="dashboard-grid">
              
              <div className="dropzone-container">
                <div 
                  className={`dropzone ${dragActive ? 'active' : ''}`}
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  onClick={() => document.getElementById('file-upload-input').click()}
                >
                  <input 
                    type="file" 
                    id="file-upload-input" 
                    style={{ display: 'none' }} 
                    accept=".pdf,.docx,.txt"
                    onChange={handleFileSelect}
                  />
                  <UploadCloud className="dropzone-icon" />
                  <div className="dropzone-text">
                    <span>Click to browse</span> or drag and drop files here
                  </div>
                  <div className="dropzone-subtext">
                    Supports PDF, DOCX, TXT up to 20MB. Connected to active APIs.
                  </div>
                </div>

                <div className="glass-panel" style={{ overflow: 'hidden' }}>
                  <div className="panel-title-container">
                    <span className="panel-title">Indexed Documents ({documents.length})</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>ChromaDB Namespace: Default</span>
                  </div>
                  <div className="document-table-wrapper">
                    <table className="document-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Size</th>
                          <th>Chunks</th>
                          <th>Ingestion Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {documents.map(d => (
                          <tr key={d.id}>
                            <td className="doc-name-cell">
                              <FileText size={16} className="doc-icon" />
                              <span>{d.name}</span>
                            </td>
                            <td>{d.size}</td>
                            <td>{d.status === 'INGESTED' ? `${d.pages > 0 ? d.pages * 4 : 8} Chunks` : '--'}</td>
                            <td>
                              <span className={`badge ${d.status === 'INGESTED' ? 'success' : d.status === 'ERROR' ? 'danger' : 'warning'}`}>
                                {d.status === 'INGESTED' ? 'Ingested' : d.status === 'ERROR' ? 'Error' : 'Processing'}
                              </span>
                            </td>
                            <td>
                              {d.status === 'INGESTED' && (
                                <button 
                                  className="action-btn"
                                  onClick={() => handleViewDocumentContent(d.id)}
                                  title="Open document in Viewer"
                                  style={{ marginRight: '8px' }}
                                >
                                  <Eye size={15} />
                                </button>
                              )}
                              <button 
                                className="action-btn danger-btn"
                                onClick={() => handleDeleteDoc(d.id, d.name)}
                                title="Remove vector embeddings"
                              >
                                <Trash2 size={15} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Console logging */}
              <div className="celery-log-viewer">
                <div className="celery-log-header">
                  <div className="celery-log-header-text">
                    <Activity size={14} className="animate-spin" style={{ color: 'var(--color-success)' }} />
                    <span>Real-time System Logger</span>
                  </div>
                  <span className="badge info">Active</span>
                </div>
                <div className="celery-log-body" ref={logsEndRef}>
                  {workerLogs.map((log, index) => (
                    <div key={index} className={`log-line ${log.level.toLowerCase()}`}>
                      <span className="log-timestamp">[{log.time}]</span>
                      <span className="log-level">[{log.level}]</span>
                      <span className="log-msg">{log.msg}</span>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW: CHAT */}
        {activeTab === 'chat' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Multi-Document Chat Interface</h2>
              <p>Simulate conversation memory and RAG queries. Highlight specific document datasets to restrict source context.</p>
            </div>

            <div className="chat-container-layout">
              
              <aside className="chat-sidebar">
                <div className="glass-panel chat-doc-selector">
                  <span className="panel-title" style={{ fontSize: '0.9rem' }}>Select Chat Context</span>
                  <div className="chat-doc-list">
                    {documents.filter(d => d.status === 'INGESTED').map(d => (
                      <label key={d.id} className="chat-doc-checkbox">
                        <input 
                          type="checkbox" 
                          checked={selectedDocIds.includes(d.id)}
                          onChange={() => {
                            if (selectedDocIds.includes(d.id)) {
                              setSelectedDocIds(prev => prev.filter(id => id !== d.id));
                            } else {
                              setSelectedDocIds(prev => [...prev, d.id]);
                            }
                          }}
                        />
                        <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {d.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="glass-panel chat-history-panel">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className="panel-title" style={{ fontSize: '0.9rem' }}>Conversations</span>
                    <button 
                      className="glass-btn secondary" 
                      style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                      onClick={handleCreateChat}
                    >
                      New
                    </button>
                  </div>
                  <div className="chat-history-list">
                    {chats.map(c => (
                      <div 
                        key={c.id} 
                        className={`history-item ${activeChatId === c.id ? 'active' : ''}`}
                        onClick={() => setActiveChatId(c.id)}
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', paddingRight: '8px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <MessageSquare size={13} style={{ flexShrink: 0 }} />
                          <span>{c.title}</span>
                        </div>
                        <button 
                          className="action-btn danger-btn sidebar-del-btn"
                          style={{ padding: '2px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteConversation(c.id);
                          }}
                          title="Delete conversation"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="glass-panel chat-main-panel" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px', borderBottom: '1px solid var(--border-color)' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: '500', color: 'var(--text-secondary)' }}>
                    Active Chat Session Context
                  </span>
                  <button
                    className="glass-btn secondary"
                    style={{ padding: '3px 8px', fontSize: '0.75rem', borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}
                    onClick={handleResetConversation}
                    disabled={activeChat.messages.length <= 1}
                  >
                    Reset Chat
                  </button>
                </div>
                <div className="chat-messages-area" style={{ flex: 1 }}>
                  {activeChat.messages && activeChat.messages.map((m, idx) => (
                    <div key={idx} className={`message-wrapper ${m.sender === 'user' ? 'user' : 'ai'}`}>
                      <div className="message-avatar">
                        {m.sender === 'user' ? 'U' : <Bot size={18} />}
                      </div>
                      <div className="message-bubble">
                        <div style={{ whiteSpace: 'pre-line' }}>
                          {m.text}
                          
                          {m.citations && m.citations.length > 0 && (
                            <div style={{ marginTop: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', width: '100%' }}>Sources:</span>
                              {m.citations.map((c, cIdx) => (
                                <span 
                                  key={cIdx} 
                                  className="citation-ref"
                                  onClick={() => handleOpenCitation(c)}
                                >
                                  {c.docName.substring(0, 15)}... [p. {c.page}]
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {m.steps && m.steps.length > 0 && (
                          <div className="agent-execution-trace">
                            <div 
                              className="trace-trigger"
                              onClick={() => setExpandedTraceIndex(expandedTraceIndex === idx ? null : idx)}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <GitBranch size={12} style={{ color: 'var(--accent-primary)' }} />
                                <span>LangGraph Trace Pipeline Logs</span>
                              </div>
                              {expandedTraceIndex === idx ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </div>
                            
                            {expandedTraceIndex === idx && (
                              <div className="trace-details">
                                {m.steps.map((step, sIdx) => (
                                  <div key={sIdx} className="trace-step">
                                    <div className="trace-step-indicator">
                                      <div className="trace-dot completed"></div>
                                      <div className="trace-line"></div>
                                    </div>
                                    <div className="trace-step-info">
                                      <span className="trace-step-name">{step.name}</span>
                                      <span className="trace-step-desc">{step.desc}</span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {isTyping && (
                    <div className="message-wrapper ai">
                      <div className="message-avatar">
                        <Bot size={18} />
                      </div>
                      <div className="message-bubble" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)' }}>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Streaming responses from Llama 3.1...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <form onSubmit={handleSendMessage} className="chat-input-area">
                  <div className="chat-input-wrapper">
                    <input 
                      type="text" 
                      className="glass-input chat-text-input" 
                      placeholder="Ask a question about the document context (e.g., 'What is our Q2 revenue?')"
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      disabled={isTyping}
                    />
                    <button type="submit" className="glass-btn" disabled={isTyping}>
                      <span>Send</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* VIEW: RAG ANALYZER */}
        {activeTab === 'analyzer' && (
          <div className="view-container">
            <div className="view-header">
              <h2>RAG Retrieval Analyzer</h2>
              <p>Analyze vector similarity indices, BM25 scores, Reciprocal Rank Fusion blending, and Cross-Encoder outcomes.</p>
            </div>

            <div className="rag-layout">
              <form onSubmit={handleRagSearchSubmit} className="analyzer-search-box">
                <input 
                  type="text" 
                  className="glass-input" 
                  style={{ flex: 1 }}
                  placeholder="Enter search query (e.g. 'revenue', 'safety', 'architecture')"
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                />
                <button type="submit" className="glass-btn">
                  <Search size={16} />
                  <span>Analyze Search</span>
                </button>
              </form>

              <div className="pipeline-flowchart">
                <div 
                  className={`pipeline-node ${activeNode === 'Query' ? 'active' : ''}`}
                  onClick={() => setActiveNode('Query')}
                >
                  <span className="node-title">Query Vectorization</span>
                  <span className="node-subtitle">bge-base-en-v1.5</span>
                </div>
                <div className="pipeline-arrow">
                  <ArrowRight className="arrow-icon" />
                  <span className="arrow-text">Dual retrieve</span>
                </div>
                
                <div 
                  className={`pipeline-node ${activeNode === 'Retrieval' ? 'active' : ''}`}
                  onClick={() => setActiveNode('Retrieval')}
                >
                  <span className="node-title">Dense + Sparse Match</span>
                  <span className="node-subtitle">ChromaDB + BM25</span>
                </div>
                <div className="pipeline-arrow">
                  <ArrowRight className="arrow-icon" />
                  <span className="arrow-text">Merge rank</span>
                </div>

                <div 
                  className={`pipeline-node ${activeNode === 'RRF' ? 'active' : ''}`}
                  onClick={() => setActiveNode('RRF')}
                >
                  <span className="node-title">RRF Fusion</span>
                  <span className="node-subtitle">Reciprocal Rank score</span>
                </div>
                <div className="pipeline-arrow">
                  <ArrowRight className="arrow-icon" />
                  <span className="arrow-text">Rerank</span>
                </div>

                <div 
                  className={`pipeline-node ${activeNode === 'Rerank' ? 'active' : ''}`}
                  onClick={() => setActiveNode('Rerank')}
                >
                  <span className="node-title">Cross-Encoder</span>
                  <span className="node-subtitle">Context Reranker</span>
                </div>
                <div className="pipeline-arrow">
                  <ArrowRight className="arrow-icon" />
                  <span className="arrow-text">Inference</span>
                </div>

                <div 
                  className={`pipeline-node ${activeNode === 'Inference' ? 'active' : ''}`}
                  onClick={() => setActiveNode('Inference')}
                >
                  <span className="node-title">Llama 3.1 Prompt</span>
                  <span className="node-subtitle">Groq LPU Generation</span>
                </div>
              </div>

              {ragResult && (
                <div className="rag-sandbox-grid">
                  
                  <div className="glass-panel" style={{ padding: '24px' }}>
                    {activeNode === 'Query' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <span className="panel-title" style={{ color: 'var(--accent-primary)' }}>Query Vectorization Stage</span>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          The incoming user query string is processed. The API generates a 768-dimensional float array using the **BAAI/bge-base-en-v1.5 embeddings** model.
                        </p>
                        <div className="drawer-chunk-box" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                          Query: "{ragResult.query}" <br/>
                          Vector Output: [ 0.0418, -0.0125, 0.0924, -0.0781, 0.0053, ... +763 elements ]
                        </div>
                      </div>
                    )}

                    {activeNode === 'Retrieval' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        <span className="panel-title" style={{ color: 'var(--accent-primary)' }}>Hybrid Search Retrieval Matches</span>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Our system executes concurrent fetches: Dense embeddings search in **ChromaDB** and Token-matching sparse search using the **BM25 algorithm**.
                        </p>
                        <div>
                          <span className="drawer-label">Dense Vector Matches (ChromaDB Cosine similarity)</span>
                          {ragResult.denseChunks.map((c, idx) => (
                            <div key={idx} className="score-comparison-row" style={{ marginBottom: '6px' }}>
                              <span style={{ fontSize: '0.8rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '300px' }}>"{c.text.substring(0, 50)}..."</span>
                              <span className="badge success">{c.score} Score</span>
                            </div>
                          ))}
                        </div>
                        <div>
                          <span className="drawer-label">Sparse Keyword Matches (BM25 Score)</span>
                          {ragResult.sparseChunks.map((c, idx) => (
                            <div key={idx} className="score-comparison-row" style={{ marginBottom: '6px' }}>
                              <span style={{ fontSize: '0.8rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '300px' }}>"{c.text.substring(0, 50)}..."</span>
                              <span className="badge info">{c.score} Score</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeNode === 'RRF' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <span className="panel-title" style={{ color: 'var(--accent-primary)' }}>Reciprocal Rank Fusion (RRF) Ranking</span>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          Combines the rankings of sparse and dense queries into a single unified scale using the formula: <code style={{ fontSize: '11px' }}>Score = sum( 1 / (Rank_i + k) )</code> where k = 60.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {ragResult.rrf.map((r, idx) => (
                            <div key={idx} className="score-comparison-row">
                              <div className="score-col">
                                <span style={{ fontWeight: '500' }}>Rank #{r.rank}: {r.document_name || r.doc}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Vector rank: {r.beforeRank.dense} | BM25 rank: {r.beforeRank.sparse}</span>
                              </div>
                              <span className="badge success">Score: {r.rrf_score || r.score}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeNode === 'Rerank' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <span className="panel-title" style={{ color: 'var(--accent-primary)' }}>Cross-Encoder Context Reranker</span>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          The top retrieval candidates are evaluated against the query using a transformer-based **Cross-Encoder**. This models the full attention between query tokens and chunk tokens.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {ragResult.crossEncoder.map((c, idx) => (
                            <div key={idx} className="score-comparison-row">
                              <span style={{ fontSize: '0.8rem' }}>Chunk #{idx + 1} ({c.document_name || c.doc})</span>
                              <span className="badge success">CE Relevance: {c.final_score || c.finalScore}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeNode === 'Inference' && (
                      <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <span className="panel-title" style={{ color: 'var(--accent-primary)' }}>Groq Llama 3.1 Inference Compilation</span>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                          The final context window is populated with the reranked chunks and the original prompt instructions before streaming on Groq LPUs.
                        </p>
                        <div className="drawer-chunk-box" style={{ fontSize: '0.8rem', whiteSpace: 'pre-line' }}>
                          {`[SYSTEM PROMPT]
You are a citation-aware assistant. Respond strictly utilizing the context chunks below:

[CONTEXT]
1. Source: ${ragResult.crossEncoder[0]?.document_name || 'Document'}
Content: ${ragResult.crossEncoder[0]?.text || 'Context data'}

[USER QUERY]
${ragResult.query}`}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="glass-panel" style={{ padding: '24px' }}>
                    <span className="panel-title" style={{ display: 'block', marginBottom: '12px' }}>Parent-Child Chunk Expanders</span>
                    <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                      Small chunks (Child nodes) are used for vector matches to increase accuracy, but we expand context to larger blocks (Parent nodes) during LLM generation. Hover/Click chunks to inspect:
                    </p>
                    <div>
                      {ragResult.denseChunks.map((c, idx) => (
                        <div key={idx} className="chunk-card">
                          <div className="chunk-card-header">
                            <span className="chunk-card-title">Retrieved Matching Chunk #{idx + 1}</span>
                            <span className="badge info">{c.document_name || c.source}</span>
                          </div>
                          <div className="parent-child-visual">
                            <div className="parent-context">
                              <span className="drawer-label" style={{ fontSize: '0.65rem', color: 'var(--accent-secondary)' }}>Expanded Parent Context (Sent to Prompt)</span>
                              <div>... {c.parent_text || c.parent} ...</div>
                            </div>
                            <div className="child-context">
                              <span className="drawer-label" style={{ fontSize: '0.65rem', color: 'var(--accent-primary)' }}>Matching Child Embeddings Chunk (Found in ChromaDB)</span>
                              <div>{c.text}</div>
                            </div>
                          </div>
                          <div className="chunk-card-footer">
                            <span>Relevance: {c.score}</span>
                            <span>Page: {c.page}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW: COMPARE */}
        {activeTab === 'compare' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Split-Screen Document Compare</h2>
              <p>Compare raw content of two documents side-by-side and prompt AI to highlight common topics, discrepancies, and joint outcomes.</p>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div className="compare-selector-grid">
                <div className="compare-dropdown-wrapper">
                  <label>Select Document A</label>
                  <select 
                    className="compare-select"
                    value={compareDocA}
                    onChange={(e) => setCompareDocA(e.target.value)}
                  >
                    {documents.filter(d => d.status === 'INGESTED').map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="compare-dropdown-wrapper">
                  <label>Select Document B</label>
                  <select 
                    className="compare-select"
                    value={compareDocB}
                    onChange={(e) => setCompareDocB(e.target.value)}
                  >
                    {documents.filter(d => d.status === 'INGESTED').map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <button 
                  className="glass-btn" 
                  onClick={handleCompareSubmit}
                  disabled={isComparing}
                >
                  {isComparing ? (
                    <>
                      <RefreshCw className="animate-spin" size={16} />
                      <span>Comparing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={16} />
                      <span>Compare Alignment</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="compare-split-layout">
              <div className="glass-panel" style={{ overflow: 'hidden' }}>
                <div className="compare-column-header">
                  <FileText size={16} className="doc-icon" />
                  <span>A: {documents.find(d => d.id === compareDocA)?.name}</span>
                </div>
                <div className="compare-doc-viewer">
                  Uploaded File content indexed. Trigger Compare to compute comparison logs.
                </div>
              </div>

              <div className="glass-panel" style={{ overflow: 'hidden' }}>
                <div className="compare-column-header">
                  <FileText size={16} className="doc-icon" />
                  <span>B: {documents.find(d => d.id === compareDocB)?.name}</span>
                </div>
                <div className="compare-doc-viewer">
                  Uploaded File content indexed. Trigger Compare to compute comparison logs.
                </div>
              </div>
            </div>

            {compareAnalysis && (
              <div className="glass-panel compare-analysis-panel animate-fade-in">
                <span className="panel-title" style={{ color: 'var(--accent-primary)' }}>AI Comparison Analysis Report</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div className="comparison-point">
                    <span className="comparison-point-title">
                      <Check size={14} style={{ color: 'var(--color-success)' }} />
                      <span>Common Objectives & Themes</span>
                    </span>
                    <span className="comparison-point-desc">{compareAnalysis.similarities}</span>
                  </div>
                  <div className="comparison-point">
                    <span className="comparison-point-title">
                      <Scale size={14} style={{ color: 'var(--accent-primary)' }} />
                      <span>Structural & Thematic Differences</span>
                    </span>
                    <span className="comparison-point-desc">{compareAnalysis.differences}</span>
                  </div>
                  <div className="comparison-point">
                    <span className="comparison-point-title">
                      <X size={14} style={{ color: 'var(--color-danger)' }} />
                      <span>Discrepancies & Contradictions</span>
                    </span>
                    <span className="comparison-point-desc">{compareAnalysis.contradictions}</span>
                  </div>
                  <div className="comparison-point" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <span className="comparison-point-title" style={{ color: 'var(--accent-secondary)' }}>
                      <Sparkles size={14} />
                      <span>Joint Takeaway</span>
                    </span>
                    <span className="comparison-point-desc">{compareAnalysis.takeaway}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* VIEW: STUDY HUB */}
        {activeTab === 'study' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Study & Retention Hub</h2>
              <p>Review hierarchical summaries, self-test with flippable flashcards, and run quizzes to score comprehension.</p>
            </div>

            <div className="study-hub-layout">
              <div className="study-doc-select-bar">
                <span style={{ fontSize: '0.9rem', fontWeight: '500', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  Review Document:
                </span>
                <select 
                  className="compare-select"
                  style={{ width: '100%' }}
                  value={studyDocId}
                  onChange={(e) => setStudyDocId(e.target.value)}
                >
                  {documents.filter(d => d.status === 'INGESTED').map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="study-tabs-header">
                <button 
                  className={`study-tab ${studyActiveTab === 'summary' ? 'active' : ''}`}
                  onClick={() => setStudyActiveTab('summary')}
                >
                  AI Summaries
                </button>
                <button 
                  className={`study-tab ${studyActiveTab === 'flashcards' ? 'active' : ''}`}
                  onClick={() => setStudyActiveTab('flashcards')}
                >
                  Study Flashcards
                </button>
                <button 
                  className={`study-tab ${studyActiveTab === 'quiz' ? 'active' : ''}`}
                  onClick={() => setStudyActiveTab('quiz')}
                >
                  Comprehension Quiz
                </button>
              </div>

              <div className="study-content-area">
                
                {/* SUB TAB: SUMMARIES */}
                {studyActiveTab === 'summary' && studySummary && (
                  <div className="summary-container animate-fade-in">
                    <div className="glass-panel executive-summary-box">
                      <div className="summary-heading">Executive Summary</div>
                      <div className="summary-body">{studySummary.exec}</div>
                    </div>
                    {studySummary.sections && studySummary.sections.map((section, idx) => (
                      <div key={idx} className="glass-panel summary-section-card">
                        <div className="summary-heading">{section.title}</div>
                        <ul className="summary-bullet-list">
                          {section.bullets && section.bullets.map((b, bIdx) => (
                            <li key={bIdx} className="summary-bullet-item">{b}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {/* SUB TAB: FLASHCARDS */}
                {studyActiveTab === 'flashcards' && studyFlashcards && studyFlashcards.length > 0 && (
                  <div className="flashcards-layout animate-fade-in">
                    <div className="flashcard-wrapper">
                      <div 
                        className={`flashcard ${isFlipped ? 'flipped' : ''}`}
                        onClick={() => setIsFlipped(!isFlipped)}
                      >
                        <div className="flashcard-side flashcard-front">
                          <div className="flashcard-label">Term</div>
                          <div className="flashcard-text">
                            {studyFlashcards[flashcardIndex]?.term}
                          </div>
                          <div style={{ position: 'absolute', bottom: '20px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Click to flip
                          </div>
                        </div>

                        <div className="flashcard-side flashcard-back">
                          <div className="flashcard-label">Definition / Explanation</div>
                          <div className="flashcard-text" style={{ fontSize: '1.05rem', fontWeight: '400' }}>
                            {studyFlashcards[flashcardIndex]?.definition}
                          </div>
                          <div style={{ position: 'absolute', bottom: '20px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Click to flip back
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flashcard-controls">
                      <button 
                        className="glass-btn secondary"
                        onClick={() => handleFlashcardNav('prev')}
                      >
                        Prev
                      </button>
                      <span className="card-index-indicator">
                        {flashcardIndex + 1} / {studyFlashcards.length}
                      </span>
                      <button 
                        className="glass-btn secondary"
                        onClick={() => handleFlashcardNav('next')}
                      >
                        Next
                      </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>How did you do?</span>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <button 
                          className="glass-btn secondary" 
                          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)', padding: '6px 12px', fontSize: '0.85rem' }}
                          onClick={() => handleMarkCard(flashcardIndex, 'wrong')}
                        >
                          <X size={14} />
                          Incorrect
                        </button>
                        <button 
                          className="glass-btn secondary" 
                          style={{ borderColor: 'var(--color-success)', color: 'var(--color-success)', padding: '6px 12px', fontSize: '0.85rem' }}
                          onClick={() => handleMarkCard(flashcardIndex, 'correct')}
                        >
                          <Check size={14} />
                          Correct
                        </button>
                      </div>
                      <div className="flashcard-score-summary" style={{ marginTop: '12px', color: 'var(--text-muted)' }}>
                        <span>Correct: {flashcardScores.correct}</span>
                        <span>•</span>
                        <span>Incorrect: {flashcardScores.incorrect}</span>
                        <span>•</span>
                        <button 
                          style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', textDecoration: 'underline' }}
                          onClick={handleResetFlashcards}
                        >
                          Reset Score
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SUB TAB: QUIZZES */}
                {studyActiveTab === 'quiz' && studyQuizzes && studyQuizzes.length > 0 && (
                  <div className="quiz-container animate-fade-in">
                    
                    {quizScore === null ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="quiz-progress-bar-container">
                          <div 
                            className="quiz-progress-bar"
                            style={{ width: `${(Object.keys(selectedQuizAnswers).length / studyQuizzes.length) * 100}%` }}
                          ></div>
                        </div>

                        {studyQuizzes.map((q, qIdx) => (
                          <div key={qIdx} className="glass-panel quiz-card">
                            <span className="quiz-question">Q{qIdx + 1}: {q.q}</span>
                            <div className="quiz-options-list">
                              {q.options.map((opt, optIdx) => (
                                <button
                                  key={optIdx}
                                  className={`quiz-option-btn ${selectedQuizAnswers[qIdx] === optIdx ? 'selected' : ''}`}
                                  onClick={() => handleSelectQuizAnswer(qIdx, optIdx)}
                                >
                                  {opt}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}

                        <button 
                          className="glass-btn" 
                          style={{ alignSelf: 'flex-end', marginTop: '10px' }}
                          onClick={handleGradeQuiz}
                          disabled={Object.keys(selectedQuizAnswers).length < studyQuizzes.length}
                        >
                          <Award size={16} />
                          <span>Grade My Quiz</span>
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        <div className="glass-panel quiz-score-screen">
                          <div className="quiz-score-ring">
                            <span className="quiz-score-number">{quizScore} / {studyQuizzes.length}</span>
                            <span className="quiz-score-label">Graded Score</span>
                          </div>
                          <h2>
                            {quizScore === studyQuizzes.length 
                              ? 'Mastery Level!' 
                              : quizScore > 0 
                                ? 'Nice Attempt!' 
                                : 'Keep Studying!'}
                          </h2>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                            You answered {quizScore} out of {studyQuizzes.length} questions correctly. Review the explanations below.
                          </p>
                          <button className="glass-btn secondary" onClick={handleResetQuiz}>
                            <RefreshCw size={14} />
                            <span>Retake Quiz</span>
                          </button>
                        </div>

                        {studyQuizzes.map((q, qIdx) => {
                          const userAns = selectedQuizAnswers[qIdx];
                          const isCorrect = userAns === q.answer;

                          return (
                            <div key={qIdx} className="glass-panel quiz-card">
                              <span className="quiz-question" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {isCorrect 
                                  ? <Check size={18} style={{ color: 'var(--color-success)' }} /> 
                                  : <X size={18} style={{ color: 'var(--color-danger)' }} />
                                }
                                <span>Q{qIdx + 1}: {q.q}</span>
                              </span>
                              
                              <div className="quiz-options-list">
                                {q.options.map((opt, optIdx) => {
                                  let optClass = '';
                                  if (optIdx === q.answer) {
                                    optClass = 'correct';
                                  } else if (optIdx === userAns && !isCorrect) {
                                    optClass = 'wrong';
                                  }
                                  
                                  return (
                                    <button
                                      key={optIdx}
                                      className={`quiz-option-btn ${optClass}`}
                                      disabled
                                    >
                                      {opt}
                                    </button>
                                  );
                                })}
                              </div>

                              {showQuizExpl[qIdx] && (
                                <div className={`quiz-feedback-box ${isCorrect ? 'correct' : 'wrong'}`}>
                                  <div className="quiz-feedback-title">Explanation</div>
                                  <div>{q.exp}</div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                  </div>
                )}

              </div>
            </div>
          </div>
        )}

        {/* VIEW: DOCUMENT Viewer */}
        {activeTab === 'viewer' && (
          <div className="view-container">
            <div className="view-header">
              <h2>Document Text Viewer</h2>
              <p>Explore page-by-page extracted text content directly from the vector index store.</p>
            </div>

            <div className="glass-panel" style={{ padding: '20px' }}>
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', maxWidth: '600px' }}>
                <span style={{ fontSize: '0.95rem', fontWeight: '500', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  Select Document:
                </span>
                <select 
                  className="compare-select"
                  style={{ flex: 1 }}
                  value={viewerDocId}
                  onChange={(e) => setViewerDocId(e.target.value)}
                >
                  <option value="">-- Choose Ingested Document --</option>
                  {documents.filter(d => d.status === 'INGESTED').map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <button 
                  className="glass-btn secondary"
                  onClick={fetchViewerContent}
                  disabled={!viewerDocId || isViewerLoading}
                >
                  {isViewerLoading ? <RefreshCw className="animate-spin" size={14} /> : <RefreshCw size={14} />}
                  <span>Reload</span>
                </button>
              </div>
            </div>

            {viewerDocId ? (
              isViewerLoading ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw className="animate-spin" size={24} style={{ marginBottom: '12px', color: 'var(--accent-primary)' }} />
                  <div>Extracting document text pages from filesystem...</div>
                </div>
              ) : viewerError ? (
                <div className="glass-panel" style={{ padding: '30px', color: 'var(--color-danger)', borderLeft: '4px solid var(--color-danger)' }}>
                  <div>Error: {viewerError}</div>
                </div>
              ) : (
                <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div className="compare-column-header" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FileText size={16} className="doc-icon" />
                      <span>{viewerData?.name} ({viewerData?.pages} Pages)</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input 
                        type="text" 
                        className="glass-input"
                        placeholder="Search word..." 
                        style={{ padding: '4px 8px', fontSize: '0.8rem', width: '160px' }}
                        value={viewerSearch}
                        onChange={(e) => setViewerSearch(e.target.value)}
                      />
                      <button 
                        className="glass-btn secondary" 
                        style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                        onClick={() => {
                          if (viewerData?.content) {
                            navigator.clipboard.writeText(viewerData.content);
                            alert("Full text content copied to clipboard!");
                          }
                        }}
                      >
                        Copy Text
                      </button>
                    </div>
                  </div>
                  <div className="compare-doc-viewer" style={{ height: '500px', fontFamily: 'var(--font-sans)', whiteSpace: 'pre-line' }}>
                    {viewerSearch && viewerData?.content ? (
                      viewerData.content.split(new RegExp(`(${viewerSearch})`, 'gi')).map((chunk, cIdx) => 
                        chunk.toLowerCase() === viewerSearch.toLowerCase() 
                          ? <mark key={cIdx} style={{ background: '#f59e0b', color: 'black', borderRadius: '2px', padding: '0 2px' }}>{chunk}</mark> 
                          : chunk
                      )
                    ) : (
                      viewerData?.content
                    )}
                  </div>
                </div>
              )
            ) : (
              <div className="glass-panel" style={{ padding: '50px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <FileText size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
                <div>Select a document above or click "View" on any file in the Document table to open it here.</div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* CITATION DRAWER */}
      <div className={`citation-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3>Citation Reference Details</h3>
          <button 
            className="action-btn"
            onClick={() => setDrawerOpen(false)}
          >
            <X size={18} />
          </button>
        </div>
        
        {activeCitation && (
          <div className="drawer-body">
            <div className="drawer-block">
              <span className="drawer-label">Source Document</span>
              <span className="drawer-value" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500' }}>
                <FileText size={15} style={{ color: 'var(--accent-primary)' }} />
                {activeCitation.docName}
              </span>
            </div>

            <div className="drawer-block">
              <span className="drawer-label">Document Context Page</span>
              <span className="drawer-value">Page {activeCitation.page} of target index</span>
            </div>

            <div className="drawer-block">
              <span className="drawer-label">Matching Child Chunk (ChromaDB)</span>
              <div className="drawer-chunk-box child">
                "{activeCitation.text}"
              </div>
            </div>

            <div className="drawer-block">
              <span className="drawer-label">Expanded Parent Context (Llama Context Window)</span>
              <div className="drawer-chunk-box parent">
                ... {documents.find(d => d.id === activeCitation.docId)?.content || activeCitation.text} ...
              </div>
            </div>

            <div className="drawer-block">
              <span className="drawer-label">Retrieval Engine Relevance</span>
              <span className="drawer-score-badge">
                <Sparkles size={14} />
                <span>Blended RAG Match</span>
              </span>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

export default App;
