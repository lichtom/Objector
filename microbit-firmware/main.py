from microbit import *
import machine,utime,math
V2=False
try:
 import microphone,speaker;V2=True
except:pass
try:import neopixel as _NP
except:_NP=None
_n=None;_nc=0;_mp={}
_ro=False;_ri=200;_lr=0;_we=False;_wt=5000;_wa='S';_wc=0;_buf=''
def _s(m):
 try:uart.write((str(m)+'\n').encode())
 except:pass
def ok(d=''):_s(('OK:'+str(d))if d else'OK')
def er(m):_s('ER:'+str(m))
def _r():
 global _buf
 try:d=uart.read()
 except:return
 if not d:return
 try:_buf+=d.decode('utf-8','ignore')
 except:_buf='';return
 if len(_buf)>200:_buf=_buf[-100:]
 i=_buf.find('\n')
 if i>=0:
  l=_buf[:i].strip().replace('\r','')
  _buf=_buf[i+1:]
  return l if l else None
def _p(n):
 return{'P0':pin0,'P1':pin1,'P2':pin2,'P3':pin3,'P4':pin4,'P5':pin5,'P6':pin6,'P7':pin7,'P8':pin8,'P9':pin9,'P10':pin10,'P11':pin11,'P12':pin12,'P13':pin13,'P14':pin14,'P15':pin15,'P16':pin16,'P19':pin19,'P20':pin20}.get(n.upper())
def _ac():
 x,y,z=accelerometer.get_x(),accelerometer.get_y(),accelerometer.get_z()
 return x,y,z,int(math.sqrt(x*x+y*y+z*z))
