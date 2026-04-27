/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Client, Conversation } from '@xmtp/browser-sdk';
import { useWallets } from '@privy-io/react-auth';

interface UserProfile {
  name: string;
  avatar: string;
}

interface XmtpContextType {
  client: Client | null;
  initClient: () => Promise<void>;
  isInitializing: boolean;
  error: string | null;
  profile: UserProfile;
  updateProfile: (updates: Partial<UserProfile>) => void;
}

const XmtpContext = createContext<XmtpContextType | null>(null);

const DEFAULT_PROFILE: UserProfile = {
  name: '',
  avatar: '',
};

export function XmtpProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<Client | null>(null);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { wallets } = useWallets();
  
  // Local profile state
  const [profile, setProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('secret_chat_profile');
    return saved ? JSON.parse(saved) : DEFAULT_PROFILE;
  });

  useEffect(() => {
    localStorage.setItem('secret_chat_profile', JSON.stringify(profile));
  }, [profile]);

  const updateProfile = (updates: Partial<UserProfile>) => {
    setProfile(prev => ({ ...prev, ...updates }));
  };

  const initClient = async () => {
    const embeddedWallet = wallets.find((w) => w.walletClientType === 'privy');
    if (!embeddedWallet) {
      setError('No embedded wallet found. Please sign in with Google first.');
      return;
    }

    setIsInitializing(true);
    setError(null);

    try {
      const provider = await embeddedWallet.getEthereumProvider();
      
      // XMTP v3 expects a Signer object
      const signer = {
        type: 'EOA' as const,
        getIdentifier: async () => ({
          type: 'ethereum_address' as const,
          value: embeddedWallet.address,
        }),
        signMessage: async (message: string) => {
          const signature = await provider.request({
            method: 'personal_sign',
            params: [message, embeddedWallet.address],
          });
          // Convert hex signature to Uint8Array
          return new Uint8Array(
            (signature.match(/.{1,2}/g) || []).map((byte: string) => parseInt(byte, 16))
          );
        },
      };

      const xmtpClient = await Client.create(signer as any, { 
        env: 'production',
      } as any);
      
      setClient(xmtpClient);
    } catch (err: any) {
      console.error('XMTP Initialization Error:', err);
      setError(err.message || 'Failed to initialize XMTP');
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <XmtpContext.Provider value={{ client, initClient, isInitializing, error, profile, updateProfile }}>
      {children}
    </XmtpContext.Provider>
  );
}

export function useXmtp() {
  const context = useContext(XmtpContext);
  if (!context) {
    throw new Error('useXmtp must be used within an XmtpProvider');
  }
  return context;
}
