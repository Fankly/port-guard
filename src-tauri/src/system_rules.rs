//! Read-only inventory of the host firewall. Configuration and live rules are
//! deliberately separate: a readable pf.conf does not prove PF is enabled.
use anyhow::{Context, Result, ensure};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashSet,
    io::Read,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

const MAX_OUTPUT: usize = 8 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Inventory {
    pub platform: String,
    pub read_at: u64,
    pub sources: Vec<RuleSource>,
    pub rules: Vec<SystemRule>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuleSource {
    id: String,
    label: String,
    kind: String,
    status: String,
    message: String,
    rule_count: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemRule {
    id: String,
    source_id: String,
    name: String,
    category: String,
    direction: String,
    protocols: String,
    ports: String,
    remote_ports: String,
    source: String,
    destination: String,
    application: String,
    enabled: Option<bool>,
    raw: String,
}

impl Inventory {
    fn new(platform: &str) -> Self {
        Self {
            platform: platform.into(),
            read_at: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            sources: Vec::new(),
            rules: Vec::new(),
        }
    }

    fn collect(
        &mut self,
        id: &str,
        label: &str,
        kind: &str,
        result: Result<(Vec<SystemRule>, String)>,
    ) {
        let (status, message, rules) = match result {
            Ok((rules, message)) => ("ok", message, rules),
            Err(error) => {
                let message = format!("{error:#}");
                let lower = message.to_lowercase();
                let status = if [
                    "permission denied",
                    "access is denied",
                    "access denied",
                    "拒绝访问",
                    "requires elevation",
                    "unauthorizedaccess",
                ]
                .iter()
                .any(|text| lower.contains(text))
                {
                    "permission"
                } else {
                    "error"
                };
                (status, message, Vec::new())
            }
        };
        self.sources.push(RuleSource {
            id: id.into(),
            label: label.into(),
            kind: kind.into(),
            status: status.into(),
            message,
            rule_count: rules.len(),
        });
        self.rules.extend(rules);
    }
}

/// No caller-supplied commands or paths, no elevation, and no firewall writes.
pub fn read_system_rules() -> Inventory {
    let mut inventory = Inventory::new(std::env::consts::OS);
    match std::env::consts::OS {
        "macos" => read_macos(&mut inventory),
        "windows" => read_windows(&mut inventory),
        _ => inventory.sources.push(RuleSource {
            id: "unsupported".into(),
            label: "系统防火墙".into(),
            kind: "live".into(),
            status: "unsupported".into(),
            message: "当前支持 macOS 和 Windows 的系统规则读取。".into(),
            rule_count: 0,
        }),
    }
    inventory
}

fn bounded_read(reader: impl Read) -> std::io::Result<Vec<u8>> {
    let mut data = Vec::new();
    reader
        .take((MAX_OUTPUT + 1) as u64)
        .read_to_end(&mut data)?;
    Ok(data)
}

pub(crate) fn command_text(program: &Path, args: &[&str], timeout: Duration) -> Result<String> {
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .with_context(|| format!("无法运行 {}", program.display()))?;
    let stdout = child.stdout.take().context("缺少标准输出")?;
    let stderr = child.stderr.take().context("缺少错误输出")?;
    let out = thread::spawn(move || bounded_read(stdout));
    let err = thread::spawn(move || bounded_read(stderr));
    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break Ok(status),
            Ok(None) if Instant::now() < deadline => thread::sleep(Duration::from_millis(20)),
            Ok(None) => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(anyhow::anyhow!("读取超时，请刷新重试"));
            }
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                break Err(error.into());
            }
        }
    };
    let stdout = out.join().map_err(|_| anyhow::anyhow!("读取线程失败"))??;
    let stderr = err.join().map_err(|_| anyhow::anyhow!("读取线程失败"))??;
    let status = status?;
    ensure!(
        stdout.len() <= MAX_OUTPUT && stderr.len() <= MAX_OUTPUT,
        "规则输出超过读取上限"
    );
    ensure!(
        status.success(),
        "{}",
        String::from_utf8_lossy(&stderr).trim()
    );
    Ok(String::from_utf8(stdout)?
        .trim_start_matches('\u{feff}')
        .to_owned())
}

