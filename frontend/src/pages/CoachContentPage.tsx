import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { coachContentApi, type CoachContentItem, resolveMediaUrl } from '../lib/api';

type Tab = 'all' | 'image' | 'video' | 'article';
type ModalMode = 'image' | 'video' | 'article' | null;

export default function CoachContentPage() {
  const { theme } = useThemeStore();

  const [items, setItems] = useState<CoachContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('all');

  const [modal, setModal] = useState<ModalMode>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [articleBody, setArticleBody] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const [viewArticle, setViewArticle] = useState<CoachContentItem | null>(null);
  const [viewImage, setViewImage] = useState<CoachContentItem | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const cardBg = theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const inputCls = `w-full px-4 py-3 rounded-xl border text-sm focus:outline-none transition-all ${
    theme === 'dark' ? 'glass border-white/10 text-white focus:border-blue-500 placeholder-white/30' : 'bg-white border-gray-300 focus:border-blue-400'
  }`;

  const fetchContent = (tab: Tab = activeTab) => {
    setLoading(true);
    coachContentApi.list(tab === 'all' ? undefined : tab)
      .then(r => setItems(r.data.content))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchContent(activeTab); }, [activeTab]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setArticleBody('');
    setIsPublic(true); setFile(null); setFilePreview(null);
    setFormError(''); setUploadProgress(0);
  };

  const openModal = (mode: ModalMode) => { resetForm(); setModal(mode); };
  const closeModal = () => { setModal(null); resetForm(); };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setFilePreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    setFormError('');
    if (!title.trim()) { setFormError('Title is required.'); return; }

    if (modal === 'article') {
      if (!articleBody.trim()) { setFormError('Article body is required.'); return; }
      setUploading(true);
      try {
        const r = await coachContentApi.createArticle({ title, description, article_body: articleBody, is_public: isPublic });
        setItems(prev => [r.data, ...prev]);
        closeModal();
      } catch (e: any) {
        setFormError(e.response?.data?.detail || 'Failed to save article.');
      } finally { setUploading(false); }
      return;
    }

    if (!file) { setFormError('Please select a file.'); return; }
    const fd = new FormData();
    fd.append('title', title);
    fd.append('content_type', modal!);
    fd.append('description', description);
    fd.append('is_public', String(isPublic));
    fd.append('file', file);

    setUploading(true);
    try {
      const r = await coachContentApi.upload(fd, setUploadProgress);
      setItems(prev => [r.data, ...prev]);
      closeModal();
    } catch (e: any) {
      setFormError(e.response?.data?.detail || 'Upload failed.');
    } finally { setUploading(false); setUploadProgress(0); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this content?')) return;
    try {
      await coachContentApi.delete(id);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch { alert('Delete failed.'); }
  };

  const handleToggleVisibility = async (id: string) => {
    try {
      const r = await coachContentApi.toggleVisibility(id);
      setItems(prev => prev.map(i => i.id === id ? { ...i, is_public: r.data.is_public } : i));
    } catch { alert('Failed to update visibility.'); }
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'all', label: 'All', icon: 'fas fa-th-large' },
    { key: 'image', label: 'Images', icon: 'fas fa-image' },
    { key: 'video', label: 'Videos', icon: 'fas fa-video' },
    { key: 'article', label: 'Articles', icon: 'fas fa-file-alt' },
  ];

  const typeColor: Record<string, string> = {
    image: 'from-pink-500 to-rose-500',
    video: 'from-blue-500 to-cyan-500',
    article: 'from-green-500 to-emerald-500',
  };

  const typeIcon: Record<string, string> = {
    image: 'fas fa-image',
    video: 'fas fa-video',
    article: 'fas fa-file-alt',
  };

  function formatSize(bytes: number | null) {
    if (!bytes) return '';
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 mb-6 border ${glass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-photo-video text-orange-400"></i>My Content
            </h1>
            <p className={`mt-1 text-sm ${sub}`}>Upload and manage your images, videos, and articles</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(['image', 'video', 'article'] as ModalMode[]).map(type => (
              <button key={type} onClick={() => openModal(type)}
                className={`px-4 py-2 rounded-xl text-white text-sm font-semibold bg-gradient-to-r ${typeColor[type!]} hover:opacity-90 transition-opacity flex items-center gap-2`}>
                <i className={typeIcon[type!]}></i>
                {type!.charAt(0).toUpperCase() + type!.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Images', count: items.filter(i => i.content_type === 'image').length, icon: 'fas fa-image', color: 'from-pink-500 to-rose-500' },
          { label: 'Videos', count: items.filter(i => i.content_type === 'video').length, icon: 'fas fa-video', color: 'from-blue-500 to-cyan-500' },
          { label: 'Articles', count: items.filter(i => i.content_type === 'article').length, icon: 'fas fa-file-alt', color: 'from-green-500 to-emerald-500' },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`rounded-2xl p-4 border ${cardBg} flex items-center gap-3`}>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-r ${s.color} flex items-center justify-center flex-shrink-0`}>
              <i className={`${s.icon} text-white text-sm`}></i>
            </div>
            <div>
              <p className="text-xl font-bold">{s.count}</p>
              <p className={`text-xs ${sub}`}>{s.label}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className={`flex gap-1 p-1 rounded-2xl mb-6 w-fit ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
              activeTab === t.key
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow'
                : theme === 'dark' ? 'text-white/60 hover:text-white' : 'text-gray-600 hover:text-gray-900'
            }`}>
            <i className={`${t.icon} text-xs`}></i>{t.label}
          </button>
        ))}
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className={`rounded-3xl border p-16 text-center ${glass}`}>
          <div className={`w-20 h-20 rounded-3xl mx-auto flex items-center justify-center mb-4 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
            <i className={`fas fa-photo-video text-4xl ${sub}`}></i>
          </div>
          <p className="font-semibold text-lg mb-1">No content yet</p>
          <p className={`text-sm ${sub}`}>Upload an image, video, or write an article to get started</p>
        </motion.div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item, i) => (
            <motion.div key={item.id} initial={{ opacity: 0, y: 20, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.04 }}
              className={`rounded-2xl border overflow-hidden group transition-all ${cardBg} hover:border-blue-500/30`}>
              <div className="relative w-full h-44 bg-gradient-to-br from-white/5 to-white/10 overflow-hidden">
                {item.content_type === 'image' && item.file_url ? (
                  <img src={resolveMediaUrl(item.file_url)} alt={item.title}
                    className="w-full h-full object-cover cursor-pointer" onClick={() => setViewImage(item)} />
                ) : item.content_type === 'video' && item.file_url ? (
                  <video src={resolveMediaUrl(item.file_url)} className="w-full h-full object-cover" controls preload="metadata" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 cursor-pointer" onClick={() => setViewArticle(item)}>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-r from-green-500 to-emerald-500 flex items-center justify-center">
                      <i className="fas fa-file-alt text-white text-2xl"></i>
                    </div>
                    <p className={`text-xs px-4 text-center line-clamp-2 ${sub}`}>{item.article_body?.slice(0, 80)}...</p>
                  </div>
                )}
                <span className={`absolute top-2 left-2 text-xs px-2 py-0.5 rounded-full text-white bg-gradient-to-r ${typeColor[item.content_type]} font-medium`}>
                  <i className={`${typeIcon[item.content_type]} mr-1`}></i>{item.content_type}
                </span>
                <span className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full border font-medium ${
                  item.is_public ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                }`}>
                  <i className={`fas ${item.is_public ? 'fa-globe' : 'fa-lock'} mr-1`}></i>
                  {item.is_public ? 'Public' : 'Private'}
                </span>
              </div>
              <div className="p-4">
                <p className="font-semibold text-sm truncate mb-1">{item.title}</p>
                {item.description && <p className={`text-xs line-clamp-2 mb-2 ${sub}`}>{item.description}</p>}
                <div className={`flex items-center justify-between text-xs ${sub}`}>
                  <span>{formatDate(item.created_at)}</span>
                  {item.file_size && <span>{formatSize(item.file_size)}</span>}
                </div>
                <div className="flex gap-2 mt-3">
                  {item.content_type === 'article' && (
                    <button onClick={() => setViewArticle(item)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                        theme === 'dark' ? 'glass border-white/10 hover:border-blue-500/40 hover:text-blue-400' : 'bg-white border-gray-200 hover:border-blue-400 hover:text-blue-500'
                      }`}>
                      <i className="fas fa-eye mr-1"></i>Read
                    </button>
                  )}
                  <button onClick={() => handleToggleVisibility(item.id)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      theme === 'dark' ? 'glass border-white/10 hover:border-yellow-500/40 hover:text-yellow-400' : 'bg-white border-gray-200 hover:border-yellow-400 hover:text-yellow-500'
                    }`}>
                    <i className={`fas ${item.is_public ? 'fa-lock' : 'fa-globe'} mr-1`}></i>
                    {item.is_public ? 'Make Private' : 'Make Public'}
                  </button>
                  <button onClick={() => handleDelete(item.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-all">
                    <i className="fas fa-trash-alt"></i>
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <AnimatePresence>
        {modal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={closeModal}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }} onClick={e => e.stopPropagation()}
              className={`relative w-full max-w-lg rounded-3xl border p-6 ${theme === 'dark' ? 'glass border-white/20 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-2xl'}`}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <div className={`w-9 h-9 rounded-xl bg-gradient-to-r ${typeColor[modal]} flex items-center justify-center`}>
                    <i className={`${typeIcon[modal]} text-white text-sm`}></i>
                  </div>
                  {modal === 'image' ? 'Upload Image' : modal === 'video' ? 'Upload Video' : 'Write Article'}
                </h2>
                <button onClick={closeModal} className={`w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                  <i className="fas fa-times text-sm"></i>
                </button>
              </div>

              <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>Title *</label>
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Give your content a title..." className={inputCls} />
                </div>
                <div>
                  <label className={`block text-xs mb-1 ${sub}`}>Description</label>
                  <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional short description..." className={inputCls} />
                </div>

                {(modal === 'image' || modal === 'video') && (
                  <div>
                    <label className={`block text-xs mb-1 ${sub}`}>{modal === 'image' ? 'Image file *' : 'Video file *'}</label>
                    <input ref={fileRef} type="file" accept={modal === 'image' ? 'image/*' : 'video/*'} onChange={handleFileChange} className="hidden" />
                    {!file ? (
                      <button onClick={() => fileRef.current?.click()}
                        className={`w-full py-8 rounded-2xl border-2 border-dashed flex flex-col items-center gap-2 transition-all ${
                          theme === 'dark' ? 'border-white/20 hover:border-blue-500/50 text-white/40 hover:text-blue-400' : 'border-gray-300 hover:border-blue-400 text-gray-400 hover:text-blue-500'
                        }`}>
                        <i className={`${modal === 'image' ? 'fas fa-image' : 'fas fa-video'} text-3xl`}></i>
                        <span className="text-sm font-medium">Click to select {modal}</span>
                        <span className="text-xs">{modal === 'image' ? 'JPG, PNG, GIF, WebP — max 20 MB' : 'MP4, MOV, AVI — max 500 MB'}</span>
                      </button>
                    ) : (
                      <div className={`rounded-2xl border overflow-hidden ${theme === 'dark' ? 'border-white/10' : 'border-gray-200'}`}>
                        {modal === 'image' && filePreview && <img src={filePreview} alt="preview" className="w-full max-h-48 object-cover" />}
                        {modal === 'video' && filePreview && <video src={filePreview} controls className="w-full max-h-48" />}
                        <div className={`p-3 flex items-center justify-between ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-50'}`}>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className={`text-xs ${sub}`}>{formatSize(file.size)}</p>
                          </div>
                          <button onClick={() => { setFile(null); setFilePreview(null); if (fileRef.current) fileRef.current.value = ''; }}
                            className="ml-3 text-red-400 hover:text-red-300 text-sm flex-shrink-0">
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      </div>
                    )}
                    {uploading && uploadProgress > 0 && (
                      <div className="mt-2">
                        <div className={`h-1.5 rounded-full overflow-hidden ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`}>
                          <motion.div animate={{ width: `${uploadProgress}%` }} transition={{ duration: 0.3 }}
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full" />
                        </div>
                        <p className={`text-xs mt-1 ${sub}`}>{uploadProgress}% uploaded</p>
                      </div>
                    )}
                  </div>
                )}

                {modal === 'article' && (
                  <div>
                    <label className={`block text-xs mb-1 ${sub}`}>Article Body *</label>
                    <textarea value={articleBody} onChange={e => setArticleBody(e.target.value)}
                      rows={8} placeholder="Write your article content here..." className={inputCls + ' resize-none'} />
                  </div>
                )}

                <div className={`flex items-center justify-between p-3 rounded-xl border ${theme === 'dark' ? 'glass border-white/10' : 'bg-gray-50 border-gray-200'}`}>
                  <div>
                    <p className="text-sm font-medium">Visibility</p>
                    <p className={`text-xs ${sub}`}>{isPublic ? 'Visible to all players' : 'Only visible to you'}</p>
                  </div>
                  <button onClick={() => setIsPublic(p => !p)}
                    className={`relative w-11 h-6 rounded-full transition-all ${isPublic ? 'bg-blue-500' : theme === 'dark' ? 'bg-white/20' : 'bg-gray-300'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${isPublic ? 'left-5' : 'left-0.5'}`} />
                  </button>
                </div>

                {formError && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    <i className="fas fa-exclamation-circle mr-2"></i>{formError}
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={closeModal} disabled={uploading}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                    theme === 'dark' ? 'glass border-white/20 hover:bg-white/10' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'
                  } disabled:opacity-40`}>
                  Cancel
                </button>
                <button onClick={handleSubmit} disabled={uploading}
                  className={`flex-1 py-2.5 rounded-xl text-white text-sm font-semibold bg-gradient-to-r ${typeColor[modal]} hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2`}>
                  {uploading
                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />{modal !== 'article' ? 'Uploading...' : 'Saving...'}</>
                    : <><i className={modal === 'article' ? 'fas fa-save' : 'fas fa-cloud-upload-alt'}></i>{modal === 'article' ? 'Publish Article' : `Upload ${modal.charAt(0).toUpperCase() + modal.slice(1)}`}</>
                  }
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Article Modal */}
      <AnimatePresence>
        {viewArticle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewArticle(null)}>
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className={`relative w-full max-w-2xl rounded-3xl border p-6 max-h-[80vh] flex flex-col ${
                theme === 'dark' ? 'glass border-white/20 text-white' : 'bg-white border-gray-200 text-gray-900 shadow-2xl'
              }`}>
              <div className="flex items-start justify-between mb-4 flex-shrink-0">
                <div>
                  <h2 className="text-xl font-bold">{viewArticle.title}</h2>
                  {viewArticle.description && <p className={`text-sm mt-1 ${sub}`}>{viewArticle.description}</p>}
                  <p className={`text-xs mt-1 ${sub}`}>{formatDate(viewArticle.created_at)}</p>
                </div>
                <button onClick={() => setViewArticle(null)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ml-4 flex-shrink-0 ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                  <i className="fas fa-times text-sm"></i>
                </button>
              </div>
              <div className={`flex-1 overflow-y-auto text-sm leading-relaxed whitespace-pre-wrap ${sub}`}>
                {viewArticle.article_body}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* View Image Modal */}
      <AnimatePresence>
        {viewImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 cursor-zoom-out" onClick={() => setViewImage(null)}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.img initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              src={resolveMediaUrl(viewImage.file_url)} alt={viewImage.title}
              className="relative max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
              onClick={e => e.stopPropagation()} />
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
