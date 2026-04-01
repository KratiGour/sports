import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

export default function AdminUsersPage() {
  const { theme } = useThemeStore();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchUsers();
  }, [page, search, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('access_token');
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: '20',
      });
      
      if (search) params.append('search', search);
      if (roleFilter) params.append('role', roleFilter);
      if (statusFilter) params.append('is_active', statusFilter);

      const response = await axios.get(`${API_URL}/api/v1/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setUsers(response.data.users);
      setTotal(response.data.total);
      setTotalPages(response.data.total_pages);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const token = localStorage.getItem('access_token');
      await axios.patch(
        `${API_URL}/api/v1/admin/users/${userId}`,
        { is_active: !currentStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const getRoleBadge = (role: string) => {
    const colors = {
      ADMIN: 'from-red-500/20 to-orange-500/20 text-red-400 border-red-500/30',
      COACH: 'from-green-500/20 to-emerald-500/20 text-green-400 border-green-500/30',
      PLAYER: 'from-blue-500/20 to-cyan-500/20 text-blue-400 border-blue-500/30',
    };
    return colors[role as keyof typeof colors] || colors.PLAYER;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className={theme === 'dark' ? 'text-white' : 'text-gray-900'}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 mb-8 border ${
          theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        <h1 className="text-3xl font-bold gradient-text flex items-center gap-3">
          <i className="fas fa-users text-blue-400"></i>
          User Management
        </h1>
        <p className={`mt-2 text-sm ${theme === 'dark' ? 'text-white/70' : 'text-gray-600'}`}>
          Manage all users, search, filter, and control account status
        </p>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className={`rounded-3xl p-6 mb-6 border ${
          theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
              <i className="fas fa-search mr-1"></i> Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Name or email..."
              className={`w-full px-4 py-2 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'glass border-white/20 text-white focus:border-blue-500'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none`}
            />
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
              <i className="fas fa-user-tag mr-1"></i> Role
            </label>
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
              className={`w-full px-4 py-2 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'glass border-white/20 text-white focus:border-blue-500'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none`}
            >
              <option value="">All Roles</option>
              <option value="PLAYER">Player</option>
              <option value="COACH">Coach</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>

          <div>
            <label className={`block text-sm font-medium mb-2 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
              <i className="fas fa-toggle-on mr-1"></i> Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className={`w-full px-4 py-2 rounded-xl border transition-all ${
                theme === 'dark'
                  ? 'glass border-white/20 text-white focus:border-blue-500'
                  : 'bg-gray-50 border-gray-300 text-gray-900 focus:border-blue-500'
              } focus:outline-none`}
            >
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Suspended</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
            Showing {users.length} of {total} users
          </p>
          <button
            onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setPage(1); }}
            className={`text-sm px-4 py-2 rounded-xl border transition-all ${
              theme === 'dark'
                ? 'glass border-white/20 hover:bg-white/10'
                : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
            }`}
          >
            <i className="fas fa-redo mr-1"></i> Reset Filters
          </button>
        </div>
      </motion.div>

      {/* Users Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className={`rounded-3xl p-6 border ${
          theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg'
        }`}
      >
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-12">
            <i className="fas fa-users text-4xl text-white/20 mb-4"></i>
            <p className={theme === 'dark' ? 'text-white/60' : 'text-gray-600'}>No users found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {users.map((user, i) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl p-4 border transition-all ${
                  theme === 'dark'
                    ? 'glass border-white/10 hover:border-white/20'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className={`text-sm ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
                        {user.email}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-3 py-1 rounded-full border bg-gradient-to-r ${getRoleBadge(user.role)}`}>
                      {user.role}
                    </span>
                    
                    <span className={`text-xs px-3 py-1 rounded-full ${
                      user.is_active
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {user.is_active ? 'Active' : 'Suspended'}
                    </span>

                    <div className={`text-xs ${theme === 'dark' ? 'text-white/50' : 'text-gray-500'}`}>
                      <div>Joined: {formatDate(user.created_at)}</div>
                      <div>Last login: {formatDate(user.last_login)}</div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => toggleUserStatus(user.id, user.is_active)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        user.is_active
                          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/30'
                          : 'bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30'
                      }`}
                    >
                      <i className={`fas ${user.is_active ? 'fa-ban' : 'fa-check'} mr-1`}></i>
                      {user.is_active ? 'Suspend' : 'Activate'}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`px-4 py-2 rounded-xl border transition-all ${
                page === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'glass border-white/20 hover:bg-white/10'
                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
              }`}
            >
              <i className="fas fa-chevron-left"></i>
            </button>
            
            <span className={`px-4 py-2 ${theme === 'dark' ? 'text-white/60' : 'text-gray-600'}`}>
              Page {page} of {totalPages}
            </span>
            
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className={`px-4 py-2 rounded-xl border transition-all ${
                page === totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : theme === 'dark'
                    ? 'glass border-white/20 hover:bg-white/10'
                    : 'bg-gray-50 border-gray-300 hover:bg-gray-100'
              }`}
            >
              <i className="fas fa-chevron-right"></i>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
