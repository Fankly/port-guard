//! Bounded reads from an existing PFLOG interface; no interfaces or PF rules
//! are created. Only decoded packet metadata is persisted.
use crate::{
    store::{AccessRecord, Store},
    system_rules::command_text,
};
use anyhow::Result;
use serde::Serialize;
use std::{
    path::Path,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LogSnapshot {
    pub status: String,
    pub message: String,
    pub interface: Option<String>,
    pub interfaces: Vec<String>,
    pub checked_at: u64,
    pub events: Vec<AccessRecord>,
    pub undecodable: u32,
    pub kernel_dropped: Option<u32>,
}

fn valid_pflog(value: &str) -> bool {
    value.strip_prefix("pflog").is_some_and(|suffix| {
        !suffix.is_empty() && suffix.bytes().all(|byte| byte.is_ascii_digit())
    })
}

fn choose_interface(interfaces: &[String], preferred: &str) -> Option<String> {
    interfaces
        .iter()
        .find(|interface| interface.as_str() == preferred)
        .or_else(|| interfaces.first())
        .cloned()
}

pub fn read_access_logs(store: &Store) -> Result<LogSnapshot> {
    let now_ms = SystemTime::now().duration_since(UNIX_EPOCH)?.as_millis() as u64;
    let state = store.load()?;
    let preferred = state
        .as_ref()
        .map(|state| state.preferences.log_interface.as_str())
        .unwrap_or("pflog0");
    let retention = state
        .as_ref()
        .and_then(|state| state.preferences.retention.parse::<u64>().ok())
        .unwrap_or(7);
    let mut snapshot = LogSnapshot {
        status: "unsupported".into(),
        message: "当前日志读取支持 macOS PFLOG；Windows 事件采集尚未接入。".into(),
        interface: None,
        interfaces: Vec::new(),
        checked_at: now_ms,
        events: Vec::new(),
        undecodable: 0,
        kernel_dropped: None,
    };
    let mut records = Vec::new();
    if std::env::consts::OS == "macos" {
        match command_text(Path::new("/sbin/ifconfig"), &["-l"], Duration::from_secs(3)) {
            Ok(text) => {
                snapshot.interfaces = text
                    .split_whitespace()
                    .filter(|value| valid_pflog(value))
                    .map(str::to_owned)
                    .collect();
                snapshot.interfaces.sort();
                snapshot.interface = choose_interface(&snapshot.interfaces, preferred);
                if let Some(interface) = &snapshot.interface {
                    match pf_probe::capture::collect(interface, None, 1, 2000) {
                        Ok(batch) => {
                            snapshot.status = "connected".into();
                            snapshot.message = "已读取真实 PFLOG。每次采集 1 秒，保留 TCP/UDP 元数据；轮询间隔、未记录 log 的规则及未采集时段不在统计范围内。".into();
                            snapshot.undecodable = batch.undecodable;
                            snapshot.kernel_dropped = batch.kernel_dropped;
                            records = batch
                                .events
                                .iter()
                                .enumerate()
                                .map(|(index, event)| AccessRecord {
                                    id: format!(
                                        "{}:{index}:{}:{}",
                                        event.timestamp_ns, event.ruleset, event.rule
                                    ),
                                    timestamp_ms: event.timestamp_ns / 1_000_000,
                                    source: if event.direction == "in" {
                                        &event.source_ip
                                    } else {
                                        &event.destination_ip
                                    }
                                    .clone(),
                                    local: if event.direction == "in" {
                                        &event.destination_ip
                                    } else {
                                        &event.source_ip
                                    }
                                    .clone(),
                                    port: if event.direction == "in" {
                                        event.destination_port
                                    } else {
                                        event.source_port
                                    },
                                    source_port: event.source_port,
                                    destination_port: event.destination_port,
                                    protocol: event.protocol.into(),
                                    result: event.action.into(),
                                    direction: event.direction.into(),
                                    rule_label: format!(
                                        "{} #{} / {}",
                                        event.ruleset, event.rule, event.subrule
                                    ),
                                })
                                .collect();
                        }
                        Err(error) => {
                            let message = error.to_string();
                            snapshot.status = if message.to_lowercase().contains("permission")
                                || message.to_lowercase().contains("not permitted")
                            {
                                "permission"
                            } else {
                                "error"
                            }
                            .into();
                            snapshot.message = message;
                        }
                    }
                } else {
                    snapshot.status = "missing_interface".into();
                    snapshot.message = "未发现 pflog 接口。需要管理员创建 PFLOG 接口，并确认目标 PF 规则配置了 log；现有规则中没有 log 的流量不会产生 PF 日志。当前尚未开始采集。".into();
                }
            }
            Err(error) => {
                snapshot.status = "error".into();
                snapshot.message = error.to_string();
            }
        }
    }
    snapshot.events = store.access_records(&records, retention, now_ms)?;
    Ok(snapshot)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn automatic_interface_selection_never_falls_back_to_a_network_card() {
        assert!(valid_pflog("pflog0"));
        assert!(!valid_pflog("en0"));
        assert!(!valid_pflog("pflog"));
        assert!(!valid_pflog("pflog0;"));
        let interfaces = vec!["pflog0".into(), "pflog7".into()];
        assert_eq!(
            choose_interface(&interfaces, "pflog7").as_deref(),
            Some("pflog7")
        );
        assert_eq!(
            choose_interface(&interfaces, "pflog9").as_deref(),
            Some("pflog0")
        );
        assert_eq!(choose_interface(&[], "pflog0"), None);
    }
    #[test]
    fn metadata_is_deduplicated_and_expires_by_retention() {
        let directory = tempfile::tempdir().unwrap();
        let store = Store::open(directory.path().join("logs.sqlite3")).unwrap();
        let event = AccessRecord {
            id: "real-event".into(),
            timestamp_ms: 1,
            source: "192.0.2.1".into(),
            local: "192.0.2.2".into(),
            port: 22,
            source_port: 50000,
            destination_port: 22,
            protocol: "tcp".into(),
            result: "block".into(),
            direction: "in".into(),
            rule_label: "test #1".into(),
        };
        assert_eq!(
            store
                .access_records(&[event.clone(), event], 7, 1)
                .unwrap()
                .len(),
            1
        );
        assert_eq!(store.access_records(&[], 7, 86400000).unwrap().len(), 1);
        assert!(
            store
                .access_records(&[], 7, 8 * 86400000)
                .unwrap()
                .is_empty()
        );
        assert!(store.access_records(&[], 0, 1).is_err());
    }
}
