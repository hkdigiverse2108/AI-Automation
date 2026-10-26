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
  const simVariablesRef = useRef({});
  const [currentNodeId, setCurrentNodeId] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [typing, setTyping] = useState(false);
  const [validationReport, setValidationReport] = useState({ passed: true, errors: [] });
  const messagesEndRef = useRef(null);

  // Helper to extract text from any node message structure
  const extractNodeText = (node) => {
    return (
      node.data?.message?.text ||
      node.data?.message?.body ||
      node.data?.message?.caption ||
      node.data?.prompt ||
      node.data?.text ||
      ''
    );
  };

  const isImageNode = (node) => {
    return (
      node.data?.message?.type === 'image' &&
      !!(node.data?.message?.assetKey || node.data?.message?.mediaUrl || node.data?.message?.caption)
    );
  };

  // Find the best matching edge based on user response
  const findMatchingEdge = (node, userText) => {
    if (!node.edges || node.edges.length === 0) return null;
    if (node.edges.length === 1) return node.edges[0];

    const cleanInput = String(userText || '').toLowerCase().trim();

    // 1. Exact match across comma-separated labels or condition values
    const exactMatch = node.edges.find(e => {
      const label = (e.label || '').toLowerCase();
      const condVal = (e.condition?.value || '').toLowerCase();
      const parts = label.split(',').map(s => s.trim());
      return parts.some(p => p === cleanInput) || condVal === cleanInput;
    });
    if (exactMatch) return exactMatch;

    // 2. Partial match
    const partialMatch = node.edges.find(e => {
      const label = (e.label || '').toLowerCase();
      const condVal = (e.condition?.value || '').toLowerCase();
      const parts = label.split(',').map(s => s.trim()).filter(Boolean);
      return parts.some(p => cleanInput.includes(p) || p.includes(cleanInput)) ||
             (condVal && cleanInput.includes(condVal));
    });
    if (partialMatch) return partialMatch;

    // 3. Default edge
    const defaultEdge = node.edges.find(e => {
      const label = (e.label || '').toLowerCase();
      return label.includes('default');
    });
    if (defaultEdge) return defaultEdge;

    // 4. Fallback to first edge
    return node.edges[0];
  };

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
      const nodeType = node.data?.nodeType || (node.type ? node.type.replace(/Node$/, '') : 'message');
      const textContent = extractNodeText(node);
      const isImg = isImageNode(node);

      // 1. Check for broken handles
      const targetEdges = flow.nodes.filter(n => n.edges && n.edges.some(e => e.targetNodeId === node.id));
      const hasParent = targetEdges.length > 0;
      const isEntry = node.id === flow.entryNodeId || node.id === flow.nodes[0]?.id;

      if (!hasParent && !isEntry) {
        errors.push(`Block [${nodeType}] (${node.id}) is orphaned (no incoming links).`);
      }

      // 2. Check for missing configuration
      if (nodeType === 'message' && !textContent && !isImg) {
        errors.push(`Message block (${node.id}) has empty text content.`);
      }
      if (nodeType === 'question') {
        const hasPrompt = !!textContent || isImg;
        if (!hasPrompt) {
          errors.push(`Question block (${node.id}) is missing the prompt text.`);
        }
      }
      if (nodeType === 'condition' && (!node.data?.condition?.variable || !node.data?.condition?.value)) {
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
    const nodeType = node.data?.nodeType || (node.type ? node.type.replace(/Node$/, '') : 'message');

    switch (nodeType) {
      case 'message': {
        setTyping(true);
        await sleep(800);
        setTyping(false);

        const rawText = extractNodeText(node);
        const parsedText = interpolateVars(rawText);
        addBotMessage(parsedText, {
          type: node.data?.message?.type,
          header: interpolateVars(node.data?.message?.header || ''),
          footer: interpolateVars(node.data?.message?.footer || ''),
          buttons: node.data?.message?.buttons,
          sections: node.data?.message?.sections
        });

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
          await sleep(800);
          setTyping(false);

          const rawText = extractNodeText(node);
          const parsedText = interpolateVars(rawText);
          addBotMessage(parsedText, {
            type: node.data?.message?.type,
            header: interpolateVars(node.data?.message?.header || ''),
            footer: interpolateVars(node.data?.message?.footer || ''),
            buttons: node.data?.message?.buttons,
            sections: node.data?.message?.sections
          });
          // Wait for user input
        } else {
          // Process user input
          const varName = node.data?.variable || 'temp_var';
          let finalVal = userMsgText;
          if (varName.toLowerCase().includes('phone') || varName.toLowerCase().includes('mobile')) {
            if (/same/i.test(userMsgText) || userMsgText.includes('આ જ નંબર') || userMsgText.includes('यही नंबर')) {
              finalVal = simVariablesRef.current['phone'] || simVariablesRef.current['sender_phone'] || '+91 98786 57877';
            }
          }
          const updatedVars = { ...simVariablesRef.current, [varName]: finalVal };
          simVariablesRef.current = updatedVars;
          setSimVariables(updatedVars);

          const nextEdge = findMatchingEdge(node, userMsgText);
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
    let result = text || '';
    const vars = {
      phone: '+91 98786 57877',
      sender_phone: '+91 98786 57877',
      ...simVariables,
      ...(simVariablesRef.current || {})
    };
    Object.entries(vars).forEach(([key, val]) => {
      result = result.replace(new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}|\\$\\{\\s*${key}\\s*\\}`, 'gi'), val);
    });
    return result;
  };

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

  const addBotMessage = (text, meta = null) => {
    setMessages(prev => [...prev, { sender: 'bot', text, meta, timestamp: new Date() }]);
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
    const initialVars = {
      phone: '+91 98786 57877',
      sender_phone: '+91 98786 57877'
    };
    simVariablesRef.current = initialVars;
    setSimVariables(initialVars);
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
    const nodeType = node?.data?.nodeType || (node?.type ? node.type.replace(/Node$/, '') : 'message');
    if (nodeType === 'question') {
      executeStep(currentNodeId, userText);
    } else {
      addSystemMessage('💡 Chatbot flow is currently executing action blocks. Input ignored.');
    }
  };

  const handleSelectOption = (optionTitle) => {
    if (!isSimulating) return;
    setMessages(prev => [...prev, { sender: 'user', text: optionTitle, timestamp: new Date() }]);
    setInputText('');

    const node = flow.nodes.find(n => n.id === currentNodeId);
    const nodeType = node?.data?.nodeType || (node?.type ? node.type.replace(/Node$/, '') : 'message');
    if (nodeType === 'question') {
      executeStep(currentNodeId, optionTitle);
    }
  };

  const handleReset = () => {
    setMessages([]);
    const initialVars = {
      phone: '+91 98786 57877',
      sender_phone: '+91 98786 57877'
    };
    simVariablesRef.current = initialVars;
    setSimVariables(initialVars);
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

                  {msg.meta?.header && (
                    <div className="font-bold text-[11px] text-emerald-600 dark:text-emerald-400 mb-1 border-b border-wa-border/30 pb-0.5">
                      {msg.meta.header}
                    </div>
                  )}

                  <span className="whitespace-pre-line">{msg.text}</span>

                  {msg.meta?.footer && (
                    <div className="text-[10px] text-gray-400 mt-1 italic">
                      {msg.meta.footer}
                    </div>
                  )}

                  {/* Interactive Button Options */}
                  {Array.isArray(msg.meta?.buttons) && msg.meta.buttons.length > 0 && (
                    <div className="mt-2.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                      {msg.meta.buttons.map((btn, bIdx) => {
                        const btnLabel = btn.text || btn.title || btn.label || btn.id || `Option ${bIdx + 1}`;
                        return (
                          <button
                            key={btn.id || bIdx}
                            onClick={() => handleSelectOption(btnLabel)}
                            disabled={!isSimulating}
                            className="w-full py-2 px-3 text-center text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/90 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-xl border border-emerald-300 dark:border-emerald-700/60 transition-all shadow-2xs hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <span>{btnLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Interactive List Sections */}
                  {Array.isArray(msg.meta?.sections) && msg.meta.sections.length > 0 && (
                    <div className="mt-2.5 pt-1.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                      {msg.meta.sections.flatMap((sec, secIdx) => (sec.rows || []).map((row, rIdx) => {
                        const rowLabel = row.title || row.text || row.id || `Option ${rIdx + 1}`;
                        return (
                          <button
                            key={`${secIdx}-${row.id || rIdx}`}
                            onClick={() => handleSelectOption(rowLabel)}
                            disabled={!isSimulating}
                            className="w-full text-left py-1.5 px-2.5 text-[11px] font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/70 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 hover:text-emerald-700 dark:hover:text-emerald-400 rounded-lg border border-slate-200 dark:border-slate-700/60 transition-all flex items-center justify-between gap-1 shadow-2xs hover:scale-[1.01]"
                          >
                            <span className="font-bold text-[10.5px] truncate">{rowLabel}</span>
                            {row.description && (
                              <span className="text-[9px] text-gray-400 dark:text-gray-500 truncate max-w-[110px]">{row.description}</span>
                            )}
                          </button>
                        );
                      }))}
                    </div>
                  )}
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