def _h(c):
 global _ro,_ri,_lr,_we,_wt,_wa,_wc,_n,_nc,_mp
 c=c.strip()
 if not c or c[0]=='#':return
 _wc=utime.ticks_ms()
 if c=='P':ok(gc.mem_free());return
 if c=='RST':ok();utime.sleep_ms(100);machine.reset();return
 if c=='L1':display.show(Image.HEART);ok();return
 if c=='L0':display.clear();ok();return
 if c[:2]=='LI':
  p=c[2:].strip()
  if len(p)>=25:
   for y in range(5):
    for x in range(5):
     if p[y*5+x]in'0123456789':display.set_pixel(x,y,int(p[y*5+x]))
   ok()
  else:er()
  return
 if c[:2]=='PX':
  try:
   p=c[2:].split(',')
   display.set_pixel(int(p[0]),int(p[1]),int(p[2]))
   ok()
  except:er()
  return
 if c[:2]=='L:':
  try:display.show(getattr(Image,c[2:].upper()));ok()
  except:er()
  return
 if c[:2]=='T:':display.scroll(c[2:],delay=80,wait=False);ok();return
 if c[:2]=='S:':
  s=c[2:]
  if len(s)==1:display.show(s)
  else:display.scroll(s,delay=80,wait=False)
  ok();return
 if c=='BZ':music.stop();ok();return
 if c[:2]=='BZ':
  p=c[2:].split(':')
  f=int(p[0])
  music.pitch(f,int(p[1])if len(p)>1 else-1,wait=False)if f>0 else music.stop()
  ok();return
 if c[:2]=='SV':
  p=c[2:].split(',')
  pp=_p(p[0])
  if pp and len(p)==2:
   a=max(0,min(180,int(p[1])))
   pp.write_analog((500+a*2000//180)*1023//20000);pp.set_analog_period(20);ok()
  else:er()
  return
 if c[:2]=='SO':
  pp=_p(c[2:])
  if pp:pp.write_analog(0);ok()
  else:er()
  return
 if c[:2]=='MC':
  p=c[2:].split(',')
  if len(p)>=2:
   _mp={'a':_p(p[0]),'b':_p(p[1]),'c':_p(p[2])if len(p)>2 else None,'d':_p(p[3])if len(p)>3 else None}
   ok()
  else:er()
  return
 if c[:2]=='M:':
  p=c[2:].split(',')
  if len(p)==2:
   s=max(-100,min(100,int(p[1])));w=abs(s)*1023//100;k=p[0]
   if k in('A','2'):
    a,b=_mp.get('a'),_mp.get('b')
    if a and b:
     if s>=0:a.write_analog(w);b.write_analog(0)
     else:a.write_analog(0);b.write_analog(w)
   if k in('B','2'):
    a,b=_mp.get('c'),_mp.get('d')
    if a and b:
     if s>=0:a.write_analog(w);b.write_analog(0)
     else:a.write_analog(0);b.write_analog(w)
   ok()
  else:er()
  return
 if c=='MB':
  for k in _mp:
   if _mp[k]:_mp[k].write_analog(0)
  ok();return
 if c[:2]=='NI':
  p=c[2:].split(',')
  if len(p)==2 and _NP:
   pp=_p(p[0])
   if pp:
    try:_n=_NP.NeoPixel(pp,int(p[1]));_nc=int(p[1]);_n.clear();_n.show();ok()
    except:_n=None;er()
   else:er()
  else:er()
  return
 if c[:2]=='C:':
  if c[2:]=='0':
   if _n:_n.clear();_n.show()
   ok();return
  p=[int(x)for x in c[2:].split(',')]
  if not _n:er();return
  if len(p)==3:
   for i in range(_nc):_n[i]=(p[0],p[1],p[2])
   _n.show();ok()
  elif len(p)==4 and 0<=p[0]<_nc:
   _n[p[0]]=(p[1],p[2],p[3]);_n.show();ok()
  else:er()
  return
 if c[:2]=='W:':
  p=c[2:].split(',')
  pp=_p(p[0])
  if pp and len(p)>=2:
   v=int(p[1])
   if len(p)>2 and p[2]=='p':pp.write_analog(max(0,min(1023,v)))
   else:pp.write_digital(1 if v else 0)
   ok()
  else:er()
  return
 if c[:2]=='Q:':
  pp=_p(c[2:])
  if pp:ok(pp.read_analog())
  else:er()
  return
 if c=='TE':ok(temperature());return
 if c=='LT':ok(display.read_light_level());return
 if c=='AC':ok('%d,%d,%d,%d'%_ac());return
 if c=='BT':ok('%d,%d'%(button_a.is_pressed(),button_b.is_pressed()));return
 if c=='GE':ok(accelerometer.current_gesture());return
 if c=='SN':
  if V2:
   try:ok(microphone.sound_level())
   except:ok(-1)
  else:ok(-1)
  return
 if c=='AL':
  t,l=temperature(),display.read_light_level()
  ax,ay,az,m=_ac();ba,bb=button_a.is_pressed(),button_b.is_pressed()
  ok('%d,%d,%d,%d,%d,%d,%d,%d'%(t,l,ax,ay,az,m,ba,bb));return
 if c=='RO':_ro=True;ok();return
 if c=='RF':_ro=False;ok();return
 if c[:3]=='RI:':
  try:_ri=int(c[3:]);ok()
  except:er()
  return
 if c[:3]=='WD:':
  p=c[3:].split(',')
  if p[0]=='1':_wa=p[1]if len(p)>1 else'S';_wt=int(p[2])if len(p)>2 else 5000;_we=True;_wc=utime.ticks_ms();ok()
  elif p[0]=='0':_we=False;ok()
  else:er()
  return
 if c in('HA','SA','AN','CO','SL','SU','ME','YE','NO'):
  m={'HA':'HAPPY','SA':'SAD','AN':'ANGRY','CO':'CONFUSED','SL':'ASLEEP','SU':'SURPRISED','ME':'MEH','YE':'YES','NO':'NO'}
  display.show(getattr(Image,m[c]));ok();return
 er(c)
display.show(Image.HAPPY);utime.sleep_ms(300);display.clear()
_s('RDY:V2=%d'%V2)
while True:
 l=_r()
 if l:
  try:_h(l)
  except Exception as e:er(e)
 if _we and utime.ticks_diff(utime.ticks_ms(),_wc)>_wt:
  _we=False
  for k in _mp:
   if _mp[k]:_mp[k].write_analog(0)
  music.stop();display.clear();_s('WD')
  if _wa=='R':utime.sleep_ms(100);machine.reset()
 if _ro:
  n=utime.ticks_ms()
  if utime.ticks_diff(n,_lr)>=_ri:
   _lr=n;t,l=temperature(),display.read_light_level()
   ax,ay,az,m=_ac()
   _s('S:%d,%d,%d,%d,%d,%d'%(t,l,ax,ay,az,m))
 utime.sleep_ms(5)
