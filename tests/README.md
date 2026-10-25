# Objector 测试套件

Objector 积木编程编辑器的自动化测试框架。

## 测试框架

使用 [Vitest](https://vitest.dev/) 作为测试运行器，支持：
- 快速执行
- 热重载监听模式
- 覆盖率报告
- ES Module 原生支持

## 运行测试

### 安装依赖
```bash
cd tests
npm install
```

### 运行所有测试
```bash
npm test
```

### 监听模式（开发时使用）
```bash
npm run test:watch
```

### 生成覆盖率报告
```bash
npm run test:coverage
```

## 测试结构

```
tests/
├── package.json              # 测试依赖配置
├── README.md                 # 测试文档
├── block-registry.test.js    # 积木注册系统测试
├── history-manager.test.js   # 历史记录管理器测试
└── (更多测试文件...)
```

## 测试覆盖模块

### 核心模块
- ✅ **BlockRegistry** - 积木注册、查询、创建
- ✅ **HistoryManager** - 撤销/重做功能
- ⏳ **AutoSaveManager** - 自动保存（待添加）
- ⏳ **TemplateManager** - 项目模板（待添加）
- ⏳ **Executor** - 积木执行引擎（待添加）
- ⏳ **Serializer** - 序列化/反序列化（待添加）

### 舞台模块
- ⏳ **StageManager** - 精灵管理（待添加）
- ⏳ **CostumeManager** - 造型管理（待添加）

### 编辑器模块
- ⏳ **EditorCanvas** - 画布渲染（待添加）
- ⏳ **Palette** - 积木面板（待添加）

## 编写测试指南

### 基本结构
```javascript
import { describe, it, expect, beforeEach } from 'vitest';

describe('ModuleName', () => {
  beforeEach(() => {
    // 初始化测试环境
  });

  describe('methodName', () => {
    it('should do something', () => {
      // 测试逻辑
      expect(result).toBe(expected);
    });
  });
});
```

### 模拟依赖
对于浏览器 API 和其他模块，使用 Vitest 的 mock 功能：
```javascript
vi.stubGlobal('EditorState', { blocks: {} });
```

## 测试最佳实践

1. **独立性**：每个测试用例应该独立，不依赖其他测试
2. **清理**：使用 `beforeEach` 重置状态
3. **命名**：测试描述应清晰说明预期行为
4. **覆盖**：测试正常路径、边界情况和错误处理
5. **快速**：避免长时间运行的测试，使用 mock 替代真实 IO

## 持续集成

测试应该在每次提交前运行，确保：
- 新功能不破坏现有功能
- 重构后行为保持不变
- 覆盖率不低于阈值（建议 70%+）

## 待办事项

- [ ] 添加更多核心模块测试
- [ ] 集成测试（模块间交互）
- [ ] E2E 测试（使用 Playwright）
- [ ] 性能基准测试
- [ ] 设置 CI/CD 自动运行测试
