'use client';
import { useState, useEffect, useRef } from 'react';
import { 
  Image, UploadCloud, Copy, Check, Trash2, Edit3, 
  RefreshCw, Search, Loader2, AlertTriangle, ExternalLink, 
  Sparkles, CheckCircle2, X, Plus, Info, HelpCircle
} from 'lucide-react';
import api from '../lib/api';
import { toast } from 'react-hot-toast';

export default function BotMediaLibrary({ botId }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Custom Key upload form
  const [customKey, setCustomKey] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  // Key renaming state
  const [renamingAssetId, setRenamingAssetId] = useState(null);
  const [newNameText, setNewNameText] = useState('');
  const [renamingLoading, setRenamingLoading] = useState(false);

  // Copy status per asset key
  const [copiedKey, setCopiedKey] = useState(null);

  // Migration scan state
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);

  // Drag and drop state
  const [dragActive, setDragActive] = useState(false);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/media/bot/${botId}`);
      if (data.success) {
        setAssets(data.data.assets);
      }
    } catch (err) {
      toast.error('Failed to load media assets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (botId) {
      fetchAssets();
      setScanResult(null);
    }
  }, [botId]);

  const handleCopyKey = (key) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(key);
    toast.success(`Copied assetKey: ${key}`);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
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
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    if (customKey) {
      formData.append('assetKey', customKey.trim().toUpperCase());
    }

    try {
      const { data } = await api.post(`/media/bot/${botId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        toast.success(`Successfully uploaded asset: ${data.data.asset.assetKey}`);
        setCustomKey('');
        setSelectedFile(null);
        fetchAssets();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleReplaceFile = async (assetId, file) => {
    if (!file) return;

    const replacementToast = toast.loading('Replacing asset media file globally...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const { data } = await api.post(`/media/bot/${botId}/replace/${assetId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (data.success) {
        toast.success('Asset media file replaced globally!', { id: replacementToast });
        fetchAssets();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Replacement failed', { id: replacementToast });
    }
  };

  const handleStartRename = (asset) => {
    setRenamingAssetId(asset._id);
    setNewNameText(asset.assetKey);
  };

  const handleSaveRename = async (assetId) => {
    if (!newNameText.trim()) return;
    setRenamingLoading(true);

    try {
      const { data } = await api.put(`/media/bot/${botId}/rename/${assetId}`, {
        newAssetKey: newNameText.trim().toUpperCase()
      });
      if (data.success) {
        toast.success('Asset key renamed, bot flow references updated!');
        setRenamingAssetId(null);
        fetchAssets();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Rename failed');
    } finally {
      setRenamingLoading(false);
    }
  };

  const handleDeleteAsset = async (asset) => {
    if (asset.usageCount > 0) {
      toast.error(`Cannot delete asset: in use by ${asset.usageCount} flow nodes!`, {
        icon: '⚠️',
        duration: 4000
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete asset "${asset.assetKey}"?`)) {
      return;
    }

    try {
      const { data } = await api.delete(`/media/bot/${botId}/${asset._id}`);
      if (data.success) {
        toast.success('Asset deleted successfully');
        fetchAssets();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Deletion failed');
    }
  };

  const handleScanSync = async () => {
    setScanning(true);
    setScanResult(null);
    const scanToast = toast.loading('Scanning workflow and migrating legacy media URLs...');

    try {
      const { data } = await api.post(`/media/bot/${botId}/scan-sync`);
      if (data.success) {
        toast.success(`Scan completed! Converted ${data.migratedCount} hardcoded nodes to clean assets.`, { id: scanToast });
        setScanResult(data);
        fetchAssets();
      }
    } catch (err) {
      toast.error('Migration scan failed', { id: scanToast });
    } finally {
      setScanning(false);
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredAssets = assets.filter(a => 
    a.assetKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 h-[72vh] overflow-y-auto pr-1 pb-4 scrollbar-thin">
      
      {/* Upload Zone & Migration Options (Left Column) */}
      <div className="xl:col-span-1 space-y-6">
        
        {/* Upload Form Card */}
        <div className="bg-white dark:bg-[#111b21] border border-wa-border dark:border-wa-dark-border rounded-2xl p-5 shadow-sm space-y-4">
          <div>
            <h3 className="text-sm font-bold text-wa-text-primary dark:text-white flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-wa-green" /> Add Bot Media Asset
            </h3>
            <p className="text-[11px] text-wa-text-light mt-1">
              Upload images directly here to register asset keys, then easily pick or swap them globally without ever redrawing your canvases.
            </p>
          </div>

          <form onSubmit={handleUpload} className="space-y-4">
            
            {/* Drag & Drop File input */}
            <div 
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                dragActive 
                  ? 'border-wa-green bg-wa-green/5' 
                  : 'border-wa-border dark:border-wa-dark-border hover:border-wa-green dark:hover:border-wa-green bg-wa-search dark:bg-wa-dark-search'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/*"
                className="hidden" 
              />
              <div className="flex flex-col items-center gap-2 text-wa-text-secondary dark:text-wa-dark-text-secondary">
                <Image className="w-8 h-8 text-wa-green opacity-80" />
                {selectedFile ? (
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-wa-text-primary dark:text-white truncate max-w-[200px]">{selectedFile.name}</p>
                    <p className="text-[10px] text-wa-text-light font-mono">{formatSize(selectedFile.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-bold text-wa-text-primary dark:text-white">Drag & drop image here</p>
                    <p className="text-[10px] text-wa-text-light mt-1">or click to browse local files</p>
                  </div>
                )}
              </div>
            </div>

            {/* Custom Key name */}
            <div>
              <label className="block text-[11px] font-bold text-wa-text-secondary dark:text-wa-dark-text-secondary uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                Custom Asset Key <span className="text-[9px] text-wa-text-light font-normal">(Optional)</span>
                <HelpCircle className="w-3.5 h-3.5 text-wa-text-light cursor-help" title="e.g. PRODUCT_BANNER. If left empty, a key like IMG_001 will be automatically generated." />
              </label>
              <input
                type="text"
                placeholder="e.g. HERO_BANNER"
                value={customKey}
                onChange={(e) => setCustomKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                className="w-full text-xs px-3 py-2.5 border border-wa-border dark:border-wa-dark-border rounded-xl bg-wa-search dark:bg-wa-dark-search text-wa-text-primary dark:text-white focus:outline-none focus:ring-1 focus:ring-wa-green uppercase"
              />
              <p className="text-[9px] text-wa-text-light mt-1 font-semibold">Only uppercase characters and underscores.</p>
            </div>

            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-xs font-semibold"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Uploading Asset...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Upload & Register Asset</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Legacy Scan & Auto Migration Card */}
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-300">Auto Image Scan & Migration</h3>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/70 mt-1">
                Convert hardcoded image URLs inside your current bot canvas automatically to clean, fully managed database assets.
              </p>
            </div>
          </div>

          <button
            onClick={handleScanSync}
            disabled={scanning}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl flex items-center justify-center gap-2 text-xs font-bold shadow-md transition-all disabled:opacity-50"
          >
            {scanning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Migrating Workflow...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                <span>Scan & Sync Legacy Assets</span>
              </>
            )}
          </button>

          {/* Migration scan report details */}
          {scanResult && (
            <div className="p-3.5 bg-white dark:bg-[#111b21] border border-emerald-200 dark:border-emerald-900/50 rounded-xl space-y-2 text-[11px]">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>Successfully migrated {scanResult.migratedCount} image nodes!</span>
              </div>
              {scanResult.migratedNodes?.length > 0 ? (
                <div className="max-h-24 overflow-y-auto space-y-1 pr-1 font-mono text-[9px] scrollbar-thin mt-1 border-t border-emerald-100 dark:border-emerald-950 pt-1">
                  {scanResult.migratedNodes.map((n, i) => (
                    <div key={i} className="flex items-center justify-between text-wa-text-secondary dark:text-wa-dark-text-secondary">
                      <span>Node ID: {n.id.slice(0, 8)}...</span>
                      <span className="font-bold text-wa-green">{n.key}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-wa-text-light text-[10px] italic">No hardcoded URLs found. Your canvas is already fully synced!</p>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Media Repository Grid Dashboard (Right 2 Columns) */}
      <div className="xl:col-span-2 space-y-4 flex flex-col h-full overflow-hidden">
        
        {/* Search & Refresh Actions */}
        <div className="flex items-center gap-3 bg-white dark:bg-[#111b21] border border-wa-border dark:border-wa-dark-border rounded-xl px-4 py-2.5 shadow-sm">
          <Search className="w-4.5 h-4.5 text-wa-text-light" />
          <input
            type="text"
            placeholder="Search assets by key or filename..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-xs w-full text-wa-text-primary dark:text-white"
          />
          <button 
            onClick={fetchAssets}
            className="p-1 hover:bg-wa-hover dark:hover:bg-wa-dark-hover rounded-lg transition-colors text-wa-text-secondary dark:text-wa-dark-text-secondary"
            title="Reload Assets"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Media Asset List container */}
        <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin space-y-3">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-wa-text-secondary">
                <Loader2 className="w-8 h-8 animate-spin text-wa-green" />
                <span className="text-xs font-semibold">Fetching media assets...</span>
              </div>
            </div>
          ) : filteredAssets.length === 0 ? (
            <div className="h-full border border-dashed border-wa-border dark:border-wa-dark-border rounded-2xl flex items-center justify-center p-8 bg-white dark:bg-[#111b21] shadow-inner text-center text-wa-text-secondary">
              <div className="space-y-2 max-w-sm">
                <Image className="w-10 h-10 text-wa-green/30 mx-auto" />
                <h4 className="font-bold text-xs text-wa-text-primary dark:text-white">No Assets Found</h4>
                <p className="text-[11px] text-wa-text-light leading-relaxed">
                  {searchQuery ? 'No registered assets match your query.' : 'This bot flow doesn\'t have any central media files yet. Upload files to display them here.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredAssets.map((asset) => {
                const isRenaming = renamingAssetId === asset._id;
                const isUsed = asset.usageCount > 0;
                
                return (
                  <div 
                    key={asset._id} 
                    className="bg-white dark:bg-[#111b21] border border-wa-border dark:border-wa-dark-border rounded-xl p-3.5 shadow-sm flex flex-col justify-between hover:scale-[1.01] hover:shadow-md transition-all duration-200"
                  >
                    
                    {/* Media Card Top Section (Preview & Description) */}
                    <div className="space-y-3">
                      
                      {/* Image Preview & Hover Actions */}
                      <div className="relative group rounded-lg overflow-hidden bg-wa-search dark:bg-wa-dark-search aspect-video flex items-center justify-center border border-wa-border dark:border-wa-dark-border shadow-inner">
                        <img 
                          src={asset.fileUrl} 
                          alt={asset.fileName}
                          className="max-h-full max-w-full object-contain"
                        />
                        
                        {/* Hover Overlay Buttons */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity duration-200">
                          <button
                            onClick={() => window.open(asset.fileUrl, '_blank')}
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                            title="Open original in tab"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          
                          {/* Replacement Cloud uploader */}
                          <label 
                            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="Replace image file"
                          >
                            <UploadCloud className="w-4 h-4" />
                            <input 
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                  handleReplaceFile(asset._id, e.target.files[0]);
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        </div>

                        {/* Usage Counter Badge */}
                        <div className="absolute top-2 right-2">
                          {isUsed ? (
                            <span className="px-2 py-0.5 bg-emerald-500/90 text-white text-[9px] font-extrabold uppercase rounded shadow-md tracking-wider flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                              IN USE ({asset.usageCount})
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-gray-400/90 text-white text-[9px] font-extrabold uppercase rounded shadow-md tracking-wider">
                              UNUSED
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Key Name Input or Text */}
                      <div className="space-y-1">
                        {isRenaming ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={newNameText}
                              onChange={(e) => setNewNameText(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
                              className="w-full text-xs font-bold px-2 py-1 border border-wa-green bg-wa-search dark:bg-wa-dark-search text-wa-text-primary dark:text-white rounded-lg focus:outline-none uppercase"
                            />
                            <button
                              onClick={() => handleSaveRename(asset._id)}
                              disabled={renamingLoading}
                              className="p-1 text-wa-green hover:bg-wa-green/10 rounded-lg"
                            >
                              {renamingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => setRenamingAssetId(null)}
                              className="p-1 text-red-500 hover:bg-red-50 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="font-mono font-black text-sm tracking-wide text-wa-text-primary dark:text-white flex items-center gap-1">
                              {asset.assetKey}
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              <button 
                                onClick={() => handleStartRename(asset)}
                                className="p-1 text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white hover:bg-wa-hover dark:hover:bg-wa-dark-hover rounded transition-colors"
                                title="Rename asset key"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleCopyKey(asset.assetKey)}
                                className={`p-1 rounded transition-all ${
                                  copiedKey === asset.assetKey 
                                    ? 'bg-wa-green/10 text-wa-green scale-110' 
                                    : 'text-wa-text-secondary hover:text-wa-text-primary dark:hover:text-white hover:bg-wa-hover dark:hover:bg-wa-dark-hover'
                                }`}
                                title="Copy assetKey"
                              >
                                {copiedKey === asset.assetKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        )}
                        <p className="text-[10px] text-wa-text-light font-mono truncate" title={asset.fileName}>
                          {asset.fileName}
                        </p>
                      </div>

                    </div>

                    {/* Media Card Bottom Details & Actions */}
                    <div className="border-t border-wa-border dark:border-wa-dark-border mt-3 pt-3 flex items-center justify-between text-[10px] text-wa-text-light">
                      <div className="space-y-0.5">
                        <p>Size: <span className="font-semibold text-wa-text-secondary dark:text-wa-dark-text-secondary">{formatSize(asset.fileSize)}</span></p>
                        <p>Uploaded: <span className="font-semibold text-wa-text-secondary dark:text-wa-dark-text-secondary">{new Date(asset.createdAt).toLocaleDateString()}</span></p>
                      </div>
                      
                      <button
                        onClick={() => handleDeleteAsset(asset)}
                        className={`p-1.5 rounded-lg border transition-all ${
                          isUsed
                            ? 'opacity-40 cursor-not-allowed border-gray-100 dark:border-gray-900 text-gray-400'
                            : 'border-red-100 hover:border-red-200 dark:border-red-950 dark:hover:border-red-900/50 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20'
                        }`}
                        disabled={isUsed}
                        title={isUsed ? 'Cannot delete an active asset' : 'Delete asset'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
