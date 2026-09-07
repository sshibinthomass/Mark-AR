import { describe, expect, it } from 'vitest';
import { createEditorHistory } from '../src/app/editorHistory';

describe('editor history', () => {
  it('undoes, redoes, and clears redo after a new edit', () => {
    const history = createEditorHistory<number>();

    history.record(0);
    expect(history.undo(1)).toBe(0);
    expect(history.redo(0)).toBe(1);
    expect(history.undo(1)).toBe(0);
    history.record(2);

    expect(history.canRedo()).toBe(false);
  });

  it('coalesces the same operation inside the configured window', () => {
    let time = 1000;
    const history = createEditorHistory<number>({
      now: () => time,
      coalesceWindowMs: 300,
    });

    history.record(0, 'placement');
    time += 100;
    history.record(1, 'placement');

    expect(history.undo(2)).toBe(0);
    expect(history.undo(0)).toBeUndefined();
  });

  it('starts a new undo point after the coalescing window', () => {
    let time = 1000;
    const history = createEditorHistory<number>({
      now: () => time,
      coalesceWindowMs: 300,
    });

    history.record(0, 'placement');
    time += 301;
    history.record(1, 'placement');

    expect(history.undo(2)).toBe(1);
    expect(history.undo(1)).toBe(0);
  });

  it('keeps only the configured number of snapshots', () => {
    const history = createEditorHistory<number>({ limit: 2 });

    history.record(0);
    history.record(1);
    history.record(2);

    expect(history.undo(3)).toBe(2);
    expect(history.undo(2)).toBe(1);
    expect(history.undo(1)).toBeUndefined();
  });

  it('clones stack boundaries and skips equal consecutive snapshots', () => {
    const history = createEditorHistory<{ value: number }>({
      equals: (left, right) => left.value === right.value,
    });
    const original = { value: 1 };

    history.record(original);
    original.value = 2;
    history.record({ value: 1 });

    expect(history.undo({ value: 3 })).toEqual({ value: 1 });
    expect(history.undo({ value: 1 })).toBeUndefined();
  });
});
