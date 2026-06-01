'use client';
import { memo } from 'react';
import { Handle, Position } from 'reactflow';
import {
  MessageSquare, HelpCircle, GitFork, Bot, Clock, UserCheck,
  AlertCircle, CheckCircle2, Sparkles
} from 'lucide-react';

/* ── Shared node shell ────────────────────────── */
function NodeShell({ children, color, borderColor, isConfigured, selected }) {
  return (
    <div
      className={`
        relative rounded-2xl border-2 bg-white dark:bg-[#1a2330] shadow-lg
        transition-all duration-200 min-w-[200px] max-w-[240px]
        ${selected ? 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-[#0b141a]' : ''}
        ${borderColor}
        ${selected ? 'shadow-xl scale-[1.02]' : 'hover:shadow-xl hover:scale-[1.01]'}
      `}
      style={{ borderColor: color }}
    >
      {/* Configured indicator */}
      <div className="absolute -top-1.5 -right-1.5 z-10">
        {isConfigured ? (
          <div className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-[#1a2330]">
            <CheckCircle2 className="w-2.5 h-2.5 text-white" />
          </div>
        ) : (
          <div className="w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center shadow-md border-2 border-white dark:border-[#1a2330] animate-pulse">
            <AlertCircle className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}

/* ── Handle wrapper ───────────────────────────── */
function StyledHandle({ type, position, id, label, color }) {
  const isLeft = position === Position.Left;
  const isTop = position === Position.Top;
  return (
    <div className="relative">
      <Handle
        type={type}
        position={position}
        id={id}
        style={{
          width: 12,
          height: 12,
          background: color || '#00a884',
          border: '3px solid white',
          boxShadow: '0 0 0 1px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.1)',
          zIndex: 10,
        }}
      />
      {label && (
        <span
          className="absolute text-[9px] font-bold tracking-wide uppercase whitespace-nowrap pointer-events-none"
          style={{
            color: color || '#667781',
            ...(isTop
              ? { top: -18, left: '50%', transform: 'translateX(-50%)' }
              : isLeft
              ? { left: 18, top: '50%', transform: 'translateY(-50%)' }
              : { right: 18, top: '50%', transform: 'translateY(-50%)' }),
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   1. MESSAGE NODE — Green theme
   ═══════════════════════════════════════════════ */
export const MessageNode = memo(({ data, selected }) => {
  const isImage = data.message?.type === 'image';
  const text = isImage ? (data.message?.caption || '') : (data.message?.text || '');
  const assetKey = data.message?.assetKey || '';
  const isConfigured = isImage ? !!assetKey : text.length > 0;

  return (
    <NodeShell color="#10b981" borderColor="border-emerald-400" isConfigured={isConfigured} selected={selected}>
      <StyledHandle type="target" position={Position.Top} id="in" color="#10b981" />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: 'rgba(16,185,129,0.08)' }}>
        <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-sm">
          <MessageSquare className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 tracking-wide font-extrabold uppercase">
          {isImage ? 'SEND IMAGE' : 'SEND MESSAGE'}
        </span>
      </div>

      {/* Body */}
      <div className="px-3 py-2.5 space-y-1.5">
        {isImage && (
          <div className="flex items-center gap-1.5 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-1 rounded-lg border border-emerald-100 dark:border-emerald-900/40 text-[10px] text-emerald-700 dark:text-emerald-400 font-mono font-bold">
            <span role="img" aria-label="image">🖼️</span>
            <span className="truncate max-w-[150px]">{assetKey || 'MISSING_ASSET'}</span>
          </div>
        )}
        <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
          {text || (isImage ? <span className="italic text-gray-400">Set image caption...</span> : <span className="italic text-gray-400">Click to configure message...</span>)}
        </p>
      </div>

      <StyledHandle type="source" position={Position.Bottom} id="out" color="#10b981" />
    </NodeShell>
  );
});
MessageNode.displayName = 'MessageNode';


/* ═══════════════════════════════════════════════
   2. QUESTION NODE — Blue theme
   ═══════════════════════════════════════════════ */
export const QuestionNode = memo(({ data, selected }) => {
  const isImage = data.message?.type === 'image';
  const text = isImage ? (data.message?.caption || '') : (data.message?.text || '');
  const assetKey = data.message?.assetKey || '';
  const variable = data.variable || '';
  const isConfigured = (isImage ? !!assetKey : text.length > 0) && variable.length > 0;

  return (
    <NodeShell color="#3b82f6" borderColor="border-blue-400" isConfigured={isConfigured} selected={selected}>
      <StyledHandle type="target" position={Position.Top} id="in" color="#3b82f6" />

      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: 'rgba(59,130,246,0.08)' }}>
        <div className="w-7 h-7 rounded-lg bg-blue-500 flex items-center justify-center shadow-sm">
          <HelpCircle className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-xs font-bold text-blue-700 dark:text-blue-400 tracking-wide font-extrabold uppercase">
          {isImage ? 'ASK IMAGE Q' : 'ASK QUESTION'}
        </span>
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        {isImage && (
          <div className="flex items-center gap-1.5 bg-blue-50/50 dark:bg-blue-950/20 px-2 py-1 rounded-lg border border-blue-100 dark:border-blue-900/40 text-[10px] text-blue-700 dark:text-blue-400 font-mono font-bold">
            <span role="img" aria-label="image">🖼️</span>
            <span className="truncate max-w-[150px]">{assetKey || 'MISSING_ASSET'}</span>
          </div>
        )}
        <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-2">
          {text || (isImage ? <span className="italic text-gray-400">Set image caption...</span> : <span className="italic text-gray-400">Set question text...</span>)}
        </p>
        {variable && (
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-blue-500 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded font-mono">
              ${'{'}${variable}{'}'}
            </span>
          </div>
        )}
      </div>

      <StyledHandle type="source" position={Position.Bottom} id="out" color="#3b82f6" />
    </NodeShell>
  );
});
QuestionNode.displayName = 'QuestionNode';


/* ═══════════════════════════════════════════════
   3. CONDITION NODE — Amber theme
   ═══════════════════════════════════════════════ */
export const ConditionNode = memo(({ data, selected }) => {
  const variable = data.condition?.variable || '';
  const value = data.condition?.value || '';
  const isConfigured = variable.length > 0 && value.length > 0;

  return (
    <NodeShell color="#f59e0b" borderColor="border-amber-400" isConfigured={isConfigured} selected={selected}>
      <StyledHandle type="target" position={Position.Top} id="in" color="#f59e0b" />

      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: 'rgba(245,158,11,0.08)' }}>
        <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center shadow-sm">
          <GitFork className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-xs font-bold text-amber-700 dark:text-amber-400 tracking-wide">CONDITION</span>
      </div>

      <div className="px-3 py-2.5 space-y-1.5">
        {variable ? (
          <div className="text-[11px] text-gray-600 dark:text-gray-300">
            <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{variable}</span>
            <span className="mx-1">=</span>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-bold">{value || '?'}</span>
          </div>
        ) : (
          <p className="text-[11px] italic text-gray-400">Set condition...</p>
        )}
        <div className="flex gap-3 mt-1">
          <span className="text-[9px] font-bold text-emerald-500 flex items-center gap-0.5">
            <CheckCircle2 className="w-2.5 h-2.5" /> TRUE
          </span>
          <span className="text-[9px] font-bold text-red-400 flex items-center gap-0.5">
            <AlertCircle className="w-2.5 h-2.5" /> FALSE
          </span>
        </div>
      </div>

      <StyledHandle type="source" position={Position.Bottom} id="true" label="True" color="#10b981" style={{ left: '30%' }} />
      <StyledHandle type="source" position={Position.Bottom} id="false" label="False" color="#ef4444" style={{ left: '70%' }} />
    </NodeShell>
  );
});
ConditionNode.displayName = 'ConditionNode';


/* ═══════════════════════════════════════════════
   4. AI NODE — Purple theme
   ═══════════════════════════════════════════════ */
export const AINode = memo(({ data, selected }) => {
  const prompt = data.aiPrompt || '';
  const isConfigured = prompt.length > 0;

  return (
    <NodeShell color="#8b5cf6" borderColor="border-purple-400" isConfigured={isConfigured} selected={selected}>
      <StyledHandle type="target" position={Position.Top} id="in" color="#8b5cf6" />

      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: 'rgba(139,92,246,0.08)' }}>
        <div className="w-7 h-7 rounded-lg bg-purple-500 flex items-center justify-center shadow-sm relative">
          <Bot className="w-3.5 h-3.5 text-white" />
          <Sparkles className="w-2 h-2 text-yellow-300 absolute -top-0.5 -right-0.5" />
        </div>
        <span className="text-xs font-bold text-purple-700 dark:text-purple-400 tracking-wide">AI AGENT</span>
      </div>

      <div className="px-3 py-2.5">
        <p className="text-[11px] text-gray-600 dark:text-gray-300 leading-relaxed line-clamp-3">
          {prompt || <span className="italic text-gray-400">Configure AI prompt...</span>}
        </p>
      </div>

      <StyledHandle type="source" position={Position.Bottom} id="out" color="#8b5cf6" />
    </NodeShell>
  );
});
AINode.displayName = 'AINode';


/* ═══════════════════════════════════════════════
   5. DELAY NODE — Pink theme
   ═══════════════════════════════════════════════ */
export const DelayNode = memo(({ data, selected }) => {
  const seconds = data.delaySeconds || 0;
  const isConfigured = seconds > 0;
  const displayTime = seconds >= 3600
    ? `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`
    : seconds >= 60
    ? `${Math.floor(seconds / 60)}m ${seconds % 60}s`
    : `${seconds}s`;

  return (
    <NodeShell color="#ec4899" borderColor="border-pink-400" isConfigured={isConfigured} selected={selected}>
      <StyledHandle type="target" position={Position.Top} id="in" color="#ec4899" />

      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: 'rgba(236,72,153,0.08)' }}>
        <div className="w-7 h-7 rounded-lg bg-pink-500 flex items-center justify-center shadow-sm">
          <Clock className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-xs font-bold text-pink-700 dark:text-pink-400 tracking-wide">WAIT DELAY</span>
      </div>

      <div className="px-3 py-2.5 flex items-center justify-center">
        <div className="text-center">
          <span className="text-xl font-extrabold text-pink-600 dark:text-pink-400 tabular-nums">
            {isConfigured ? displayTime : '--'}
          </span>
          <p className="text-[9px] text-gray-400 mt-0.5 uppercase font-bold tracking-wider">Wait Duration</p>
        </div>
      </div>

      <StyledHandle type="source" position={Position.Bottom} id="out" color="#ec4899" />
    </NodeShell>
  );
});
DelayNode.displayName = 'DelayNode';


