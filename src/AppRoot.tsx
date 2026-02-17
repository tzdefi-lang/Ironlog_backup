import React from 'react';
import { PrivyProvider } from '@privy-io/react-auth';
import App from '@/App';

type AppRootProps = {
  appId: string;
};

const AppRoot: React.FC<AppRootProps> = ({ appId }) => {
  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#F59E0B',
          logo: '/icons/icon-192x192.png',
        },
        loginMethods: ['google', 'email', 'wallet'],
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'users-without-wallets',
          },
          solana: {
            createOnLogin: 'users-without-wallets',
          },
        },
      }}
    >
      <App />
    </PrivyProvider>
  );
};

export default AppRoot;
