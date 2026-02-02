
import React, { useState, useEffect, useMemo } from 'react';
import { Screen, Collection, RemittedCollection, Student, TreasurerProfile, ArchivedCollection } from './types';
import { StudentsProvider, useStudents } from './contexts/StudentsContext';
import { CollectionsProvider, useCollections } from './contexts/CollectionsContext';
import { RemittedCollectionsProvider, useRemittedCollections } from './contexts/RemittedCollectionsContext';
import { ArchivedCollectionsProvider, useArchivedCollections } from './contexts/ArchivedCollectionsContext';
import { ProfileProvider, useProfile } from './contexts/ProfileContext';
import { ValueSetsProvider } from './contexts/ValueSetsContext';
import { HistoryProvider } from './contexts/HistoryContext';
import { BadgeSettingsProvider } from './contexts/BadgeSettingsContext';
import CollectionScreen from './screens/CollectionScreen';
import RemittedScreen from './screens/RemittedScreen';
import FundsScreen from './screens/FundsScreen';
import StudentsScreen from './screens/StudentsScreen';
import MenuScreen from './screens/MenuScreen';
import CollectionDetailScreen from './screens/CollectionDetailScreen';
import ArchivedScreen from './screens/ArchivedScreen';
import ProfileScreen from './screens/ProfileScreen';
import AddCollectionScreen from './screens/AddCollectionScreen';
import EditCollectionScreen from './screens/EditCollectionScreen';
import HistoryScreen from './screens/HistoryScreen';
import SettingsScreen from './screens/SettingsScreen';
import BottomNav from './components/BottomNav';
import { NetworkStatus } from './components/NetworkStatus';
import { useFirebaseSync } from './hooks/useFirebaseSync';

// Constants
const LAST_FULL_SYNC_TIME_KEY = 'treasapp_last_full_sync_timestamp';
const FULL_SYNC_EXPIRY = 12 * 60 * 60 * 1000; // 12 Hours

