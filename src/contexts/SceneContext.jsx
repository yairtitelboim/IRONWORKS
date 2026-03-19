import React, { createContext, useContext, useMemo, useState } from 'react';

/**
 * SceneContext
 *
 * Centralized scene/workflow state for transmission navigation and card system.
 * This is a thin wrapper around the existing useSceneManager behaviour so we
 * can start sharing state without changing how scenes are persisted.
 */

const SceneContext = createContext(null);

export const SceneProvider = ({ children }) => {
  const [currentSceneId, setCurrentSceneId] = useState(null);
  const [activeWorkflowName, setActiveWorkflowName] = useState(null);

  // We will later hydrate this from useSceneManager in AITransmissionNav.
  const [scenesSnapshot, setScenesSnapshot] = useState([]);

  const value = useMemo(
    () => ({
      currentSceneId,
      setCurrentSceneId,
      activeWorkflowName,
      setActiveWorkflowName,
      scenesSnapshot,
      setScenesSnapshot
    }),
    [currentSceneId, activeWorkflowName, scenesSnapshot]
  );

  return <SceneContext.Provider value={value}>{children}</SceneContext.Provider>;
};

export const useSceneState = () => {
  const ctx = useContext(SceneContext);
  if (!ctx) {
    throw new Error('useSceneState must be used within a SceneProvider');
  }
  return ctx;
};


