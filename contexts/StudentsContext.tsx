
import React, { createContext, useContext, ReactNode, useCallback } from 'react';
import { Student } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface StudentsContextType {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
}

const StudentsContext = createContext<StudentsContextType | undefined>(undefined);

export const StudentsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [rawStudents, setRawStudents] = useLocalStorage<Student[]>('students', []);

  // Wrap setStudents to always ensure alphabetical sorting before saving
  const setStudents: React.Dispatch<React.SetStateAction<Student[]>> = useCallback((value) => {
    setRawStudents((prev) => {
      const nextValue = typeof value === 'function' ? value(prev) : value;
      return [...nextValue].sort((a, b) => a.studentName.localeCompare(b.studentName));
    });
  }, [setRawStudents]);

  return (
    <StudentsContext.Provider value={{ students: rawStudents, setStudents }}>
      {children}
    </StudentsContext.Provider>
  );
};

export const useStudents = (): StudentsContextType => {
  const context = useContext(StudentsContext);
  if (context === undefined) {
    throw new Error('useStudents must be used within a StudentsProvider');
  }
  return context;
};
