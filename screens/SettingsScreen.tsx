
import React, { useState } from 'react';
import { useProfile } from '../contexts/ProfileContext';
import { useCollections } from '../contexts/CollectionsContext';
import { useRemittedCollections } from '../contexts/RemittedCollectionsContext';
import { useArchivedCollections } from '../contexts/ArchivedCollectionsContext';
import { useStudents } from '../contexts/StudentsContext';
import { useHistory } from '../contexts/HistoryContext';
import { useFirebaseSync } from '../hooks/useFirebaseSync';
import EditStudentModal from '../components/EditStudentModal';
import { Student } from '../types';

interface SettingsScreenProps {
  onBack: () => void;
  onRestoreCloudData?: (id: string) => Promise<boolean>;
}

const SettingRow: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  description?: string; 
  onClick?: () => void; 
  value?: React.ReactNode;
  isLast?: boolean;
  destructive?: boolean;
}> = ({ icon, label, description, onClick, value, isLast, destructive }) => (
  <button 
    onClick={onClick}
    disabled={!onClick}
    className={`w-full flex items-center justify-between py-4 px-1 transition-all active:bg-slate-50 ${onClick ? 'cursor-pointer' : 'cursor-default'} ${!isLast ? 'border-b border-slate-100' : ''}`}
  >
    <div className="flex items-center min-w-0 mr-4">
      <div className={`p-2.5 rounded-xl flex-shrink-0 ${destructive ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-500'}`}>
        {icon}
      </div>
      <div className="ml-4 text-left min-w-0">
        <p className={`text-sm font-bold truncate ${destructive ? 'text-rose-600' : 'text-slate-800'}`}>{label}</p>
        {description && <p className="text-[11px] text-slate-400 font-medium leading-tight">{description}</p>}
      </div>
    </div>
    <div className="flex-shrink-0">
      {value !== undefined ? value : (
        onClick && (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
          </svg>
        )
      )}
    </div>
  </button>
);

