# -*- coding: utf-8 -*-
"""
Objector ServerSystem - deferred imports, Python 2.7 safe
"""
import mod.server.extraServerApi as serverApi

ServerApi = serverApi.GetServerApi()
compFactory = ServerApi.GetEngineCompFactory()


class ObjectorServerSystem(ServerApi.GetServerSystemCls()):

    def __init__(self, namespace, systemName):
        super(ObjectorServerSystem, self).__init__(namespace, systemName)
        self._namespace = namespace
        print '[Objector] ServerSystem __init__'

        # Deferred imports - inside constructor to avoid module-level errors
        from block_commands import execute_block_command
        from program_manager import ProgramStore
        self._execute_block_command = execute_block_command
        self.programStore = ProgramStore()

        # Listen for chat events
        self.ListenForEvent(
            ServerApi.engine_namespace,
            ServerApi.engine_system_name,
            'ServerChatEvent', self, self.on_chat
        )

        # Listen for client->server custom events
        clientNs = namespace
        clientSys = namespace + 'Client'
        self.ListenForEvent(clientNs, clientSys, 'ObjectorExecuteBlock', self, self.on_execute_block)
        self.ListenForEvent(clientNs, clientSys, 'ObjectorRunProgram', self, self.on_run_program)
        self.ListenForEvent(clientNs, clientSys, 'ObjectorSaveProgram', self, self.on_save_program)
        self.ListenForEvent(clientNs, clientSys, 'ObjectorDeleteProgram', self, self.on_delete_program)
        self.ListenForEvent(clientNs, clientSys, 'ObjectorGetPrograms', self, self.on_get_programs)

        print '[Objector] ServerSystem ready'

    # ========== Chat handler ==========

    def on_chat(self, args):
        msg = args.get('message', '').strip()
        playerId = args.get('username', '')

        if msg == '/obj' or msg == '/objector':
            args['cancel'] = True
            self._to_client(playerId, 'ObjectorOpenMenu', {'mode': 'main'})

        elif msg.startswith('/obj list'):
            args['cancel'] = True
            progs = self.programStore.list_programs(playerId)
            self._to_client(playerId, 'ObjectorShowPrograms', {'programs': progs})

        elif msg.startswith('/obj run '):
            args['cancel'] = True
            self._run_program(playerId, msg[9:].strip())

        elif msg.startswith('/obj delete '):
            args['cancel'] = True
            name = msg[12:].strip()
            if self.programStore.delete_program(playerId, name):
                self._msg(playerId, u'\xa7a Deleted: %s' % name)
            else:
                self._msg(playerId, u'\xa7c Not found: %s' % name)

    # ========== Client request handlers ==========

    def on_execute_block(self, args):
        playerId = args.get('playerId', '')
        blockId = args.get('blockId', '')
        params = args.get('params', {})
        result = self._execute_block_command(blockId, params, playerId, compFactory)
        self._to_client(playerId, 'ObjectorBlockResult', {
            'blockId': blockId,
            'success': result['success'],
            'message': result['message']
        })

    def on_run_program(self, args):
        self._run_program(args.get('playerId', ''), args.get('name', ''))

    def on_save_program(self, args):
        playerId = args.get('playerId', '')
        name = args.get('name', '')
        steps = args.get('steps', [])
        self.programStore.save_program(playerId, name, steps)
        self._msg(playerId, u'\xa7a Program "%s" saved (%d steps)' % (name, len(steps)))

    def on_delete_program(self, args):
        playerId = args.get('playerId', '')
        name = args.get('name', '')
        if self.programStore.delete_program(playerId, name):
            self._msg(playerId, u'\xa7a Deleted: %s' % name)
        else:
            self._msg(playerId, u'\xa7c Not found: %s' % name)

    def on_get_programs(self, args):
        playerId = args.get('playerId', '')
        progs = self.programStore.list_programs(playerId)
        self._to_client(playerId, 'ObjectorShowPrograms', {'programs': progs})

    # ========== Internal ==========

    def _run_program(self, playerId, name):
        program = self.programStore.get_program(playerId, name)
        if not program:
            self._msg(playerId, u'\xa7c Program "%s" not found' % name)
            return
        steps = program.get('steps', [])
        ok = 0
        for step in steps:
            r = self._execute_block_command(step.get('blockId', ''), step.get('params', {}), playerId, compFactory)
            if r['success']:
                ok += 1
            else:
                self._msg(playerId, u'\xa7c %s' % r['message'])
        self._msg(playerId, u'\xa7a Program done: %d/%d steps OK' % (ok, len(steps)))

    def _msg(self, playerId, text):
        try:
            comp = compFactory.CreateGame(ServerApi.levelId)
            comp.SetCommand(msg=text, playerId=playerId, commandType=0)
        except Exception as e:
            print '[Objector] _msg err: %s' % str(e)

    def _to_client(self, playerId, eventName, data):
        data['playerId'] = playerId
        self.BroadcastEvent(self._namespace, self._namespace + 'Client', eventName, data)

    def Destroy(self):
        print '[Objector] ServerSystem Destroy'

