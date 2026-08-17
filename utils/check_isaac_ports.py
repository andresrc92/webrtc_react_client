#!/usr/bin/env python3
"""Print all ports used by Isaac Sim and related processes on this machine."""

import re
import subprocess


KNOWN_PORTS = {
    49100: ("TCP", "WebRTC media"),
    8011:  ("TCP", "WebRTC signaling"),
    8226:  ("TCP", "Remote scripting (code editor socket)"),
    8080:  ("TCP", "Omniverse Nucleus / web UI"),
    11553: ("TCP", "ROS2 daemon IPC socket"),
}

ISAAC_PATTERNS = [
    r"oil_plant",
    r"isaacsim",
    r"kit/python",
    r"omni\.kit",
]

ROS2_PATTERNS = [
    r"ros2.daemon",
    r"ros2cli",
]

FASTDDS_PARTICIPANT_RANGE = range(17900, 18000)
KIT_INTERNAL_RANGE = range(7000, 7013)  # Kit uses 7000-7012; 7014+ is ROS2 daemon


def get_processes():
    out = subprocess.check_output(["ps", "aux"], text=True)
    procs = {}
    for line in out.splitlines()[1:]:
        parts = line.split(None, 10)
        if len(parts) < 11:
            continue
        pid = int(parts[1])
        cmd = parts[10]
        label = None
        for pat in ISAAC_PATTERNS:
            if re.search(pat, cmd):
                label = "Isaac Sim"
                break
        if label is None:
            for pat in ROS2_PATTERNS:
                if re.search(pat, cmd):
                    m = re.search(r"--ros-domain-id\s+(\d+)", cmd)
                    domain = f" (domain {m.group(1)})" if m else ""
                    label = f"ROS2 daemon{domain}"
                    break
        if label:
            procs[pid] = {"label": label, "cmd": cmd.strip()}
    return procs


def get_sockets(pids):
    out = subprocess.check_output(["ss", "-tulnp"], text=True)
    sockets = {pid: [] for pid in pids}
    for line in out.splitlines():
        m = re.search(r'pid=(\d+)', line)
        if not m:
            continue
        pid = int(m.group(1))
        if pid not in pids:
            continue
        parts = line.split()
        proto  = parts[0].lower()   # tcp / udp
        state  = parts[1]
        laddr  = parts[4]
        host, _, port_str = laddr.rpartition(":")
        try:
            port = int(port_str)
        except ValueError:
            continue
        sockets[pid].append((proto, state, host, port))
    return sockets


def categorize(proto, state, host, port):
    for known_port, (known_proto, desc) in KNOWN_PORTS.items():
        if port == known_port and proto == known_proto.lower():
            return desc
    if port in FASTDDS_PARTICIPANT_RANGE and proto == "udp":
        return "ROS2 Fast DDS participant (metatraffic)"
    if port in KIT_INTERNAL_RANGE and proto == "udp":
        return "Kit/Carbonite internal pub-sub"
    if proto == "udp":
        return "ROS2 DDS topic traffic (ephemeral)"
    return "unknown"


def main():
    procs = get_processes()
    if not procs:
        print("No Isaac Sim or ROS2 processes found.")
        return

    sockets = get_sockets(set(procs))

    for pid, info in sorted(procs.items()):
        print(f"\n{'='*60}")
        print(f"  {info['label']}  (pid {pid})")
        print(f"{'='*60}")
        entries = sockets.get(pid, [])
        if not entries:
            print("  (no open sockets)")
            continue

        # Group: named ports first, then DDS participant, then ephemeral
        def sort_key(e):
            proto, state, host, port = e
            if port in KNOWN_PORTS:
                return (0, port)
            if port in FASTDDS_PARTICIPANT_RANGE:
                return (1, port)
            if port in KIT_INTERNAL_RANGE:
                return (2, port)
            return (3, port)

        seen = set()
        for entry in sorted(entries, key=sort_key):
            proto, state, host, port = entry
            cat = categorize(proto, state, host, port)
            key = (proto, port, cat)
            # Collapse ephemeral duplicates (same port/proto on multiple ifaces)
            if key in seen and cat in ("ROS2 DDS topic traffic (ephemeral)",):
                continue
            seen.add(key)
            bind = f"{host}:{port}" if host not in ("0.0.0.0", "::") else f"*:{port}"
            state_str = f" [{state}]" if state not in ("UNCONN", "LISTEN") else f" [{state}]"
            print(f"  {proto.upper():<4} {bind:<24} {state_str:<12} {cat}")

    print()


if __name__ == "__main__":
    main()
