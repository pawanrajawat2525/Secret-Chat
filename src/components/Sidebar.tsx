/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { useXmtp } from '../contexts/XmtpContext';
import { Conversation } from '@xmtp/browser-sdk';
import { Plus, User, LogOut, Search, Shield } from 'lucide-react';
import { usePrivy } from '@privy-io/react-auth';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  onSelect: (convo: Conversation) => void;
  selectedId?: string;
}

function ConversationRow({ 
  convo, 
  isSelected, 
  onSelect 
}: { 
  convo: Conversation; 
  isSelected: boolean; 
  onSelect: (c: Conversation) => void 
}) {
  const [peerAddress, setPeerAddress] = useState<string>('Loading...');

  useEffect(() => {
    const getPeer = async () => {
      try {
        // @ts-ignore
        if ('peerInboxId' in convo && typeof (convo as any).peerInboxId === 'function') {
          const addr = await (convo as any).peerInboxId();
          setPeerAddress(addr);
        } else {
          setPeerAddress('Group Chat');
        }
      } catch (e) {
        setPeerAddress('Unknown');
      }
    };
    getPeer();
  }, [convo]);

  const truncateAddress = (addr: string) => {
    if (!addr || addr === 'Loading...' || addr === 'Group Chat') return addr;
    if (addr.startsWith('0x')) {
      return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    }
    return addr.slice(0, 10) + '...';
  };

  return (
    <div 
      onClick={() => onSelect(convo)}
      className={`group p-3 mx-2 rounded-xl flex gap-3 cursor-pointer transition-all duration-200 ${
        isSelected 
          ? 'bg-slate-800 border border-slate-700/50 shadow-lg' 
          : 'hover:bg-slate-800/20 border border-transparent'
      }`}
    >
      <div className="relative shrink-0">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-opacity ${isSelected ? 'bg-cyan-500 text-slate-900' : 'bg-slate-800 text-slate-500 opacity-60'}`}>
          <User size={20} />
        </div>
        {isSelected && (
          <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-slate-900 rounded-full"></div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start mb-0.5">
          <span className={`text-sm font-semibold truncate ${isSelected ? 'text-white' : 'text-slate-300'}`}>
            {truncateAddress(peerAddress)}
          </span>
          <span className="text-[10px] text-slate-600 font-mono">MLS</span>
        </div>
        <p className={`text-xs truncate ${isSelected ? 'text-cyan-400 font-medium' : 'text-slate-500'}`}>
          {isSelected ? 'Secure session active' : peerAddress}
        </p>
      </div>
    </div>
  );
}

export function Sidebar({ onSelect, selectedId }: SidebarProps) {
  const { client, profile, updateProfile } = useXmtp();
  const { user, logout } = usePrivy();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [newChatAddress, setNewChatAddress] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [tempName, setTempName] = useState(profile.name);

  useEffect(() => {
    if (!client) return;
    
    // Set initial name from email if empty
    if (!profile.name && user?.google?.email) {
      updateProfile({ name: user.google.email.split('@')[0] });
    }

    const loadConversations = async () => {
      const convos = await client.conversations.list();
      setConversations(convos);

      const stream = await client.conversations.stream();
      for await (const convo of stream) {
        setConversations((prev) => [convo, ...prev]);
      }
    };

    loadConversations();
  }, [client]);

  const handleStartNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!client || !newChatAddress.trim()) return;

    try {
      // @ts-ignore
      const convo = await client.conversations.createDm(newChatAddress.trim());
      setConversations((prev) => [convo, ...prev]);
      onSelect(convo);
      setNewChatAddress('');
      setIsAdding(false);
    } catch (err) {
      console.error('Failed to start chat:', err);
    }
  };

  const handleSaveProfile = () => {
    updateProfile({ name: tempName });
    setIsEditingProfile(false);
  };

  return (
    <aside className="w-80 border-r border-slate-800 bg-slate-900/30 flex flex-col shrink-0">
      {/* Identity Bar */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-4 shrink-0 bg-slate-900/50 backdrop-blur-xl group">
        <div 
          onClick={() => {
            setIsEditingProfile(true);
            setTempName(profile.name);
          }}
          className="flex items-center gap-3 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-600 p-[1.5px] shrink-0">
            <div className="w-full h-full rounded-lg bg-slate-900 flex items-center justify-center overflow-hidden">
              <img 
                src={`https://api.dicebear.com/7.x/identicon/svg?seed=${profile.name || user?.id || 'default'}`} 
                className="w-full h-full opacity-80" 
              />
            </div>
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block leading-none mb-1">Identity</span>
            <span className="text-xs font-mono text-cyan-400 truncate block">
              {profile.name || 'Anonymous'}
            </span>
          </div>
        </div>
        <div className="flex items-center">
          <button 
            onClick={() => logout()}
            className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* Profile Editor Modal Overlay */}
      <AnimatePresence>
        {isEditingProfile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 p-6 rounded-3xl w-full max-w-xs shadow-2xl"
            >
              <h3 className="text-white font-bold mb-6 text-center uppercase tracking-widest text-sm">Update Profile</h3>
              <div className="flex flex-col items-center gap-4 mb-6">
                 <div className="w-20 h-20 rounded-2xl bg-slate-800 flex items-center justify-center border border-slate-700">
                    <img 
                      src={`https://api.dicebear.com/7.x/identicon/svg?seed=${tempName || 'default'}`} 
                      className="w-16 h-16 opacity-80" 
                    />
                 </div>
                 <input 
                   type="text"
                   value={tempName}
                   onChange={(e) => setTempName(e.target.value)}
                   className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-center text-white focus:border-cyan-500/50 outline-none"
                   placeholder="Your display name"
                 />
              </div>
              <div className="flex gap-3">
                 <button 
                   onClick={handleSaveProfile}
                   className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-xl transition-colors text-xs uppercase tracking-wider"
                 >
                   Save
                 </button>
                 <button 
                   onClick={() => setIsEditingProfile(false)}
                   className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-400 font-bold py-3 rounded-xl transition-colors text-xs uppercase tracking-wider"
                 >
                   Cancel
                 </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search/New */}
      <div className="p-4">
        {isAdding ? (
          <form onSubmit={handleStartNewChat} className="space-y-2">
            <input
              autoFocus
              type="text"
              placeholder="0x... Target Address"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2 px-3 text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:border-cyan-500/50 transition-all font-mono"
              value={newChatAddress}
              onChange={(e) => setNewChatAddress(e.target.value)}
            />
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-cyan-600 text-white text-[10px] uppercase font-bold tracking-wider py-2 rounded-lg hover:bg-cyan-500 transition-colors shadow-[0_0_10px_rgba(6,182,212,0.2)]">Start</button>
              <button type="button" onClick={() => setIsAdding(false)} className="flex-1 bg-slate-800 text-slate-400 text-[10px] uppercase font-bold tracking-wider py-2 rounded-lg hover:bg-slate-700 transition-colors">Cancel</button>
            </div>
          </form>
        ) : (
          <div className="relative group">
            <input 
              readOnly
              onClick={() => setIsAdding(true)}
              type="text" 
              placeholder="Search or start chat..." 
              className="w-full bg-slate-950 border border-slate-800 rounded-lg py-2.5 pl-10 pr-4 text-xs text-slate-400 cursor-pointer hover:border-slate-700 transition-all"
            />
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-600 group-hover:text-slate-500" />
            <Plus className="w-4 h-4 absolute right-3.5 top-3 text-cyan-500" />
          </div>
        )}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto space-y-1 py-2">
        <div className="px-4 pb-2">
          <span className="text-[10px] font-bold text-slate-600 uppercase tracking-[0.2em]">Active Sessions</span>
        </div>
        {conversations.length === 0 ? (
          <div className="px-8 py-10 text-center opacity-30">
            <Shield size={32} className="mx-auto mb-3" />
            <p className="text-xs uppercase tracking-widest leading-loose">No Encrypted<br/>Channels Found</p>
          </div>
        ) : (
          conversations.map((convo) => (
            <ConversationRow
              key={convo.id}
              convo={convo}
              isSelected={selectedId === convo.id}
              onSelect={onSelect}
            />
          ))
        )}
      </div>

      {/* Footer Status */}
      <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-900/20">
        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">Network</span>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
          <span className="text-[10px] text-emerald-500 font-bold font-mono">XMTP-MLS</span>
        </div>
      </div>
    </aside>
  );
}
