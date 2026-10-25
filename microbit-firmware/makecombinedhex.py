#!/usr/bin/env python3
"""makecombinedhex.py - Combine MicroPython firmware with user script for micro:bit V2.
Usage: python makecombinedhex.py firmware.hex main.py [output.hex]
APPENDFS format: magic(MPFS) + count + directory + filenames + data."""
import sys, struct, os

def parse_hex(path):
    records = []
    base = 0
    with open(path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line[0] != ':': continue
            n = int(line[1:3], 16)
            adr = int(line[3:7], 16)
            typ = int(line[7:9], 16)
            dat = bytes.fromhex(line[9:9+n*2])
            if typ == 0: records.append((base + adr, dat))
            elif typ == 2: base = int.from_bytes(dat, 'big') << 4
            elif typ == 4: base = int.from_bytes(dat, 'big') << 16
            elif typ in (1, 3, 5): records.append(('special', typ, adr, dat))
    return records

def find_fs_start(records):
    uicr = {}
    for rec in records:
        if isinstance(rec, tuple) and len(rec) == 2:
            addr, data = rec
            if isinstance(addr, int) and 0x10001000 <= addr < 0x10002000:
                for i in range(0, len(data), 4):
                    uicr[addr + i] = int.from_bytes(data[i:i+4], 'little')
    return uicr.get(0x10001400, 0x00077000)

def _make_line(addr, typ, data):
    n = len(data)
    parts = [n, (addr >> 8) & 0xFF, addr & 0xFF, typ] + list(data)
    ck = (-sum(parts)) & 0xFF
    return ':' + ''.join(f'{b:02X}' for b in parts) + f'{ck:02X}'

def records_to_hex(records, extra=None):
    lines = []
    last_ela = None
    def emit(addr, typ, data):
        nonlocal last_ela
        ela = (addr >> 16) & 0xFFFF
        if ela != last_ela and typ == 0:
            lines.append(_make_line(0, 4, ela.to_bytes(2, 'big')))
            last_ela = ela
        if typ == 0:
            off = addr & 0xFFFF
            for i in range(0, len(data), 16):
                chunk = data[i:i+16]
                lines.append(_make_line((off + i) & 0xFFFF, 0, chunk))
        else:
            lines.append(_make_line(addr & 0xFFFF, typ, data))
    for rec in records:
        if isinstance(rec, tuple):
            if len(rec) == 2:
                a, d = rec
                if isinstance(a, int): emit(a, 0, d)
            elif len(rec) == 4:
                _, typ, adr, dat = rec
                if typ == 1: lines.append(_make_line(0, 1, b''))
                elif typ in (3, 5): lines.append(_make_line(0, typ, dat))
    if extra:
        for addr, data in extra: emit(addr, 0, data)
    if not lines or not lines[-1].startswith(':00000001'):
        lines.append(':00000001FF')
    return '\n'.join(lines) + '\n'

def make_appendfs(files):
    count = len(files)
    hdr_size = 6
    dir_size = count * 10
    str_off = hdr_size + dir_size
    fn_data = b''
    entries = []
    for fname, content in files:
        nb = fname.encode('utf-8')
        entries.append((str_off + len(fn_data), len(nb), content))
        fn_data += nb
    data_off = str_off + len(fn_data)
    result = b'MPFS' + struct.pack('<H', count)
    data_blk = b''
    for noff, nlen, content in entries:
        doff = data_off + len(data_blk)
        result += struct.pack('<HHHI', noff, doff, nlen, len(content))
        data_blk += content
    return result + fn_data + data_blk

def combine(fw_path, script_path, out_path=None):
    records = parse_hex(fw_path)
    fs = find_fs_start(records)
    print(f'FW: {fw_path}, Script: {script_path}, FS: 0x{fs:08X}')
    with open(script_path, 'r', encoding='utf-8') as f:
        code = f.read()
    afs = make_appendfs([('main.py', code.encode('utf-8'))])
    print(f'APPENDFS: {len(afs)} bytes')
    out = records_to_hex(records, [(fs, afs)])
    if out_path:
        with open(out_path, 'w') as f: f.write(out)
        print(f'Output: {out_path} ({os.path.getsize(out_path)} bytes)')
    return out

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print('Usage: makecombinedhex.py firmware.hex main.py [output.hex]')
        sys.exit(1)
    combine(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else None)
