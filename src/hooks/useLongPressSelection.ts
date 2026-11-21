import React, { useState, useRef, useCallback, useEffect } from 'react';

interface UseLongPressSelectionOptions {
  longPressMs?: number;
  moveThresholdPx?: number;
}

export function useLongPressSelection(options?: UseLongPressSelectionOptions) {
  const longPressMs = options?.longPressMs ?? 450;
  const moveThresholdPx = options?.moveThresholdPx ?? 10;

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [manualSelectionMode, setManualSelectionMode] = useState(false);

  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggeredRef = useRef(false);
  const blockContextMenuRef = useRef(false);

  const isSelectionMode = manualSelectionMode || selectedIds.size > 0;

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setManualSelectionMode(true);
    setSelectedIds(new Set(ids));
  }, []);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const exitSelectionMode = useCallback(() => {
    clearTimer();
    setSelectedIds(new Set());
    setManualSelectionMode(false);
  }, [clearTimer]);

  const enterSelectionMode = useCallback(() => {
    setManualSelectionMode(true);
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const getCardProps = useCallback(
    (id: string, onNormalClick?: () => void) => {
      const handlePointerDown = (e: React.PointerEvent) => {
        // Ignorer clic droit ou boutons secondaires
        if (e.pointerType === 'mouse' && e.button !== 0) return;

        // Ne pas déclencher d'appui long si on appuie sur un bouton/lien/input interne (hors mode sélection)
        const target = e.target as HTMLElement | null;
        if (!isSelectionMode && target?.closest('button, a, input, select, [data-no-longpress="true"]')) {
          return;
        }

        clearTimer();
        longPressTriggeredRef.current = false;
        blockContextMenuRef.current = false;
        startPosRef.current = { x: e.clientX, y: e.clientY };

        timerRef.current = window.setTimeout(() => {
          longPressTriggeredRef.current = true;
          blockContextMenuRef.current = true;
          setManualSelectionMode(true);
          setSelectedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
          });

          try {
            if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
              navigator.vibrate(25);
            }
          } catch {
            // Ignorer si vibration non supportée
          }
        }, longPressMs);
      };

      const handlePointerMove = (e: React.PointerEvent) => {
        if (!startPosRef.current || timerRef.current === null) return;
        const dx = e.clientX - startPosRef.current.x;
        const dy = e.clientY - startPosRef.current.y;
        if (Math.hypot(dx, dy) > moveThresholdPx) {
          clearTimer();
        }
      };

      const handlePointerEnd = () => {
        clearTimer();
      };

      const handleContextMenu = (e: React.MouseEvent) => {
        if (blockContextMenuRef.current || longPressTriggeredRef.current || isSelectionMode) {
          e.preventDefault();
        }
      };

      const handleClick = (e: React.MouseEvent) => {
        if (longPressTriggeredRef.current) {
          longPressTriggeredRef.current = false;
          e.preventDefault();
          e.stopPropagation();
          return;
        }

        if (isSelectionMode) {
          e.preventDefault();
          e.stopPropagation();
          toggleSelect(id);
          return;
        }

        if (onNormalClick) {
          onNormalClick();
        }
      };

      return {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerEnd,
        onPointerCancel: handlePointerEnd,
        onPointerLeave: handlePointerEnd,
        onContextMenu: handleContextMenu,
        onClick: handleClick,
      };
    },
    [clearTimer, isSelectionMode, longPressMs, moveThresholdPx, toggleSelect]
  );

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelectionMode,
    isSelected,
    toggleSelect,
    selectAll,
    deselectAll,
    enterSelectionMode,
    exitSelectionMode,
    getCardProps,
  };
}
