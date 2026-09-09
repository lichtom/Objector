# -*- coding: utf-8 -*-
"""
Objector ClientSystem - deferred imports, Python 2.7 safe
"""
import mod.client.extraClientApi as clientApi

ClientApi = clientApi.GetClientApi()
compFactory = ClientApi.GetEngineCompFactory()


class ObjectorClientSystem(ClientApi.GetClientSystemCls()):

    def __init__(self, namespace, systemName):
        super(ObjectorClientSystem, self).__init__(namespace, systemName)
        self._namespace = namespace
        self._systemName = systemName
        self.localPlayerId = None
        self._currentProgram = {'name': u'new', 'steps': []}

        print '[Objector] ClientSystem __init__'

        # Deferred import
        from block_commands import BLOCK_CATEGORIES, BLOCK_DEFINITIONS
        self._categories = BLOCK_CATEGORIES
        self._definitions = BLOCK_DEFINITIONS

        # Listen for server->client events
        serverSys = namespace + 'Server'
        self.ListenForEvent(namespace, serverSys, 'ObjectorOpenMenu', self, self.on_open_menu)
        self.ListenForEvent(namespace, serverSys, 'ObjectorBlockResult', self, self.on_block_result)
        self.ListenForEvent(namespace, serverSys, 'ObjectorShowPrograms', self, self.on_show_programs)

        # Delayed player ID fetch
        self._delay_get_id()
        print '[Objector] ClientSystem ready'

    def _delay_get_id(self):
        def _try():
            self.localPlayerId = ClientApi.GetLocalPlayerId()
            print '[Objector] playerId=%s' % str(self.localPlayerId)
            if not self.localPlayerId:
                ClientApi.GetTimerCall(1.0, 1, _try)
        ClientApi.GetTimerCall(2.0, 1, _try)

    def _pid(self):
        if not self.localPlayerId:
            self.localPlayerId = ClientApi.GetLocalPlayerId()
        return self.localPlayerId

    def _to_server(self, eventName, data):
        data['playerId'] = self._pid() or ''
        self.NotifyToServer(eventName, data)

    def _chat(self, msg):
        try:
            pid = self._pid()
            if pid:
                comp = compFactory.CreateGame(pid)
                comp.SetCommand(msg=msg, playerId=pid, commandType=0)
        except Exception as e:
            print '[Objector] chat err: %s' % str(e)

    # ========== Server event callbacks ==========

    def on_open_menu(self, args):
        mode = args.get('mode', 'main')
        if mode == 'main':
            self._main_menu()
        elif mode == 'help':
            self._help_menu()

    def on_block_result(self, args):
        self._chat(args.get('message', ''))
        if args.get('success'):
            self._after_exec()

    def on_show_programs(self, args):
        self._program_list(args.get('programs', []))

    # ========== Main menu ==========

    def _main_menu(self):
        comp = compFactory.CreateForm(self._pid())
        comp.SetForm({
            'type': 'form',
            'title': 'Objector',
            'content': 'Choose action:',
            'buttons': [
                {'text': 'Execute Block'},
                {'text': 'My Programs'},
                {'text': 'Write Program'},
                {'text': 'Help'},
                {'text': 'Close'},
            ]
        })
        def cb(data):
            if data is None or data == -1:
                return
            if data == 0:
                self._cat_menu('execute')
            elif data == 1:
                self._to_server('ObjectorGetPrograms', {})
            elif data == 2:
                self._currentProgram = {'name': u'new', 'steps': []}
                self._prog_editor()
            elif data == 3:
                self._help_menu()
        comp.RegisterFormCallback(cb)

    # ========== Category menu ==========

    def _cat_menu(self, mode):
        buttons = []
        for cat in self._categories:
            buttons.append({'text': cat['name']})
        buttons.append({'text': 'Back'})

        comp = compFactory.CreateForm(self._pid())
        comp.SetForm({
            'type': 'form',
            'title': 'Category',
            'content': 'Select category:',
            'buttons': buttons
        })
        def cb(data):
            if data is None or data == -1:
                return
            if data >= len(self._categories):
                self._main_menu()
                return
            self._block_list(self._categories[data]['id'], mode)
        comp.RegisterFormCallback(cb)

    # ========== Block list ==========

    def _block_list(self, catId, mode):
        blocks = [b for b in self._definitions if b['category'] == catId]
        buttons = []
        for b in blocks:
            buttons.append({'text': '%s (%d params)' % (b['name'], len(b.get('params', [])))})
        buttons.append({'text': 'Back'})

        comp = compFactory.CreateForm(self._pid())
        comp.SetForm({
            'type': 'form',
            'title': 'Blocks',
            'content': 'Select block:',
            'buttons': buttons
        })
        def cb(data):
            if data is None or data == -1:
                return
            if data >= len(blocks):
                self._cat_menu(mode)
                return
            block = blocks[data]
            if mode == 'execute':
                self._block_params(block)
            else:
                self._block_params_prog(block)
        comp.RegisterFormCallback(cb)

    # ========== Block params (execute) ==========

    def _block_params(self, block):
        params = block.get('params', [])
        comp = compFactory.CreateForm(self._pid())
        comp.SetForm({
            'type': 'custom_form',
            'title': block['name'],
            'content': self._form_content(params)
        })
        def cb(data):
            if data is None:
                return
            parsed = self._parse(params, data)
            self._to_server('ObjectorExecuteBlock', {'blockId': block['id'], 'params': parsed})
        comp.RegisterFormCallback(cb)

    # ========== Block params (program) ==========

    def _block_params_prog(self, block):
        params = block.get('params', [])
        comp = compFactory.CreateForm(self._pid())
        comp.SetForm({
            'type': 'custom_form',
            'title': 'Add: ' + block['name'],
            'content': self._form_content(params)
        })
        def cb(data):
            if data is None:
                return
            parsed = self._parse(params, data)
            self._currentProgram['steps'].append({
                'blockId': block['id'],
                'blockName': block['name'],
                'params': parsed
            })
            self._chat('Added: %s (step %d)' % (block['name'], len(self._currentProgram['steps'])))
            self._prog_editor()
        comp.RegisterFormCallback(cb)

    # ========== Form helpers ==========

    def _form_content(self, params):
        content = []
        for p in params:
            if p['type'] == 'dropdown':
                opts = [p.get('names', {}).get(o, o) for o in p['options']]
                content.append({'type': 'dropdown', 'text': p['label'], 'options': opts, 'default': 0})
            elif p['type'] == 'text':
                content.append({'type': 'input', 'text': p['label'], 'placeholder': p.get('default', ''), 'default': p.get('default', '')})
            elif p['type'] == 'slider':
                content.append({'type': 'slider', 'text': p['label'], 'min': p.get('min', 0), 'max': p.get('max', 10), 'step': p.get('step', 1), 'default': p.get('default', p.get('min', 0))})
            elif p['type'] == 'toggle':
                content.append({'type': 'toggle', 'text': p['label'], 'default': p.get('default', False)})
        return content

    def _parse(self, params, data):
        parsed = {}
        for i, p in enumerate(params):
            v = data[i] if i < len(data) else None
            if p['type'] == 'dropdown':
                parsed[p['key']] = p['options'][int(v)]
            elif p['type'] == 'slider':
                parsed[p['key']] = int(v)
            else:
                parsed[p['key']] = v
        return parsed

    # ========== Program editor ==========

    def _prog_editor(self):
        steps = self._currentProgram['steps']
        desc = '\n'.join(['  %d. %s' % (i+1, s['blockName']) for i, s in enumerate(steps)]) or '(empty)'

        buttons = [{'text': 'Add Block'}, {'text': 'Test Run'}]
        if steps:
            buttons.append({'text': 'Remove Last'})
            buttons.append({'text': 'Clear All'})
        buttons.append({'text': 'Save'})
        buttons.append({'text': 'Cancel'})

        comp = compFactory.CreateForm(self._pid())
        comp.SetForm({
            'type': 'form',
            'title': 'Edit: ' + self._currentProgram['name'],
            'content': '%d steps:\n%s' % (len(steps), desc),
            'buttons': buttons
        })
        def cb(data):
            if data is None or data == -1:
                return
            if data == 0:
                self._cat_menu('program')
            elif data == 1:
                for s in steps:
                    self._to_server('ObjectorExecuteBlock', {'blockId': s['blockId'], 'params': s['params']})
                self._chat('Test run: %d steps' % len(steps))
                self._prog_editor()
            elif data == 2 and steps:
                r = self._currentProgram['steps'].pop()
                self._chat('Removed: %s' % r['blockName'])
                self._prog_editor()
            elif data == 3 and steps:
                self._currentProgram['steps'] = []
                self._chat('Cleared')
                self._prog_editor()
            elif (data == 4 and not steps) or (data == 2 and not steps):
                self._save_dialog()
            elif (data == 5 and not steps) or (data == 3 and not steps) or (data == 4 and steps):
                self._currentProgram = {'name': u'new', 'steps': []}
                self._main_menu()
        comp.RegisterFormCallback(cb)

    def _save_dialog(self):
        comp = compFactory.CreateForm(self._pid())
        comp.SetForm({
            'type': 'custom_form',
            'title': 'Save Program',
            'content': [{'type': 'input', 'text': 'Name', 'placeholder': 'my_program', 'default': self._currentProgram['name']}]
        })
        def cb(data):
            if data is None:
                self._prog_editor()
                return
            name = data[0].strip() if data[0] else ''
            if not name:
                self._chat('Name cannot be empty')
                self._prog_editor()
                return
            self._currentProgram['name'] = name
            self._to_server('ObjectorSaveProgram', {'name': name, 'steps': self._currentProgram['steps']})
            self._currentProgram = {'name': u'new', 'steps': []}
        comp.RegisterFormCallback(cb)

    # ========== Program list ==========

    def _program_list(self, programs):
        buttons = []
        for p in programs:
            buttons.append({'text': '%s (%d steps)' % (p['name'], len(p.get('steps', [])))})
        buttons.append({'text': 'New Program'})
        buttons.append({'text': 'Back'})

        comp = compFactory.CreateForm(self._pid())
        comp.SetForm({
            'type': 'form',
            'title': 'My Programs',
            'content': '%d programs' % len(programs) if programs else 'No saved programs',
            'buttons': buttons
        })
        def cb(data):
            if data is None or data == -1:
                return
            if data >= len(programs):
                if data == len(programs):
                    self._currentProgram = {'name': u'new', 'steps': []}
                    self._prog_editor()
                else:
                    self._main_menu()
                return
            self._program_detail(programs[data])
        comp.RegisterFormCallback(cb)

    def _program_detail(self, prog):
        steps = prog.get('steps', [])
        desc = '\n'.join(['  %d. %s' % (i+1, s.get('blockName', '')) for i, s in enumerate(steps)]) or '(empty)'

        comp = compFactory.CreateForm(self._pid())
        comp.SetForm({
            'type': 'form',
            'title': prog['name'],
            'content': '%d steps:\n%s' % (len(steps), desc),
            'buttons': [
                {'text': 'Run'},
                {'text': 'Edit'},
                {'text': 'Delete'},
                {'text': 'Back'},
            ]
        })
        def cb(data):
            if data is None or data == -1:
                return
            if data == 0:
                self._to_server('ObjectorRunProgram', {'name': prog['name']})
            elif data == 1:
                self._currentProgram = {'name': prog['name'], 'steps': list(steps)}
                self._prog_editor()
            elif data == 2:
                self._to_server('ObjectorDeleteProgram', {'name': prog['name']})
                self._to_server('ObjectorGetPrograms', {})
            elif data == 3:
                self._to_server('ObjectorGetPrograms', {})
        comp.RegisterFormCallback(cb)

    # ========== Help ==========

    def _help_menu(self):
        text = 'Commands:\n  /obj - open menu\n  /obj list - list programs\n  /obj run <name> - run\n  /obj delete <name> - delete\n\nBlocks: %d total' % len(self._definitions)
        for cat in self._categories:
            cnt = len([b for b in self._definitions if b['category'] == cat['id']])
            text += '\n  %s (%d)' % (cat['name'], cnt)

        comp = compFactory.CreateForm(self._pid())
        comp.SetForm({
            'type': 'form',
            'title': 'Help',
            'content': text,
            'buttons': [{'text': 'Back'}]
        })
        def cb(data):
            if data == 0:
                self._main_menu()
        comp.RegisterFormCallback(cb)

    # ========== After execute ==========

    def _after_exec(self):
        comp = compFactory.CreateForm(self._pid())
        comp.SetForm({
            'type': 'form',
            'title': 'Done',
            'content': '',
            'buttons': [
                {'text': 'More Blocks'},
                {'text': 'Main Menu'},
                {'text': 'Close'},
            ]
        })
        def cb(data):
            if data is None or data == -1:
                return
            if data == 0:
                self._cat_menu('execute')
            elif data == 1:
                self._main_menu()
        comp.RegisterFormCallback(cb)

    def Destroy(self):
        print '[Objector] ClientSystem Destroy'
