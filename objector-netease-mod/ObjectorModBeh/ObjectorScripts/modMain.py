# -*- coding: utf-8 -*-
from mod.common.mod import Mod
import mod.server.extraServerApi as serverApi
import mod.client.extraClientApi as clientApi


@Mod.Binding(name='ObjectorMod', version='1.0.0')
class ObjectorMod(object):

    @Mod.InitServer()
    def ObjectorServerInit(self):
        serverApi.RegisterSystem(
            'ObjectorMod',
            'ObjectorModServerSystem',
            'ObjectorScripts.ObjectorServerSystem.ObjectorServerSystem'
        )

    @Mod.DestroyServer()
    def ObjectorServerDestroy(self):
        pass

    @Mod.InitClient()
    def ObjectorClientInit(self):
        clientApi.RegisterSystem(
            'ObjectorMod',
            'ObjectorModClientSystem',
            'ObjectorScripts.ObjectorClientSystem.ObjectorClientSystem'
        )

    @Mod.DestroyClient()
    def ObjectorClientDestroy(self):
        pass