/* ═══════════════════════════════════════════════
   6. HANDOFF NODE — Red theme
   ═══════════════════════════════════════════════ */
export const HandoffNode = memo(({ data, selected }) => {
  return (
    <NodeShell color="#ef4444" borderColor="border-red-400" isConfigured={true} selected={selected}>
      <StyledHandle type="target" position={Position.Top} id="in" color="#ef4444" />

      <div className="flex items-center gap-2 px-3 py-2 rounded-t-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
        <div className="w-7 h-7 rounded-lg bg-red-500 flex items-center justify-center shadow-sm">
          <UserCheck className="w-3.5 h-3.5 text-white" />
        </div>
        <span className="text-xs font-bold text-red-700 dark:text-red-400 tracking-wide">HUMAN HANDOFF</span>
      </div>

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 bg-red-50 dark:bg-red-950/20 rounded-lg px-2.5 py-2 border border-red-200 dark:border-red-900/50">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
            Transfer to live agent
          </span>
        </div>
      </div>

      {/* No source handle — this is a terminal node */}
    </NodeShell>
  );
});
HandoffNode.displayName = 'HandoffNode';


/* ── Export node type map for ReactFlow ────────── */
export const customNodeTypes = {
  messageNode: MessageNode,
  questionNode: QuestionNode,
  conditionNode: ConditionNode,
  aiNode: AINode,
  delayNode: DelayNode,
  handoffNode: HandoffNode,
};