fn read_macos(inventory: &mut Inventory) {
    let mut visited = HashSet::new();
    read_pf_config(inventory, Path::new("/etc/pf.conf"), &mut visited, 0);
    let pfctl = Path::new("/sbin/pfctl");
    inventory.collect(
        "pf-status",
        "PF 运行状态",
        "live",
        command_text(pfctl, &["-s", "info"], Duration::from_secs(3)).map(|text| {
            (
                Vec::new(),
                text.lines()
                    .find(|line| line.starts_with("Status:"))
                    .unwrap_or("PF 状态未知")
                    .into(),
            )
        }),
    );
    for (id, label, option) in [
        ("pf-live", "PF 当前过滤规则（含 anchors）", "-sr"),
        ("pf-nat", "PF 当前转发规则（含 anchors）", "-sn"),
    ] {
        inventory.collect(
            id,
            label,
            "live",
            command_text(pfctl, &["-a", "*", option], Duration::from_secs(3)).map(|text| {
                (
                    parse_pf(&text, id, true),
                    "从内核读取；规则是否执行还取决于 PF 运行状态和匹配顺序。".into(),
                )
            }),
        );
    }
    let alf = Path::new("/usr/libexec/ApplicationFirewall/socketfilterfw");
    inventory.collect(
        "alf-status",
        "macOS 应用防火墙状态",
        "live",
        (|| {
            let global = command_text(alf, &["--getglobalstate"], Duration::from_secs(3))?;
            let block_all = command_text(alf, &["--getblockall"], Duration::from_secs(3))?;
            Ok((
                Vec::new(),
                format!("{} · {}", global.trim(), block_all.trim()),
            ))
        })(),
    );
    inventory.collect(
        "alf-apps",
        "macOS 应用防火墙规则",
        "system",
        command_text(alf, &["--listapps"], Duration::from_secs(3)).and_then(|text| {
            Ok((
                parse_alf(&text)?,
                "应用级入站设置；执行状态见应用防火墙状态。".into(),
            ))
        }),
    );
}

fn read_pf_config(
    inventory: &mut Inventory,
    path: &Path,
    visited: &mut HashSet<PathBuf>,
    depth: usize,
) {
    let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_owned());
    if visited.len() >= 64 {
        if !inventory
            .sources
            .iter()
            .any(|source| source.id == "config-limit")
        {
            inventory.collect(
                "config-limit",
                "PF 配置读取范围",
                "config",
                Err(anyhow::anyhow!("配置文件引用超过 64 个，剩余引用未读取")),
            );
        }
        return;
    }
    if !visited.insert(canonical) {
        return;
    }
    let id = format!("config:{}", path.display());
    let result = (|| {
        ensure!(depth <= 8 && visited.len() <= 64, "PF 配置引用超过读取上限");
        ensure!(
            std::fs::metadata(path)?.is_file(),
            "PF 配置路径不是普通文件"
        );
        let data = bounded_read(std::fs::File::open(path)?)?;
        ensure!(data.len() <= MAX_OUTPUT, "PF 配置超过读取上限");
        Ok(String::from_utf8(data)?)
    })();
    match result {
        Ok(text) => {
            inventory.collect(
                &id,
                &path.display().to_string(),
                "config",
                Ok((
                    parse_pf(&text, &id, false),
                    "配置文件；不表示规则已加载或生效。".into(),
                )),
            );
            for statement in statements(&text) {
                let tokens = tokens(&statement);
                if tokens.first().map(String::as_str) == Some("load")
                    && tokens.get(1).map(String::as_str) == Some("anchor")
                {
                    if let Some(index) = tokens.iter().position(|token| token == "from") {
                        if let Some(file) = tokens.get(index + 1) {
                            let next = PathBuf::from(file);
                            let next = if next.is_absolute() {
                                next
                            } else {
                                path.parent().unwrap_or(Path::new("/etc")).join(next)
                            };
                            read_pf_config(inventory, &next, visited, depth + 1);
                        }
                    }
                }
            }
        }
        Err(error) => inventory.collect(&id, &path.display().to_string(), "config", Err(error)),
    }
}

