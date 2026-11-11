#!/usr/bin/env python3
"""Two-port TCP plus UDP one-way traffic fixture. No firewall changes.

Run the server on the Mac and the observer on a separate authorized LAN host.
Counters are transport evidence, not firewall verdicts. Standard library only.
"""
import argparse
import asyncio
import ipaddress
import json
import time


def emit(record):
    print(json.dumps(record, ensure_ascii=False), flush=True)


def address(value):
    return str(ipaddress.ip_address(value))


def port(value):
    n = int(value)
    if not 1 <= n <= 65535:
        raise argparse.ArgumentTypeError('Port must be 1..65535')
    return n


class Sender(asyncio.DatagramProtocol):
    def __init__(self, duration):
        self.duration = duration
        self.tasks = {}

    def connection_made(self, transport):
        self.transport = transport

    def datagram_received(self, data, peer):
        if data == b'subscribe' and peer not in self.tasks:
            self.tasks[peer] = asyncio.create_task(self.stream(peer))

    async def stream(self, peer):
        # One request starts a one-way stream. No repeated client requests hide
        # failures to revoke established/reverse UDP state.
        try:
            for sequence in range(self.duration * 10):
                self.transport.sendto(json.dumps({'kind': 'udp', 'sequence': sequence}).encode(), peer)
                await asyncio.sleep(0.1)
        finally:
            self.tasks.pop(peer, None)

    def connection_lost(self, error):
        for task in list(self.tasks.values()):
            task.cancel()


async def server(args):
    ensure_distinct = args.protected != args.control
    if not ensure_distinct:
        raise ValueError('Protected and control TCP ports must differ')

    async def stream(reader, writer):
        del reader
        try:
            for sequence in range(args.seconds * 10):
                writer.write((json.dumps({'kind': 'tcp', 'sequence': sequence}) + '\n').encode())
                await writer.drain()
                await asyncio.sleep(0.1)
        except (ConnectionError, asyncio.CancelledError):
            pass
        finally:
            writer.close()
            try:
                await writer.wait_closed()
            except ConnectionError:
                pass

    protected = await asyncio.start_server(stream, args.bind, args.protected)
    try:
        control = await asyncio.start_server(stream, args.bind, args.control)
    except Exception:
        protected.close()
        await protected.wait_closed()
        raise
    try:
        udp, _ = await asyncio.get_running_loop().create_datagram_endpoint(
            lambda: Sender(args.seconds), local_addr=(args.bind, args.udp))
    except Exception:
        protected.close()
        control.close()
        await protected.wait_closed()
        await control.wait_closed()
        raise
    emit({'kind': 'ready', 'bind': args.bind, 'protected_tcp': args.protected,
          'control_tcp': args.control, 'udp': args.udp, 'firewall_modified': False})
    try:
        await asyncio.sleep(args.seconds)
    finally:
        protected.close()
        control.close()
        await protected.wait_closed()
        await control.wait_closed()
        udp.close()


async def observe(args):
    counts = {'protected_tcp': 0, 'control_tcp': 0, 'udp': 0}
    failures = {}

    async def tcp(label, destination):
        writer = None
        try:
            reader, writer = await asyncio.wait_for(asyncio.open_connection(args.host, destination), 5)
            while True:
                line = await reader.readline()
                if not line:
                    failures[label] = 'connection_closed'
                    break
                if json.loads(line).get('kind') == 'tcp':
                    counts[label] += 1
        except (OSError, asyncio.TimeoutError, ValueError) as exc:
            failures[label] = str(exc)
        finally:
            if writer:
                writer.close()
                try:
                    await writer.wait_closed()
                except OSError:
                    pass

    class Receiver(asyncio.DatagramProtocol):
        def connection_made(self, transport):
            transport.sendto(b'subscribe')

        def datagram_received(self, data, peer):
            del peer
            try:
                if json.loads(data).get('kind') == 'udp':
                    counts['udp'] += 1
            except (ValueError, UnicodeDecodeError):
                failures['udp'] = 'invalid_fixture_data'

        def error_received(self, exc):
            failures['udp'] = str(exc)

    tasks = [asyncio.create_task(tcp('protected_tcp', args.protected)),
             asyncio.create_task(tcp('control_tcp', args.control))]
    transport, _ = await asyncio.get_running_loop().create_datagram_endpoint(
        Receiver, remote_addr=(args.host, args.udp))
    previous = counts.copy()
    try:
        for elapsed in range(1, args.seconds + 1):
            await asyncio.sleep(1)
            now = counts.copy()
            emit({'kind': 'traffic_observation', 'elapsed_seconds': elapsed,
                  'timestamp': time.time(), 'received_in_last_second': {k: now[k] - previous[k] for k in now},
                  'received_total': now, 'connection_errors': failures.copy(),
                  'firewall_verdict_inferred': False})
            previous = now
    finally:
        transport.close()
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    for name in ['server', 'observe']:
        p = commands.add_parser(name)
        p.add_argument('--protected', type=port, default=18080)
        p.add_argument('--control', type=port, default=18081)
        p.add_argument('--udp', type=port, default=18080)
        p.add_argument('--seconds', type=int, default=60)
        if name == 'server':
            p.add_argument('--bind', type=address, default='127.0.0.1')
        else:
            p.add_argument('--host', type=address, required=True)
    args = parser.parse_args()
    if not 1 <= args.seconds <= 3600:
        parser.error('seconds must be 1..3600')
    try:
        asyncio.run(server(args) if args.command == 'server' else observe(args))
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
