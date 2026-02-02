import React, { createContext, useContext, ReactNode } from 'react';
import { BadgeSettings } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface BadgeSettingsContextType {
  settings: BadgeSettings;
  setSettings: React.Dispatch<React.SetStateAction<BadgeSettings>>;
}

const BadgeSettingsContext = createContext<BadgeSettingsContextType | undefined>(undefined);

const defaultSettings: BadgeSettings = {
  style: 'glass',
  size: 'small',
  position: 'center',
  animated: true,
  notificationDaysBefore: 1,
};

export const BadgeSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useLocalStorage<BadgeSettings>('badgeSettings', defaultSettings);

  return (
    <BadgeSettingsContext.Provider value={{ settings, setSettings }}>
      {children}
    </BadgeSettingsContext.Provider>
  );
};

export const useBadgeSettings = () => {
  const context = useContext(BadgeSettingsContext);
  if (context === undefined) {
    throw new Error('useBadgeSettings must be used within a BadgeSettingsProvider');
  }
  return context;
};