const SectionHeader: React.FC<{ title: string }> = ({ title }) => (
  <h3 className="px-1 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 mt-8">{title}</h3>
);

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  const { profile, setProfile } = useProfile();
  const { students, setStudents } = useStudents();
  const { collections, setCollections } = useCollections();
  const { remittedCollections, setRemittedCollections } = useRemittedCollections();
  const { archivedCollections, setArchivedCollections } = useArchivedCollections();
  const { setHistory } = useHistory();
  
  const [isManagingStudents, setIsManagingStudents] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);

  const { status, pushAllToCloud, performFullRestore } = useFirebaseSync(
    profile,
    students,
    collections,
    remittedCollections,
    archivedCollections,
    {
        setProfile,
        setStudents,
        setCollections,
        setRemitted: setRemittedCollections,
        setArchived: setArchivedCollections
    }
  );

  const isIdSet = profile.studentId && 
                  profile.studentId !== 'Student ID' && 
                  profile.studentId !== '';

  const handleRestore = async () => {
    if (!isIdSet) return;
    const confirmRestore = window.confirm(
        `RESTORE DATA FROM CLOUD?\n\nThis will REPLACE ALL records on this phone with the cloud version for ID: ${profile.studentId}.\n\nLocal unsynced data will be lost. Proceed?`
    );
    if (confirmRestore) {
        const success = await performFullRestore(profile.studentId);
        if (success) alert("Restoration complete.");
    }
  };

  /**
   * Nuclear Wipe: Clears all localStorage and reloads the application.
   */
  const handleLocalReset = () => {
    const confirmWipe = window.confirm(
        "CONFIRM LOCAL DATA WIPE?\n\nThis will permanently delete ALL data stored on this device. This cannot be undone.\n\n(Cloud backups will remain safe on our servers. You can restore them later using your Student ID.)\n\nProceed with device wipe?"
    );
    
    if (confirmWipe) {
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
        localStorage.clear();
        window.location.reload();
    }
  };

  const handleUpdateStudent = (updatedData: { studentName: string; notes?: string }) => {
    if (!editingStudent) return;
    setStudents(prev => prev.map(s => s.id === editingStudent.id ? { ...s, ...updatedData, synced: false } : s));
    setEditingStudent(null);
  };

  const handleDeleteStudent = () => {
    if (!studentToDelete) return;
    setStudents(prev => prev.filter(s => s.id !== studentToDelete.id));
    setStudentToDelete(null);
  };

  if (isManagingStudents) {
    return (
        <div className="flex flex-col h-screen bg-white">
            <header className="bg-white p-6 pb-2 flex items-center justify-between z-20">
                <button onClick={() => setIsManagingStudents(false)} className="text-blue-600 font-bold flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                    Settings
                </button>
                <h1 className="text-lg font-black text-slate-900 absolute left-1/2 -translate-x-1/2">Registry</h1>
                <div className="w-10" />
            </header>
            <main className="flex-1 overflow-y-auto p-6 pt-2 pb-24">
                {students.length === 0 ? (
                    <div className="text-center py-20 opacity-30">
                        <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">No students registered</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {students.map(student => (
                            <div key={student.id} className="flex items-center justify-between py-3 border-b border-slate-50">
                                <div className="min-w-0 flex-1 pr-4">
                                    <p className="font-bold text-slate-800 truncate">{student.studentName}</p>
                                    <p className="text-[10px] text-slate-400 font-mono tracking-tighter uppercase">{student.studentNo}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setEditingStudent(student)} className="p-2 text-blue-500 bg-blue-50 rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L15.232 5.232z" /></svg>
                                    </button>
                                    <button onClick={() => setStudentToDelete(student)} className="p-2 text-rose-500 bg-rose-50 rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>
            {editingStudent && <EditStudentModal isOpen={!!editingStudent} onClose={() => setEditingStudent(null)} student={editingStudent} onSave={handleUpdateStudent} />}
            {studentToDelete && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-sm p-6">
                        <h3 className="text-xl font-black text-slate-900">Delete Entry?</h3>
                        <p className="mt-2 text-sm text-slate-600 leading-relaxed">Remove <strong>{studentToDelete.studentName}</strong>? This won't delete existing history, but they won't appear in future lists.</p>
                        <div className="mt-6 flex flex-col gap-2">
                            <button onClick={handleDeleteStudent} className="w-full py-3.5 bg-rose-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-rose-500/20">Delete</button>
                            <button onClick={() => setStudentToDelete(null)} className="w-full py-3 text-slate-400 font-bold uppercase text-xs">Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="bg-white p-6 pb-2 flex items-center justify-between z-20 border-b border-slate-100 sticky top-0">
        <button onClick={onBack} className="text-blue-600 font-bold flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
            Back
        </button>
        <h1 className="text-lg font-black text-slate-900 absolute left-1/2 -translate-x-1/2 uppercase tracking-tighter text-center">Settings</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 overflow-y-auto p-6 pt-2 pb-24">
        
        <SectionHeader title="Synchronization" />
        <div className="bg-white rounded-2xl">
          <SettingRow 
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>}
            label="Backup Now"
            description="Manually push local data to Firestore"
            onClick={() => isIdSet ? pushAllToCloud() : alert("Set ID first")}
            value={status === 'syncing' ? <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping" /> : null}
          />
          <SettingRow 
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" /></svg>}
            label="Cloud Restoration"
            description="Replace phone data with cloud backup"
            onClick={handleRestore}
            isLast
          />
        </div>

        <SectionHeader title="Application Registry" />
        <div className="bg-white rounded-2xl">
          <SettingRow 
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a7 7 0 00-7 7v1h11v-1a7 7 0 00-7-7z" /></svg>}
            label="Student Registry"
            description="Manage and edit registered students"
            onClick={() => setIsManagingStudents(true)}
            isLast
          />
        </div>

        <SectionHeader title="Danger Zone" />
        <div className="bg-white rounded-2xl">
          <SettingRow 
            icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>}
            label="Wipe Device Data"
            description="Delete all records from this phone only"
            onClick={handleLocalReset}
            destructive
            isLast
          />
        </div>

        <div className="mt-12 text-center">
            <p className="text-[10px] font-black uppercase text-slate-300 tracking-[0.4em]">TreasApp v1.1.6</p>
            <p className="text-[9px] font-bold text-slate-200 mt-1">Offline-First Classroom Ledger</p>
        </div>
      </main>
    </div>
  );
};

export default SettingsScreen;
