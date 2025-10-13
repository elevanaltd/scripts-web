/**
 * Script Status Context
 *
 * Provides script status information across the application
 * Allows Header to display save status without prop drilling
 */

import { createContext, useContext, useState, ReactNode, useCallback, useMemo } from 'react';

export interface ScriptStatus {
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  lastSaved: Date | null;
  componentCount: number;
}

interface ScriptStatusContextType {
  scriptStatus: ScriptStatus | null;
  updateScriptStatus: (status: Partial<ScriptStatus>) => void;
  clearScriptStatus: () => void;
}

const ScriptStatusContext = createContext<ScriptStatusContextType | undefined>(undefined);

interface ScriptStatusProviderProps {
  children: ReactNode;
}

export function ScriptStatusProvider({ children }: ScriptStatusProviderProps) {
  const [scriptStatus, setScriptStatus] = useState<ScriptStatus | null>(null);

  // Memoize the update function to maintain stable reference
  const updateScriptStatus = useCallback((updates: Partial<ScriptStatus>) => {
    setScriptStatus(current => {
      if (!current) {
        // If no current status, create a new one with defaults
        return {
          saveStatus: 'saved',
          lastSaved: null,
          componentCount: 0,
          ...updates
        };
      }
      return { ...current, ...updates };
    });
  }, []);

  // Memoize the clear function to maintain stable reference
  const clearScriptStatus = useCallback(() => {
    setScriptStatus(null);
  }, []);

  // Memoize the context value to prevent unnecessary re-renders
  const contextValue = useMemo(
    () => ({
      scriptStatus,
      updateScriptStatus,
      clearScriptStatus
    }),
    [scriptStatus, updateScriptStatus, clearScriptStatus]
  );

  return (
    <ScriptStatusContext.Provider value={contextValue}>
      {children}
    </ScriptStatusContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useScriptStatus() {
  const context = useContext(ScriptStatusContext);
  if (context === undefined) {
    throw new Error('useScriptStatus must be used within a ScriptStatusProvider');
  }
  return context;
}