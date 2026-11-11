use anyhow::{Result, bail, ensure};
use ipnet::IpNet;
use serde::{Deserialize, Serialize};
use std::{collections::BTreeSet, fmt::Write, net::IpAddr};

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    Tcp,
    Udp,
}
impl Protocol {
    pub fn name(self) -> &'static str {
        match self {
            Self::Tcp => "tcp",
            Self::Udp => "udp",
        }
    }
    pub fn number(self) -> u8 {
        match self {
            Self::Tcp => 6,
            Self::Udp => 17,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Policy {
    pub interface: String,
    pub log_interface: String,
    pub services: Vec<Service>,
}
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Service {
    pub port: u16,
    pub protocols: Vec<Protocol>,
    pub allow: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct CompiledService {
    pub port: u16,
    pub protocol: Protocol,
    pub allow: Vec<IpNet>,
}
#[derive(Debug)]
pub struct CompiledPolicy {
    pub interface: String,
    pub log_interface: String,
    pub services: Vec<CompiledService>,
}

pub fn valid_interface(value: &str) -> bool {
    !value.is_empty()
        && value.len() < 16
        && value
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

fn parse_network(s: &str) -> Result<IpNet> {
    ensure!(s.trim() == s && !s.is_empty(), "来源地址包含空白或为空");
    let net = if let Ok(ip) = s.parse::<IpAddr>() {
        IpNet::from(ip)
    } else {
        s.parse::<IpNet>()?
    };
    // Normalize host bits. Rules always use numeric addresses, never DNS or PF text.
    Ok(net.trunc())
}

impl Policy {
    pub fn compile(self) -> Result<CompiledPolicy> {
        ensure!(valid_interface(&self.interface), "非法网络接口名称");
        let suffix = self.log_interface.strip_prefix("pflog").unwrap_or("");
        ensure!(
            !suffix.is_empty() && suffix.bytes().all(|b| b.is_ascii_digit()),
            "日志接口必须为 pflogN"
        );
        ensure!(suffix.parse::<u16>()? < 16, "本原型仅接受 pflog0..pflog15");
        ensure!(!self.services.is_empty(), "至少配置一个服务");
        let mut services = vec![];
        let mut keys = BTreeSet::new();
        for service in self.services {
            ensure!(service.port != 0, "端口不能为 0");
            ensure!(!service.protocols.is_empty(), "必须选择 TCP 或 UDP");
            let allow: BTreeSet<_> = service
                .allow
                .iter()
                .map(|s| parse_network(s))
                .collect::<Result<_>>()?;
            for protocol in service.protocols {
                ensure!(
                    keys.insert((service.port, protocol)),
                    "同一端口/协议重复配置"
                );
                services.push(CompiledService {
                    port: service.port,
                    protocol,
                    allow: allow.iter().copied().collect(),
                });
            }
        }
        services.sort_by_key(|s| (s.port, s.protocol));
        Ok(CompiledPolicy {
            interface: self.interface,
            log_interface: self.log_interface,
            services,
        })
    }
}

impl CompiledService {
    pub fn allows(&self, source: IpAddr) -> bool {
        self.allow.iter().any(|net| net.contains(&source))
    }
}

impl CompiledPolicy {
    /// Generate only an isolated anchor body. This does NOT attach/enable PF.
    /// It deliberately restricts both directions of traffic for the local service port.
    /// A clean, audited root-anchor placement is a prerequisite for applying it.
    pub fn render(&self) -> String {
        let mut out = String::from(
            "# pf-probe experimental anchor body; never use as the root ruleset.\n# Requires separately audited root anchor placement and pflog interface.\n",
        );
        for s in &self.services {
            for v6 in [false, true] {
                let family = if v6 { "inet6" } else { "inet" };
                let name = format!(
                    "fp_{}_{}_{}",
                    s.port,
                    s.protocol.name(),
                    if v6 { 6 } else { 4 }
                );
                let nets: Vec<_> = s
                    .allow
                    .iter()
                    .filter(|n| matches!(n, IpNet::V6(_)) == v6)
                    .map(ToString::to_string)
                    .collect();
                writeln!(out, "table <{name}> persist {{ {} }}", nets.join(", ")).unwrap();
                let tcp = if s.protocol == Protocol::Tcp {
                    " flags any"
                } else {
                    ""
                };
                // Allow then final block: no negated empty-table semantics are required.
                for direction in ["in", "out"] {
                    let endpoints = if direction == "in" {
                        format!("from <{name}> to self port = {}", s.port)
                    } else {
                        format!("from self port = {} to <{name}>", s.port)
                    };
                    writeln!(out, "pass {direction} log (to {}) quick on {} {family} proto {} {endpoints}{tcp} keep state label \"fp_{}_{}_allow\"",
                        self.log_interface, self.interface, s.protocol.name(), s.port, s.protocol.name()).unwrap();
                    let endpoints = if direction == "in" {
                        format!("from any to self port = {}", s.port)
                    } else {
                        format!("from self port = {} to any", s.port)
                    };
                    writeln!(out, "block drop {direction} log (to {}) quick on {} {family} proto {} {endpoints} label \"fp_{}_{}_block\"",
                        self.log_interface, self.interface, s.protocol.name(), s.port, s.protocol.name()).unwrap();
                }
            }
        }
        out
    }

    pub fn render_document(&self) -> serde_json::Value {
        serde_json::json!({"kind":"anchor_plan", "applied":false, "interface":self.interface,
            "log_interface":self.log_interface, "root_anchor_attached":false,
            "needs_live_validation":["root_anchor_order", "existing_states", "reverse_traffic", "logging"],
            "rules":self.render()})
    }
}

pub fn parse_protocol(s: &str) -> Result<Protocol> {
    match s {
        "tcp" => Ok(Protocol::Tcp),
        "udp" => Ok(Protocol::Udp),
        _ => bail!("协议仅支持 tcp/udp"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn compile(allow: &[&str]) -> CompiledPolicy {
        Policy {
            interface: "en0".into(),
            log_interface: "pflog7".into(),
            services: vec![Service {
                port: 8080,
                protocols: vec![Protocol::Tcp, Protocol::Udp],
                allow: allow.iter().map(|x| x.to_string()).collect(),
            }],
        }
        .compile()
        .unwrap()
    }
    #[test]
    fn cidr_union_and_single_ip() {
        let p = compile(&["192.168.1.20", "192.168.2.7/24", "2001:db8::/64"]);
        let s = &p.services[0];
        for ip in ["192.168.1.20", "192.168.2.254", "2001:db8::1"] {
            assert!(s.allows(ip.parse().unwrap()));
        }
        for ip in ["192.168.1.21", "192.168.3.1", "2001:db9::1"] {
            assert!(!s.allows(ip.parse().unwrap()));
        }
        assert!(p.render().contains("192.168.2.0/24"));
    }
    #[test]
    fn ipv4_whitelist_still_emits_ipv6_blocks() {
        let text = compile(&["192.168.1.20"]).render();
        assert!(text.contains("table <fp_8080_tcp_6> persist {  }"));
        assert!(text.contains("inet6 proto tcp from any to self port = 8080"));
        assert!(text.contains("inet6 proto udp from self port = 8080 to any"));
    }
    #[test]
    fn empty_whitelist_blocks_all_families() {
        let p = compile(&[]);
        assert!(!p.services[0].allows("192.168.1.2".parse().unwrap()));
        assert_eq!(
            p.render()
                .lines()
                .filter(|x| x.starts_with("block "))
                .count(),
            8
        );
    }
    #[test]
    fn injection_and_duplicate_policy_rejected() {
        for source in ["any", "1.2.3.4\npass all", "example.com", " 1.2.3.4"] {
            let p = Policy {
                interface: "en0".into(),
                log_interface: "pflog7".into(),
                services: vec![Service {
                    port: 8080,
                    protocols: vec![Protocol::Tcp],
                    allow: vec![source.into()],
                }],
            };
            assert!(p.compile().is_err());
        }
        assert!(!valid_interface("en0\npass all"));
        let s = Service {
            port: 8080,
            protocols: vec![Protocol::Tcp, Protocol::Tcp],
            allow: vec![],
        };
        assert!(
            Policy {
                interface: "en0".into(),
                log_interface: "pflog0".into(),
                services: vec![s]
            }
            .compile()
            .is_err()
        );
    }
    #[test]
    fn removing_single_entry_does_not_revoke_covering_network() {
        assert!(compile(&["192.168.1.0/24"]).services[0].allows("192.168.1.20".parse().unwrap()));
    }
    #[test]
    fn only_configured_ports_and_no_global_pf_directives() {
        let s = compile(&["192.168.1.20"]).render();
        for l in s
            .lines()
            .filter(|l| l.starts_with("pass ") || l.starts_with("block "))
        {
            assert!(l.contains("port = 8080"));
        }
        assert!(!s.contains("port = 8081"));
        assert!(!s.contains("set "));
        assert!(!s.contains("flush"));
    }
}
