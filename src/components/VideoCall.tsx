/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { Conversation } from '@xmtp/browser-sdk';
import { X, Video, VideoOff, Mic, MicOff, PhoneOff, Loader2, Shield } from 'lucide-react';
import { Buffer } from 'buffer';

// Ensure Buffer is available for simple-peer
if (typeof window !== 'undefined') {
  window.Buffer = Buffer;
}

interface VideoCallProps {
  conversation: Conversation;
  type: 'video' | 'audio';
  isIncoming?: boolean;
  onClose: () => void;
  incomingSignal?: any;
}

export function VideoCall({ conversation, type, isIncoming, onClose, incomingSignal }: VideoCallProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [peer, setPeer] = useState<Peer.Instance | null>(null);
  const [status, setStatus] = useState<'requesting' | 'connecting' | 'connected' | 'failed'>('requesting');
  const [videoEnabled, setVideoEnabled] = useState(type === 'video');
  const [audioEnabled, setAudioEnabled] = useState(true);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    let activeStream: MediaStream;
    let peerInstance: Peer.Instance | null = null;

    const startLocalStream = async () => {
      try {
        activeStream = await navigator.mediaDevices.getUserMedia({
          video: type === 'video',
          audio: true,
        });
        setStream(activeStream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = activeStream;
        }

        peerInstance = new Peer({
          initiator: !isIncoming,
          trickle: false,
          stream: activeStream,
        });

        peerInstance.on('signal', async (data) => {
          // Send signal via XMTP (E2E Encrypted signaling)
          try {
            // @ts-ignore
            await conversation.sendText(JSON.stringify({
              type: 'signal',
              signal: data,
              callType: type,
              isResponse: !!isIncoming
            }));
          } catch (e) {
            console.error('Failed to send signal:', e);
          }
        });

        peerInstance.on('stream', (remote) => {
          setRemoteStream(remote);
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remote;
          }
          setStatus('connected');
        });

        peerInstance.on('error', (err) => {
          console.error('Peer error:', err);
          setStatus('failed');
        });

        peerInstance.on('close', () => onClose());

        if (isIncoming && incomingSignal) {
          peerInstance.signal(incomingSignal);
        }

        setPeer(peerInstance);
        setStatus('connecting');
      } catch (err) {
        console.error('Failed to get media stream:', err);
        setStatus('failed');
      }
    };

    startLocalStream();

    // Listen for signaling messages from peer if we are the initiator
    const signalingListener = async () => {
       // @ts-ignore
       const stream = await conversation.stream();
       for await (const msg of stream) {
         try {
           const content = msg.content as any;
           if (typeof content?.text === 'string' && content.text.startsWith('{')) {
             const data = JSON.parse(content.text);
             if (data.type === 'signal' && data.isResponse && !isIncoming && peerInstance) {
                peerInstance.signal(data.signal);
             }
           }
         } catch (e) {}
       }
    };
    if (!isIncoming) signalingListener();

    return () => {
      activeStream?.getTracks().forEach((track) => track.stop());
      peerInstance?.destroy();
    };
  }, []);

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const endCall = () => {
    peer?.destroy();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="relative w-full max-w-4xl aspect-video bg-slate-900 rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
        
        {/* Remote Video */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover ${status !== 'connected' ? 'hidden' : ''}`}
        />
        
        {status !== 'connected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-400">
            <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center animate-pulse">
               <Video size={40} />
            </div>
            <p className="text-lg font-bold tracking-widest uppercase">
              {status === 'connecting' ? 'Establishing P2P Link...' : 'Waiting for Peer...'}
            </p>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}

        {/* Local Video Overlay */}
        <div className="absolute bottom-6 right-6 w-48 aspect-video bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-xl">
           <video
             ref={localVideoRef}
             autoPlay
             playsInline
             muted
             className="w-full h-full object-cover"
           />
           {!videoEnabled && (
             <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                <VideoOff size={24} className="text-slate-600" />
             </div>
           )}
        </div>

        {/* Controls Overlay */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-6 px-8 py-4 bg-slate-900/80 backdrop-blur-xl rounded-full border border-slate-800 shadow-2xl">
           <button 
             onClick={toggleAudio}
             className={`p-4 rounded-full transition-all ${audioEnabled ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-red-500/20 text-red-500'}`}
           >
             {audioEnabled ? <Mic size={24} /> : <MicOff size={24} />}
           </button>
           
           <button 
             onClick={endCall}
             className="p-5 bg-red-600 text-white rounded-full hover:bg-red-500 transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)]"
           >
             <PhoneOff size={28} />
           </button>

           <button 
             onClick={toggleVideo}
             className={`p-4 rounded-full transition-all ${videoEnabled ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-red-500/20 text-red-500'}`}
           >
             {videoEnabled ? <Video size={24} /> : <VideoOff size={24} />}
           </button>
        </div>

        {/* Info Label */}
        <div className="absolute top-6 left-6 flex items-center gap-3 bg-slate-950/50 backdrop-blur-md px-4 py-2 rounded-full border border-slate-800/50">
           <Shield size={14} className="text-cyan-500" />
           <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">E2E Encrypted P2P Session</span>
        </div>
      </div>
    </div>
  );
}