// Quotes protect comments and names. Preserve expressions rather than guessing
// the meaning of macros, named services, tables, negations or port ranges.
fn statements(text: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut pending = String::new();
    for line in text.lines() {
        let mut quoted = false;
        let mut escaped = false;
        let clean: String = line
            .chars()
            .take_while(|ch| {
                if escaped {
                    escaped = false;
                    return true;
                }
                if *ch == '\\' {
                    escaped = true;
                    return true;
                }
                if *ch == '"' {
                    quoted = !quoted;
                }
                *ch != '#' || quoted
            })
            .collect();
        let clean = clean.trim();
        if clean.is_empty() {
            continue;
        }
        let continuation = clean.ends_with('\\');
        pending.push_str(clean.trim_end_matches('\\'));
        if continuation {
            pending.push(' ');
        } else {
            result.push(std::mem::take(&mut pending));
        }
    }
    if !pending.is_empty() {
        result.push(pending);
    }
    result
}

fn tokens(text: &str) -> Vec<String> {
    let mut result = Vec::new();
    let mut token = String::new();
    let mut quoted = false;
    let mut escaped = false;
    for ch in text.chars() {
        if escaped {
            token.push(ch);
            escaped = false;
            continue;
        }
        if ch == '\\' {
            escaped = true;
            continue;
        }
        if ch == '"' {
            quoted = !quoted;
            continue;
        }
        if !quoted && (ch.is_whitespace() || "{},()".contains(ch)) {
            if !token.is_empty() {
                result.push(std::mem::take(&mut token));
            }
            if !ch.is_whitespace() {
                result.push(ch.to_string());
            }
        } else {
            token.push(ch);
        }
    }
    if !token.is_empty() {
        result.push(token);
    }
    result
}

fn pf_field(tokens: &[String], start: usize, stops: &[&str]) -> String {
    tokens
        .iter()
        .skip(start)
        .take_while(|token| !stops.contains(&token.as_str()))
        .cloned()
        .collect::<Vec<_>>()
        .join(" ")
}