// Advanced Cloud Loading Component inspired by "Download Button Animation"
const CuteLoadingScreen: React.FC<{ isFinished?: boolean }> = ({ isFinished = false }) => {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  
  const messages = [
    "Connecting to Cloud...",
    "Syncing Ledgers...",
    "Downloading Collections...",
    "Finalizing Data..."
  ];

  useEffect(() => {
    if (isFinished) {
      setProgress(100);
      return;
    }
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 95) return prev;
        return prev + (Math.random() * 4);
      });
    }, 120);

    const msgInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 1500);

    return () => {
      clearInterval(interval);
      clearInterval(msgInterval);
    };
  }, [isFinished]);

  // Derived states for icon switching
  const isComplete = progress >= 100;
  const showCloud = progress > 80 && progress < 100;
  const showRing = progress <= 80;

  // SVG Constants
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="fixed inset-0 bg-white/95 backdrop-blur-xl z-[200] flex flex-col items-center justify-center p-6 transition-all duration-700">
      <div className="relative w-64 h-64 flex items-center justify-center">
        {/* Animated Glow Background */}
        <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-1000 ${isComplete ? 'bg-emerald-400/20 scale-125' : 'bg-blue-400/10 scale-100'}`}></div>
        
        {/* Main Icon Sequence Container */}
        <div className={`relative transition-all duration-500 ease-out ${isComplete ? 'scale-110' : 'scale-100'}`}>
          <svg width="120" height="120" viewBox="0 0 100 100" className="transform -rotate-90">
            {/* Background Ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              className="text-slate-100"
            />
            {/* Progress Ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              stroke="currentColor"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              style={{ strokeDashoffset: offset, transition: 'stroke-dashoffset 0.3s ease' }}
              strokeLinecap="round"
              className={`${isComplete ? 'text-emerald-500' : 'text-blue-500'}`}
            />
          </svg>

          {/* Success Checkmark Circle (Appears at 100%) */}
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${isComplete ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
             <div className="w-[84px] h-[84px] bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-500/40 animate-pop">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" className="animate-draw-check" />
                </svg>
             </div>
          </div>

          {/* Cloud Icon (Appears between 80% and 100%) */}
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${showCloud ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12 text-blue-500 animate-cloud-bounce">
                <path d="M17.5,19c-3.037,0-5.5-2.463-5.5-5.5c0-0.088,0.003-0.175,0.01-0.261C10.457,11.831,8.374,10,6,10c-2.761,0-5,2.239-5,5s2.239,5,5,5h11.5c2.485,0,4.5-2.015,4.5-4.5S19.985,11,17.5,11c-0.247,0-0.488,0.021-0.722,0.06C16.402,8.196,13.91,6,11,6c-3.155,0-5.74,2.443-5.973,5.55C4.041,11.23,3,12.355,3,13.75C3,15.269,4.231,16.5,5.75,16.5h0.75v-1h-0.75C4.783,15.5,4,14.717,4,13.75c0-0.893,0.669-1.637,1.551-1.737l0.553-0.063l0.04-0.555C6.26,9.221,8.423,7,11,7c2.296,0,4.254,1.603,4.686,3.834l0.117,0.606l0.613-0.076C16.634,12.341,17.06,12,17.5,12c1.933,0,3.5,1.567,3.5,3.5S19.433,19,17.5,19z"/>
                <path d="M11.293,16.707l3-3l-1.414-1.414L12,13.172V9h-2v4.172l-0.879-0.879l-1.414,1.414l3,3C10.902,16.895,11.098,16.895,11.293,16.707z" />
              </svg>
          </div>

          {/* Inner Percentage (Appears during ring loading) */}
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-300 ${showRing ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
            <span className="text-xl font-black text-slate-800 tracking-tighter">
              {Math.round(progress)}<span className="text-xs opacity-40 ml-0.5">%</span>
            </span>
          </div>
        </div>
      </div>

      {/* Progress & Text */}
      <div className="mt-4 text-center space-y-2">
        <div className="h-6 overflow-hidden">
           <p className={`text-lg font-black text-slate-800 tracking-tight transition-all duration-500 ${isComplete ? 'translate-y-0 opacity-100' : 'opacity-60'}`}>
            {isComplete ? 'Ready to Work' : messages[messageIndex]}
          </p>
        </div>
        
        {isComplete && (
           <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] animate-fade-in">
              Everything synced
           </p>
        )}
      </div>

      <style>{`
        @keyframes pop {
          0% { transform: scale(0.5); opacity: 0; }
          70% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes draw-check {
          from { stroke-dasharray: 0 100; }
          to { stroke-dasharray: 100 0; }
        }
        @keyframes cloud-bounce {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        .animate-pop { animation: pop 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-draw-check { animation: draw-check 0.5s ease-out 0.3s forwards; stroke-dasharray: 100; stroke-dashoffset: 100; }
        .animate-cloud-bounce { animation: cloud-bounce 2s ease-in-out infinite; }
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
};

// Internal content that consumes the contexts
const AppContent: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<Screen>(Screen.Collection);
  const [selectedCollection, setSelectedCollection] = useState<Collection | RemittedCollection | null>(null);
  const [isArchivedView, setIsArchivedView] = useState(false);
  const [isProfileView, setIsProfileView] = useState(false);
  const [isSettingsView, setIsSettingsView] = useState(false);
  const [isAddCollectionView, setIsAddCollectionView] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [isHistoryView, setIsHistoryView] = useState(false);
  const [highlightedStudentId, setHighlightedStudentId] = useState<string | null>(null);
  const [isInitialRestoring, setIsInitialRestoring] = useState(false);
  const [isSyncComplete, setIsSyncComplete] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const { students, setStudents } = useStudents();
  const { collections, setCollections } = useCollections();
  const { remittedCollections, setRemittedCollections } = useRemittedCollections();
  const { archivedCollections, setArchivedCollections } = useArchivedCollections();
  const { profile, setProfile } = useProfile();

  const clearLocalData = () => {
    setStudents([]);
    setCollections([]);
    setRemittedCollections([]);
    setArchivedCollections([]);
  };

  const { status, performFullRestore, pushAllToCloud } = useFirebaseSync(
    profile,
    students,
    collections,
    remittedCollections,
    archivedCollections,
    {
        setProfile: (p) => setProfile(p),
        setStudents: (s) => setStudents(s),
        setCollections: (c) => setCollections(c),
        setRemitted: (r) => setRemittedCollections(r),
        setArchived: (a) => setArchivedCollections(a),
    }
  );

  const handleFullIdentitySwitch = async (newId: string, newName: string, newAvatar: string) => {
      setIsInitialRestoring(true);
      setIsSyncComplete(false);
      clearLocalData();
      setProfile({ studentId: newId, name: newName, avatar: newAvatar });

      await new Promise(resolve => setTimeout(resolve, 800));

      try {
          await performFullRestore(newId);
          setIsSyncComplete(true);
      } catch (err) {
          console.error("Identity switch sync failed", err);
          setIsSyncComplete(true);
      } finally {
          setTimeout(() => {
            setIsInitialRestoring(false);
            setIsSyncComplete(false);
          }, 2000);
      }
  };

  const handleIdentityMigration = async (newId: string, newName: string, newAvatar: string) => {
    setIsInitialRestoring(true);
    setIsSyncComplete(false);
    setProfile({ studentId: newId, name: newName, avatar: newAvatar });

    await new Promise(resolve => setTimeout(resolve, 800));

    try {
        await pushAllToCloud();
        setIsSyncComplete(true);
    } catch (err) {
        console.error("Identity migration push failed", err);
        setIsSyncComplete(true);
    } finally {
        setTimeout(() => {
            setIsInitialRestoring(false);
            setIsSyncComplete(false);
        }, 2000);
    }
  };

  const isSubViewActive = !!(
    selectedCollection || 
    isArchivedView || 
    isProfileView || 
    isSettingsView || 
    isAddCollectionView || 
    editingCollection || 
    isHistoryView
  );

  useEffect(() => {
    const onFocus = (e: FocusEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
        setIsKeyboardVisible(true);
      }
    };
    const onBlur = () => setIsKeyboardVisible(false);

    window.addEventListener('focusin', onFocus);
    window.addEventListener('focusout', onBlur);
    return () => {
      window.removeEventListener('focusin', onFocus);
      window.removeEventListener('focusout', onBlur);
    };
  }, []);

  useEffect(() => {
    const onPopState = (event: PopStateEvent) => {
      if (isSubViewActive) {
        handleBackNavigation();
        window.history.pushState({ noBackExitsApp: true }, '');
      }
    };

    if (isSubViewActive) {
      window.history.pushState({ noBackExitsApp: true }, '');
      window.addEventListener('popstate', onPopState);
    }

    return () => {
      window.removeEventListener('popstate', onPopState);
    };
  }, [isSubViewActive, selectedCollection, isArchivedView, isProfileView, isSettingsView, isAddCollectionView, editingCollection, isHistoryView]);

  useEffect(() => {
    const syncOnLaunch = async () => {
      const currentId = profile.studentId;
      const isValidId = currentId && currentId !== 'Student ID' && currentId !== '';
      
      const lastSyncTime = localStorage.getItem(LAST_FULL_SYNC_TIME_KEY);
      const isExpired = !lastSyncTime || (Date.now() - parseInt(lastSyncTime, 10)) > FULL_SYNC_EXPIRY;
      const isDataMissing = students.length === 0 && collections.length === 0;

      // Only perform launch restore if online AND (data missing OR sync is old)
      if (isValidId && navigator.onLine && !isInitialRestoring && (isExpired || isDataMissing)) {
        setIsInitialRestoring(true);
        setIsSyncComplete(false);
        try {
          // Race the sync against a 2.5-second timeout to prioritize offline access
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Sync timeout')), 2500)
          );

          await Promise.race([
            performFullRestore(currentId),
            timeoutPromise
          ]);
          setIsSyncComplete(true);
        } catch (err) {
          console.error("TreasApp: Auto-sync failed during launch", err);
          setIsSyncComplete(true);
        } finally {
          setTimeout(() => {
            setIsInitialRestoring(false);
            setIsSyncComplete(false);
          }, 2000);
        }
      }
    };
    
    syncOnLaunch();
  }, []);

  const renderScreen = () => {
    if (isProfileView) return (
      <ProfileScreen 
        onBack={() => setIsProfileView(false)} 
        onSwitchIdentity={handleFullIdentitySwitch}
        onMigrateIdentity={handleIdentityMigration}
        onSaveSync={(newProfile) => pushAllToCloud(false, newProfile)}
        syncStatus={status} 
      />
    );
    if (isSettingsView) return <SettingsScreen onBack={() => setIsSettingsView(false)} onRestoreCloudData={performFullRestore} />;
    if (isHistoryView) return <HistoryScreen onBack={() => setIsHistoryView(false)} />;
    if (isArchivedView) return <ArchivedScreen onBack={() => setIsArchivedView(false)} onSelectCollection={(c) => setSelectedCollection(c)} />;
    if (isAddCollectionView) return (
      <AddCollectionScreen 
        onBack={() => setIsAddCollectionView(false)} 
        onCollectionAdded={(c) => {
          setCollections(prev => [...prev, c]);
          setIsAddCollectionView(false);
          setSelectedCollection(c);
        }}
        hasStudents={students.length > 0}
        collections={collections}
      />
    );
    if (editingCollection) return (
      <EditCollectionScreen 
        collection={editingCollection} 
        onBack={() => setEditingCollection(null)} 
        onSave={(updated) => {
          setCollections(prev => prev.map(c => c.id === updated.id ? updated : c));
          setEditingCollection(null);
          setSelectedCollection(updated);
        }}
        collections={collections}
      />
    );

    if (selectedCollection) {
      return (
        <CollectionDetailScreen
          collection={selectedCollection}
          onBack={() => {
            setSelectedCollection(null);
            setHighlightedStudentId(null);
          }}
          onUpdateCollection={(updated) => {
            if ('remittance' in updated) {
              setRemittedCollections(prev => prev.map(c => c.id === updated.id ? (updated as RemittedCollection) : c));
            } else {
              setCollections(prev => prev.map(c => c.id === updated.id ? updated : c));
            }
            setSelectedCollection(updated);
          }}
          onEditCollection={(c) => setEditingCollection(c)}
          collections={collections}
          highlightedStudentId={highlightedStudentId}
        />
      );
    }

    switch (activeScreen) {
      case Screen.Collection:
        return (
          <CollectionScreen 
            onSelectCollection={setSelectedCollection} 
            onAddCollection={() => setIsAddCollectionView(true)}
            syncStatus={status}
            onSyncPull={() => performFullRestore(profile.studentId)}
            onSelectionModeChange={setIsSelectionMode}
          />
        );
      case Screen.Remitted:
        return <RemittedScreen onSelectCollection={setSelectedCollection} />;
      case Screen.Funds:
        return <FundsScreen />;
      case Screen.Students:
        return (
          <StudentsScreen 
            onSelectStudentPayment={(colId, stuId) => {
              const col = [...collections, ...remittedCollections].find(c => c.id === colId);
              if (col) {
                setSelectedCollection(col);
                setHighlightedStudentId(stuId);
              }
            }}
            onSelectCollection={setSelectedCollection}
          />
        );
      case Screen.Menu:
        return (
          <MenuScreen 
            onViewArchive={() => setIsArchivedView(true)} 
            onViewProfile={() => setIsProfileView(true)}
            onViewHistory={() => setIsHistoryView(true)}
            onViewSettings={() => setIsSettingsView(true)} 
          />
        );
      default:
        return (
          <CollectionScreen 
            onSelectCollection={setSelectedCollection} 
            onAddCollection={() => setIsAddCollectionView(true)}
            syncStatus={status}
            onSyncPull={() => performFullRestore(profile.studentId)}
            onSelectionModeChange={setIsSelectionMode}
          />
        );
    }
  };

  const handleBackNavigation = () => {
    if (editingCollection) {
      setEditingCollection(null);
    } else if (isAddCollectionView) {
      setIsAddCollectionView(false);
    } else if (selectedCollection) {
      setSelectedCollection(null);
      setHighlightedStudentId(null);
    } else if (isArchivedView) {
      setIsArchivedView(false);
    } else if (isProfileView) {
      setIsProfileView(false);
    } else if (isSettingsView) {
      setIsSettingsView(false);
    } else if (isHistoryView) {
      setIsHistoryView(false);
    }
  };

  return (
    <div className="flex flex-col h-screen font-sans bg-slate-50 text-slate-800">
      <NetworkStatus syncStatus={status} />
      <main className="flex-1 overflow-y-auto pb-32">
        {isInitialRestoring ? (
           <CuteLoadingScreen isFinished={isSyncComplete} />
        ) : renderScreen()}
      </main>
      {!selectedCollection && !isProfileView && !isSettingsView && !isHistoryView && !isArchivedView && !isAddCollectionView && !editingCollection && !isSelectionMode && !isKeyboardVisible && (
        <BottomNav activeScreen={activeScreen} setActiveScreen={setActiveScreen} />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ProfileProvider>
      <StudentsProvider>
        <CollectionsProvider>
          <RemittedCollectionsProvider>
            <ArchivedCollectionsProvider>
              <ValueSetsProvider>
                <HistoryProvider>
                  <BadgeSettingsProvider>
                    <AppContent />
                  </BadgeSettingsProvider>
                </HistoryProvider>
              </ValueSetsProvider>
            </ArchivedCollectionsProvider>
          </RemittedCollectionsProvider>
        </CollectionsProvider>
      </StudentsProvider>
    </ProfileProvider>
  );
};

export default App;
