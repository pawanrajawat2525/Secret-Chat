/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { PrivyProvider, usePrivy } from '@privy-io/react-auth';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { XmtpProvider, useXmtp } from './contexts/XmtpContext';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { VideoCall } from './components/VideoCall';
import { Conversation } from '@xmtp/browser-sdk';
import { Loader2, ShieldCheck, Mail, Lock, UserCheck, PhoneCall, X as XIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const queryClient = new QueryClient();

// Get the Privy App ID from environment
const PRIVY_APP_ID = (import.meta as any).env.VITE_PRIVY_APP_ID || "clp_placeholder";

function ChatAppContent() {
  const { login, authenticated, ready, user } = usePrivy();
  const { client, initClient, isInitializing, error } = useXmtp();
  const [selectedConvo, setSelectedConvo] = useState<Conversation | null>(null);
  
  // Call State
  const [activeCall, setActiveCall] = useState<{
    convo: Conversation;
    type: 'video' | 'audio';
    isIncoming: boolean;
    signal?: any;
  } | null>(null);
  
  const [incomingCall, setIncomingCall] = useState<{
    convo: Conversation;
    type: 'video' | 'audio';
    signal: any;
  } | null>(null);

  useEffect(() => {
    if (!client) return;

    // Global listener for incoming calls
    const listenForCalls = async () => {
      // @ts-ignore
      const stream = await client.conversations.stream();
      for await (const convo of stream) {
        // @ts-ignore
        const messageStream = await convo.stream();
        for await (const msg of messageStream) {
           try {
             const content = msg.content as any;
             if (typeof content?.text === 'string' && content.text.startsWith('{')) {
               const data = JSON.parse(content.text);
               if (data.type === 'signal' && !data.isResponse) {
                  setIncomingCall({
                    convo,
                    type: data.callType,
                    signal: data.signal
                  });
               }
             }
           } catch (e) {}
        }
      }
    };
    
    // Also listen to existing conversations
    const listenToExisting = async () => {
      const convos = await client.conversations.list();
      convos.forEach(async (convo) => {
        // @ts-ignore
        const messageStream = await convo.stream();
        for await (const msg of messageStream) {
           try {
             const content = msg.content as any;
             if (typeof content?.text === 'string' && content.text.startsWith('{')) {
               const data = JSON.parse(content.text);
               if (data.type === 'signal' && !data.isResponse) {
                  setIncomingCall({
                    convo,
                    type: data.callType,
                    signal: data.signal
                  });
               }
             }
           } catch (e) {}
        }
      });
    };

    listenForCalls();
    listenToExisting();
  }, [client]);

  if (!ready) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-blue-500" size={40} />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#020617] p-6 bg-immersive-gradient">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-slate-900/40 backdrop-blur-xl p-10 rounded-3xl border border-slate-800 text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-cyan-500 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(6,182,212,0.3)]">
            <ShieldCheck size={40} className="text-slate-900" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-3">X-MESSAGE <span className="text-cyan-400 font-mono text-xs ml-1">v3.0</span></h1>
          <p className="text-slate-400 mb-10 leading-relaxed">
            Identity-agnostic, end-to-end encrypted messaging via XMTP v3 and MLS protocols.
          </p>
          
          <button
            onClick={() => login()}
            className="w-full flex items-center justify-center gap-3 bg-slate-950 border border-slate-800 py-4 px-6 rounded-2xl text-slate-200 font-semibold hover:border-cyan-500/50 hover:bg-slate-900 transition-all shadow-sm group"
          >
            <div className="bg-white p-1 rounded-md">
              <img 
                src="https://www.google.com/favicon.ico" 
                alt="Google" 
                className="w-5 h-5"
              />
            </div>
            Sign in with Google
          </button>
          
          <div className="mt-12 pt-8 border-t border-slate-800/50 grid grid-cols-2 gap-6 text-left">
            <div className="flex items-start gap-2">
              <Lock size={16} className="text-cyan-500 mt-1 flex-shrink-0" />
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Forward Secrecy</span>
            </div>
            <div className="flex items-start gap-2">
              <Mail size={16} className="text-cyan-500 mt-1 flex-shrink-0" />
              <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">MLS Support</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-[#020617] p-6 bg-immersive-gradient">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-slate-900/40 backdrop-blur-xl p-10 rounded-3xl border border-slate-800 text-center shadow-2xl"
        >
          <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
            <UserCheck size={40} className="text-slate-900" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Access Verified</h2>
          <p className="text-slate-400 mb-4">{user?.google?.email}</p>
          <p className="text-sm text-slate-500 mb-10 leading-relaxed">
            Securely deriving your messaging keys. No servers will ever touch your identity seed.
          </p>

          {error && (
            <div className="mb-8 p-4 bg-red-500/10 text-red-400 text-xs rounded-xl border border-red-500/20 text-left font-mono">
              Error: {error}
            </div>
          )}

          <button
            onClick={initClient}
            disabled={isInitializing}
            className="w-full flex items-center justify-center gap-3 bg-cyan-500 text-slate-950 py-4 rounded-2xl font-bold hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)]"
          >
            {isInitializing ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Building Local DB...
              </>
            ) : (
              'Initialize Cryptographic Layer'
            )}
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden antialiased relative">
      <Sidebar 
        onSelect={setSelectedConvo} 
        selectedId={selectedConvo?.id} 
      />
      <ChatArea 
        conversation={selectedConvo} 
        onStartCall={(type) => selectedConvo && setActiveCall({ convo: selectedConvo, type, isIncoming: false })}
      />

      {/* Active Call View */}
      {activeCall && (
        <VideoCall 
          conversation={activeCall.convo}
          type={activeCall.type}
          isIncoming={activeCall.isIncoming}
          incomingSignal={activeCall.signal}
          onClose={() => setActiveCall(null)}
        />
      )}

      {/* Incoming Call Notification */}
      <AnimatePresence>
        {incomingCall && !activeCall && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-[200] w-full max-w-sm"
          >
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-2xl flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-cyan-500 flex items-center justify-center animate-bounce text-slate-900">
                   <PhoneCall size={24} />
                </div>
                <div className="flex-1 min-w-0">
                   <h4 className="text-white font-bold text-sm truncate">Incoming {incomingCall.type} Call</h4>
                   <p className="text-[10px] text-slate-500 uppercase tracking-widest font-mono truncate">ID: {incomingCall.convo.id.slice(0, 10)}...</p>
                </div>
                <div className="flex gap-2">
                   <button 
                     onClick={() => {
                       setActiveCall({
                         convo: incomingCall.convo,
                         type: incomingCall.type,
                         isIncoming: true,
                         signal: incomingCall.signal
                       });
                       setIncomingCall(null);
                     }}
                     className="bg-emerald-600 hover:bg-emerald-500 text-white p-2.5 rounded-xl transition-colors"
                   >
                     <PhoneCall size={18} />
                   </button>
                   <button 
                     onClick={() => setIncomingCall(null)}
                     className="bg-slate-800 hover:bg-slate-700 text-slate-400 p-2.5 rounded-xl transition-colors"
                   >
                     <XIcon size={18} />
                   </button>
                </div>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          loginMethods: ['google'],
          embeddedWallets: {
            ethereum: {
              createOnLogin: 'users-without-wallets',
            },
          },
          appearance: {
            theme: 'light',
            accentColor: '#2563eb',
            logo: 'https://lucide.dev/logo.svg',
          },
        }}
      >
        <XmtpProvider>
          <ChatAppContent />
        </XmtpProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
}