fn parse_pf(text: &str, source_id: &str, live: bool) -> Vec<SystemRule> {
    let mut result = Vec::new();
    let mut anchors: Vec<String> = Vec::new();
    for statement in statements(text) {
        let t = tokens(&statement);
        let Some(first) = t.first().map(String::as_str) else {
            continue;
        };
        if first == "}" {
            anchors.pop();
            continue;
        }
        let category = match first {
            "pass" => "allow",
            "block" => "block",
            "nat" | "rdr" | "binat" => "translation",
            "no" if t
                .get(1)
                .is_some_and(|value| ["nat", "rdr", "binat"].contains(&value.as_str())) =>
            {
                "translation"
            }
            value if value.ends_with("anchor") || value == "load" => "anchor",
            _ => "other",
        };
        let traffic = ["allow", "block", "translation"].contains(&category);
        let from = if traffic {
            t.iter().position(|token| token == "from")
        } else {
            None
        };
        let to = if traffic {
            t.iter().position(|token| token == "to")
        } else {
            None
        };
        let mut source = from
            .map(|index| pf_field(&t, index + 1, &["port", "to"]))
            .unwrap_or_default();
        let mut destination = to
            .map(|index| {
                pf_field(
                    &t,
                    index + 1,
                    &[
                        "port",
                        "flags",
                        "keep",
                        "no",
                        "modulate",
                        "synproxy",
                        "label",
                        "tag",
                        "tagged",
                        "queue",
                        "->",
                        "rtable",
                        "probability",
                    ],
                )
            })
            .unwrap_or_default();
        let port = |start: usize, end: usize| {
            t[start..end]
                .iter()
                .position(|token| token == "port")
                .map(|index| {
                    pf_field(
                        &t[..end],
                        start + index + 1,
                        &[
                            "flags",
                            "keep",
                            "no",
                            "modulate",
                            "synproxy",
                            "label",
                            "tag",
                            "tagged",
                            "queue",
                            "->",
                            "rtable",
                            "probability",
                        ],
                    )
                })
                .unwrap_or_default()
        };
        let inbound = t
            .iter()
            .take_while(|token| {
                !["on", "proto", "from", "to", "all", "label"].contains(&token.as_str())
            })
            .any(|token| token == "in");
        let outbound = t
            .iter()
            .take_while(|token| {
                !["on", "proto", "from", "to", "all", "label"].contains(&token.as_str())
            })
            .any(|token| token == "out");
        if traffic && from.is_none() && t.iter().any(|token| token == "all") {
            source = "any".into();
            destination = "any".into();
        }
        let protocols = t
            .iter()
            .position(|token| token == "proto")
            .map(|index| pf_field(&t, index + 1, &["from", "to", "all"]))
            .unwrap_or_default();
        let label = t
            .iter()
            .position(|token| token == "label")
            .and_then(|index| t.get(index + 1));
        result.push(SystemRule {
            id: format!("{source_id}:{}", result.len()),
            source_id: source_id.into(),
            name: label.cloned().unwrap_or_else(|| {
                if category == "anchor" {
                    format!(
                        "{first} · {}",
                        t.get(if first == "load" { 2 } else { 1 })
                            .map(String::as_str)
                            .unwrap_or("")
                    )
                } else if anchors.is_empty() {
                    first.into()
                } else {
                    format!("{} · {first}", anchors.join("/"))
                }
            }),
            category: category.into(),
            direction: if inbound {
                "in"
            } else if outbound {
                "out"
            } else if ["allow", "block", "translation"].contains(&category) {
                "both"
            } else {
                "unknown"
            }
            .into(),
            protocols,
            ports: to.map(|index| port(index + 1, t.len())).unwrap_or_default(),
            remote_ports: from
                .map(|index| port(index + 1, to.unwrap_or(t.len())))
                .unwrap_or_default(),
            source,
            destination,
            application: String::new(),
            enabled: None,
            raw: statement,
        });
        if live && category == "anchor" && t.last().map(String::as_str) == Some("{") {
            anchors.push(t.get(1).cloned().unwrap_or_default());
        }
    }
    result
}

fn parse_alf(text: &str) -> Result<Vec<SystemRule>> {
    let mut result = Vec::new();
    let total = text
        .lines()
        .find_map(|line| {
            line.strip_prefix("Total number of apps = ")
                .and_then(|value| value.trim().parse::<usize>().ok())
        })
        .context("无法识别应用防火墙输出")?;
    let mut application = String::new();
    for line in text.lines() {
        let line = line.trim();
        if let Some((index, path)) = line.split_once(" : ") {
            if index.parse::<usize>().is_ok() {
                application = path.trim().into();
            }
        } else if !application.is_empty() && line.starts_with('(') {
            let lower = line.to_lowercase();
            result.push(SystemRule {
                id: format!("alf-apps:{}", result.len()),
                source_id: "alf-apps".into(),
                name: Path::new(&application)
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .into_owned(),
                category: if lower.contains("block") {
                    "block"
                } else if lower.contains("allow") {
                    "allow"
                } else {
                    "other"
                }
                .into(),
                direction: "in".into(),
                protocols: String::new(),
                ports: String::new(),
                remote_ports: String::new(),
                source: "any".into(),
                destination: "本机应用".into(),
                application: std::mem::take(&mut application),
                enabled: None,
                raw: line.into(),
            });
        }
    }
    ensure!(
        result.len() == total,
        "应用规则输出不完整：预期 {total} 条，解析 {} 条",
        result.len()
    );
    Ok(result)
}

