use anyhow::{Result, bail, ensure};
use serde::Serialize;
use std::net::{Ipv4Addr, Ipv6Addr};

#[derive(Debug, Serialize)]
pub struct Event {
    pub timestamp_ns: u64,
    pub action: &'static str,
    pub reason: u8,
    pub interface: String,
    pub ruleset: String,
    pub rule: u32,
    pub subrule: u32,
    pub direction: &'static str,
    pub family: u8,
    pub protocol: &'static str,
    pub source_ip: String,
    pub destination_ip: String,
    pub source_port: u16,
    pub destination_port: u16,
}
fn be16(b: &[u8]) -> u16 {
    u16::from_be_bytes([b[0], b[1]])
}
fn be32(b: &[u8]) -> u32 {
    u32::from_be_bytes([b[0], b[1], b[2], b[3]])
}
fn cstr(b: &[u8]) -> String {
    String::from_utf8_lossy(&b[..b.iter().position(|x| *x == 0).unwrap_or(b.len())]).into_owned()
}

/// Decode Darwin DLT_PFLOG. No payload is retained or inferred firewall decision generated.
pub fn decode(packet: &[u8], timestamp_ns: u64) -> Result<Event> {
    ensure!(packet.len() >= 64, "truncated pflog header");
    let header_len = usize::from(packet[0]);
    ensure!(header_len >= 61, "unsupported short pflog header");
    let aligned = (header_len + 3) & !3;
    ensure!(aligned <= packet.len(), "truncated pflog extension");
    let action = match packet[2] {
        0 => "allow",
        1 => "block",
        _ => bail!("unknown PF action"),
    };
    let direction = match packet[60] {
        1 => "in",
        2 => "out",
        _ => bail!("unknown PF direction"),
    };
    let ip = &packet[aligned..];
    let (family, proto, source, destination, offset, bound) = match packet[1] {
        2 => {
            ensure!(
                ip.len() >= 20 && ip[0] >> 4 == 4,
                "truncated or mismatched IPv4 header"
            );
            let ihl = usize::from(ip[0] & 15) * 4;
            let total = usize::from(be16(&ip[2..4]));
            ensure!(
                ihl >= 20 && ihl <= ip.len() && total >= ihl,
                "invalid IPv4 lengths"
            );
            ensure!(
                be16(&ip[6..8]) & 0x1fff == 0,
                "non-initial IPv4 fragment: ports unavailable"
            );
            (
                4,
                ip[9],
                Ipv4Addr::new(ip[12], ip[13], ip[14], ip[15]).to_string(),
                Ipv4Addr::new(ip[16], ip[17], ip[18], ip[19]).to_string(),
                ihl,
                total.min(ip.len()),
            )
        }
        30 => {
            ensure!(
                ip.len() >= 40 && ip[0] >> 4 == 6,
                "truncated or mismatched IPv6 header"
            );
            let total = 40 + usize::from(be16(&ip[4..6]));
            ensure!(total > 40, "IPv6 jumbograms/empty payload are not decoded");
            let bound = total.min(ip.len());
            let source = Ipv6Addr::from(<[u8; 16]>::try_from(&ip[8..24])?).to_string();
            let destination = Ipv6Addr::from(<[u8; 16]>::try_from(&ip[24..40])?).to_string();
            let mut next = ip[6];
            let mut pos = 40;
            let mut extension_count = 0;
            while matches!(next, 0 | 43 | 44 | 51 | 60) {
                extension_count += 1;
                ensure!(extension_count <= 8, "too many IPv6 extension headers");
                ensure!(pos + 2 <= bound, "truncated IPv6 extension");
                let len = match next {
                    44 => {
                        ensure!(pos + 8 <= bound, "truncated fragment header");
                        ensure!(
                            be16(&ip[pos + 2..pos + 4]) & 0xfff8 == 0,
                            "non-initial IPv6 fragment: ports unavailable"
                        );
                        8
                    }
                    51 => (usize::from(ip[pos + 1]) + 2) * 4,
                    _ => (usize::from(ip[pos + 1]) + 1) * 8,
                };
                ensure!(pos + len <= bound, "invalid IPv6 extension length");
                next = ip[pos];
                pos += len;
            }
            (6, next, source, destination, pos, bound)
        }
        _ => bail!("unsupported PF address family"),
    };
    let protocol = match proto {
        6 => "tcp",
        17 => "udp",
        _ => bail!("non TCP/UDP packet: ports unavailable"),
    };
    ensure!(offset + 4 <= bound, "truncated transport ports");
    Ok(Event {
        timestamp_ns,
        action,
        reason: packet[3],
        interface: cstr(&packet[4..20]),
        ruleset: cstr(&packet[20..36]),
        rule: be32(&packet[36..40]),
        subrule: be32(&packet[40..44]),
        direction,
        family,
        protocol,
        source_ip: source,
        destination_ip: destination,
        source_port: be16(&ip[offset..offset + 2]),
        destination_port: be16(&ip[offset + 2..offset + 4]),
    })
}

