'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  Bot, Phone, Video, MoreVertical, Send, Smile, Paperclip, X,
  Play, Pause, RotateCcw, AlertTriangle, CheckCircle, Bug, Terminal
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function FlowSimulatorPanel({ flow, isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [simVariables, setSimVariables] = useState({});
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [typing, setTyping] = useState(false);
  const [validationReport, setValidationReport] = useState({ passed: true, errors: [] });
  const messagesEndRef = useRef(null);

  // Validate the flow design
  const validateFlow = () => {
    const errors = [];
    if (!flow || !flow.nodes || flow.nodes.length === 0) {
      errors.push('The flow has no nodes.');
      setValidationReport({ passed: false, errors });
      return;
    }

    const nodeIds = flow.nodes.map(n => n.id);

    flow.nodes.forEach(node => {
      // 1. Check for broken handles
      const targetEdges = flow.nodes.filter(n => n.edges && n.edges.some(e => e.targetNodeId === node.id));
      const hasParent = targetEdges.length > 0;
      const isEntry = node.id === flow.entryNodeId || node.id === flow.nodes[0]?.id;

      if (!hasParent && !isEntry) {
        errors.push(`Block [${node.data?.nodeType || node.type}] (${node.id}) is orphaned (no incoming links).`);
      }

      // 2. Check for missing configuration
      if (node.type === 'message' && !node.data?.message?.text) {
        errors.push(`Message block (${node.id}) has empty text content.`);
      }
      if (node.type === 'question' && (!node.data?.message?.text || !node.data?.variable)) {
        errors.push(`Question block (${node.id}) is missing the prompt or the store variable name.`);
      }
      if (node.type === 'condition' && (!node.data?.condition?.variable || !node.data?.condition?.value)) {
        errors.push(`Condition block (${node.id}) has unconfigured variable or matching value.`);
      }

      // 3. Infinite loop detection helper (simple circular reference check)
      if (node.edges && node.edges.some(e => e.targetNodeId === node.id)) {
        errors.push(`Node (${node.id}) is linked to itself, creating an infinite loop.`);
      }
    });

    setValidationReport({
      passed: errors.length === 0,
      errors
    });
  };

  useEffect(() => {
    if (flow) {
      validateFlow();
    }
  }, [flow]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typing]);

  // Execute a single step in the visual flow
  const executeStep = async (nodeId, userMsgText = null) => {
    if (!flow || !flow.nodes) return;
    
    let node = flow.nodes.find(n => n.id === nodeId);
    if (!node) {
      // Completed
      addSystemMessage('🏁 Chatbot Flow simulation completed successfully.');
      setIsSimulating(false);
      return;
    }

    setCurrentNodeId(node.id);
    const nodeType = node.data?.nodeType || node.type;

    switch (nodeType) {
      case 'message': {
        setTyping(true);
        await sleep(1000);
        setTyping(false);

        const parsedText = interpolateVars(node.data?.message?.text || '');
        addBotMessage(parsedText);

        const nextEdge = node.edges?.[0];
        if (nextEdge) {
          executeStep(nextEdge.targetNodeId);
        } else {
          executeStep(null);
        }
        break;
      }

      case 'question': {
        if (userMsgText === null) {
          // Send question prompt
          setTyping(true);
          await sleep(1000);
          setTyping(false);

          const parsedText = interpolateVars(node.data?.message?.text || '');
          addBotMessage(parsedText);
          // Wait for user input
        } else {
          // Process user input
          const varName = node.data?.variable || 'temp_var';
          setSimVariables(prev => ({
            ...prev,
            [varName]: userMsgText
          }));

          const nextEdge = node.edges?.[0];
          if (nextEdge) {
            executeStep(nextEdge.targetNodeId);
          } else {
            executeStep(null);
          }
        }
        break;
      }

      case 'condition': {
        setTyping(true);
        await sleep(600);
        setTyping(false);

        const cond = node.data?.condition;
        const currentVal = String(simVariables[cond?.variable] || '').toLowerCase().trim();
        const targetVal = String(cond?.value || '').toLowerCase().trim();
        const passes = currentVal.includes(targetVal);

        addSystemMessage(`🔍 Branch Evaluated: ${cond?.variable} ("${currentVal}") contains "${targetVal}"? → ${passes ? 'TRUE' : 'FALSE'}`);

        // React Flow edges maps true to index 0 and false to index 1
        const edge = passes 
          ? node.edges?.find(e => e.label === 'true' || e.condition?.branch === 'true') || node.edges?.[0]
          : node.edges?.find(e => e.label === 'false' || e.condition?.branch === 'false') || node.edges?.[1];

        if (edge) {
          executeStep(edge.targetNodeId);
        } else {
          executeStep(null);
        }
        break;
      }

      case 'delay': {
        const delaySec = node.data?.delaySeconds || 3;
        addSystemMessage(`⏱️ Delay active: Waiting for ${delaySec}s...`);
        setTyping(true);
        await sleep(delaySec * 1000);
        setTyping(false);

        const nextEdge = node.edges?.[0];
        if (nextEdge) {
          executeStep(nextEdge.targetNodeId);
        } else {
          executeStep(null);
        }
        break;
      }

      case 'ai': {
        setTyping(true);
        await sleep(1500);
        setTyping(false);

        addBotMessage(`🤖 [AI Persona Prompt Active]: Hello! I am analyzing your request based on custom system prompt: "${node.data?.aiPrompt?.substring(0, 40)}..."`);
        
        const nextEdge = node.edges?.[0];
        if (nextEdge) {
          executeStep(nextEdge.targetNodeId);
        } else {
          executeStep(null);
        }
        break;
      }

      case 'handoff': {
        setTyping(true);
        await sleep(800);
        setTyping(false);
        addBotMessage("Connecting you with a team member right now! ⚡ They'll be with you shortly.");
        addSystemMessage('⚠️ Human Takeover triggered. Bot suppressed.');
        setIsSimulating(false);
        break;
      }

      default:
        executeStep(null);
    }
  };

  const interpolateVars = (text) => {
    let result = text;
    Object.entries(simVariables).forEach(([key, val]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), val);
    });
    return result;
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const addBotMessage = (text) => {
    setMessages(prev => [...prev, { sender: 'bot', text, timestamp: new Date() }]);
  };

  const addSystemMessage = (text) => {
    setMessages(prev => [...prev, { sender: 'system', text, timestamp: new Date() }]);
  };

  const handleStartSimulation = () => {
    if (!validationReport.passed) {
      toast.error('Cannot simulate. Please resolve build errors first!');
      setIsDebugMode(true);
      return;
    }
    setMessages([]);
    setSimVariables({});
    setIsSimulating(true);
    const entryId = flow.entryNodeId || flow.nodes?.[0]?.id;
    executeStep(entryId);
  };

  const handleSend = () => {
    if (!inputText.trim() || !isSimulating) return;

    const userText = inputText.trim();
    setMessages(prev => [...prev, { sender: 'user', text: userText, timestamp: new Date() }]);
    setInputText('');

    // Advance simulator if we are waiting for a question reply
    const node = flow.nodes.find(n => n.id === currentNodeId);
    const nodeType = node?.data?.nodeType || node?.type;
    if (nodeType === 'question') {
      executeStep(currentNodeId, userText);
    } else {
      addSystemMessage('💡 Chatbot flow is currently executing action blocks. Input ignored.');
    }
  };

  const handleReset = () => {
    setMessages([]);
    setSimVariables({});
    setCurrentNodeId(null);
    setIsSimulating(false);
    toast.success('Simulator Reset');
  };

  if (!isOpen) return null;

  return (
    <div className="w-96 border-l border-wa-border dark:border-wa-dark-border bg-white dark:bg-wa-dark-panel h-full flex flex-col justify-between shrink-0 relative z-30 shadow-2xl overflow-hidden glass-card animate-slide-in">
      
      {/* Header */}
      <div className="p-4 border-b border-wa-border dark:border-wa-dark-border flex items-center justify-between bg-wa-bg dark:bg-wa-dark-header/40 shrink-0">
        <div className="flex items-center gap-2">
          <Phone className="w-4.5 h-4.5 text-wa-green animate-pulse" />
          <div>
            <h4 className="font-bold text-xs text-wa-text-primary dark:text-white">WABA Simulator Shell</h4>
            <span className="text-[9px] font-bold text-wa-green uppercase tracking-wide">Dynamic Sandbox</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsDebugMode(!isDebugMode)}
            className={`p-1.5 rounded-lg border transition-colors ${
              isDebugMode 
                ? 'bg-wa-green/10 text-wa-green border-wa-green/20' 
                : 'text-wa-text-secondary border-transparent hover:bg-wa-border dark:hover:bg-wa-dark-border'
            }`}
            title="Toggle Debug Mode"
          >
            <Bug className="w-4.5 h-4.5" />
          </button>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-wa-border dark:hover:bg-wa-dark-border text-wa-text-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Simulator Body */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#efeae2] dark:bg-slate-900 relative">
        <div className="absolute inset-0 wa-chat-bg opacity-[0.06] dark:opacity-[0.02] pointer-events-none z-0" />

        {/* Message Feed inside Phone shell */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 relative z-10 scrollbar-thin flex flex-col">
          
          {/* Controls overlay if not started */}
          {!isSimulating && messages.length === 0 && (
            <div className="my-auto text-center space-y-4 max-w-xs mx-auto p-6 bg-white/95 dark:bg-wa-dark-panel/95 rounded-2xl shadow-lg border border-wa-border dark:border-wa-dark-border animate-scale-up">
              <Bot className="w-10 h-10 text-wa-green mx-auto" />
              <div>
                <h5 className="font-bold text-xs text-wa-text-primary dark:text-white">Start Flow Simulation</h5>
                <p className="text-[10px] text-wa-text-secondary leading-relaxed mt-1">
                  Interact with your visual bot flow instantly to verify connections, conditions, and prompts.
                </p>
              </div>
              <button
                onClick={handleStartSimulation}
                className="w-full py-2.5 bg-wa-green hover:bg-wa-green-hover text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>Launch Simulator</span>
              </button>
            </div>
          )}

          {/* Active Logs Render */}
          {messages.map((msg, idx) => {
            if (msg.sender === 'system') {
              return (
                <div key={idx} className="flex justify-center my-1.5 select-none">
                  <span className="px-2.5 py-0.5 bg-white/80 dark:bg-wa-dark-header/80 border border-wa-border dark:border-wa-dark-border text-[9px] font-bold text-wa-text-secondary rounded-lg shadow-sm">
                    {msg.text}
                  </span>
                </div>
              );
            }

            const isBot = msg.sender === 'bot';
            return (
              <div key={idx} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                <div className={`relative max-w-[85%] rounded-2xl px-3 py-1.5 shadow-sm text-xs leading-relaxed border ${
                  isBot 
                    ? 'bg-white dark:bg-wa-dark-header border-wa-border/20 text-wa-text-primary dark:text-white rounded-tl-none' 
                    : 'bg-wa-bubble-out-bg dark:bg-wa-dark-bubble-out-bg border-wa-green/10 text-wa-text-primary dark:text-white rounded-tr-none'
                }`}>
                  {/* WhatsApp speech tail */}
                  <div className={`absolute top-0 w-2 h-2.5 overflow-hidden ${isBot ? '-left-[7px]' : '-right-[7px]'}`}>
                    <div className={`w-3.5 h-3.5 rotate-45 transform ${
                      isBot 
                        ? 'bg-white dark:bg-wa-dark-header border-t border-r border-wa-border/20 dark:border-wa-dark-border/10 origin-top-right' 
                        : 'bg-wa-bubble-out-bg dark:bg-wa-dark-bubble-out-bg origin-top-left'
                    }`} />
                  </div>
                  <span>{msg.text}</span>
                </div>
              </div>
            );
          })}

          {/* Typing Indicator */}
          {typing && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-wa-dark-header border border-wa-border/20 rounded-2xl rounded-tl-none px-3.5 py-2 shadow-sm flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-wa-text-secondary animate-bounce" />
                <span className="w-1.5 h-1.5 rounded-full bg-wa-text-secondary animate-bounce [animation-delay:0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-wa-text-secondary animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Debug / Validation Console Drawer */}
        {isDebugMode && (
          <div className="absolute inset-x-0 bottom-14 bg-slate-900 border-t border-slate-800 h-52 flex flex-col z-20 font-mono text-[10px] text-emerald-400 select-none animate-slide-up">
            
            {/* Debug Header */}
            <div className="p-2 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-slate-400 shrink-0 font-bold">
              <span className="flex items-center gap-1 text-[9px]"><Terminal className="w-3.5 h-3.5" /> DEBUG CONSOLE</span>
              <span className={validationReport.passed ? 'text-wa-green' : 'text-red-500'}>
                {validationReport.passed ? 'BUILD PASSED' : 'BUILD FAILURE'}
              </span>
            </div>

            {/* Debug Streams */}
            <div className="flex-1 p-3 overflow-y-auto space-y-2 scrollbar-thin">
              
              {/* Build Validation Report */}
              <div className="space-y-1">
                <span className="text-slate-400 font-bold">🔧 BUILD INTEGRITY REPORT:</span>
                {validationReport.errors.length === 0 ? (
                  <div className="text-wa-green flex items-center gap-1">✓ Flow build validated. No orphan links or infinite loops detected.</div>
                ) : (
                  validationReport.errors.map((err, idx) => (
                    <div key={idx} className="text-red-400 flex items-start gap-1">⚠️ {err}</div>
                  ))
                )}
              </div>

              {/* Variables Map */}
              {Object.keys(simVariables).length > 0 && (
                <div className="space-y-1 border-t border-slate-800 pt-1.5">
                  <span className="text-slate-400 font-bold">📂 DYNAMIC MEMORY VARIABLES:</span>
                  {Object.entries(simVariables).map(([k, v]) => (
                    <div key={k} className="pl-2">{k}: <span className="text-white">"{v}"</span></div>
                  ))}
                </div>
              )}

              {/* Active Block Highlight */}
              {currentNodeId && (
                <div className="border-t border-slate-800 pt-1.5 text-slate-400">
                  <span>Current Step ID: </span><span className="text-white">{currentNodeId}</span>
                </div>
              )}

            </div>
          </div>
        )}

        {/* Chat Input Shell */}
        <div className="px-3 py-2 bg-white dark:bg-wa-dark-header border-t border-wa-border dark:border-wa-dark-border flex items-center gap-2 relative z-10 shrink-0">
          <Smile className="w-5.5 h-5.5 text-wa-text-secondary cursor-not-allowed" />
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            disabled={!isSimulating}
            placeholder={isSimulating ? "Type a reply to the bot..." : "Simulator offline"}
            className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-wa-dark-panel border border-wa-border dark:border-wa-dark-border text-xs rounded-xl focus:outline-none placeholder-wa-text-light text-wa-text-primary dark:text-white"
          />
          <button 
            onClick={handleSend}
            disabled={!isSimulating || !inputText.trim()}
            className="w-8 h-8 rounded-full bg-wa-green hover:bg-wa-green-hover text-white flex items-center justify-center shrink-0 disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5 fill-white" />
          </button>
        </div>

      </div>

      {/* Simulator Footer controls */}
      <div className="p-3 border-t border-wa-border dark:border-wa-dark-border bg-slate-50 dark:bg-wa-dark-header/40 flex items-center justify-between shrink-0">
        <button
          onClick={handleStartSimulation}
          className="px-3 py-1.5 bg-wa-green hover:bg-wa-green-hover text-white text-[10px] font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all"
        >
          <Play className="w-3 h-3 fill-white" />
          <span>Reset & Start</span>
        </button>
        <button
          onClick={handleReset}
          className="px-3 py-1.5 border border-wa-border dark:border-wa-dark-border hover:bg-wa-bg dark:hover:bg-wa-dark-panel text-wa-text-secondary text-[10px] font-bold rounded-lg flex items-center gap-1 transition-all"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Reset</span>
        </button>
      </div>

    </div>
  );
}