const WINDOWS_SCRIPT: &str = r#"
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$profiles = @(Get-NetFirewallProfile -PolicyStore ActiveStore | ForEach-Object {
    [PSCustomObject]@{ Name=$_.Name; Enabled=($_.Enabled.ToString() -eq 'True'); DefaultInboundAction=$_.DefaultInboundAction.ToString(); DefaultOutboundAction=$_.DefaultOutboundAction.ToString() }
})
$rules = @(Get-NetFirewallRule -PolicyStore ActiveStore | ForEach-Object {
    $r = $_
    $p = @($r | Get-NetFirewallPortFilter)
    $a = @($r | Get-NetFirewallAddressFilter)
    $app = @($r | Get-NetFirewallApplicationFilter)
    $service = @($r | Get-NetFirewallServiceFilter)
    [PSCustomObject]@{
        id = ('windows:' + $r.Name); sourceId = 'windows-live'; name = $r.DisplayName
        category = $(if ($r.Action.ToString() -eq 'Allow') { 'allow' } elseif ($r.Action.ToString() -eq 'Block') { 'block' } else { 'other' })
        direction = $(if ($r.Direction.ToString() -eq 'Inbound') { 'in' } elseif ($r.Direction.ToString() -eq 'Outbound') { 'out' } else { 'unknown' })
        protocols = (($p | ForEach-Object { $_.Protocol }) -join ', ')
        ports = (($p | ForEach-Object { $_.LocalPort }) -join ', ')
        remotePorts = (($p | ForEach-Object { $_.RemotePort }) -join ', ')
        source = (($a | ForEach-Object { $_.RemoteAddress }) -join ', ')
        destination = (($a | ForEach-Object { $_.LocalAddress }) -join ', ')
        application = (($app | ForEach-Object { $_.Program }) -join ', ')
        enabled = ($r.Enabled.ToString() -eq 'True')
        raw = (@{ Name=$r.Name; Description=$r.Description; Profile=$r.Profile.ToString(); InterfaceType=$r.InterfaceType.ToString(); Service=($service.Service -join ', '); PolicyStoreSource=$r.PolicyStoreSource; PolicyStoreSourceType=$r.PolicyStoreSourceType.ToString(); EnforcementStatus=$r.EnforcementStatus.ToString() } | ConvertTo-Json -Compress)
    }
})
@{ profiles=$profiles; rules=$rules } | ConvertTo-Json -Depth 6 -Compress
"#;

fn parse_windows(text: &str) -> Result<(Vec<SystemRule>, String)> {
    let value: serde_json::Value = serde_json::from_str(text)?;
    let rules =
        serde_json::from_value(value.get("rules").context("缺少 Windows 规则列表")?.clone())?;
    let profiles = value
        .get("profiles")
        .and_then(|value| value.as_array())
        .context("缺少 Windows 防火墙配置文件")?;
    let summary = profiles
        .iter()
        .map(|profile| {
            format!(
                "{}：{}（默认入站 {} / 出站 {}）",
                profile["Name"].as_str().unwrap_or("未知"),
                if profile["Enabled"] == true {
                    "已开启"
                } else {
                    "已关闭"
                },
                profile["DefaultInboundAction"],
                profile["DefaultOutboundAction"]
            )
        })
        .collect::<Vec<_>>()
        .join("；");
    Ok((
        rules,
        format!("ActiveStore · {summary}。规则是否执行还取决于活动网络配置文件及其他过滤层。"),
    ))
}

