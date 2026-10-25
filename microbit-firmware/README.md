# Objector micro:bit 实时控制固件

专为实时控制优化的 MicroPython 固件，精简内置资源，覆盖全部硬件 IO。

## 特性

- **<10ms 响应**：5ms 主循环，命令即时执行
- **V1/V2 自动识别**：自动检测 micro:bit 版本，启用对应功能
- **全覆盖**：LED矩阵/按键/加速度计/罗盘/温度/光线/触摸/声音/GPIO/I2C/SPI/NeoPixel/舵机/电机
- **高级控制**：PID控制器、看门狗、数据记录、Radio通信
- **精简设计**：去除无关内置资源，固件体积小

## 快速开始

### 1. 烧录固件

```bash
# 安装 mpremote
pip install mpremote

# 烧录
mpremote cp main.py :
mpremote reset
```

或用 [Thonny IDE](https://thonny.org/) 打开 `main.py` 保存到 micro:bit。

### 2. 电脑端连接

```bash
pip install pyserial
python controller.py COM3
```

## 命令协议

**格式**：一行一命令，回车结束，设备回传 `OK:数据` 或 `ERR:原因`

**波特率**：115200

### 系统命令

| 命令 | 说明 |
|------|------|
| `PING` | 心跳检测 |
| `INFO` | 设备信息 |
| `GC` | 垃圾回收，返回剩余内存 |
| `RESET` | 软重启 |
| `HELP` | 命令列表 |

### LED 矩阵

| 命令 | 说明 |
|------|------|
| `LED:ON` | 显示心形 |
| `LED:OFF` | 清屏 |
| `LED:IMG:<25字符>` | 自定义图案 (0-9亮度) |
| `LED:PX:<x,y,0-9>` | 设置单个像素 |
| `LED:BR:<0-255>` | 全局亮度 |
| `LED:<名称>` | 内置图像 (HEART/HAPPY/ARROW_N...) |

### 文字显示

| 命令 | 说明 |
|------|------|
| `TEXT:<文字>` | 滚动显示 |
| `SHOW:<字符>` | 静态显示 |

### 蜂鸣器/声音

| 命令 | 说明 |
|------|------|
| `BUZZ:<频率[:毫秒]>` | 蜂鸣器 |
| `BUZZ:OFF` | 停止 |
| `NOTE:<音符序列>` | 播放音符 (C4:200,D4:200) |
| `SPK:ON` / `SPK:OFF` | V2 扬声器开关 |

### 舵机

| 命令 | 说明 |
|------|------|
| `SERVO:<引脚,角度>` | 设置角度 0-180 (如 SERVO:P0,90) |
| `SERVO_OFF:<引脚>` | 释放 PWM |

### 电机

| 命令 | 说明 |
|------|------|
| `MCFG:<A1,A2[,B1,B2,ENA,ENB]>` | 配置电机引脚 |
| `MOTOR:<A\|B\|ALL,速度>` | 设置速度 -100~100 |
| `MOTOR:BRAKE` | 全部刹车 |

### NeoPixel RGB

| 命令 | 说明 |
|------|------|
| `NP_INIT:<引脚,数量>` | 初始化 |
| `RGB:<r,g,b>` | 全部亮 |
| `RGB:<序号,r,g,b>` | 单个亮 |
| `RGB:OFF` | 全灭 |
| `RGB:RAINBOW` | 彩虹 |

### GPIO

| 命令 | 说明 |
|------|------|
| `PIN_W:<引脚,值[,digital\|pwm]>` | 写引脚 |
| `PIN_R:<引脚[,digital\|analog]>` | 读引脚 |

### I2C

| 命令 | 说明 |
|------|------|
| `I2C_INIT:<SCL,SDA[,频率]>` | 初始化 |
| `I2C_SCAN` | 扫描设备 |
| `I2C_R:<地址,寄存器[,字节数]>` | 读取 |
| `I2C_W:<地址,寄存器,数据...>` | 写入 |

### SPI

| 命令 | 说明 |
|------|------|
| `SPI_INIT:<SCLK,MOSI,MISO[,频率]>` | 初始化 |
| `SPI_W:<hex>` | 写入 |
| `SPI_R:<字节数>` | 读取 |
| `SPI_XFER:<hex>` | 全双工 |

### 传感器

| 命令 | 返回数据 |
|------|----------|
| `TEMP` | 温度 (°C) |
| `LIGHT` | 光线强度 0-255 |
| `ACC` | x,y,z,幅值,俯仰,横滚 |
| `COMPASS` | 朝向,磁场强度 |
| `BTN` | A按键,B按键 |
| `GESTURE` | 当前手势 |
| `TOUCH` | V2 Logo触摸 |
| `SOUND` | V2 麦克风音量 |
| `ALL` | 全部传感器一次返回 |

### 高级功能

| 命令 | 说明 |
|------|------|
| `REPORT:ON` / `OFF` / `<ms>` | 传感器自动上报 |
| `WD:ON,<STOP\|SAFE\|RESET>[,ms]` | 看门狗 |
| `PID:ON,<目标>,<Kp>,<Ki>,<Kd>[,源][,引脚]` | PID控制 |
| `LOG:ON` / `OFF` / `<ms>` | 数据记录 |
| `RADIO:ON[,ch,group,power]` | Radio通信 |

## 传感器上报格式

`REPORT:ON` 开启后，设备每 N 毫秒自动发送：

```
S:温度,光线,AX,AY,AZ,幅值,朝向,磁场,按键A,按键B,触摸,声音,手势,俯仰,横滚
```

## 引脚映射

可用引脚：P0~P16, P19, P20

| 引脚 | 用途建议 |
|------|----------|
| P0 | 舵机/模拟输入 |
| P1, P2 | 电机A/模拟输入 |
| P3~P4 | 电机B |
| P8 | 电机使能 |
| P13~P16 | SPI (P13=SCLK, P14=MISO, P15=MOSI) |
| P16 | NeoPixel |
| P19~P20 | I2C (P19=SCL, P20=SDA) |

## 文件结构

```
microbit-firmware/
├── main.py          # 固件（烧录到 micro:bit）
├── controller.py    # 电脑端控制脚本
└── README.md        # 本文档
```

## 示例

### 舵机控制

```python
# Python
servo('P0', 90)   # 转到90度
servo('P0', 0)    # 转到0度
servo_off('P0')   # 释放
```

### 双电机小车

```python
# Python
motor_cfg('P1', 'P2', 'P3', 'P4')  # 配置引脚
motor('A', 80)    # 电机A正转80%
motor('B', -50)   # 电机B反转50%
motor_brake()     # 刹车
```

### RGB灯带

```python
# Python
np_init('P16', 8)      # 8颗灯珠
rgb(255, 0, 0)         # 全部红色
rgb_one(3, 0, 255, 0)  # 第3颗绿色
rgb_rainbow()          # 彩虹效果
```

### PID 温度控制

```python
# Python
pid_on(30, 2.0, 0.1, 0.5, 'T', 'P0')  # 目标30°C，输出到P0
pid_target(35)  # 修改目标值
pid_off()       # 关闭
```
