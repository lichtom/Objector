import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * 历史记录管理器测试
 * 测试撤销/重做功能
 */
describe('HistoryManager', () => {
  let HistoryManager;
  let mockEditorState;

  beforeEach(() => {
    // 模拟 EditorState
    mockEditorState = {
      blocks: {
        blk1: { id: 'blk1', type: 'move_steps', x: 0, y: 0, params: { steps: 10 } },
      },
    };
    
    // 模拟 HistoryManager（简化版）
    HistoryManager = {
      _history: [],
      _currentIndex: -1,
      _isUndoing: false,
      MAX_HISTORY: 50,
      
      init() {
        this._history = [];
        this._currentIndex = -1;
        this._isUndoing = false;
        this.pushSnapshot();
      },
      
      _getSnapshot() {
        return JSON.stringify(mockEditorState.blocks);
      },
      
      _restoreSnapshot(snapshot) {
        this._isUndoing = true;
        mockEditorState.blocks = JSON.parse(snapshot);
        this._isUndoing = false;
      },
      
      pushSnapshot() {
        if (this._isUndoing) return;
        const snapshot = this._getSnapshot();
        
        if (this._history.length > 0 && this._history[this._currentIndex] === snapshot) {
          return;
        }
        
        if (this._currentIndex < this._history.length - 1) {
          this._history = this._history.slice(0, this._currentIndex + 1);
        }
        
        this._history.push(snapshot);
        this._currentIndex = this._history.length - 1;
        
        if (this._history.length > this.MAX_HISTORY) {
          this._history.shift();
          this._currentIndex--;
        }
      },
      
      undo() {
        if (!this.canUndo()) return;
        this._currentIndex--;
        this._restoreSnapshot(this._history[this._currentIndex]);
      },
      
      redo() {
        if (!this.canRedo()) return;
        this._currentIndex++;
        this._restoreSnapshot(this._history[this._currentIndex]);
      },
      
      canUndo() {
        return this._currentIndex > 0;
      },
      
      canRedo() {
        return this._currentIndex < this._history.length - 1;
      },
      
      clear() {
        this._history = [];
        this._currentIndex = -1;
        this._isUndoing = false;
      },
      
      getHistoryLength() {
        return this._history.length;
      },
    };
  });

  describe('init', () => {
    it('should initialize with empty history', () => {
      HistoryManager.init();
      expect(HistoryManager.getHistoryLength()).toBe(1); // 初始快照
      expect(HistoryManager._currentIndex).toBe(0);
    });

    it('should record initial state', () => {
      HistoryManager.init();
      expect(HistoryManager._history[0]).toBe(JSON.stringify(mockEditorState.blocks));
    });
  });

  describe('pushSnapshot', () => {
    it('should add new snapshot to history', () => {
      HistoryManager.init();
      mockEditorState.blocks.blk2 = { id: 'blk2', type: 'turn_right', x: 0, y: 0 };
      HistoryManager.pushSnapshot();
      expect(HistoryManager.getHistoryLength()).toBe(2);
      expect(HistoryManager._currentIndex).toBe(1);
    });

    it('should not add duplicate snapshots', () => {
      HistoryManager.init();
      HistoryManager.pushSnapshot();
      HistoryManager.pushSnapshot();
      expect(HistoryManager.getHistoryLength()).toBe(1);
    });

    it('should clear future history when new snapshot is added after undo', () => {
      HistoryManager.init();
      mockEditorState.blocks.blk2 = { id: 'blk2', type: 'turn_right' };
      HistoryManager.pushSnapshot();
      mockEditorState.blocks.blk3 = { id: 'blk3', type: 'looks_show' };
      HistoryManager.pushSnapshot();
      expect(HistoryManager.getHistoryLength()).toBe(3);
      
      HistoryManager.undo();
      mockEditorState.blocks.blk4 = { id: 'blk4', type: 'wait' };
      HistoryManager.pushSnapshot();
      expect(HistoryManager.getHistoryLength()).toBe(3); // 原来的 blk3 被丢弃
    });

    it('should respect MAX_HISTORY limit', () => {
      HistoryManager.init();
      for (let i = 0; i < 60; i++) {
        mockEditorState.blocks[`blk${i}`] = { id: `blk${i}`, type: `block${i}` };
        HistoryManager.pushSnapshot();
      }
      expect(HistoryManager.getHistoryLength()).toBeLessThanOrEqual(HistoryManager.MAX_HISTORY);
    });
  });

  describe('undo/redo', () => {
    it('should undo to previous state', () => {
      HistoryManager.init();
      const originalBlocks = JSON.parse(JSON.stringify(mockEditorState.blocks));
      
      mockEditorState.blocks.blk2 = { id: 'blk2', type: 'turn_right' };
      HistoryManager.pushSnapshot();
      
      HistoryManager.undo();
      expect(mockEditorState.blocks).toEqual(originalBlocks);
    });

    it('should redo after undo', () => {
      HistoryManager.init();
      mockEditorState.blocks.blk2 = { id: 'blk2', type: 'turn_right' };
      HistoryManager.pushSnapshot();
      const newBlocks = JSON.parse(JSON.stringify(mockEditorState.blocks));
      
      HistoryManager.undo();
      HistoryManager.redo();
      expect(mockEditorState.blocks).toEqual(newBlocks);
    });

    it('should not undo when at beginning of history', () => {
      HistoryManager.init();
      expect(HistoryManager.canUndo()).toBe(false);
      HistoryManager.undo(); // Should not throw
      expect(HistoryManager._currentIndex).toBe(0);
    });

    it('should not redo when at end of history', () => {
      HistoryManager.init();
      mockEditorState.blocks.blk2 = { id: 'blk2', type: 'turn_right' };
      HistoryManager.pushSnapshot();
      
      expect(HistoryManager.canRedo()).toBe(false);
      HistoryManager.redo(); // Should not throw
      expect(HistoryManager._currentIndex).toBe(1);
    });

    it('should handle multiple undo/redo cycles', () => {
      HistoryManager.init();
      mockEditorState.blocks.blk2 = { id: 'blk2', type: 'turn_right' };
      HistoryManager.pushSnapshot();
      mockEditorState.blocks.blk3 = { id: 'blk3', type: 'looks_show' };
      HistoryManager.pushSnapshot();
      mockEditorState.blocks.blk4 = { id: 'blk4', type: 'wait' };
      HistoryManager.pushSnapshot();
      
      HistoryManager.undo();
      HistoryManager.undo();
      HistoryManager.redo();
      HistoryManager.undo();
      HistoryManager.redo();
      HistoryManager.redo();
      
      expect(Object.keys(mockEditorState.blocks)).toContain('blk4');
    });
  });

  describe('canUndo/canRedo', () => {
    it('should correctly report undo availability', () => {
      HistoryManager.init();
      expect(HistoryManager.canUndo()).toBe(false);
      
      mockEditorState.blocks.blk2 = { id: 'blk2', type: 'turn_right' };
      HistoryManager.pushSnapshot();
      expect(HistoryManager.canUndo()).toBe(true);
      
      HistoryManager.undo();
      expect(HistoryManager.canUndo()).toBe(false);
    });

    it('should correctly report redo availability', () => {
      HistoryManager.init();
      expect(HistoryManager.canRedo()).toBe(false);
      
      mockEditorState.blocks.blk2 = { id: 'blk2', type: 'turn_right' };
      HistoryManager.pushSnapshot();
      expect(HistoryManager.canRedo()).toBe(false);
      
      HistoryManager.undo();
      expect(HistoryManager.canRedo()).toBe(true);
      
      HistoryManager.redo();
      expect(HistoryManager.canRedo()).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all history', () => {
      HistoryManager.init();
      mockEditorState.blocks.blk2 = { id: 'blk2', type: 'turn_right' };
      HistoryManager.pushSnapshot();
      mockEditorState.blocks.blk3 = { id: 'blk3', type: 'looks_show' };
      HistoryManager.pushSnapshot();
      
      HistoryManager.clear();
      expect(HistoryManager.getHistoryLength()).toBe(0);
      expect(HistoryManager._currentIndex).toBe(-1);
    });
  });
});
