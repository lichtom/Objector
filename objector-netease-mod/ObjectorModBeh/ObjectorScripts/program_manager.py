# -*- coding: utf-8 -*-
"""
Objector 编程模组 - 程序存储管理
使用模组数据存储玩家保存的程序
"""


class ProgramStore(object):
    """程序存储管理器 - 内存中存储（单世界会话）"""

    def __init__(self):
        # playerId -> [programs]
        self._programs = {}
        print '[Objector] ProgramStore 已初始化'

    def save_program(self, playerId, name, steps):
        """保存程序（如果同名已存在则覆盖）"""
        if playerId not in self._programs:
            self._programs[playerId] = []

        programs = self._programs[playerId]

        # 查找同名程序
        found = False
        for i, p in enumerate(programs):
            if p['name'] == name:
                programs[i] = {'name': name, 'steps': steps}
                found = True
                break

        if not found:
            programs.append({'name': name, 'steps': steps})

        print '[Objector] 已保存程序: %s (%d 步) 玩家: %s' % (name, len(steps), playerId)

    def get_program(self, playerId, name):
        """获取指定名称的程序"""
        if playerId not in self._programs:
            return None
        for p in self._programs[playerId]:
            if p['name'] == name:
                return p
        return None

    def list_programs(self, playerId):
        """列出玩家所有程序"""
        if playerId not in self._programs:
            return []
        return self._programs[playerId]

    def delete_program(self, playerId, name):
        """删除程序"""
        if playerId not in self._programs:
            return False

        programs = self._programs[playerId]
        for i, p in enumerate(programs):
            if p['name'] == name:
                programs.pop(i)
                print '[Objector] 已删除程序: %s' % name
                return True
        return False
