"""
Objector micro:bit 电脑端实时控制台
pip install pyserial
"""
import serial, threading, time, sys

PORT = sys.argv[1] if len(sys.argv) > 1 else 'COM3'
BAUD = 115200

ser = serial.Serial(PORT, BAUD, timeout=0.1)

def reader():
    while True:
        line = ser.readline()
        if line:
            try:
                txt = line.decode('utf-8', 'ignore').strip()
                if txt:
                    print('[MB]', txt)
            except:
                pass

threading.Thread(target=reader, daemon=True).start()

def send(cmd):
    ser.write((cmd + '\n').encode('utf-8'))
    ser.flush()

# ===== API =====
def ping():               send('PING')
def info():               send('INFO')
def led_on():             send('LED:ON')
def led_off():            send('LED:OFF')
def led_img(pat):         send('LED:IMG:' + pat)
def led_pixel(x, y, b):   send('LED:PX:%d,%d,%d' % (x, y, b))
def led_brightness(v):    send('LED:BR:%d' % v)
def led(name):            send('LED:' + name)
def text(s):              send('TEXT:' + s)
def show(s):              send('SHOW:' + s)
def buzz(freq, dur=0):    send('BUZZ:%d:%d' % (freq, dur))
def buzz_off():           send('BUZZ:OFF')
def note(notes):          send('NOTE:' + notes)
def servo(pin, angle):    send('SERVO:%s,%d' % (pin, angle))
def servo_off(pin):       send('SERVO_OFF:' + pin)
def motor_cfg(a1, a2, b1=None, b2=None):
    parts = [a1, a2]
    if b1: parts.append(b1)
    if b2: parts.append(b2)
    send('MCFG:' + ','.join(parts))
def motor(which, speed):  send('MOTOR:%s,%d' % (which, speed))
def motor_brake():        send('MOTOR:BRAKE')
def np_init(pin, count):  send('NP_INIT:%s,%d' % (pin, count))
def rgb(r, g, b):         send('RGB:%d,%d,%d' % (r, g, b))
def rgb_one(i, r, g, b):  send('RGB:%d,%d,%d,%d' % (i, r, g, b))
def rgb_off():            send('RGB:OFF')
def rgb_rainbow():        send('RGB:RAINBOW')
def pin_write(pin, val, mode='digital'): send('PIN_W:%s,%d,%s' % (pin, val, mode))
def pin_read(pin, mode='analog'):        send('PIN_R:%s,%s' % (pin, mode))
def temp():               send('TEMP')
def light():              send('LIGHT')
def acc():                send('ACC')
def compass():            send('COMPASS')
def buttons():            send('BTN')
def gesture():            send('GESTURE')
def touch():              send('TOUCH')
def sound():              send('SOUND')
def all_sensors():        send('ALL')
def report(on, ms=200):   send('REPORT:%s' % ('ON' if on else str(ms) if isinstance(ms, int) and ms > 0 else 'OFF'))
def wd_on(action='STOP', timeout=5000): send('WD:ON,%s,%d' % (action, timeout))
def wd_off():             send('WD:OFF')
def pid_on(target, kp, ki, kd, src='T', pin=None):
    cmd = 'PID:ON,%s,%s,%s,%s,%s' % (target, kp, ki, kd, src)
    if pin: cmd += ',' + pin
    send(cmd)
def pid_off():            send('PID:OFF')
def pid_target(v):        send('PID:TARGET,%s' % v)
def log_on(ms=1000):      send('LOG:%d' % ms)
def log_off():            send('LOG:OFF')

# 表情快捷
def happy():    send('HAPPY')
def sad():      send('SAD')
def angry():    send('ANGRY')
def confused(): send('CONFUSED')
def surprised():send('SURPRISED')
def yes():      send('YES')
def no():       send('NO')

print('Objector micro:bit 实时控制台')
print('端口: %s  波特率: %d' % (PORT, BAUD))
print('输入 HELP 查看所有命令, 输入 quit 退出\n')

try:
    while True:
        cmd = input('> ').strip()
        if not cmd:
            continue
        if cmd.lower() in ('quit', 'exit', 'q'):
            break
        send(cmd)
except KeyboardInterrupt:
    pass
finally:
    motor_brake()
    buzz_off()
    led_off()
    ser.close()
    print('\n已断开')
