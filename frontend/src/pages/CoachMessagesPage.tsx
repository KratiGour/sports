import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { messagesApi, type MessageItem, type PlayerConversation } from '../lib/api';

export default function CoachMessagesPage() {
  const { theme } = useThemeStore();
  const { user } = useAuthStore();

  const [players, setPlayers] = useState<PlayerConversation[]>([]);
  const [selected, setSelected] = useState<PlayerConversation | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const glass = theme === 'dark' ? 'glass border-white/20' : 'bg-white border-gray-200 shadow-lg';
  const sub = theme === 'dark' ? 'text-white/60' : 'text-gray-500';
  const divider = theme === 'dark' ? 'border-white/10' : 'border-gray-200';

  useEffect(() => {
    messagesApi.listPlayers()
      .then(r => setPlayers(r.data))
      .catch(() => setPlayers([]))
      .finally(() => setLoadingPlayers(false));
  }, []);

  const loadConversation = useCallback(async (playerId: string) => {
    setLoadingMsgs(true);
    try {
      const r = await messagesApi.getConversation(playerId);
      setMessages(r.data);
      setPlayers(prev => prev.map(p => p.player_id === playerId ? { ...p, unread_count: 0 } : p));
    } finally {
      setLoadingMsgs(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return;
    loadConversation(selected.player_id);
    pollRef.current = setInterval(() => {
      messagesApi.getConversation(selected.player_id)
        .then(r => setMessages(r.data))
        .catch(() => {});
    }, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selected, loadConversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSelectPlayer = (player: PlayerConversation) => {
    setSelected(player);
    setMobileShowChat(true);
  };

  const handleSend = async () => {
    if (!input.trim() || !selected || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    const optimistic: MessageItem = {
      id: `temp-${Date.now()}`,
      coach_id: user?.id || '',
      player_id: selected.player_id,
      sender_id: user?.id || '',
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, optimistic]);
    try {
      const r = await messagesApi.send(selected.player_id, content);
      setMessages(prev => prev.map(m => m.id === optimistic.id ? r.data : m));
      setPlayers(prev => prev.map(p =>
        p.player_id === selected.player_id
          ? { ...p, last_message: content, last_message_at: new Date().toISOString() }
          : p
      ));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimistic.id));
      setInput(content);
    } finally {
      setSending(false);
    }
  };

  function formatTime(iso: string | null) {
    if (!iso) return '';
    const d = new Date(iso);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const filteredPlayers = players.filter(p =>
    p.player_name.toLowerCase().includes(search.toLowerCase()) ||
    p.player_email.toLowerCase().includes(search.toLowerCase())
  );

  const totalUnread = players.reduce((s, p) => s + p.unread_count, 0);

  return (
    <div className={`${theme === 'dark' ? 'text-white' : 'text-gray-900'} h-[calc(100vh-8rem)] flex flex-col`}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-5 mb-4 border flex-shrink-0 ${glass}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold gradient-text flex items-center gap-3">
              <i className="fas fa-comments text-purple-400"></i>Messages
              {totalUnread > 0 && (
                <span className="text-sm px-2 py-0.5 rounded-full bg-blue-500 text-white font-semibold">{totalUnread}</span>
              )}
            </h1>
            <p className={`mt-0.5 text-sm ${sub}`}>Direct messages with your players</p>
          </div>
        </div>
      </motion.div>

      <div className={`flex-1 flex rounded-3xl border overflow-hidden ${glass} min-h-0`}>
        {/* Player list */}
        <div className={`${mobileShowChat ? 'hidden lg:flex' : 'flex'} flex-col w-full lg:w-80 flex-shrink-0 border-r ${divider}`}>
          <div className={`p-3 border-b ${divider}`}>
            <div className="relative">
              <i className={`fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-xs ${sub}`}></i>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search players..."
                className={`w-full pl-8 pr-3 py-2 rounded-xl text-sm border focus:outline-none transition-all ${
                  theme === 'dark' ? 'glass border-white/10 text-white focus:border-purple-500 placeholder-white/30' : 'bg-gray-50 border-gray-200 focus:border-purple-400'
                }`} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingPlayers ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : filteredPlayers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                  <i className={`fas fa-user-friends text-2xl ${sub}`}></i>
                </div>
                <p className={`text-sm font-medium ${sub}`}>{search ? 'No players found' : 'No players yet'}</p>
                {!search && <p className={`text-xs mt-1 ${sub}`}>Players who submit videos will appear here</p>}
              </div>
            ) : (
              filteredPlayers.map(player => (
                <button key={player.player_id} onClick={() => handleSelectPlayer(player)}
                  className={`w-full p-4 text-left transition-all border-b ${divider} ${
                    selected?.player_id === player.player_id
                      ? theme === 'dark' ? 'bg-purple-500/10 border-l-2 border-l-purple-500' : 'bg-purple-50 border-l-2 border-l-purple-500'
                      : theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-gray-50'
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold text-sm">
                        {player.player_name.charAt(0).toUpperCase()}
                      </div>
                      {player.unread_count > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-bold">
                          {player.unread_count > 9 ? '9+' : player.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-medium text-sm truncate">{player.player_name}</p>
                        <span className={`text-[11px] flex-shrink-0 ${sub}`}>{formatTime(player.last_message_at)}</span>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${player.unread_count > 0 ? theme === 'dark' ? 'text-white/80' : 'text-gray-700' : sub}`}>
                        {player.last_message || player.player_email}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className={`${mobileShowChat ? 'flex' : 'hidden lg:flex'} flex-1 flex-col min-w-0`}>
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div className={`w-20 h-20 rounded-3xl flex items-center justify-center ${theme === 'dark' ? 'bg-purple-500/10' : 'bg-purple-50'}`}>
                <i className="fas fa-comments text-4xl text-purple-400"></i>
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg">Select a player</p>
                <p className={`text-sm mt-1 ${sub}`}>Choose a player from the list to start messaging</p>
              </div>
            </div>
          ) : (
            <>
              <div className={`p-4 border-b flex items-center gap-3 flex-shrink-0 ${divider}`}>
                <button onClick={() => setMobileShowChat(false)}
                  className={`lg:hidden mr-1 w-8 h-8 rounded-lg flex items-center justify-center ${theme === 'dark' ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
                  <i className="fas fa-arrow-left text-sm"></i>
                </button>
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                  {selected.player_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{selected.player_name}</p>
                  <p className={`text-xs truncate ${sub}`}>{selected.player_email}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loadingMsgs ? (
                  <div className="flex justify-center py-12">
                    <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 py-12">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${theme === 'dark' ? 'bg-white/5' : 'bg-gray-100'}`}>
                      <i className={`fas fa-comment-dots text-2xl ${sub}`}></i>
                    </div>
                    <p className={`text-sm ${sub}`}>No messages yet. Say hello!</p>
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => {
                      const isCoach = msg.sender_id !== selected.player_id;
                      const showDate = i === 0 || (
                        new Date(msg.created_at!).toDateString() !== new Date(messages[i - 1].created_at!).toDateString()
                      );
                      return (
                        <div key={msg.id}>
                          {showDate && (
                            <div className="flex items-center gap-3 my-4">
                              <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`} />
                              <span className={`text-xs px-2 ${sub}`}>
                                {new Date(msg.created_at!).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                              </span>
                              <div className={`flex-1 h-px ${theme === 'dark' ? 'bg-white/10' : 'bg-gray-200'}`} />
                            </div>
                          )}
                          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                            className={`flex ${isCoach ? 'justify-end' : 'justify-start'}`}>
                            {!isCoach && (
                              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 self-end mb-1">
                                {selected.player_name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="max-w-[70%]">
                              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                isCoach
                                  ? 'bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-br-sm'
                                  : theme === 'dark' ? 'glass border border-white/10 rounded-bl-sm' : 'bg-gray-100 border border-gray-200 rounded-bl-sm'
                              }`}>
                                {msg.content}
                              </div>
                              <p className={`text-[11px] mt-1 ${isCoach ? 'text-right' : ''} ${sub}`}>
                                {formatTime(msg.created_at)}
                                {isCoach && <i className={`fas fa-check ml-1 ${msg.is_read ? 'text-blue-400' : ''}`}></i>}
                              </p>
                            </div>
                          </motion.div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </>
                )}
              </div>

              <div className={`p-4 border-t flex-shrink-0 ${divider}`}>
                <div className="flex gap-2 items-end">
                  <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    placeholder={`Message ${selected.player_name}...`}
                    className={`flex-1 px-4 py-3 rounded-2xl border text-sm focus:outline-none transition-all ${
                      theme === 'dark' ? 'glass border-white/10 text-white focus:border-purple-500 placeholder-white/30' : 'bg-gray-50 border-gray-200 focus:border-purple-400'
                    }`} />
                  <button onClick={handleSend} disabled={!input.trim() || sending}
                    className="w-11 h-11 rounded-2xl bg-gradient-to-r from-purple-500 to-pink-600 text-white flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-all flex-shrink-0">
                    {sending
                      ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <i className="fas fa-paper-plane text-sm"></i>}
                  </button>
                </div>
                <p className={`text-[11px] mt-1.5 ${sub}`}>Press Enter to send</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
