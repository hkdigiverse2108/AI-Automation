'use client';
import { Flame, Thermometer, Snowflake, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react';

const SEGMENT_CONFIG = {
  hot: {
    label: 'Hot',
    icon: Flame,
    color: 'text-red-500',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    gradient: 'from-red-500 to-orange-500',
    ringColor: 'ring-red-400',
  },
  warm: {
    label: 'Warm',
    icon: Thermometer,
    color: 'text-amber-500',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    gradient: 'from-amber-500 to-yellow-500',
    ringColor: 'ring-amber-400',
  },
  cold: {
    label: 'Cold',
    icon: Snowflake,
    color: 'text-blue-500',
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    gradient: 'from-blue-500 to-cyan-500',
    ringColor: 'ring-blue-400',
  },
  new: {
    label: 'New',
    icon: Sparkles,
    color: 'text-emerald-500',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    gradient: 'from-emerald-500 to-teal-500',
    ringColor: 'ring-emerald-400',
  },
};

/**
 * Inline score badge — compact display for tables
 */
export function ScoreBadge({ score = 0, segment = 'new', size = 'sm' }) {
  const config = SEGMENT_CONFIG[segment] || SEGMENT_CONFIG.new;
  const Icon = config.icon;

  if (size === 'xs') {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold ${config.bg} ${config.color} border ${config.border}`}>
        <Icon className="w-2.5 h-2.5" />
        {score}
      </span>
    );
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${config.bg} ${config.color} border ${config.border}`}>
      <Icon className="w-3.5 h-3.5" />
      <span>{score}</span>
      <span className="text-[9px] font-semibold opacity-70 uppercase">{config.label}</span>
    </div>
  );
}

/**
 * Segment filter pill
 */
export function SegmentPill({ segment, isActive, onClick, count }) {
  const config = SEGMENT_CONFIG[segment] || SEGMENT_CONFIG.new;
  const Icon = config.icon;

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 border ${
        isActive
          ? `${config.bg} ${config.color} ${config.border} shadow-sm`
          : 'border-transparent text-wa-text-secondary hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
      }`}
    >
      <Icon className="w-3 h-3" />
      <span className="capitalize">{config.label}</span>
      {count !== undefined && (
        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/50 dark:bg-black/20' : 'bg-wa-search dark:bg-wa-dark-search'}`}>
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * Full score card — detailed breakdown for contact detail view
 */
export default function ContactScoreCard({ score = 0, segment = 'new', breakdown = {}, trend = 'stable' }) {
  const config = SEGMENT_CONFIG[segment] || SEGMENT_CONFIG.new;
  const Icon = config.icon;

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-400' : 'text-wa-text-light';

  // Calculate gauge arc (score 0-100 maps to 0-180 degrees)
  const angle = (score / 100) * 180;

  const scoreParts = [
    { label: 'Engagement', value: breakdown.engagement || 0, max: 40, color: '#00a884' },
    { label: 'Recency', value: breakdown.recency || 0, max: 30, color: '#3b82f6' },
    { label: 'Response Rate', value: breakdown.responseRate || 0, max: 30, color: '#f59e0b' },
  ];

  return (
    <div className={`glass-card p-4 border ${config.border}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.bg}`}>
            <Icon className={`w-4 h-4 ${config.color}`} />
          </div>
          <div>
            <p className="text-xs font-bold text-wa-text-primary dark:text-white">Engagement Score</p>
            <p className="text-[9px] text-wa-text-secondary capitalize">{config.label} Lead</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 ${trendColor}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          <span className="text-[10px] font-semibold capitalize">{trend}</span>
        </div>
      </div>

      {/* Score Display */}
      <div className="flex items-center justify-center py-3">
        <div className="relative w-28 h-16">
          {/* Gauge background */}
          <svg viewBox="0 0 120 70" className="w-full h-full">
            {/* Background arc */}
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke="var(--border-color)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            {/* Score arc */}
            <path
              d="M 10 65 A 50 50 0 0 1 110 65"
              fill="none"
              stroke={`url(#scoreGrad-${segment})`}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(angle / 180) * 157} 157`}
            />
            <defs>
              <linearGradient id={`scoreGrad-${segment}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={segment === 'hot' ? '#ef4444' : segment === 'warm' ? '#f59e0b' : segment === 'cold' ? '#3b82f6' : '#10b981'} />
                <stop offset="100%" stopColor={segment === 'hot' ? '#f97316' : segment === 'warm' ? '#eab308' : segment === 'cold' ? '#06b6d4' : '#14b8a6'} />
              </linearGradient>
            </defs>
          </svg>
          {/* Score number */}
          <div className="absolute inset-x-0 bottom-0 text-center">
            <span className={`text-2xl font-extrabold ${config.color} tabular-nums`}>{score}</span>
            <span className="text-[9px] text-wa-text-light font-bold block -mt-0.5">/100</span>
          </div>
        </div>
      </div>

      {/* Score Breakdown Bars */}
      <div className="space-y-2 mt-2">
        {scoreParts.map((part, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[10px] text-wa-text-secondary font-medium">{part.label}</span>
              <span className="text-[10px] font-bold text-wa-text-primary dark:text-white">
                {part.value}/{part.max}
              </span>
            </div>
            <div className="h-1.5 bg-wa-search dark:bg-wa-dark-search rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${(part.value / part.max) * 100}%`,
                  backgroundColor: part.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
