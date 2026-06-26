'use client';
import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import {
  Megaphone, Plus, Play, Pause, RefreshCw, BarChart2, Calendar,
  CheckCircle2, AlertTriangle, Loader2, Clock, ArrowUpRight, Edit2, Trash2
} from 'lucide-react';
import api from '../../../lib/api';
import CampaignForm from '../../../components/CampaignForm';
import { useConfirmStore } from '../../../lib/store';
import { formatDate } from '../../../lib/utils';

export default function UnofficialCampaignsPage() {
  const confirm = useConfirmStore((state) => state.confirm);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState(null);
  const [stats, setStats] = useState({
    running: 0,
    scheduled: 0,
    completed: 0,
    totalSent: 0
  });

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/campaigns?isUnofficial=true');
      if (data.success) {
        setCampaigns(data.data.campaigns);
        const running = data.data.campaigns.filter(c => c.status === 'running').length;
        const scheduled = data.data.campaigns.filter(c => c.status === 'scheduled').length;
        const completed = data.data.campaigns.filter(c => c.status === 'completed').length;
        const totalSent = data.data.campaigns.reduce((acc, c) => acc + (c.stats?.sent || 0), 0);
        setStats({ running, scheduled, completed, totalSent });
      }
    } catch (err) {
      toast.error('Failed to load unofficial campaigns list');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCampaigns(); }, []);

  const handleStartCampaign = async (id) => {
    try {
      const { data } = await api.post(`/campaigns/${id}/start`);
      if (data.success) {
        toast.success(data.message || 'Unofficial campaign blast queued!');
        fetchCampaigns();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start campaign');
    }
  };

  const handlePauseCampaign = async (id) => {
    try {
      const { data } = await api.post(`/campaigns/${id}/pause`);
      if (data.success) { toast.success('Campaign paused'); fetchCampaigns(); }
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to pause'); }
  };

  const handleResumeCampaign = async (id) => {
    try {
      const { data } = await api.post(`/campaigns/${id}/resume`);
      if (data.success) { toast.success('Campaign resumed'); fetchCampaigns(); }
    } catch (err) { toast.error(err.response?.data?.error || 'Failed to resume'); }
  };

  const handleEditCampaign = (campaign) => {
    setEditingCampaign(campaign);
    setIsFormOpen(true);
  };

  const handleDeleteCampaign = async (id) => {
    const confirmed = await confirm('Are you sure you want to delete this unofficial campaign? This action cannot be undone.', 'Delete Unofficial Campaign');
    if (!confirmed) {
      return;
    }
    try {
      const { data } = await api.delete(`/campaigns/${id}`);
      if (data.success) {
        toast.success('Campaign deleted successfully');
        fetchCampaigns();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete campaign');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'running': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-wa-green/10 text-wa-green"><span className="w-1.5 h-1.5 rounded-full bg-wa-green animate-pulse" />Running</span>;
      case 'scheduled': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400"><Clock className="w-3 h-3" />Scheduled</span>;
      case 'completed': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3 h-3" />Completed</span>;
      case 'paused': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400">Paused</span>;
      case 'failed': return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"><AlertTriangle className="w-3 h-3" />Failed</span>;
      default: return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-wa-search dark:bg-wa-dark-search text-wa-text-secondary">Draft</span>;
    }
  };

  const statCards = [
    { label: 'Active Running', value: stats.running, icon: <span className="w-2 h-2 rounded-full bg-wa-green animate-ping" />, color: 'bg-wa-green/10', text: 'text-wa-green' },
    { label: 'Scheduled', value: stats.scheduled, icon: <Calendar className="w-4 h-4" />, color: 'bg-amber-50 dark:bg-amber-900/15', text: 'text-amber-500' },
    { label: 'Completed', value: stats.completed, icon: <CheckCircle2 className="w-4 h-4" />, color: 'bg-emerald-50 dark:bg-emerald-900/15', text: 'text-emerald-500' },
    { label: 'Total Sent', value: stats.totalSent, icon: <BarChart2 className="w-4 h-4" />, color: 'bg-blue-50 dark:bg-blue-900/15', text: 'text-blue-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">Unofficial Campaigns</h2>
          <p className="text-sm text-wa-text-secondary dark:text-wa-dark-text-secondary mt-0.5">Launch unofficial marketing campaigns at 5 messages per second rate limit.</p>
        </div>
        <button
          onClick={() => { setEditingCampaign(null); setIsFormOpen(true); }}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 text-sm"
        >
          <Plus className="w-4 h-4" />
          New Unofficial Campaign
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => (
          <div key={i} className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${card.color} ${card.text} flex items-center justify-center`}>
                {card.icon}
              </div>
              <div>
                <span className="block text-xs text-wa-text-secondary dark:text-wa-dark-text-secondary">{card.label}</span>
                <span className="text-xl font-bold text-wa-text-primary dark:text-wa-dark-text-primary">{card.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Campaigns Table */}
      <div className="glass-card overflow-hidden">
        <div className="px-6 py-4 border-b border-wa-border dark:border-wa-dark-border flex justify-between items-center bg-wa-panel-header/50 dark:bg-wa-dark-panel-header/50">
          <h3 className="font-semibold text-sm text-wa-text-primary dark:text-wa-dark-text-primary">Unofficial Campaigns Log</h3>
          <button
            onClick={fetchCampaigns}
            className="flex items-center gap-1.5 text-xs text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-wa-dark-text-primary transition-colors px-2 py-1 rounded-lg hover:bg-wa-hover dark:hover:bg-wa-dark-hover"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-wa-border dark:border-wa-dark-border text-xs font-semibold uppercase text-wa-text-secondary bg-wa-panel-header/30 dark:bg-wa-dark-panel-header/30">
                <th className="px-6 py-3.5">Campaign Name</th>
                <th className="px-6 py-3.5">Template</th>
                <th className="px-6 py-3.5">Target</th>
                <th className="px-6 py-3.5">Date</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Delivery</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-wa-border/50 dark:divide-wa-dark-border/50 text-sm">
              {loading && campaigns.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-12 text-center text-wa-text-secondary">
                    <div className="flex justify-center items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin text-wa-green" />
                      <span>Loading campaigns...</span>
                    </div>
                  </td>
                </tr>
              ) : campaigns.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center text-wa-text-secondary">
                    <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="text-sm">No unofficial campaigns created yet.</p>
                    <p className="text-xs mt-1 opacity-70">Click "New Unofficial Campaign" to start.</p>
                  </td>
                </tr>
              ) : (
                campaigns.map((campaign) => {
                  let target = 'All Contacts';
                  if (campaign.audience?.type === 'tag') {
                    target = `Tags: ${campaign.audience?.tags?.join(', ') || ''}`;
                  } else if (campaign.audience?.type === 'group') {
                    const groupNames = campaign.audience?.groupIds
                      ?.map(g => typeof g === 'object' ? g.name : g)
                      .filter(Boolean)
                      .join(', ');
                    target = `Group: ${groupNames || 'Selected Group'}`;
                  }
                  const sent = campaign.stats?.sent || 0;
                  const delivered = campaign.stats?.delivered || 0;
                  const read = campaign.stats?.read || 0;
                  const total = campaign.audience?.totalCount || sent || 1;
                  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

                  return (
                    <tr key={campaign._id} className="hover:bg-wa-hover/50 dark:hover:bg-wa-dark-hover/50 transition-colors">
                      <td className="px-6 py-4 font-semibold text-wa-text-primary dark:text-wa-dark-text-primary">{campaign.name}</td>
                      <td className="px-6 py-4 text-wa-text-secondary font-mono text-xs">{campaign.templateName}</td>
                      <td className="px-6 py-4 text-wa-text-secondary text-xs">{target}</td>
                      <td className="px-6 py-4 text-wa-text-secondary text-xs">{formatDate(campaign.scheduledAt || campaign.createdAt)}</td>
                      <td className="px-6 py-4">{getStatusBadge(campaign.status)}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-1.5 min-w-[130px]">
                          <div className="flex justify-between text-xs font-medium text-wa-text-secondary">
                            <span>{deliveryRate}%</span>
                            <span>{read} read</span>
                          </div>
                          <div className="w-full bg-wa-search dark:bg-wa-dark-search rounded-full h-1.5 overflow-hidden">
                            <div className="bg-wa-green h-1.5 rounded-full transition-all duration-500" style={{ width: `${deliveryRate}%` }} />
                          </div>
                          <div className="text-[10px] text-wa-text-light">
                            {sent} sent · {delivered} delivered · {campaign.stats?.failed || 0} failed
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center gap-1.5">
                          {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                            <button onClick={() => handleStartCampaign(campaign._id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-wa-green hover:bg-wa-green/10 transition-colors" title="Start">
                              <Play className="w-4 h-4 fill-current" />
                            </button>
                          )}
                          {campaign.status === 'running' && (
                            <button onClick={() => handlePauseCampaign(campaign._id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors" title="Pause">
                              <Pause className="w-4 h-4 fill-current" />
                            </button>
                          )}
                          {campaign.status === 'paused' && (
                            <button onClick={() => handleResumeCampaign(campaign._id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Resume">
                              <Play className="w-4 h-4 fill-current" />
                            </button>
                          )}
                          {(campaign.status === 'draft' || campaign.status === 'scheduled') && (
                            <button onClick={() => handleEditCampaign(campaign)} className="w-8 h-8 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Edit">
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          <button onClick={() => handleDeleteCampaign(campaign._id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* FORM MODAL */}
      {isFormOpen && (
        <CampaignForm
          campaign={editingCampaign}
          onClose={() => { setIsFormOpen(false); setEditingCampaign(null); }}
          onSuccess={() => { setIsFormOpen(false); setEditingCampaign(null); fetchCampaigns(); }}
          isUnofficial={true}
        />
      )}
    </div>
  );
}
