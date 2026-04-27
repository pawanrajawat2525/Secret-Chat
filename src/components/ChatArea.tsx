/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, useRef } from 'react';
import { Conversation, Message } from '@xmtp/browser-sdk';
import { Send, User, Loader2, ShieldCheck, Info, Shield, Lock, Video, Phone, Image as ImageIcon, Paperclip, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useXmtp } from '../contexts/XmtpContext';

interface ChatAreaProps {
  conversation: Conversation | null;
  onStartCall: (type: 'video' | 'audio') => void;
}

export function ChatArea({ conversation, onStartCall }: ChatAreaProps) {
  const { profile } = useXmtp();
  const [messages, setMessages] = useState<any[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [peerAddress, setPeerAddress] = useState<string>('');
  const [peerTyping, setPeerTyping] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!conversation) {
      setMessages([]);
      setPeerAddress('');
      return;
    }

    const loadMessages = async () => {
      setIsLoading(true);
      try {
        // Get peer address
        if ('peerInboxId' in conversation && typeof (conversation as any).peerInboxId === 'function') {
          const addr = await (conversation as any).peerInboxId();
          setPeerAddress(addr);
        }

        const history = await conversation.messages();
        setMessages(history);
        
        // Stream messages
        // @ts-ignore
        const stream = await conversation.stream();
        for await (const msg of stream) {
          const content = msg.content as any;
          
          // Handle meta-messages (typing, signaling)
          try {
            if (typeof content?.text === 'string' && content.text.startsWith('{')) {
              const data = JSON.parse(content.text);
              if (data.type === 'status' && data.status === 'typing') {
                setPeerTyping(true);
                setTimeout(() => setPeerTyping(false), 3000);
                continue;
              }
            }
          } catch (e) {
            // Not JSON or other error
          }

          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadMessages();
  }, [conversation]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, peerTyping]);

  const sendTypingStatus = async () => {
    if (!conversation) return;
    try {
      // @ts-ignore
      await conversation.sendText(JSON.stringify({ type: 'status', status: 'typing' }));
    } catch (e) {}
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    
    if (!isTyping) {
      setIsTyping(true);
      sendTypingStatus();
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
    }, 2000);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!conversation || !input.trim()) return;

    const text = input.trim();
    setInput('');
    setIsTyping(false);

    try {
      // @ts-ignore
      await conversation.sendText(text);
    } catch (err) {
      console.error('Failed to send message:', err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !conversation) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64Content = event.target?.result as string;
      const type = file.type.startsWith('image/') ? 'image' : 'video';
      
      try {
        // @ts-ignore
        await conversation.sendText(JSON.stringify({
          type: 'media',
          mediaType: type,
          data: base64Content,
          fileName: file.name
        }));
      } catch (err) {
        console.error('Failed to send media:', err);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!conversation) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center bg-[#020617] relative overflow-hidden">
        <div className="relative z-10 text-center">
          <div className="w-24 h-24 rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-6 mx-auto shadow-2xl">
            <Shield size={48} className="text-slate-800" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight mb-2">SECURE ENCLAVE</h2>
          <p className="text-slate-500 text-sm max-w-xs mx-auto">
            All messages in this terminal are end-to-end encrypted. Select a peer to establish a session.
          </p>
        </div>
        
        {/* Atmospheric Backdrops */}
        <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none"></div>
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none"></div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col relative bg-[#020617] overflow-hidden">
      {/* Chat Header */}
      <header className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/20 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
            <User size={18} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-white truncate max-w-[200px]">
              {peerAddress || 'Unknown Identity'}
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase font-bold tracking-widest font-mono">
              E2E Encrypted
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => onStartCall('audio')}
            className="text-slate-500 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-slate-800"
          >
            <Phone size={18} />
          </button>
          <button 
            onClick={() => onStartCall('video')}
            className="text-slate-500 hover:text-cyan-400 transition-colors p-2 rounded-lg hover:bg-slate-800"
          >
            <Video size={18} />
          </button>
          <div className="w-[1px] h-6 bg-slate-800 mx-1"></div>
          <button className="text-slate-500 hover:text-white transition-colors"><Info size={18} /></button>
        </div>
      </header>

      {/* Message Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide relative z-10"
      >
        {isLoading && messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Loader2 className="animate-spin text-cyan-500" size={32} />
            <span className="text-[10px] text-slate-600 uppercase font-bold tracking-[0.2em]">Synchronizing Registry...</span>
          </div>
        ) : (
          <>
            <AnimatePresence initial={false}>
              {messages.map((msg) => {
                const isMine = msg.senderInboxId === (conversation as any).client?.inboxId || msg.senderInboxId === (conversation as any).clientInboxId;
                let contentText = (msg.content as any)?.text || (typeof msg.content === 'string' ? msg.content : 'Unsupported message');
                let media: any = null;
                
                try {
                  if (typeof contentText === 'string' && contentText.startsWith('{')) {
                    const data = JSON.parse(contentText);
                    if (data.type === 'media') {
                      media = data;
                      contentText = '';
                    } else if (data.type === 'status') {
                      return null; // Skip status messages in render
                    }
                  }
                } catch (e) {}

                const sentAt = msg.sentAt || (msg.sentAtNs ? new Date(Number(msg.sentAtNs) / 1000000) : new Date());
                
                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    className={`flex gap-3 max-w-[85%] ${isMine ? 'flex-row-reverse ml-auto' : 'flex-row'}`}
                  >
                    <div className={`w-8 h-8 rounded shrink-0 self-end mb-2 flex items-center justify-center font-bold text-[10px] ${
                      isMine ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-500'
                    }`}>
                      {isMine ? (profile.name?.[0].toUpperCase() || 'ME') : 'ID'}
                    </div>
                    <div className={`space-y-1 ${isMine ? 'items-end flex flex-col' : ''}`}>
                      <div className={`p-4 rounded-2xl shadow-xl border transition-all ${
                        isMine 
                          ? 'bg-cyan-600/10 text-cyan-50 border-cyan-500/20 hover:bg-cyan-600/20 rounded-br-none shadow-[0_0_20px_rgba(6,182,212,0.05)]' 
                          : 'bg-slate-900 text-slate-200 border-slate-800 rounded-bl-none hover:border-slate-700'
                      }`}>
                        {media ? (
                          <div className="space-y-2">
                             {media.mediaType === 'image' ? (
                               <img src={media.data} className="max-w-full rounded-lg shadow-sm" alt="Shared" />
                             ) : (
                               <video src={media.data} controls className="max-w-full rounded-lg shadow-sm" />
                             )}
                             {media.fileName && <p className="text-[10px] opacity-60 italic">{media.fileName}</p>}
                          </div>
                        ) : (
                          <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                            {contentText}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 px-1">
                        <span className="text-[10px] text-slate-600 font-mono">
                          {sentAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {isMine && (
                          <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2 ml-1">
                            <ShieldCheck size={10} className="text-emerald-500/50" />
                            <span className="text-[9px] text-slate-700 uppercase font-black">Delivered</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            
            {peerTyping && (
              <motion.div 
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 text-slate-500 text-xs font-mono ml-11"
              >
                <div className="flex gap-1">
                  <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce"></span>
                  <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1 h-1 bg-cyan-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
                SECURE CHANNEL ACTIVE • PEER IS TYPING
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Chat Input */}
      <div className="p-6 pt-2 shrink-0 relative z-20">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-2 flex items-center gap-2 shadow-2xl focus-within:border-cyan-500/50 transition-all">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*,video/*"
            onChange={handleFileUpload}
          />
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-cyan-400 transition-colors"
          >
             <Paperclip size={20} />
          </button>
          
          <input
            type="text"
            placeholder="Type an encrypted message..."
            className="flex-1 bg-transparent border-none outline-none focus:ring-0 py-2 px-3 text-sm text-slate-200 placeholder:text-slate-700 font-sans"
            value={input}
            onChange={handleInputChange}
            onKeyDown={(e) => e.key === 'Enter' && handleSend(e)}
          />
          <button 
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim()}
            className={`p-2.5 rounded-xl transition-all ${
              input.trim() 
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)] hover:bg-cyan-400' 
                : 'bg-slate-800 text-slate-600 opacity-50 cursor-not-allowed'
            }`}
          >
            <Send size={18} strokeWidth={2.5} />
          </button>
        </div>
        <div className="mt-3 flex justify-center">
          <div className="flex items-center gap-1.5 opacity-50 bg-slate-900/50 px-3 py-1 rounded-full border border-slate-800/50">
            <Lock className="w-3 h-3 text-emerald-500" />
            <span className="text-[9px] text-slate-500 font-bold tracking-[0.15em] uppercase">Private Session • Privy Verified</span>
          </div>
        </div>
      </div>

      {/* Atmospheric Background Glow */}
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-cyan-500/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none"></div>
    </main>
  );
}
