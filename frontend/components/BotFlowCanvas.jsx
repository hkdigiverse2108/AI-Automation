'use client';
import { useState, useCallback, useEffect } from 'react';
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
  UserCheck, Plus, Trash2, Save, Play, X, Settings
} from 'lucide-react';
import { toast } from 'react-hot-toast';

// Available node type definitions with styling details
const NODE_TYPES_INFO = {
  message: { label: 'Send Message', icon: MessageSquare, color: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450' },
  question: { label: 'Ask Question', icon: HelpCircle, color: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-450' },
  condition: { label: 'Condition Branch', icon: GitFork, color: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450' },
  ai: { label: 'AI Agent Prompt', icon: Bot, color: 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-450' },
  delay: { label: 'Wait Delay', icon: Clock, color: 'border-pink-500 bg-pink-50 dark:bg-pink-950/20 text-pink-700 dark:text-pink-450' },
  handoff: { label: 'Human Handoff', icon: UserCheck, color: 'border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-450' }
};

export default function BotFlowCanvas({ flow, onSave }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState(null);
  
  // Trigger config for the overall bot flow
  const [triggerType, setTriggerType] = useState('keyword');
  const [keywords, setKeywords] = useState('');

  // Map backend model to React Flow representation
  useEffect(() => {
    if (flow) {
      setTriggerType(flow.trigger?.type || 'keyword');
      setKeywords(flow.trigger?.keywords?.join(', ') || '');
      
      if (flow.nodes && flow.nodes.length > 0) {
        const rfNodes = flow.nodes.map(n => ({
          id: n.id,
          type: 'default',
          position: n.position || { x: 100, y: 100 },
          data: { 
            ...n.data, 
            nodeType: n.type, 
            label: (
              <div className="flex items-center gap-2 font-medium">
                {renderNodeIcon(n.type)}
                <span>{NODE_TYPES_INFO[n.type]?.label || n.type}</span>
              </div>
            ) 
          },
          style: {
            borderRadius: '12px',
            border: '2px solid',
            padding: '10px',
            fontSize: '12px',
            width: 180,
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
            borderColor: getBorderColor(n.type)
          }
        }));
        
        const rfEdges = [];
        flow.nodes.forEach(n => {
          if (n.edges) {
            n.edges.forEach((e, idx) => {
              rfEdges.push({
                id: `${n.id}-${e.targetNodeId}-${idx}`,
                source: n.id,
                target: e.targetNodeId,
                label: e.label || '',
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed }
              });
            });
          }
        });

        setNodes(rfNodes);
        setEdges(rfEdges);
      } else {
        // Create an entry point node if flow is empty
        const initialNode = {
          id: 'node_1',
          type: 'default',
          position: { x: 250, y: 150 },
          data: { 
            nodeType: 'message', 
            message: { text: 'Hello! Thanks for reaching out.' },
            label: (
              <div className="flex items-center gap-2 font-medium">
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                <span>Send Message</span>
              </div>
            )
          },
          style: { borderRadius: '12px', border: '2px solid #10b981', padding: '10px', fontSize: '12px', width: 180 }
        };
        setNodes([initialNode]);
        setEdges([]);
      }
    }
  }, [flow, setNodes, setEdges]);

  const renderNodeIcon = (type) => {
    const Icon = NODE_TYPES_INFO[type]?.icon || MessageSquare;
    return <Icon className="w-4 h-4" />;
  };

  const getBorderColor = (type) => {
    switch (type) {
      case 'message': return '#10b981';
      case 'question': return '#3b82f6';
      case 'condition': return '#f59e0b';
      case 'ai': return '#8b5cf6';
      case 'delay': return '#ec4899';
      case 'handoff': return '#ef4444';
      default: return '#64748b';
    }
  };

  // Connect handler
  const onConnect = useCallback(
    (params) => {
      // Add standard arrow markers to edges
      const edgeParams = {
        ...params,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed }
      };
      setEdges((eds) => addEdge(edgeParams, eds));
    },
    [setEdges]
  );

  // Add a new node to canvas
  const handleAddNode = (type) => {
    const newId = `node_${Date.now()}`;
    const newNode = {
      id: newId,
      type: 'default',
      position: { x: 300, y: 250 },
      data: {
        nodeType: type,
        message: { text: type === 'message' ? 'Hello text' : '' },
        variable: type === 'question' ? 'user_choice' : '',
        condition: type === 'condition' ? { variable: '', value: '' } : undefined,
        delaySeconds: type === 'delay' ? 60 : undefined,
        aiPrompt: type === 'ai' ? 'Respond to customer inquiry.' : undefined,
        label: (
          <div className="flex items-center gap-2 font-medium">
            {renderNodeIcon(type)}
            <span>{NODE_TYPES_INFO[type]?.label}</span>
          </div>
        )
      },
      style: {
        borderRadius: '12px',
        border: '2px solid',
        padding: '10px',
        fontSize: '12px',
        width: 180,
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
        borderColor: getBorderColor(type)
      }
    };
    setNodes((nds) => [...nds, newNode]);
    toast.success(`Added ${NODE_TYPES_INFO[type]?.label} block`);
  };

  // Node Selection
  const onNodeClick = (event, node) => {
    setSelectedNode(node);
  };

  // Update selected node attributes
  const handleUpdateNodeData = (field, val) => {
    if (!selectedNode) return;
    
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === selectedNode.id) {
          const updatedNode = {
            ...node,
            data: {
              ...node.data,
              [field]: val
            }
          };
          // Sync changes in editor panel
          setSelectedNode(updatedNode);
          return updatedNode;
        }
        return node;
      })
    );
  };

  // Delete Node
  const handleDeleteNode = (id) => {
    setNodes((nds) => nds.filter((node) => node.id !== id));
    setEdges((eds) => eds.filter((edge) => edge.source !== id && edge.target !== id));
    setSelectedNode(null);
    toast.success('Block deleted');
  };

  // Map back to Mongoose Schema and save
  const handleSaveFlow = () => {
    const formattedNodes = nodes.map((node) => {
      // Find all target edges from this node
      const matchingEdges = edges.filter((e) => e.source === node.id);
      const subEdges = matchingEdges.map((e) => ({
        targetNodeId: e.target,
        label: e.label || ''
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

  return (
    <div className="flex h-[75vh] border border-dark-200 dark:border-dark-700 rounded-2xl overflow-hidden glass-card bg-slate-50 dark:bg-dark-950 relative">
      {/* Node Palette Bar (Left) */}
      <div className="w-56 border-r border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 p-4 shrink-0 flex flex-col justify-between h-full">
        <div className="flex-1 overflow-y-auto pr-1 space-y-4 mb-4 scrollbar-thin">
          <div>
            <h4 className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2">Trigger Details</h4>
            <div className="space-y-2">
              <label className="block text-[11px] font-semibold text-dark-400">Trigger Type</label>
              <select 
                value={triggerType} 
                onChange={(e) => setTriggerType(e.target.value)}
                className="w-full text-xs px-2 py-1.5 border dark:border-dark-700 bg-transparent rounded focus:outline-none"
              >
                <option value="keyword">Keywords Match</option>
                <option value="any">On First Inbound Message</option>
              </select>

              {triggerType === 'keyword' && (
                <div>
                  <label className="block text-[11px] font-semibold text-dark-400">Keywords list</label>
                  <input 
                    type="text" 
                    placeholder="hi, hello, menu"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    className="w-full text-xs px-2 py-1.5 border dark:border-dark-700 bg-transparent rounded mt-1"
                  />
                  <p className="text-[9px] text-dark-400 mt-0.5">Comma-separated</p>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-dark-100 dark:border-dark-800 pt-3">
            <h4 className="text-xs font-bold text-dark-500 uppercase tracking-wider mb-2.5">Flow Blocks</h4>
            <div className="grid grid-cols-1 gap-2">
              {Object.entries(NODE_TYPES_INFO).map(([key, item]) => {
                const Icon = item.icon;
                return (
                  <button
                    key={key}
                    onClick={() => handleAddNode(key)}
                    className={`flex items-center gap-2 px-3 py-2 border rounded-xl text-left hover:scale-[1.02] transition-transform text-xs ${item.color}`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
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
      <div className="flex-1 h-full">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          fitView
        >
          <Controls />
          <MiniMap />
          <Background color="#cbd5e1" gap={16} />
        </ReactFlow>
      </div>

      {/* Editor Panel (Right Side Drawer Overlay) */}
      {selectedNode && (
        <div className="w-80 h-full border-l border-dark-200 dark:border-dark-700 bg-white dark:bg-dark-900 absolute right-0 top-0 z-10 shadow-2xl p-5 flex flex-col justify-between animate-slide-in">
          <div className="space-y-5">
            <div className="flex items-center justify-between border-b dark:border-dark-850 pb-3">
              <div className="flex items-center gap-2">
                {renderNodeIcon(selectedNode.data.nodeType)}
                <span className="font-bold text-sm dark:text-white capitalize">{selectedNode.data.nodeType} Block</span>
              </div>
              <button 
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded hover:bg-dark-100 dark:hover:bg-dark-800"
              >
                <X className="w-4 h-4 text-dark-500" />
              </button>
            </div>

            {/* MESSAGE type settings */}
            {selectedNode.data.nodeType === 'message' && (
              <div>
                <label className="block text-xs font-semibold text-dark-500 uppercase mb-1.5">Outbound Text Message</label>
                <textarea
                  rows="4"
                  value={selectedNode.data.message?.text || ''}
                  onChange={(e) => handleUpdateNodeData('message', { text: e.target.value })}
                  placeholder="Enter message body copy..."
                  className="w-full text-sm px-3 py-2 border dark:border-dark-700 rounded-lg dark:bg-dark-950 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            )}

            {/* QUESTION type settings */}
            {selectedNode.data.nodeType === 'question' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-dark-500 uppercase mb-1.5">Question Text</label>
                  <textarea
                    rows="3"
                    value={selectedNode.data.message?.text || ''}
                    onChange={(e) => handleUpdateNodeData('message', { text: e.target.value })}
                    placeholder="Ask user a question..."
                    className="w-full text-sm px-3 py-2 border dark:border-dark-700 rounded-lg dark:bg-dark-950 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dark-500 uppercase mb-1.5">Store Answer in Variable</label>
                  <input
                    type="text"
                    value={selectedNode.data.variable || ''}
                    onChange={(e) => handleUpdateNodeData('variable', e.target.value)}
                    placeholder="e.g. user_choice"
                    className="w-full text-sm px-3 py-1.5 border dark:border-dark-700 rounded-lg dark:bg-dark-950 focus:outline-none"
                  />
                  <p className="text-[9px] text-dark-400 mt-1">This context variable can be used for downstream conditionals.</p>
                </div>
              </div>
            )}

            {/* CONDITION type settings */}
            {selectedNode.data.nodeType === 'condition' && (
              <div className="space-y-4">
                <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-250 rounded-lg text-xs text-amber-700 space-y-1">
                  <span className="font-bold block">Conditional Route Instructions:</span>
                  <p>First output handle path is for <span className="font-bold">TRUE</span> branch, and the second handle is for the <span className="font-bold">FALSE</span> branch.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-dark-500 uppercase mb-1.5">Target Variable name</label>
                  <input
                    type="text"
                    value={selectedNode.data.condition?.variable || ''}
                    onChange={(e) => handleUpdateNodeData('condition', { 
                      variable: e.target.value, 
                      value: selectedNode.data.condition?.value || '' 
                    })}
                    placeholder="e.g. user_choice"
                    className="w-full text-sm px-3 py-1.5 border dark:border-dark-700 rounded-lg dark:bg-dark-950 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-dark-500 uppercase mb-1.5">Expected Matching Value</label>
                  <input
                    type="text"
                    value={selectedNode.data.condition?.value || ''}
                    onChange={(e) => handleUpdateNodeData('condition', { 
                      variable: selectedNode.data.condition?.variable || '', 
                      value: e.target.value 
                    })}
                    placeholder="e.g. yes"
                    className="w-full text-sm px-3 py-1.5 border dark:border-dark-700 rounded-lg dark:bg-dark-950 focus:outline-none"
                  />
                </div>
              </div>
            )}

            {/* AI Prompt settings */}
            {selectedNode.data.nodeType === 'ai' && (
              <div>
                <label className="block text-xs font-semibold text-dark-500 uppercase mb-1.5">AI Persona Prompt Settings</label>
                <textarea
                  rows="5"
                  value={selectedNode.data.aiPrompt || ''}
                  onChange={(e) => handleUpdateNodeData('aiPrompt', e.target.value)}
                  placeholder="e.g. You are a helpful booking assistant. Guide the user to schedule an appointment..."
                  className="w-full text-sm px-3 py-2 border dark:border-dark-700 rounded-lg dark:bg-dark-950 focus:outline-none focus:ring-1 focus:ring-purple-500"
                />
              </div>
            )}

            {/* DELAY settings */}
            {selectedNode.data.nodeType === 'delay' && (
              <div>
                <label className="block text-xs font-semibold text-dark-500 uppercase mb-1.5">Delay Duration (Seconds)</label>
                <input
                  type="number"
                  value={selectedNode.data.delaySeconds || 0}
                  onChange={(e) => handleUpdateNodeData('delaySeconds', parseInt(e.target.value) || 0)}
                  className="w-full text-sm px-3 py-1.5 border dark:border-dark-700 rounded-lg dark:bg-dark-950 focus:outline-none"
                />
              </div>
            )}

            {/* HANDOFF settings */}
            {selectedNode.data.nodeType === 'handoff' && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-xl text-red-600 space-y-1">
                <span className="text-xs font-bold block">Live Human Agent Transition</span>
                <p className="text-[11px] text-dark-600 dark:text-dark-300">
                  When execution reaches this node, the AI bot pauses, and status updates to "human". This will notify your team inbox.
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => handleDeleteNode(selectedNode.id)}
            className="w-full py-2.5 border border-red-250 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-colors mt-6"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Block</span>
          </button>
        </div>
      )}
    </div>
  );
}