fn read_windows(inventory: &mut Inventory) {
    let root = std::env::var_os("SystemRoot").unwrap_or_else(|| "C:\\Windows".into());
    let program = PathBuf::from(root).join("System32/WindowsPowerShell/v1.0/powershell.exe");
    inventory.collect(
        "windows-live",
        "Windows 系统防火墙",
        "live",
        command_text(
            &program,
            &[
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                WINDOWS_SCRIPT,
            ],
            Duration::from_secs(20),
        )
        .and_then(|text| parse_windows(&text)),
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pf_classification_preserves_scope_and_quoted_names() {
        let rules = parse_pf(
            "pass in proto { tcp, udp } from ! <trusted> port 1024:65535 to (en0) port { 80, 443 } keep state label \"web #1\" # comment\nblock out from any to 192.0.2.1\nrdr on en0 proto tcp from any to any port 8080 -> 127.0.0.1 port 80\nanchor \"com.apple/*\"",
            "config",
            false,
        );
        assert_eq!(rules.len(), 4);
        assert_eq!(rules[0].category, "allow");
        assert_eq!(rules[0].name, "web #1");
        assert_eq!(rules[0].ports, "{ 80 , 443 }");
        assert_eq!(rules[0].remote_ports, "1024:65535");
        assert_eq!(rules[0].source, "! <trusted>");
        assert_eq!(rules[1].direction, "out");
        assert_eq!(rules[2].category, "translation");
        assert_eq!(rules[2].ports, "8080");
        assert_eq!(rules[3].category, "anchor");
        assert!(rules.iter().all(|rule| rule.enabled.is_none()));
    }

    #[test]
    fn recursive_live_anchors_and_continuations() {
        let rules = parse_pf(
            "anchor \"apple\" all {\n anchor \"child\" all {\n pass in proto tcp from any \\\n to any port 22\n }\n}\nblock all",
            "live",
            true,
        );
        assert_eq!(rules.len(), 4);
        assert_eq!(rules[2].name, "apple/child · pass");
        assert_eq!(rules[2].ports, "22");
        assert_eq!(rules[3].source, "any");
        assert_eq!(rules[3].name, "block");
    }

    #[test]
    fn config_references_are_read_once_and_failures_remain_visible() {
        let directory = tempfile::tempdir().unwrap();
        let root = directory.path().join("pf.conf");
        std::fs::write(
            &root,
            "load anchor \"child\" from \"child\"\nload anchor \"missing\" from \"missing\"",
        )
        .unwrap();
        std::fs::write(
            directory.path().join("child"),
            "block in all\nload anchor \"root\" from \"pf.conf\"",
        )
        .unwrap();
        let mut inventory = Inventory::new("macos");
        read_pf_config(&mut inventory, &root, &mut HashSet::new(), 0);
        assert_eq!(inventory.sources.len(), 3);
        assert_eq!(inventory.rules.len(), 4);
        assert_eq!(inventory.sources[2].status, "error");
        assert!(
            inventory.sources[..2]
                .iter()
                .all(|source| source.kind == "config")
        );
    }

    #[test]
    fn application_rules_require_complete_output() {
        let rules = parse_alf("Total number of apps = 2\n0 : /Applications/One.app\n( Allow incoming connections )\n1 : /Applications/Two.app\n( Block incoming connections )").unwrap();
        assert_eq!(rules[0].category, "allow");
        assert_eq!(rules[1].category, "block");
        assert!(parse_alf("Total number of apps = 1").is_err());
        assert!(parse_alf("unexpected output").is_err());
        assert!(parse_alf("Total number of apps = 0").unwrap().is_empty());
    }

    #[test]
    fn windows_empty_disabled_and_scoped_rules() {
        let (_, message) =
            parse_windows(r#"{"profiles":[{"Name":"Public","Enabled":false}],"rules":[]}"#)
                .unwrap();
        assert!(message.contains("已关闭"));
        let (rules, _) = parse_windows(r#"{"profiles":[],"rules":[{"id":"windows:ssh","sourceId":"windows-live","name":"SSH","category":"allow","direction":"in","protocols":"TCP","ports":"22","remotePorts":"Any","source":"192.0.2.0/24","destination":"Any","application":"Any","enabled":false,"raw":"{}"}]}"#).unwrap();
        assert_eq!(rules[0].enabled, Some(false));
        assert_eq!(rules[0].source, "192.0.2.0/24");
        assert!(parse_windows("{}").is_err());
    }

    #[test]
    fn permission_failure_is_not_an_empty_success() {
        let mut inventory = Inventory::new("macos");
        inventory.collect(
            "pf",
            "PF",
            "live",
            Err(anyhow::anyhow!("pfctl: /dev/pf: Permission denied")),
        );
        assert_eq!(inventory.sources[0].status, "permission");
        assert!(inventory.rules.is_empty());
    }

    #[cfg(unix)]
    #[test]
    fn command_reader_times_out_and_reports_errors() {
        assert!(
            command_text(Path::new("/bin/sleep"), &["2"], Duration::from_millis(40))
                .unwrap_err()
                .to_string()
                .contains("超时")
        );
        assert!(
            command_text(
                Path::new("/bin/cat"),
                &["/does-not-exist-port-guard"],
                Duration::from_secs(1)
            )
            .is_err()
        );
    }
}
