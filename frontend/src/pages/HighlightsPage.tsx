import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { videosApi, resolveMediaUrl } from '../lib/api';

interface Video {
  id: string;
  title: string;
  description?: string;
  teams?: string;
  venue?: string;
  match_date?: string;
  duration_seconds?: number;
  total_events: number;
  total_fours: number;
  total_sixes: number;
  total_wickets: number;
  status: string;
  created_at: string;
  supercut_path?: string;
  file_path?: string;
}

type EventFilter = 'all' | 'FOUR' | 'SIX' | 'WICKET';
type SortFilter = 'auto' | 'newest' | 'oldest' | 'processing-first';
type ViewMode = 'grid' | 'list';

export default function HighlightsPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState<EventFilter>('all');
  const [sortFilter, setSortFilter] = useState<SortFilter>('auto');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchVideos = async () => {
      setLoading(true);
      try {
        const response = await videosApi.listPublic({
          page,
          per_page: 12,
          search: searchQuery || undefined,
          event_type: eventFilter === 'all' ? undefined : eventFilter,
        });
        setVideos(response.data.videos || []);
        setTotalPages(Math.ceil((response.data.total || 0) / 12));
      } catch (error) {
        console.error('Failed to fetch videos:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVideos();
  }, [page, searchQuery, eventFilter]);

  // Filter videos based on search and event type
  const hasProcessingVideos = videos.some((video) => String(video.status || '').toLowerCase() === 'processing');
  const effectiveSortFilter: Exclude<SortFilter, 'auto'> =
    sortFilter === 'auto' ? (hasProcessingVideos ? 'processing-first' : 'newest') : sortFilter;

  const filteredVideos = videos.filter((video) => {
    const matchesSearch =
      video.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      video.teams?.toLowerCase().includes(searchQuery.toLowerCase());

    if (eventFilter === 'all') return matchesSearch;

    if (eventFilter === 'FOUR' && video.total_fours > 0) return matchesSearch;
    if (eventFilter === 'SIX' && video.total_sixes > 0) return matchesSearch;
    if (eventFilter === 'WICKET' && video.total_wickets > 0) return matchesSearch;

    return false;
  }).sort((a, b) => {
    if (effectiveSortFilter === 'processing-first') {
      const aProcessing = String(a.status || '').toLowerCase() === 'processing';
      const bProcessing = String(b.status || '').toLowerCase() === 'processing';
      if (aProcessing !== bProcessing) {
        return aProcessing ? -1 : 1;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }

    if (effectiveSortFilter === 'oldest') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="text-white min-h-screen">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="glass rounded-3xl p-8 mb-8 border border-white/20 backdrop-blur-xl relative overflow-hidden"
      >
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-pink-500/10 animate-gradient"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold gradient-text flex items-center gap-3 mb-2">
              <i className="fas fa-film text-blue-400 text-3xl"></i>
              Video Library
            </h1>
            <p className="text-white/70 text-sm flex items-center gap-2">
              <i className="fas fa-video text-blue-400/60"></i>
              Browse {filteredVideos.length} cricket highlights • {videos.filter(v => String(v.status).toLowerCase() === 'completed').length} ready
            </p>
          </div>
          
          {/* View Mode Toggle */}
          <div className="flex items-center gap-2 glass px-3 py-2 rounded-xl border border-white/20">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'grid' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <i className="fas fa-grip-horizontal"></i>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-all ${
                viewMode === 'list' 
                  ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg' 
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <i className="fas fa-list"></i>
            </button>
          </div>
        </div>
      </motion.div>

      {/* Search & Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className="space-y-4 mb-8"
      >
        {/* Search Bar */}
        <div className="relative">
          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-white/40 text-lg"></i>
          <input
            type="text"
            placeholder="Search by match title, teams, or venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-4 py-4 glass border border-white/20 rounded-2xl text-white placeholder-white/40 focus:outline-none focus:border-blue-500/50 focus:ring-2 focus:ring-blue-500/20 bg-transparent transition-all text-lg"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-white/60 text-sm font-medium">
            <i className="fas fa-filter mr-2"></i>
            Filter by:
          </span>
          
          {/* Event Filter Pills */}
          <div className="flex gap-2">
            {(['all', 'FOUR', 'SIX', 'WICKET'] as EventFilter[]).map((filter) => (
              <motion.button
                key={filter}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setEventFilter(filter)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  eventFilter === filter
                    ? filter === 'FOUR'
                      ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50'
                      : filter === 'SIX'
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/50'
                      : filter === 'WICKET'
                      ? 'bg-red-500 text-white shadow-lg shadow-red-500/50'
                      : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-lg'
                    : 'glass border border-white/20 text-white/70 hover:text-white hover:border-white/40'
                }`}
              >
                {filter === 'all' && <i className="fas fa-circle-check mr-2"></i>}
                {filter === 'FOUR' && <i className="fas fa-circle mr-2"></i>}
                {filter === 'SIX' && <i className="fas fa-circle mr-2"></i>}
                {filter === 'WICKET' && <i className="fas fa-circle mr-2"></i>}
                {filter === 'all' ? 'All Events' : `${filter}s`}
              </motion.button>
            ))}
          </div>

          <div className="h-6 w-px bg-white/20 mx-1"></div>

          {/* Sort Dropdown (Improved) */}
          <div className="flex items-center gap-2 glass px-4 py-2 rounded-xl border border-white/20">
            <i className="fas fa-sort text-white/40"></i>
            <select
              value={sortFilter}
              onChange={(e) => setSortFilter(e.target.value as SortFilter)}
              className="bg-transparent text-white text-sm focus:outline-none cursor-pointer"
            >
              <option value="auto" className="bg-gray-900">Auto Sort</option>
              <option value="newest" className="bg-gray-900">Newest First</option>
              <option value="oldest" className="bg-gray-900">Oldest First</option>
              <option value="processing-first" className="bg-gray-900">Processing First</option>
            </select>
          </div>
        </div>
      </motion.div>

      {/* Video Grid/List */}
      {loading ? (
        <div className={viewMode === 'grid' 
          ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
          : "space-y-4"
        }>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="glass rounded-2xl animate-pulse border border-white/10">
              <div className={viewMode === 'grid' ? "aspect-video bg-white/5 rounded-t-2xl" : "h-32 bg-white/5 rounded-t-2xl"} />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-white/10 rounded w-3/4" />
                <div className="h-3 bg-white/10 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredVideos.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-20 glass rounded-3xl border border-white/20"
        >
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 flex items-center justify-center">
            <i className="fas fa-magnifying-glass text-3xl text-white/40"></i>
          </div>
          <h3 className="text-2xl font-semibold text-white mb-2">No highlights found</h3>
          <p className="text-white/60 mb-6">Try adjusting your search or filters</p>
          {(searchQuery || eventFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setEventFilter('all');
              }}
              className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl font-medium transition-all"
            >
              <i className="fas fa-rotate-left mr-2"></i>
              Clear Filters
            </button>
          )}
        </motion.div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={viewMode}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className={viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" 
              : "space-y-4"
            }
          >
            {filteredVideos.map((video, i) => (
              <HighlightCard key={video.id} video={video} index={i} viewMode={viewMode} />
            ))}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex justify-center gap-3 mt-8"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-6 py-2 glass border border-white/20 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
          >
            <i className="fas fa-chevron-left mr-2"></i>
            Previous
          </motion.button>
          <span className="px-4 py-2 text-white/60">
            Page {page} of {totalPages}
          </span>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-6 py-2 glass border border-white/20 rounded-xl text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-white/10 transition-all"
          >
            Next
            <i className="fas fa-chevron-right ml-2"></i>
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

// Highlight Card Component
function HighlightCard({ video, index, viewMode }: { video: Video; index: number; viewMode: ViewMode }) {
  const [isHovered, setIsHovered] = useState(false);
  
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getThumbnailUrl = (video: Video): string => {
    // If video has a supercut or file path, generate thumbnail URL
    if (video.supercut_path) {
      return resolveMediaUrl(video.supercut_path);
    }
    if (video.file_path) {
      return resolveMediaUrl(video.file_path);
    }
    // Fallback to gradient
    return '';
  };

  const statusConfig = {
    processing: {
      icon: 'fa-spinner animate-spin',
      text: 'Processing',
      className: 'bg-yellow-500/90 text-white shadow-lg shadow-yellow-500/50',
    },
    failed: {
      icon: 'fa-triangle-exclamation',
      text: 'Failed',
      className: 'bg-red-500/90 text-white shadow-lg shadow-red-500/50',
    },
    completed: {
      icon: 'fa-check-circle',
      text: 'Ready',
      className: 'bg-emerald-500/90 text-white shadow-lg shadow-emerald-500/50',
    },
  };

  const status = String(video.status || '').toLowerCase() as keyof typeof statusConfig;
  const statusInfo = statusConfig[status];

  if (viewMode === 'list') {
    return (
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: index * 0.03 }}
      >
        <Link
          to={`/video/${video.id}`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          className="block glass rounded-2xl border border-white/20 overflow-hidden hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20 transition-all group"
        >
          <div className="flex gap-4 p-4">
            {/* Thumbnail */}
            <div className="w-48 h-28 flex-shrink-0 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 relative overflow-hidden">
              {getThumbnailUrl(video) ? (
                <img 
                  src={getThumbnailUrl(video) + '#t=1'} 
                  alt={video.title}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-all">
                <motion.div
                  animate={{ scale: isHovered ? 1.2 : 1 }}
                  className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center shadow-xl"
                >
                  <i className="fas fa-play text-white ml-1"></i>
                </motion.div>
              </div>
              {statusInfo && (
                <div className={`absolute top-2 left-2 px-2 py-1 rounded-lg text-xs font-medium ${statusInfo.className}`}>
                  <i className={`fas ${statusInfo.icon} mr-1`}></i>
                  {statusInfo.text}
                </div>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1 group-hover:text-blue-400 transition-colors line-clamp-1">
                  {video.title}
                </h3>
                <p className="text-sm text-white/60 mb-2">
                  {video.teams || 'Unknown Teams'} • {video.venue || 'Unknown Venue'}
                </p>
              </div>

              {/* Stats Row */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-sm font-medium">
                  <i className="fas fa-circle text-[6px]"></i>
                  {video.total_fours}
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-sm font-medium">
                  <i className="fas fa-circle text-[6px]"></i>
                  {video.total_sixes}
                </div>
                <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-sm font-medium">
                  <i className="fas fa-circle text-[6px]"></i>
                  {video.total_wickets}
                </div>
                <div className="ml-auto flex items-center gap-2 text-white/60 text-sm">
                  <i className="fas fa-clock"></i>
                  {formatDuration(video.duration_seconds)}
                </div>
                <div className="text-white/60 text-sm">
                  {formatDate(video.match_date)}
                </div>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  // Grid View (Enhanced)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Link
        to={`/video/${video.id}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className="block glass rounded-2xl border border-white/20 overflow-hidden hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20 transition-all group relative"
      >
        {/* Thumbnail */}
        <div className="aspect-video bg-gradient-to-br from-blue-500/20 via-purple-500/20 to-pink-500/20 relative overflow-hidden">
          {getThumbnailUrl(video) ? (
            <img 
              src={getThumbnailUrl(video) + '#t=1'} 
              alt={video.title}
              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : null}
          
          {/* Overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-40 transition-opacity"></div>
          
          {/* Play button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ 
                scale: isHovered ? 1.2 : 1,
                rotate: isHovered ? 90 : 0
              }}
              transition={{ type: "spring", stiffness: 300 }}
              className="w-16 h-16 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center opacity-80 group-hover:opacity-100 shadow-2xl shadow-blue-500/50"
            >
              <i className="fas fa-play text-white text-xl ml-1"></i>
            </motion.div>
          </div>
          
          {/* Duration badge */}
          <div className="absolute bottom-3 right-3 px-3 py-1.5 bg-black/80 backdrop-blur-md rounded-xl text-xs text-white font-medium flex items-center gap-1.5 shadow-lg">
            <i className="fas fa-clock"></i>
            {formatDuration(video.duration_seconds)}
          </div>
          
          {/* Status badge */}
          {statusInfo && (
            <div className={`absolute top-3 left-3 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${statusInfo.className}`}>
              <i className={`fas ${statusInfo.icon}`}></i>
              {statusInfo.text}
            </div>
          )}

          {/* Quick Actions (on hover) */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-3 right-3 flex gap-2"
              >
                {video.supercut_path && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      window.open(resolveMediaUrl(video.supercut_path!), '_blank');
                    }}
                    className="p-2 bg-black/80 backdrop-blur-md rounded-lg text-white hover:bg-blue-500 transition-colors"
                  >
                    <i className="fas fa-download"></i>
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Content */}
        <div className="p-5">
          <h3 className="font-semibold text-white mb-2 line-clamp-1 group-hover:text-blue-400 transition-colors text-base">
            {video.title}
          </h3>
          <p className="text-sm text-white/60 mb-4 line-clamp-1">
            {video.teams || 'Unknown Teams'}
          </p>
          <div className="flex items-center gap-2 text-xs text-white/50 mb-4">
            <i className="fas fa-calendar"></i>
            {formatDate(video.match_date)}
          </div>

          {/* Event Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center px-2 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <div className="text-lg font-bold text-blue-400">{video.total_fours}</div>
              <div className="text-[10px] text-white/60 uppercase tracking-wide">Fours</div>
            </div>
            <div className="text-center px-2 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="text-lg font-bold text-emerald-400">{video.total_sixes}</div>
              <div className="text-[10px] text-white/60 uppercase tracking-wide">Sixes</div>
            </div>
            <div className="text-center px-2 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="text-lg font-bold text-red-400">{video.total_wickets}</div>
              <div className="text-[10px] text-white/60 uppercase tracking-wide">Wickets</div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
