type EditorHistoryOptions<T> = {
  equals?(left: T, right: T): boolean;
  limit?: number;
  coalesceWindowMs?: number;
  now?(): number;
};

type EditorHistory<T> = {
  record(snapshot: T, coalesceKey?: string): void;
  undo(current: T): T | undefined;
  redo(current: T): T | undefined;
  clear(): void;
  canUndo(): boolean;
  canRedo(): boolean;
};

export function createEditorHistory<T>({
  equals = Object.is,
  limit = 100,
  coalesceWindowMs = 300,
  now = Date.now,
}: EditorHistoryOptions<T> = {}): EditorHistory<T> {
  /* Snapshots are plain data, so the platform's deep copy is the whole job. */
  const clone = structuredClone;
  const undoStack: T[] = [];
  const redoStack: T[] = [];
  let lastObserved: T | undefined;
  let lastCoalesceKey: string | undefined;
  let lastRecordTime = Number.NEGATIVE_INFINITY;

  function resetCoalescing(): void {
    lastObserved = undefined;
    lastCoalesceKey = undefined;
    lastRecordTime = Number.NEGATIVE_INFINITY;
  }

  return {
    record(snapshot, coalesceKey) {
      if (lastObserved !== undefined && equals(snapshot, lastObserved)) {
        return;
      }

      const recordTime = now();
      const shouldCoalesce = Boolean(
        coalesceKey
        && coalesceKey === lastCoalesceKey
        && recordTime - lastRecordTime <= coalesceWindowMs
        && undoStack.length > 0,
      );
      if (!shouldCoalesce) {
        undoStack.push(clone(snapshot));
        if (undoStack.length > Math.max(1, limit)) {
          undoStack.splice(0, undoStack.length - Math.max(1, limit));
        }
      }
      redoStack.length = 0;
      lastObserved = clone(snapshot);
      lastCoalesceKey = coalesceKey;
      lastRecordTime = recordTime;
    },

    undo(current) {
      const snapshot = undoStack.pop();
      if (snapshot === undefined) {
        return undefined;
      }
      redoStack.push(clone(current));
      resetCoalescing();
      return clone(snapshot);
    },

    redo(current) {
      const snapshot = redoStack.pop();
      if (snapshot === undefined) {
        return undefined;
      }
      undoStack.push(clone(current));
      resetCoalescing();
      return clone(snapshot);
    },

    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
      resetCoalescing();
    },

    canUndo() {
      return undoStack.length > 0;
    },

    canRedo() {
      return redoStack.length > 0;
    },
  };
}
