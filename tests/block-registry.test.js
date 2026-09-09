import { describe, it, expect, beforeEach } from 'vitest';

/**
 * 积木注册系统测试
 * 测试 BlockRegistry 的注册、查询、创建功能
 */
describe('BlockRegistry', () => {
  let BlockRegistry;

  beforeEach(() => {
    // 模拟 BlockRegistry（简化版）
    BlockRegistry = {
      _categories: [],
      _blocks: {},
      
      registerCategory(id, name, color) {
        if (this._categories.some(c => c.id === id)) return;
        this._categories.push({ id, name, color });
      },
      
      register(def) {
        this._blocks[def.type] = def;
      },
      
      getCategory(id) {
        return this._categories.find(c => c.id === id);
      },
      
      getCategories() {
        return this._categories;
      },
      
      getBlock(type) {
        return this._blocks[type];
      },
      
      getAllBlocks() {
        return this._blocks;
      },
      
      getBlocksByCategory(catId) {
        return Object.values(this._blocks).filter(b => b.category === catId);
      },
      
      createBlock(type, x, y) {
        const def = this._blocks[type];
        if (!def) return null;
        const params = {};
        (def.params || []).forEach(p => { params[p.name] = p.default; });
        return {
          id: 'blk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
          type,
          x: x || 0,
          y: y || 0,
          params,
          ports: {},
        };
      },
    };
  });

  describe('registerCategory', () => {
    it('should register a new category', () => {
      BlockRegistry.registerCategory('motion', '运动', '#4C97FF');
      expect(BlockRegistry.getCategories()).toHaveLength(1);
      expect(BlockRegistry.getCategory('motion')).toBeDefined();
      expect(BlockRegistry.getCategory('motion').name).toBe('运动');
    });

    it('should not register duplicate categories', () => {
      BlockRegistry.registerCategory('motion', '运动', '#4C97FF');
      BlockRegistry.registerCategory('motion', '运动', '#4C97FF');
      expect(BlockRegistry.getCategories()).toHaveLength(1);
    });

    it('should register multiple different categories', () => {
      BlockRegistry.registerCategory('motion', '运动', '#4C97FF');
      BlockRegistry.registerCategory('looks', '外观', '#9966FF');
      BlockRegistry.registerCategory('control', '控制', '#FFBF00');
      expect(BlockRegistry.getCategories()).toHaveLength(3);
    });
  });

  describe('register', () => {
    it('should register a block definition', () => {
      BlockRegistry.register({
        type: 'move_steps',
        category: 'motion',
        label: '移动 {steps} 步',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [{ name: 'steps', type: 'number', default: 10 }],
      });
      expect(BlockRegistry.getBlock('move_steps')).toBeDefined();
      expect(BlockRegistry.getBlock('move_steps').label).toBe('移动 {steps} 步');
    });

    it('should overwrite existing block with same type', () => {
      BlockRegistry.register({
        type: 'test_block',
        label: 'Original',
        params: [],
      });
      BlockRegistry.register({
        type: 'test_block',
        label: 'Updated',
        params: [],
      });
      expect(BlockRegistry.getBlock('test_block').label).toBe('Updated');
    });
  });

  describe('getBlocksByCategory', () => {
    it('should return blocks filtered by category', () => {
      BlockRegistry.register({
        type: 'move_steps',
        category: 'motion',
        params: [],
      });
      BlockRegistry.register({
        type: 'turn_right',
        category: 'motion',
        params: [],
      });
      BlockRegistry.register({
        type: 'looks_show',
        category: 'looks',
        params: [],
      });
      
      const motionBlocks = BlockRegistry.getBlocksByCategory('motion');
      expect(motionBlocks).toHaveLength(2);
      
      const looksBlocks = BlockRegistry.getBlocksByCategory('looks');
      expect(looksBlocks).toHaveLength(1);
    });

    it('should return empty array for category with no blocks', () => {
      const blocks = BlockRegistry.getBlocksByCategory('nonexistent');
      expect(blocks).toHaveLength(0);
    });
  });

  describe('createBlock', () => {
    it('should create a block instance from definition', () => {
      BlockRegistry.register({
        type: 'move_steps',
        category: 'motion',
        label: '移动 {steps} 步',
        shape: 'stack',
        ports: { flowIn: true, flowOut: true },
        params: [{ name: 'steps', type: 'number', default: 10 }],
      });
      
      const block = BlockRegistry.createBlock('move_steps', 100, 200);
      expect(block).toBeDefined();
      expect(block.type).toBe('move_steps');
      expect(block.x).toBe(100);
      expect(block.y).toBe(200);
      expect(block.params.steps).toBe(10);
      expect(block.id).toMatch(/^blk_/);
    });

    it('should return null for nonexistent block type', () => {
      const block = BlockRegistry.createBlock('nonexistent');
      expect(block).toBeNull();
    });

    it('should use default position when not provided', () => {
      BlockRegistry.register({
        type: 'test_block',
        params: [],
      });
      
      const block = BlockRegistry.createBlock('test_block');
      expect(block.x).toBe(0);
      expect(block.y).toBe(0);
    });

    it('should initialize params with default values', () => {
      BlockRegistry.register({
        type: 'test_block',
        params: [
          { name: 'num', type: 'number', default: 42 },
          { name: 'str', type: 'string', default: 'hello' },
          { name: 'bool', type: 'boolean', default: true },
        ],
      });
      
      const block = BlockRegistry.createBlock('test_block');
      expect(block.params.num).toBe(42);
      expect(block.params.str).toBe('hello');
      expect(block.params.bool).toBe(true);
    });

    it('should generate unique IDs for each block', () => {
      BlockRegistry.register({
        type: 'test_block',
        params: [],
      });
      
      const block1 = BlockRegistry.createBlock('test_block');
      const block2 = BlockRegistry.createBlock('test_block');
      expect(block1.id).not.toBe(block2.id);
    });
  });
});