#[derive(Debug, Serialize)]
pub struct CaptureResult {
    pub events: Vec<Event>,
    pub skipped: Vec<String>,
}
pub fn decode_pcap(bytes: &[u8]) -> Result<CaptureResult> {
    ensure!(bytes.len() >= 24, "truncated pcap file");
    let (little, nano) = match &bytes[..4] {
        [0xd4, 0xc3, 0xb2, 0xa1] => (true, false),
        [0xa1, 0xb2, 0xc3, 0xd4] => (false, false),
        [0x4d, 0x3c, 0xb2, 0xa1] => (true, true),
        [0xa1, 0xb2, 0x3c, 0x4d] => (false, true),
        _ => bail!("unsupported capture format; use classic pcap, not pcapng"),
    };
    let u32at = |b: &[u8]| {
        let a: [u8; 4] = b[..4].try_into().unwrap();
        if little {
            u32::from_le_bytes(a)
        } else {
            u32::from_be_bytes(a)
        }
    };
    let u16at = |b: &[u8]| {
        let a: [u8; 2] = b[..2].try_into().unwrap();
        if little {
            u16::from_le_bytes(a)
        } else {
            u16::from_be_bytes(a)
        }
    };
    ensure!(
        u16at(&bytes[4..6]) == 2 && u16at(&bytes[6..8]) == 4,
        "unsupported pcap version"
    );
    ensure!(
        u32at(&bytes[20..24]) & 0xffff == 117,
        "capture is not DLT_PFLOG; ordinary packet capture cannot prove a firewall verdict"
    );
    let snap = u32at(&bytes[16..20]) as usize;
    let mut pos = 24;
    let mut result = CaptureResult {
        events: vec![],
        skipped: vec![],
    };
    while pos < bytes.len() {
        ensure!(pos + 16 <= bytes.len(), "truncated pcap record");
        let seconds = u64::from(u32at(&bytes[pos..]));
        let fraction = u64::from(u32at(&bytes[pos + 4..]));
        ensure!(
            fraction < if nano { 1_000_000_000 } else { 1_000_000 },
            "invalid pcap timestamp"
        );
        let len = u32at(&bytes[pos + 8..]) as usize;
        let original = u32at(&bytes[pos + 12..]) as usize;
        ensure!(len <= snap && len <= original, "invalid capture lengths");
        pos += 16;
        ensure!(len <= bytes.len() - pos, "truncated pcap packet");
        match decode(
            &bytes[pos..pos + len],
            seconds * 1_000_000_000 + fraction * if nano { 1 } else { 1000 },
        ) {
            Ok(event) => result.events.push(event),
            Err(e) => result.skipped.push(e.to_string()),
        };
        pos += len;
    }
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn packet(v6: bool, block: bool) -> Vec<u8> {
        let mut b = vec![0; 64 + if v6 { 48 } else { 28 }];
        b[0] = 61;
        b[1] = if v6 { 30 } else { 2 };
        b[2] = u8::from(block);
        b[60] = 1;
        b[4..7].copy_from_slice(b"en0");
        b[20..28].copy_from_slice(b"pf_probe");
        b[36..40].copy_from_slice(&7u32.to_be_bytes());
        let ip = &mut b[64..];
        let offset = if v6 {
            ip[0] = 0x60;
            ip[4..6].copy_from_slice(&8u16.to_be_bytes());
            ip[6] = 17;
            ip[8..24].copy_from_slice(&"2001:db8::20".parse::<Ipv6Addr>().unwrap().octets());
            ip[24..40].copy_from_slice(&"2001:db8::10".parse::<Ipv6Addr>().unwrap().octets());
            40
        } else {
            ip[0] = 0x45;
            ip[2..4].copy_from_slice(&28u16.to_be_bytes());
            ip[9] = 17;
            ip[12..16].copy_from_slice(&[192, 0, 2, 20]);
            ip[16..20].copy_from_slice(&[192, 0, 2, 10]);
            20
        };
        ip[offset..offset + 2].copy_from_slice(&40000u16.to_be_bytes());
        ip[offset + 2..offset + 4].copy_from_slice(&8080u16.to_be_bytes());
        b
    }
    #[test]
    fn decodes_actual_action_and_ports() {
        for v6 in [false, true] {
            for block in [false, true] {
                let e = decode(&packet(v6, block), 123).unwrap();
                assert_eq!(e.action, if block { "block" } else { "allow" });
                assert_eq!(e.destination_port, 8080);
                assert_eq!(e.source_port, 40000);
                assert_eq!(e.rule, 7);
            }
        }
    }
    #[test]
    fn every_truncated_prefix_is_safe() {
        for v6 in [false, true] {
            let b = packet(v6, false);
            for n in 0..b.len() {
                let _ = decode(&b[..n], 0);
            }
        }
    }
    #[test]
    fn unknown_actions_and_address_families_are_not_guessed() {
        let mut b = packet(false, false);
        b[2] = 99;
        assert!(decode(&b, 0).is_err());
        b[2] = 0;
        b[1] = 99;
        assert!(decode(&b, 0).is_err());
    }
    #[test]
    fn fragmented_payload_is_not_interpreted_as_ports() {
        let mut b = packet(false, false);
        b[70..72].copy_from_slice(&1u16.to_be_bytes());
        assert!(decode(&b, 0).unwrap_err().to_string().contains("fragment"));
    }
    #[test]
    fn ipv6_extension_chain() {
        let mut b = packet(true, false);
        b[70] = 0;
        b[68..70].copy_from_slice(&16u16.to_be_bytes());
        b.splice(104..104, [17, 0, 0, 0, 0, 0, 0, 0]);
        assert_eq!(decode(&b, 0).unwrap().destination_port, 8080);
    }
    #[test]
    fn real_capture_linktype_required() {
        let mut b = vec![0; 24];
        b[..4].copy_from_slice(&[0xd4, 0xc3, 0xb2, 0xa1]);
        b[4..6].copy_from_slice(&2u16.to_le_bytes());
        b[6..8].copy_from_slice(&4u16.to_le_bytes());
        b[20..24].copy_from_slice(&1u32.to_le_bytes());
        assert!(
            decode_pcap(&b)
                .unwrap_err()
                .to_string()
                .contains("DLT_PFLOG")
        );
    }
    #[test]
    fn classic_pcap_endian_and_clock() {
        for little in [false, true] {
            let p = packet(false, true);
            let mut b = if little {
                vec![0xd4, 0xc3, 0xb2, 0xa1]
            } else {
                vec![0xa1, 0xb2, 0xc3, 0xd4]
            };
            for n in [2u16, 4] {
                b.extend(if little {
                    n.to_le_bytes()
                } else {
                    n.to_be_bytes()
                });
            }
            for n in [0, 0, 256, 117, 10, 500_000, p.len() as u32, p.len() as u32] {
                b.extend(if little {
                    n.to_le_bytes()
                } else {
                    n.to_be_bytes()
                });
            }
            b.extend(p);
            let result = decode_pcap(&b).unwrap();
            assert_eq!(result.events[0].timestamp_ns, 10_500_000_000);
            assert!(result.skipped.is_empty());
        }
    }
}
