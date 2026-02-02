
import React, { useState, useEffect, useRef } from 'react';
import { Screen } from '../types';
import { SCREENS } from '../constants';
import { CollectionIcon, RemittedIcon, FundsIcon, StudentsIcon, MenuIcon } from './icons/NavIcons';

interface BottomNavProps {
  activeScreen: Screen;
  setActiveScreen: (screen: Screen) => void;
}

const iconMap: { [key in Screen]: React.ReactNode } = {
  [Screen.Collection]: <CollectionIcon />,
  [Screen.Remitted]: <RemittedIcon />,
  [Screen.Funds]: <FundsIcon />,
  [Screen.Students]: <StudentsIcon />,
  [Screen.Menu]: <MenuIcon />,
};

const BottomNav: React.FC<BottomNavProps> = ({ activeScreen, setActiveScreen }) => {
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    // We attach the scroll listener to the main scrollable area defined in App.tsx
    const scrollContainer = document.querySelector('main');
    if (!scrollContainer) return;

    const handleScroll = () => {
      const currentScrollY = scrollContainer.scrollTop;
      
      // Only trigger if we've scrolled more than a small threshold to prevent flickering
      if (Math.abs(currentScrollY - lastScrollY.current) < 10) return;

      if (currentScrollY > lastScrollY.current && currentScrollY > 60) {
        // Scrolling Down - Hide
        setIsVisible(false);
      } else {
        // Scrolling Up - Show
        setIsVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
      className={`fixed bottom-8 left-0 right-0 z-40 px-6 pointer-events-none transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-24 opacity-0'
      }`}
    >
      <nav className="max-w-[400px] mx-auto pointer-events-auto">
        {/* Main Nav Container */}
        <div className="bg-white shadow-[0_15px_50px_-12px_rgba(0,0,0,0.15)] rounded-[24px] p-2 flex justify-between items-center h-[64px] border border-slate-50">
          
          {SCREENS.map((screen) => {
            const isActive = activeScreen === screen;
            return (
              <button
                key={screen}
                onClick={() => {
                  if (activeScreen !== screen) {
                    setActiveScreen(screen);
                    if (navigator.vibrate) navigator.vibrate(5);
                  }
                }}
                className={`no-tap-highlight relative flex items-center justify-center transition-all duration-300 ease-out outline-none ${
                  isActive 
                    ? 'flex-[2.2] bg-orange-50/60 rounded-full h-full px-4' 
                    : 'flex-1 text-slate-400 hover:text-slate-600 h-full'
                }`}
                aria-label={`Navigate to ${screen}`}
              >
                {/* Icon Wrapper */}
                <div className={`transition-all duration-300 ${isActive ? 'text-orange-500 mr-2 scale-110' : 'text-slate-800 scale-100'}`}>
                  <div className="w-5 h-5 flex-shrink-0">
                    {isActive ? (
                       <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                      </svg>
                    ) : iconMap[screen]}
                  </div>
                </div>
                
                {/* Label (only visible when active) */}
                <div 
                  className={`overflow-hidden transition-all duration-300 ${
                    isActive ? 'max-w-[80px] opacity-100' : 'max-w-0 opacity-0'
                  }`}
                >
                  <span className="text-[13px] font-bold tracking-tight whitespace-nowrap text-orange-600">
                    {screen}
                  </span>
                </div>

                {/* Subtle Dot for non-active screen indicators */}
                {!isActive && screen === Screen.Collection && (
                   <div className="absolute top-2 right-1/2 translate-x-3 w-1 h-1 bg-blue-500 rounded-full" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
      
      <style>{`
        .no-tap-highlight {
          -webkit-tap-highlight-color: transparent;
        }
      `}</style>
    </div>
  );
};

export default BottomNav;
