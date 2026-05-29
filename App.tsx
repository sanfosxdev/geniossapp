import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import HeroSection from './components/HeroSection';
import MenuSection from './components/MenuSection';
import AboutSection from './components/AboutSection';
import Footer from './components/Footer';
import ChatAssistantModal from './components/ChatAssistantModal';
import AdminDashboard from './components/AdminDashboard';
import FloatingChatButton from './components/FloatingChatButton';
import TableOrderView from './components/TableOrderView';
import AdminLogin from './components/AdminLogin';
import { getSliceBotStatus, type SliceBotStatus } from './services/sliceBotService';
import { isBusinessOpen } from './services/scheduleService';
import { logout, subscribeToAuthState, type AuthUser } from './services/authService';

type View = 'site' | 'admin';

const App: React.FC = () => {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [view, setView] = useState<View>('site');
  const [tableId, setTableId] = useState<string | null>(null);
  const [isSliceBotActive, setIsSliceBotActive] = useState(() => getSliceBotStatus() === 'active');
  const [isStoreOpen, setIsStoreOpen] = useState(() => isBusinessOpen());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const handleSliceBotStatusChange = (newStatus: SliceBotStatus) => {
    setIsSliceBotActive(newStatus === 'active');
  };

  const openChat = () => {
    if (isSliceBotActive) {
      setIsChatOpen(true);
    }
  };
  const closeChat = () => setIsChatOpen(false);
  const openAdmin = () => setView('admin');

  const handleLogout = async () => {
    await logout();
    setView('site');
  };

  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user) => {
      setAuthUser(user);
      setIsAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tableIdFromUrl = urlParams.get('tableId');
    if (tableIdFromUrl) {
      setTableId(tableIdFromUrl);
    }
    
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'pizzeria-slice-bot-status') {
        setIsSliceBotActive(getSliceBotStatus() === 'active');
      }
    };

    window.addEventListener('storage', handleStorageChange);

    const storeStatusInterval = setInterval(() => {
        setIsStoreOpen(isBusinessOpen());
    }, 60000); // Check every minute

    return () => {
        window.removeEventListener('storage', handleStorageChange);
        clearInterval(storeStatusInterval);
    };
  }, []);

  if (tableId) {
    return <TableOrderView tableId={tableId} />;
  }
  
  if (view === 'admin') {
    if (isAuthLoading) {
      return (
        <div className="flex h-screen w-screen justify-center items-center bg-gray-50 dark:bg-gray-900">
          <p className="text-lg font-semibold text-gray-700 dark:text-gray-200">Verificando sesion...</p>
        </div>
      );
    }

    if (!authUser?.profile) {
      return <AdminLogin onLoginSuccess={openAdmin} onGoToSite={() => setView('site')} />;
    }

    return (
      <AdminDashboard
        onGoToSite={() => setView('site')}
        onSliceBotStatusChange={handleSliceBotStatusChange}
        currentUserEmail={authUser.email}
        currentUserRole={authUser.profile.role}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="bg-light dark:bg-dark text-dark dark:text-light font-sans antialiased">
      <Header onOrderClick={openChat} onAdminClick={openAdmin} isBotActive={isSliceBotActive} isStoreOpen={isStoreOpen} />
      <main>
        <HeroSection onOrderClick={openChat} isBotActive={isSliceBotActive} isStoreOpen={isStoreOpen} />
        <MenuSection />
        <AboutSection />
      </main>
      <Footer onAdminClick={() => setView('admin')} />
      {isSliceBotActive && <ChatAssistantModal isOpen={isChatOpen} onClose={closeChat} />}
      <FloatingChatButton onClick={openChat} isBotActive={isSliceBotActive} />
    </div>
  );
};

export default App;
