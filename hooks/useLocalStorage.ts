
import React, { useState, useEffect } from 'react';

/**
 * Deeply clones and sanitizes an object for JSON serialization.
 * Removes circular references and converts non-plain objects (like Firestore Refs) 
 * to strings to prevent "Converting circular structure to JSON" errors.
 */
function toSerializablePOJO(obj: any, seen = new WeakSet()): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    // Handle circular references
    if (seen.has(obj)) return '[Circular]';

    // Handle Dates
    if (obj instanceof Date) return obj.toISOString();

    // Handle Arrays
    if (Array.isArray(obj)) {
        return obj.map(item => toSerializablePOJO(item, seen));
    }

    // Detect if this is a complex object (class instance) rather than a POJO
    // Firestore references and instances have complex prototypes.
    const proto = Object.getPrototypeOf(obj);
    const isPlain = proto === null || proto === Object.prototype;
    
    // Additional check for Firestore-like objects that might pretend to be plain
    // but contain internal circular SDK references (like 'firestore' or 'i' properties)
    if (!isPlain || obj.firestore || obj._firestore || (obj.path && typeof obj.path === 'string')) {
        return obj.path || String(obj);
    }

    seen.add(obj);

    const result: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const val = obj[key];
            // Skip functions and internal properties
            if (typeof val === 'function') continue;
            // Recursively sanitize
            result[key] = toSerializablePOJO(val, seen);
        }
    }
    return result;
}

export function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error loading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      // Sanitize data before stringifying to avoid circular structure errors
      const serializableValue = toSerializablePOJO(storedValue);
      const serialized = JSON.stringify(serializableValue);
      window.localStorage.setItem(key, serialized);
    } catch (error) {
      // If serialization still fails, we log it but don't crash the app
      console.error(`Storage error for key "${key}":`, error);
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue];
}
