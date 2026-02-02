
import React, { useState, useRef, useEffect } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import { TreasurerProfile } from '../types';

interface ProfileScreenProps {
  onBack: () => void;
  onSwitchIdentity?: (newId: string, newName: string, newAvatar: string) => Promise<void>;
  onMigrateIdentity?: (newId: string, newName: string, newAvatar: string) => Promise<void>;
  onSaveSync?: (profile: TreasurerProfile) => Promise<void>;
  syncStatus?: string;
}

const ProfileScreen: React.FC<ProfileScreenProps> = ({ onBack, onSwitchIdentity, onMigrateIdentity, onSaveSync, syncStatus }) => {
  const { profile, setProfile } = useProfile();
  const [name, setName] = useState(profile.name);
  const [studentId, setStudentId] = useState(profile.studentId);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showChangePrompt, setShowChangePrompt] = useState(false);
  const [isEditingEnabled, setIsEditingEnabled] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const idInputRef = useRef<HTMLInputElement>(null);

  const isIdEmpty = profile.studentId === '' || profile.studentId === 'Student ID';
  const isLocked = !isIdEmpty && !isEditingEnabled;

  useEffect(() => {
    setName(profile.name);
    setStudentId(profile.studentId);
    setAvatar(profile.avatar);
  }, [profile]);

  const handleAvatarClick = () => {
    if (isUploading) return;
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
          alert("File is too large. Please select an image under 5MB.");
          return;
      }
      
      setIsUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      // Updated to your specific whitelisted preset: BseePortal
      formData.append('upload_preset', 'BseePortal'); 
      formData.append('api_key', '949286227676122');

      try {
        const response = await fetch('https://api.cloudinary.com/v1_1/dkdfrhlxi/image/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();
        
        if (!response.ok) {
            console.error("Cloudinary error payload:", data);
            throw new Error(data.error?.message || 'Upload failed');
        }
        
        setAvatar(data.secure_url);
      } catch (err: any) {
        console.error("Avatar upload failed:", err);
        alert(`Avatar upload failed:\n${err.message}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !studentId.trim() || isUploading) return;
    
    const idHasChanged = studentId.trim() !== profile.studentId;
    
    if (idHasChanged) {
        // If ID has changed, we show a prompt to choose between Migrate or Switch
        setShowChangePrompt(true);
        return;
    }

    setIsSaving(true);
    const newProfile = {
      name: name.trim(),
      studentId: studentId.trim(),
      avatar,
    };

    setProfile(newProfile);
    
    // Explicitly trigger cloud sync after local state update, passing the new data directly
    if (onSaveSync) {
        await onSaveSync(newProfile);
    }
    
    setTimeout(() => {
      setIsSaving(false);
      onBack();
    }, 500);
  };

  const handleStartChangeIdentity = () => {
      setIsEditingEnabled(true);
      setTimeout(() => idInputRef.current?.focus(), 100);
  };

  const performMigration = async () => {
      if (!onMigrateIdentity) return;
      setIsSaving(true);
      setShowChangePrompt(false);
      await onMigrateIdentity(studentId.trim(), name.trim(), avatar);
      setIsSaving(false);
      onBack();
  };

  const performSwitch = async () => {
      if (!onSwitchIdentity) return;
      setIsSaving(true);
      setShowChangePrompt(false);
      await onSwitchIdentity(studentId.trim(), name.trim(), avatar);
      setIsSaving(false);
      onBack();
  };
  
  const isFormValid = name.trim() && studentId.trim() && !isUploading;

  const DefaultAvatar = () => (
    <div className="h-32 w-32 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 ring-4 ring-white shadow-lg">
        {isUploading ? (
            <svg className="animate-spin h-10 w-10 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
        ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        )}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-white shadow-sm p-4 flex items-center z-20 sticky top-0 border-b border-slate-100">
        <button onClick={onBack} className="mr-4 text-gray-600 hover:text-blue-500 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">Treasurer Profile</h1>
      </header>
      
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-col items-center mb-8">
          <div className="relative cursor-pointer group" onClick={handleAvatarClick}>
            {avatar ? (
              <div className="relative">
                <img src={avatar} alt="Profile" className={`h-32 w-32 rounded-full object-cover ring-4 ring-white shadow-lg group-hover:ring-blue-100 transition-all ${isUploading ? 'opacity-50' : ''}`} />
                {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                )}
              </div>
            ) : (
              <DefaultAvatar />
            )}
            <div className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-2.5 border-4 border-white shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" />
              </svg>
            </div>
          </div>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="space-y-6 max-w-md mx-auto">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <label htmlFor="name" className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 ml-1">Full Name</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onFocus={() => setIsKeyboardVisible(true)}
              onBlur={() => setTimeout(() => setIsKeyboardVisible(false), 100)}
              className="mt-1 block w-full px-4 py-3 bg-slate-50 border-0 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-slate-800 font-medium"
              placeholder="e.g. Juan Dela Cruz"
            />
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex justify-between items-center mb-1 ml-1">
                <label htmlFor="studentId" className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Student ID / Ledger ID</label>
                <div className="flex items-center space-x-2">
                    {isLocked && (
                        <button 
                            onClick={handleStartChangeIdentity}
                            className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-600 hover:bg-amber-100 uppercase tracking-tighter transition-colors"
                        >
                            Edit ID
                        </button>
                    )}
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${isLocked ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-600'}`}>
                        {isLocked ? 'Locked' : 'Editable'}
                    </span>
                </div>
            </div>
            <div className="relative">
                <input
                  ref={idInputRef}
                  type="text"
                  id="studentId"
                  value={studentId}
                  disabled={isLocked}
                  onFocus={() => setIsKeyboardVisible(true)}
                  onBlur={() => setTimeout(() => setIsKeyboardVisible(false), 100)}
                  onChange={(e) => setStudentId(e.target.value)}
                  className={`mt-1 block w-full px-4 py-3 border-0 rounded-xl transition-all font-medium ${
                    isLocked 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed pr-10' 
                    : 'bg-slate-50 text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white'
                  }`}
                  placeholder="e.g. 2024-0001"
                />
                {isLocked && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                    </div>
                )}
            </div>
            
            <p className="mt-2 px-1 text-[9px] text-slate-400 uppercase font-black tracking-tighter italic">This ID connects you to your specific cloud ledger.</p>
          </div>
        </div>
      </main>

      {!isKeyboardVisible && (
          <footer className="p-6 bg-white border-t border-slate-100 sticky bottom-0 z-20">
            <button
              onClick={handleSave}
              disabled={!isFormValid || isSaving}
              className="w-full bg-blue-600 text-white font-bold py-4 px-4 rounded-2xl hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed shadow-lg shadow-blue-500/30 transition-all active:scale-95"
            >
              {isSaving ? 'Synchronizing...' : 'Save & Update'}
            </button>
          </footer>
      )}

      {showChangePrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-sm p-6 transform transition-all">
                <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4 text-amber-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Identity Changed</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    You have changed your Student ID to <strong>{studentId}</strong>. How would you like to proceed?
                </p>
                <div className="mt-6 flex flex-col space-y-3">
                    <button 
                        onClick={performMigration}
                        className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 active:scale-95 transition-transform"
                    >
                        Transfer Local Data
                    </button>
                    <p className="text-[10px] text-center text-slate-400 uppercase font-bold">Recommended: Uploads current records to new ID</p>
                    
                    <div className="py-2 border-t border-slate-100 my-2"></div>
                    
                    <button 
                        onClick={performSwitch}
                        className="w-full py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold active:scale-95 transition-transform"
                    >
                        Switch Identity (Pull)
                    </button>
                    <p className="text-[10px] text-center text-slate-400 uppercase font-bold">Caution: Clears phone and pulls cloud data for new ID</p>

                    <button onClick={() => setShowChangePrompt(false)} className="w-full py-3 text-slate-400 font-bold uppercase text-xs tracking-widest mt-4">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ProfileScreen;
