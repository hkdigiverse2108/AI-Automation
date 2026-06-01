'use client';
import { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { 
  MessageSquare, HelpCircle, GitFork, Activity, Clock, Bot, 
  UserCheck, Plus, Trash2, Save, Play, X, Settings,
  Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, Keyboard,
  GripVertical, Layers, UploadCloud, Loader2, Image
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { customNodeTypes } from './CustomBotNodes';
import api from '../lib/api';

// Available node type definitions with styling details
const NODE_TYPES_INFO = {
  message: { label: 'Send Message', icon: MessageSquare, color: '#10b981', bgClass: 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400', rfType: 'messageNode' },
  question: { label: 'Ask Question', icon: HelpCircle, color: '#3b82f6', bgClass: 'bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400', rfType: 'questionNode' },
  condition: { label: 'Condition', icon: GitFork, color: '#f59e0b', bgClass: 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400', rfType: 'conditionNode' },
  ai: { label: 'AI Agent', icon: Bot, color: '#8b5cf6', bgClass: 'bg-purple-50 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-400', rfType: 'aiNode' },
  delay: { label: 'Wait Delay', icon: Clock, color: '#ec4899', bgClass: 'bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800 text-pink-700 dark:text-pink-400', rfType: 'delayNode' },
  handoff: { label: 'Human Handoff', icon: UserCheck, color: '#ef4444', bgClass: 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400', rfType: 'handoffNode' }
};

// Maximum undo/redo history size
const MAX_HISTORY = 30;

export default function BotFlowCanvas({ flow, onSave }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  const [assets, setAssets] = useState([]);
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const handleUploadImageNode = async (file) => {
    if (!file || !flow?._id || flow?._id === 'new_flow') return;
    
    setUploadingImage(true);
    const toastId = toast.loading('Uploading and attaching image to block...');
    const formData = new FormData();
    formData.append('file', file);
    
    const customKey = `ATTACH_${Date.now()}`;
    formData.append('assetKey', customKey);

    try {
      const { data } = await api.post(`/media/bot/${flow._id}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        const asset = data.data.asset;
        toast.success('Image attached successfully!', { id: toastId });
        
        // Fetch fresh list of assets
        const assetsRes = await api.get(`/media/bot/${flow._id}`);
        if (assetsRes.data.success) {
          setAssets(assetsRes.data.assets);
        }

        // Update the selected node to image type
        const currentText = selectedNode?.data?.message?.text || selectedNode?.data?.message?.caption || '';
        handleUpdateNodeData('message', {
          type: 'image',
          assetKey: asset.assetKey,
          mediaUrl: asset.assetKey,
          caption: currentText,
          text: currentText
        });
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed', { id: toastId });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('image/')) {
        handleUploadImageNode(file);
      } else {
        toast.error('Only image files are allowed');
      }
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type.startsWith('image/')) {
        handleUploadImageNode(file);
      } else {
        toast.error('Only image files are allowed');
      }
    }
  };

  useEffect(() => {
    const fetchAssets = async () => {
      if (flow?._id && flow?._id !== 'new_flow') {
        try {
          const { data } = await api.get(`/media/bot/${flow._id}`);
          if (data.success) {
            setAssets(data.data.assets);
          }
        } catch (err) {
          console.error('Failed to fetch assets for picker:', err);
        }
      }
    };
    fetchAssets();
  }, [flow, selectedNode]);
  
  // Trigger config
  const [triggerType, setTriggerType] = useState('keyword');
  const [keywords, setKeywords] = useState('');

  // Undo/Redo history
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedo = useRef(false);

  // Save current state to history
  const pushHistory = useCallback((newNodes, newEdges) => {
    if (isUndoRedo.current) {
      isUndoRedo.current = false;
      return;
    }
    setHistory(prev => {
      const truncated = prev.slice(0, historyIndex + 1);
      const next = [...truncated, { nodes: JSON.parse(JSON.stringify(newNodes)), edges: JSON.parse(JSON.stringify(newEdges)) }];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  const handleUndo = useCallback(() => {
    if (historyIndex <= 0) return;
    isUndoRedo.current = true;
    const prev = history[historyIndex - 1];
    setNodes(prev.nodes);
    setEdges(prev.edges);
    setHistoryIndex(i => i - 1);
    toast('Undo', { icon: '↩️', duration: 1000 });
  }, [history, historyIndex, setNodes, setEdges]);

  const handleRedo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    isUndoRedo.current = true;
    const next = history[historyIndex + 1];
    setNodes(next.nodes);
    setEdges(next.edges);
    setHistoryIndex(i => i + 1);
    toast('Redo', { icon: '↪️', duration: 1000 });
  }, [history, historyIndex, setNodes, setEdges]);

  // Map backend model to React Flow representation
  useEffect(() => {
    if (flow) {
      setTriggerType(flow.trigger?.type || 'keyword');
      setKeywords(flow.trigger?.keywords?.join(', ') || '');
      
      if (flow.nodes && flow.nodes.length > 0) {
        const rfNodes = flow.nodes.map(n => {
          const info = NODE_TYPES_INFO[n.type] || NODE_TYPES_INFO.message;
          return {
            id: n.id,
            type: info.rfType,
            position: n.position || { x: 100, y: 100 },
            data: { 
              ...n.data, 
              nodeType: n.type, 
            },
          };
        });
        
        const rfEdges = [];
        flow.nodes.forEach(n => {
          if (n.edges) {
            n.edges.forEach((e, idx) => {
              rfEdges.push({
                id: `${n.id}-${e.targetNodeId}-${idx}`,
                source: n.id,
                target: e.targetNodeId,
                sourceHandle: e.sourceHandle || 'out',
                label: e.label || '',
                animated: true,
                style: { strokeWidth: 2, stroke: '#00a884' },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#00a884' }
              });
            });
          }
        });

        setNodes(rfNodes);
        setEdges(rfEdges);
        // Initialize history
        setHistory([{ nodes: JSON.parse(JSON.stringify(rfNodes)), edges: JSON.parse(JSON.stringify(rfEdges)) }]);
        setHistoryIndex(0);
      } else {
        const initialNode = {
          id: 'node_1',
          type: 'messageNode',
          position: { x: 250, y: 150 },
          data: { 
            nodeType: 'message', 
            message: { text: 'Hello! Thanks for reaching out.' },
          },
        };
        setNodes([initialNode]);
        setEdges([]);
        setHistory([{ nodes: [{ ...initialNode }], edges: [] }]);
        setHistoryIndex(0);
      }
    }
  }, [flow, setNodes, setEdges]);

  // Connect handler
  const onConnect = useCallback(
    (params) => {
      const edgeParams = {
        ...params,
        animated: true,
        style: { strokeWidth: 2, stroke: '#00a884' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#00a884' }
      };
      setEdges((eds) => {
        const next = addEdge(edgeParams, eds);
        pushHistory(nodes, next);
        return next;
      });
    },
    [setEdges, nodes, pushHistory]
  );

  // Add a new node to canvas
  const handleAddNode = (type) => {
    const newId = `node_${Date.now()}`;
    const info = NODE_TYPES_INFO[type];
    const newNode = {
      id: newId,
      type: info.rfType,
      position: { x: 300 + Math.random() * 100, y: 200 + Math.random() * 100 },
      data: {
        nodeType: type,
        message: { text: type === 'message' ? 'Hello text' : '' },
        variable: type === 'question' ? 'user_choice' : '',
        condition: type === 'condition' ? { variable: '', value: '' } : undefined,
        delaySeconds: type === 'delay' ? 60 : undefined,
        aiPrompt: type === 'ai' ? 'Respond to customer inquiry.' : undefined,
      },
    };
    setNodes((nds) => {
      const next = [...nds, newNode];
      pushHistory(next, edges);
      return next;
    });
    toast.success(`Added ${info.label} block`);
  };

  // Node Selection
  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  // Update selected node attributes
  const handleUpdateNodeData = (field, val) => {
    if (!selectedNode) return;
    
    setNodes((nds) => {
      const updated = nds.map((node) => {
        if (node.id === selectedNode.id) {
          const updatedNode = {
            ...node,
            data: {
              ...node.data,
              [field]: val
            }
          };
          setSelectedNode(updatedNode);
          return updatedNode;
        }
        return node;
      });
      pushHistory(updated, edges);
      return updated;
    });
  };

  // Delete Node
  const handleDeleteNode = (id) => {
    setNodes((nds) => {
      const next = nds.filter((node) => node.id !== id);
      setEdges((eds) => {
        const nextEdges = eds.filter((edge) => edge.source !== id && edge.target !== id);
        pushHistory(next, nextEdges);
        return nextEdges;
      });
      return next;
    });
    setSelectedNode(null);
    toast.success('Block deleted');
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      // Delete key
      if (e.key === 'Delete' && selectedNode) {
        handleDeleteNode(selectedNode.id);
        return;
      }
      // Ctrl+Z = Undo
      if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      // Ctrl+Shift+Z or Ctrl+Y = Redo
      if ((e.ctrlKey && e.shiftKey && e.key === 'z') || (e.ctrlKey && e.key === 'y')) {
        e.preventDefault();
        handleRedo();
        return;
      }
      // Ctrl+S = Save
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSaveFlow();
        return;
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [selectedNode, handleUndo, handleRedo]);

  // Map back to Mongoose Schema and save
  const handleSaveFlow = () => {
    const formattedNodes = nodes.map((node) => {
      const matchingEdges = edges.filter((e) => e.source === node.id);
      const subEdges = matchingEdges.map((e) => ({
        targetNodeId: e.target,
        label: e.label || '',
        sourceHandle: e.sourceHandle || 'out',
      }));

      return {
        id: node.id,
        type: node.data.nodeType,
        position: node.position,
        data: {
          message: node.data.message,
          variable: node.data.variable,
          condition: node.data.condition,
          action: node.data.action,
          delaySeconds: node.data.delaySeconds,
          aiPrompt: node.data.aiPrompt
        },
        edges: subEdges
      };
    });

    const trigger = {
      type: triggerType,
      keywords: keywords ? keywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean) : []
    };

    onSave({ trigger, nodes: formattedNodes });
  };

  // Fit view
  const handleFitView = () => {
    if (reactFlowInstance) {
      reactFlowInstance.fitView({ padding: 0.2, duration: 300 });
    }
  };

  return (
    <div className="flex h-[75vh] border border-wa-border dark:border-wa-dark-border rounded-2xl overflow-hidden bg-slate-50 dark:bg-[#0a1118] relative shadow-xl">
      {/* Node Palette Bar (Left) */}
      <div className="w-56 border-r border-wa-border dark:border-wa-dark-border bg-white dark:bg-[#111b21] p-4 shrink-0 flex flex-col justify-between h-full">
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-4 scrollbar-thin">
          <div>
            <h4 className="text-[10px] font-extrabold text-wa-text-secondary uppercase tracking-[0.12em] mb-2 flex items-center gap-1.5">
              <Settings className="w-3 h-3" /> Trigger Config
            </h4>
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-wa-text-light">Trigger Type</label>
              <select 
                value={triggerType} 
                onChange={(e) => setTriggerType(e.target.value)}
                className="w-full text-xs px-2.5 py-2 border border-wa-border dark:border-wa-dark-border bg-wa-search dark:bg-wa-dark-search rounded-lg focus:outline-none focus:ring-1 focus:ring-wa-green text-wa-text-primary dark:text-white"
              >
                <option value="keyword">Keywords Match</option>
                <option value="any">On First Inbound Message</option>
              </select>

              {triggerType === 'keyword' && (
                <div>
                  <label className="block text-[11px] font-semibold text-wa-text-light">Keywords list</label>
                  <input 
                    type="text" 
                    placeholder="hi, hello, menu"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 border border-wa-border dark:border-wa-dark-border bg-wa-search dark:bg-wa-dark-search rounded-lg mt-1 focus:outline-none focus:ring-1 focus:ring-wa-green text-wa-text-primary dark:text-white"
                  />
                  <p className="text-[9px] text-wa-text-light mt-0.5">Comma-separated</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-wa-border dark:border-wa-dark-border pt-3">
            <h4 className="text-[10px] font-extrabold text-wa-text-secondary uppercase tracking-[0.12em] mb-2.5 flex items-center gap-1.5">
              <Layers className="w-3 h-3" /> Flow Blocks
            </h4>
            <div className="grid grid-cols-1 gap-1.5">
              {Object.entries(NODE_TYPES_INFO).map(([key, item]) => {
                const Icon = item.icon;
                return (
                  <button
                    key={key}
                    onClick={() => handleAddNode(key)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 border rounded-xl text-left hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-semibold ${item.bgClass}`}
                  >
                    <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: item.color + '20' }}>
                      <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
                    </div>
                    <span>{item.label}</span>
                    <Plus className="w-3 h-3 ml-auto opacity-40" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Undo/Redo + Shortcuts */}
          <div className="border-t border-wa-border dark:border-wa-dark-border pt-3">
            <h4 className="text-[10px] font-extrabold text-wa-text-secondary uppercase tracking-[0.12em] mb-2 flex items-center gap-1.5">
              <Keyboard className="w-3 h-3" /> Actions
            </h4>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={handleUndo}
                disabled={historyIndex <= 0}
                className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[10px] font-semibold border border-wa-border dark:border-wa-dark-border text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover disabled:opacity-30 transition-all"
              >
                <Undo2 className="w-3.5 h-3.5" /> Undo
              </button>
              <button
                onClick={handleRedo}
                disabled={historyIndex >= history.length - 1}
                className="flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[10px] font-semibold border border-wa-border dark:border-wa-dark-border text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover disabled:opacity-30 transition-all"
              >
                <Redo2 className="w-3.5 h-3.5" /> Redo
              </button>
            </div>
            <button
              onClick={handleFitView}
              className="w-full mt-1.5 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-[10px] font-semibold border border-wa-border dark:border-wa-dark-border text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-all"
            >
              <Maximize2 className="w-3.5 h-3.5" /> Fit to View
            </button>
            <div className="mt-2 text-[9px] text-wa-text-light space-y-0.5">
              <p><kbd className="px-1 py-0.5 bg-wa-search dark:bg-wa-dark-search rounded text-[8px] font-mono">Ctrl+Z</kbd> Undo</p>
              <p><kbd className="px-1 py-0.5 bg-wa-search dark:bg-wa-dark-search rounded text-[8px] font-mono">Ctrl+Y</kbd> Redo</p>
              <p><kbd className="px-1 py-0.5 bg-wa-search dark:bg-wa-dark-search rounded text-[8px] font-mono">Ctrl+S</kbd> Save</p>
              <p><kbd className="px-1 py-0.5 bg-wa-search dark:bg-wa-dark-search rounded text-[8px] font-mono">Del</kbd> Delete node</p>
            </div>
          </div>
        </div>

        <button 
          onClick={handleSaveFlow}
          className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold"
        >
          <Save className="w-4 h-4" />
          <span>Save Builder Flow</span>
        </button>
      </div>

      {/* Main React Flow Canvas */}
      <div className="flex-1 h-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onInit={setReactFlowInstance}
          nodeTypes={customNodeTypes}
          snapToGrid={true}
          snapGrid={[16, 16]}
          fitView
          defaultEdgeOptions={{
            animated: true,
            style: { strokeWidth: 2, stroke: '#00a884' },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#00a884' },
          }}
        >
          <Controls 
            showInteractive={false}
            className="!bg-white dark:!bg-wa-dark-panel !border !border-wa-border dark:!border-wa-dark-border !rounded-xl !shadow-lg"
          />
          <MiniMap 
            nodeColor={(n) => {
              const type = n.data?.nodeType;
              return NODE_TYPES_INFO[type]?.color || '#64748b';
            }}
            maskColor="rgba(0,0,0,0.08)"
            className="!bg-white dark:!bg-wa-dark-panel !border !border-wa-border dark:!border-wa-dark-border !rounded-xl"
          />
          <Background color="#e2e8f0" gap={16} size={1} />
        </ReactFlow>
      </div>

      {/* Node info bar at bottom */}
      <div className="absolute bottom-3 left-60 right-3 flex items-center justify-between px-4 py-2 bg-white/90 dark:bg-[#111b21]/90 backdrop-blur-md border border-wa-border dark:border-wa-dark-border rounded-xl shadow-lg text-[10px] z-20">
        <div className="flex items-center gap-4 text-wa-text-secondary">
          <span className="font-bold">{nodes.length} <span className="font-normal">blocks</span></span>
          <span className="font-bold">{edges.length} <span className="font-normal">connections</span></span>
        </div>
        <div className="flex items-center gap-1 text-wa-text-light">
          <span>Snap: 16px grid</span>
          <span className="mx-1">·</span>
          <span>History: {historyIndex + 1}/{history.length}</span>
        </div>
      </div>

      {/* Editor Panel (Right Side Drawer Overlay) */}
      {selectedNode && (
        <div className="w-80 h-full border-l border-wa-border dark:border-wa-dark-border bg-white dark:bg-[#111b21] absolute right-0 top-0 z-30 shadow-2xl p-5 flex flex-col justify-between animate-slide-in overflow-y-auto">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b border-wa-border dark:border-wa-dark-border pb-3">
              <div className="flex items-center gap-2">
                {(() => {
                  const info = NODE_TYPES_INFO[selectedNode.data.nodeType];
                  const Icon = info?.icon || MessageSquare;
                  return (
                    <>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: (info?.color || '#64748b') + '15' }}>
                        <Icon className="w-4 h-4" style={{ color: info?.color || '#64748b' }} />
                      </div>
                      <span className="font-bold text-sm text-wa-text-primary dark:text-white capitalize">{selectedNode.data.nodeType} Block</span>
                    </>
                  );
                })()}
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
              >
                <X className="w-4 h-4 text-wa-text-secondary" />
              </button>
            </div>

            {/* MESSAGE type settings */}
            {selectedNode.data.nodeType === 'message' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Message Type</label>
                  <select
                    value={selectedNode.data.message?.type || 'text'}
                    onChange={(e) => {
                      const type = e.target.value;
                      handleUpdateNodeData('message', { 
                        type, 
                        mediaUrl: type === 'text' ? '' : (selectedNode.data.message?.mediaUrl || ''),
                        assetKey: type === 'text' ? '' : (selectedNode.data.message?.assetKey || ''),
                        caption: type === 'text' ? '' : (selectedNode.data.message?.caption || '')
                      });
                    }}
                    className="w-full text-xs px-2.5 py-2 border border-wa-border dark:border-wa-dark-border bg-wa-search dark:bg-wa-dark-search rounded-lg focus:outline-none text-wa-text-primary dark:text-white"
                  >
                    <option value="text">Outbound Text Message</option>
                    <option value="image">Image Attachment</option>
                  </select>
                </div>

                {selectedNode.data.message?.type === 'image' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Image Source Asset</label>
                      <select
                        value={selectedNode.data.message?.assetKey || ''}
                        onChange={(e) => {
                          const assetKey = e.target.value;
                          handleUpdateNodeData('message', { 
                            assetKey, 
                            mediaUrl: assetKey 
                          });
                        }}
                        className="w-full text-xs px-2.5 py-2 border border-wa-border dark:border-wa-dark-border bg-wa-search dark:bg-wa-dark-search rounded-lg focus:outline-none text-wa-text-primary dark:text-white font-mono"
                      >
                        <option value="">-- Choose Asset from Media Library --</option>
                        {assets.map(a => (
                          <option key={a._id} value={a.assetKey}>{a.assetKey} ({a.fileName})</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-wa-text-light mt-1">
                        Don't see your asset here? Upload it in the <span className="font-bold text-wa-green">Media Library</span> tab.
                      </p>
                    </div>

                    {/* Show preview of selected asset */}
                    {selectedNode.data.message?.assetKey && (
                      <div className="p-2 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search aspect-video flex items-center justify-center overflow-hidden">
                        {(() => {
                          const selectedAsset = assets.find(a => a.assetKey === selectedNode.data.message.assetKey);
                          if (selectedAsset) {
                            return <img src={selectedAsset.fileUrl} className="max-h-full object-contain" alt="preview" />;
                          }
                          return <span className="text-[10px] text-wa-text-light">Asset url resolving...</span>;
                        })()}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Image Caption</label>
                      <textarea
                        rows="3"
                        value={selectedNode.data.message?.caption || selectedNode.data.message?.text || ''}
                        onChange={(e) => handleUpdateNodeData('message', { caption: e.target.value, text: e.target.value })}
                        placeholder="Enter image caption body..."
                        className="w-full text-sm px-3 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-wa-green"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Message Text Copy</label>
                    <textarea
                      rows="4"
                      value={selectedNode.data.message?.text || ''}
                      onChange={(e) => handleUpdateNodeData('message', { text: e.target.value })}
                      placeholder="Enter message body copy..."
                      className="w-full text-sm px-3 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-wa-green"
                    />

                    {/* Premium Drag and Drop Image Attachment Box */}
                    <div className="mt-3">
                      <label className="block text-[10px] font-extrabold text-wa-text-secondary uppercase tracking-wider mb-1.5">
                        Attach Image
                      </label>
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                          border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200
                          ${dragActive 
                            ? 'border-wa-green bg-emerald-50/50 dark:bg-emerald-950/20 scale-[1.01]' 
                            : 'border-wa-border dark:border-wa-dark-border hover:border-wa-green hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
                          }
                        `}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        {uploadingImage ? (
                          <div className="flex flex-col items-center gap-2 text-wa-text-secondary">
                            <Loader2 className="w-6 h-6 text-wa-green animate-spin" />
                            <span className="text-[10px] font-bold">Uploading image file...</span>
                          </div>
                        ) : (
                          <>
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                              <UploadCloud className="w-5 h-5 text-wa-green" />
                            </div>
                            <div className="text-center">
                              <span className="text-[11px] font-bold text-wa-text-primary dark:text-white block">
                                Drag & drop image here
                              </span>
                              <span className="text-[9px] text-wa-text-light">
                                or click to select from computer
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Add a remove attachment button for image type message in Message drawer */}
                {selectedNode.data.message?.type === 'image' && (
                  <button
                    onClick={() => {
                      const currentText = selectedNode.data.message?.caption || selectedNode.data.message?.text || '';
                      handleUpdateNodeData('message', {
                        type: 'text',
                        text: currentText,
                        mediaUrl: '',
                        assetKey: '',
                        caption: ''
                      });
                    }}
                    className="w-full mt-2 py-2 flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-950/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-600 rounded-xl text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-4 h-4" /> Remove Image Attachment
                  </button>
                )}
              </div>
            )}

            {/* QUESTION type settings */}
            {selectedNode.data.nodeType === 'question' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Question Type</label>
                  <select
                    value={selectedNode.data.message?.type || 'text'}
                    onChange={(e) => {
                      const type = e.target.value;
                      handleUpdateNodeData('message', { 
                        type, 
                        mediaUrl: type === 'text' ? '' : (selectedNode.data.message?.mediaUrl || ''),
                        assetKey: type === 'text' ? '' : (selectedNode.data.message?.assetKey || ''),
                        caption: type === 'text' ? '' : (selectedNode.data.message?.caption || '')
                      });
                    }}
                    className="w-full text-xs px-2.5 py-2 border border-wa-border dark:border-wa-dark-border bg-wa-search dark:bg-wa-dark-search rounded-lg focus:outline-none text-wa-text-primary dark:text-white"
                  >
                    <option value="text">Outbound Text Question</option>
                    <option value="image">Image Attachment Question</option>
                  </select>
                </div>

                {selectedNode.data.message?.type === 'image' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Image Source Asset</label>
                      <select
                        value={selectedNode.data.message?.assetKey || ''}
                        onChange={(e) => {
                          const assetKey = e.target.value;
                          handleUpdateNodeData('message', { 
                            assetKey, 
                            mediaUrl: assetKey 
                          });
                        }}
                        className="w-full text-xs px-2.5 py-2 border border-wa-border dark:border-wa-dark-border bg-wa-search dark:bg-wa-dark-search rounded-lg focus:outline-none text-wa-text-primary dark:text-white font-mono"
                      >
                        <option value="">-- Choose Asset from Media Library --</option>
                        {assets.map(a => (
                          <option key={a._id} value={a.assetKey}>{a.assetKey} ({a.fileName})</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-wa-text-light mt-1">
                        Don't see your asset here? Upload it in the <span className="font-bold text-wa-green">Media Library</span> tab.
                      </p>
                    </div>

                    {/* Show preview of selected asset */}
                    {selectedNode.data.message?.assetKey && (
                      <div className="p-2 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search aspect-video flex items-center justify-center overflow-hidden">
                        {(() => {
                          const selectedAsset = assets.find(a => a.assetKey === selectedNode.data.message.assetKey);
                          if (selectedAsset) {
                            return <img src={selectedAsset.fileUrl} className="max-h-full object-contain" alt="preview" />;
                          }
                          return <span className="text-[10px] text-wa-text-light">Asset url resolving...</span>;
                        })()}
                      </div>
                    )}

                    <div>
                      <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Question Caption</label>
                      <textarea
                        rows="3"
                        value={selectedNode.data.message?.caption || selectedNode.data.message?.text || ''}
                        onChange={(e) => handleUpdateNodeData('message', { caption: e.target.value, text: e.target.value })}
                        placeholder="Enter question caption copy..."
                        className="w-full text-sm px-3 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Question Text Copy</label>
                    <textarea
                      rows="3"
                      value={selectedNode.data.message?.text || ''}
                      onChange={(e) => handleUpdateNodeData('message', { text: e.target.value })}
                      placeholder="Ask user a question..."
                      className="w-full text-sm px-3 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />

                    {/* Premium Drag and Drop Image Attachment Box */}
                    <div className="mt-3">
                      <label className="block text-[10px] font-extrabold text-wa-text-secondary uppercase tracking-wider mb-1.5">
                        Attach Image
                      </label>
                      <div
                        onDragEnter={handleDrag}
                        onDragOver={handleDrag}
                        onDragLeave={handleDrag}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`
                          border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-200
                          ${dragActive 
                            ? 'border-wa-green bg-emerald-50/50 dark:bg-emerald-950/20 scale-[1.01]' 
                            : 'border-wa-border dark:border-wa-dark-border hover:border-wa-green hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
                          }
                        `}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        {uploadingImage ? (
                          <div className="flex flex-col items-center gap-2 text-wa-text-secondary">
                            <Loader2 className="w-6 h-6 text-wa-green animate-spin" />
                            <span className="text-[10px] font-bold">Uploading image file...</span>
                          </div>
                        ) : (
                          <>
                            <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center">
                              <UploadCloud className="w-5 h-5 text-wa-green" />
                            </div>
                            <div className="text-center">
                              <span className="text-[11px] font-bold text-wa-text-primary dark:text-white block">
                                Drag & drop image here
                              </span>
                              <span className="text-[9px] text-wa-text-light">
                                or click to select from computer
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Add a remove attachment button for image type question in Question drawer */}
                {selectedNode.data.message?.type === 'image' && (
                  <button
                    onClick={() => {
                      const currentText = selectedNode.data.message?.caption || selectedNode.data.message?.text || '';
                      handleUpdateNodeData('message', {
                        type: 'text',
                        text: currentText,
                        mediaUrl: '',
                        assetKey: '',
                        caption: ''
                      });
                    }}
                    className="w-full mt-2 py-2 flex items-center justify-center gap-1.5 border border-red-200 dark:border-red-950/50 hover:bg-red-50 dark:hover:bg-red-950/20 text-red-500 hover:text-red-600 rounded-xl text-xs font-bold transition-all"
                  >
                    <Trash2 className="w-4 h-4" /> Remove Image Attachment
                  </button>
                )}

                <div>
                  <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Store Answer in Variable</label>
                  <input
                    type="text"
                    value={selectedNode.data.variable || ''}
                    onChange={(e) => handleUpdateNodeData('variable', e.target.value)}
                    placeholder="e.g. user_choice"
                    className="w-full text-sm px-3 py-1.5 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <p className="text-[9px] text-wa-text-light mt-1">This context variable can be used for downstream conditionals.</p>
                </div>
              </div>
            )}

            {/* CONDITION type settings */}
            {selectedNode.data.nodeType === 'condition' && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 rounded-xl text-xs text-amber-700 dark:text-amber-400 space-y-1">
                  <span className="font-bold block">Conditional Route Instructions:</span>
                  <p>Connect the <span className="font-bold text-emerald-600">TRUE</span> output to one path, and the <span className="font-bold text-red-500">FALSE</span> output to another.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Target Variable name</label>
                  <input
                    type="text"
                    value={selectedNode.data.condition?.variable || ''}
                    onChange={(e) => handleUpdateNodeData('condition', { 
                      variable: e.target.value, 
                      value: selectedNode.data.condition?.value || '' 
                    })}
                    placeholder="e.g. user_choice"
                    className="w-full text-sm px-3 py-1.5 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search text-wa-text-primary dark:text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Expected Matching Value</label>
                  <input
                    type="text"
                    value={selectedNode.data.condition?.value || ''}
                    onChange={(e) => handleUpdateNodeData('condition', { 
                      variable: selectedNode.data.condition?.variable || '', 
                      value: e.target.value 
                    })}
                    placeholder="e.g. yes"
                    className="w-full text-sm px-3 py-1.5 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search text-wa-text-primary dark:text-white focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* AI Prompt settings */}
            {selectedNode.data.nodeType === 'ai' && (
              <div>
                <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">AI Persona Prompt Settings</label>
                <textarea
                  rows="5"
                  value={selectedNode.data.aiPrompt || ''}
                  onChange={(e) => handleUpdateNodeData('aiPrompt', e.target.value)}
                  placeholder="e.g. You are a helpful booking assistant. Guide the user to schedule an appointment..."
                  className="w-full text-sm px-3 py-2 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            )}

            {/* DELAY settings */}
            {selectedNode.data.nodeType === 'delay' && (
              <div>
                <label className="block text-xs font-bold text-wa-text-secondary uppercase mb-1.5">Delay Duration (Seconds)</label>
                <input
                  type="number"
                  value={selectedNode.data.delaySeconds || 0}
                  onChange={(e) => handleUpdateNodeData('delaySeconds', parseInt(e.target.value) || 0)}
                  className="w-full text-sm px-3 py-1.5 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search text-wa-text-primary dark:text-white focus:outline-none"
                />
                <div className="mt-2 flex gap-2">
                  {[30, 60, 300, 3600].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => handleUpdateNodeData('delaySeconds', v)}
                      className="px-2 py-1 rounded-lg text-[10px] font-semibold border border-wa-border dark:border-wa-dark-border text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover transition-colors"
                    >
                      {v >= 3600 ? `${v / 3600}h` : v >= 60 ? `${v / 60}m` : `${v}s`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* HANDOFF settings */}
            {selectedNode.data.nodeType === 'handoff' && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-xl text-red-600 dark:text-red-400 space-y-1">
                <span className="text-xs font-bold block">Live Human Agent Transition</span>
                <p className="text-[11px] text-gray-600 dark:text-gray-300">
                  When execution reaches this node, the AI bot pauses, and status updates to "human". This will notify your team inbox.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => handleDeleteNode(selectedNode.id)}
            className="w-full py-2.5 border border-red-200 dark:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-colors mt-6"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Block</span>
          </button>
        </div>
      )}
    </div>
  );
}
