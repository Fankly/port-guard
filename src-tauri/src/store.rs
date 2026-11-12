//! Local persistence for the Tauri shell.
//!
//! The desktop process owns the SQLite file; the WebView only talks to it through
//! the typed Tauri commands in `commands.rs`. Rules are re-validated with the
//! shared `pf-probe` policy core before every write, so the front-end cannot
//! persist a rule that the PF generator would reject.

use anyhow::{Context, Result, bail, ensure};
use pf_probe::policy::{CompiledPolicy, Policy, Protocol, Service};
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::{
    path::{Path, PathBuf},
    sync::Mutex,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Source {
    pub address: String,
    pub label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Rule {
    pub id: String,
    pub name: String,
    pub port: u16,
    pub protocols: Vec<String>,
    pub sources: Vec<Source>,
    pub enabled: bool,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Operation {
    pub id: String,
    pub time: String,
    pub action: String,
    pub detail: String,
    pub port: Option<u16>,
    pub result: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    pub interface: String,
    pub log_interface: String,
    pub retention: String,
    pub launch_at_login: bool,
    pub notify_blocked: bool,
    pub notify_log_gap: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewState {
    pub rules: Vec<Rule>,
    pub operations: Vec<Operation>,
    pub preferences: Preferences,
}

impl Preferences {
    fn defaults() -> Self {
        Self {
            interface: "en0".into(),
            log_interface: "pflog0".into(),
            retention: "7".into(),
            launch_at_login: true,
            notify_blocked: false,
            notify_log_gap: true,
        }
    }
}

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS rules (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    port        INTEGER NOT NULL,
    protocols   TEXT NOT NULL,
    enabled     INTEGER NOT NULL,
    updated_at  TEXT NOT NULL,
    position    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sources (
    rule_id     TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    position    INTEGER NOT NULL,
    address     TEXT NOT NULL,
    label       TEXT NOT NULL,
    PRIMARY KEY (rule_id, position)
);
CREATE TABLE IF NOT EXISTS operations (
    id          TEXT PRIMARY KEY,
    time        TEXT NOT NULL,
    action      TEXT NOT NULL,
    detail      TEXT NOT NULL,
    port        INTEGER,
    result      TEXT NOT NULL,
    position    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS preferences (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL
);
"#;

pub struct Store {
    connection: Mutex<Connection>,
    path: PathBuf,
}

impl Store {
    pub fn open(path: PathBuf) -> Result<Self> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let connection = Connection::open(&path)
            .with_context(|| format!("无法打开 SQLite 数据库 {}", path.display()))?;
        connection.pragma_update(None, "journal_mode", "WAL")?;
        connection.pragma_update(None, "foreign_keys", "ON")?;
        connection.execute_batch(SCHEMA)?;
        Ok(Self {
            connection: Mutex::new(connection),
            path,
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn load(&self) -> Result<Option<PreviewState>> {
        let connection = self.connection.lock().expect("数据库连接锁已损坏");
        let rules = Self::read_rules(&connection)?;
        let operations = Self::read_operations(&connection)?;
        let preferences = Self::read_preferences(&connection)?;
        if rules.is_empty() && operations.is_empty() && preferences.is_none() {
            return Ok(None);
        }
        Ok(Some(PreviewState {
            rules,
            operations,
            preferences: preferences.unwrap_or_else(Preferences::defaults),
        }))
    }

    pub fn save(&self, state: &PreviewState) -> Result<()> {
        validate(state)?;
        let mut connection = self.connection.lock().expect("数据库连接锁已损坏");
        let transaction = connection.transaction()?;
        transaction.execute("DELETE FROM sources", [])?;
        transaction.execute("DELETE FROM rules", [])?;
        transaction.execute("DELETE FROM operations", [])?;
        transaction.execute("DELETE FROM preferences", [])?;

        for (position, rule) in state.rules.iter().enumerate() {
            transaction.execute(
                "INSERT INTO rules (id, name, port, protocols, enabled, updated_at, position)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    rule.id,
                    rule.name,
                    rule.port,
                    serde_json::to_string(&rule.protocols)?,
                    rule.enabled,
                    rule.updated_at,
                    position as i64,
                ],
            )?;
            for (index, source) in rule.sources.iter().enumerate() {
                transaction.execute(
                    "INSERT INTO sources (rule_id, position, address, label)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![rule.id, index as i64, source.address, source.label],
                )?;
            }
        }

        for (position, operation) in state.operations.iter().take(200).enumerate() {
            transaction.execute(
                "INSERT INTO operations (id, time, action, detail, port, result, position)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![
                    operation.id,
                    operation.time,
                    operation.action,
                    operation.detail,
                    operation.port,
                    operation.result,
                    position as i64,
                ],
            )?;
        }

        let preferences = &state.preferences;
        for (key, value) in [
            ("interface", preferences.interface.clone()),
            ("logInterface", preferences.log_interface.clone()),
            ("retention", preferences.retention.clone()),
            ("launchAtLogin", preferences.launch_at_login.to_string()),
            ("notifyBlocked", preferences.notify_blocked.to_string()),
            ("notifyLogGap", preferences.notify_log_gap.to_string()),
        ] {
            transaction.execute(
                "INSERT INTO preferences (key, value) VALUES (?1, ?2)",
                params![key, value],
            )?;
        }

        transaction.commit()?;
        Ok(())
    }

    pub fn reset(&self) -> Result<()> {
        let connection = self.connection.lock().expect("数据库连接锁已损坏");
        connection.execute_batch(
            "DELETE FROM sources; DELETE FROM rules; DELETE FROM operations; DELETE FROM preferences;",
        )?;
        Ok(())
    }

    fn read_rules(connection: &Connection) -> Result<Vec<Rule>> {
        let mut statement = connection.prepare(
            "SELECT id, name, port, protocols, enabled, updated_at
             FROM rules ORDER BY position",
        )?;
        let rows = statement
            .query_map([], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, u16>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, bool>(4)?,
                    row.get::<_, String>(5)?,
                ))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        drop(statement);

        let mut rules = Vec::with_capacity(rows.len());
        for (id, name, port, protocols, enabled, updated_at) in rows {
            let protocols: Vec<String> = serde_json::from_str(&protocols).unwrap_or_default();
            let mut source_statement = connection.prepare(
                "SELECT address, label FROM sources WHERE rule_id = ?1 ORDER BY position",
            )?;
            let sources = source_statement
                .query_map([&id], |row| {
                    Ok(Source {
                        address: row.get(0)?,
                        label: row.get(1)?,
                    })
                })?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            rules.push(Rule {
                id,
                name,
                port,
                protocols,
                sources,
                enabled,
                updated_at,
            });
        }
        Ok(rules)
    }

    fn read_operations(connection: &Connection) -> Result<Vec<Operation>> {
        let mut statement = connection.prepare(
            "SELECT id, time, action, detail, port, result
             FROM operations ORDER BY position LIMIT 200",
        )?;
        let operations = statement
            .query_map([], |row| {
                Ok(Operation {
                    id: row.get(0)?,
                    time: row.get(1)?,
                    action: row.get(2)?,
                    detail: row.get(3)?,
                    port: row.get(4)?,
                    result: row.get(5)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(operations)
    }

    fn read_preferences(connection: &Connection) -> Result<Option<Preferences>> {
        let mut statement = connection.prepare("SELECT key, value FROM preferences")?;
        let pairs = statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        if pairs.is_empty() {
            return Ok(None);
        }
        let mut preferences = Preferences::defaults();
        for (key, value) in pairs {
            match key.as_str() {
                "interface" => preferences.interface = value,
                "logInterface" => preferences.log_interface = value,
                "retention" => preferences.retention = value,
                "launchAtLogin" => preferences.launch_at_login = value == "true",
                "notifyBlocked" => preferences.notify_blocked = value == "true",
                "notifyLogGap" => preferences.notify_log_gap = value == "true",
                _ => {}
            }
        }
        Ok(Some(preferences))
    }
}

/// Validate a UI state with the same core used by the `pf-probe` CLI.
pub fn compiled_policy(state: &PreviewState) -> Result<CompiledPolicy> {
    ensure!(
        ["7", "14", "30"].contains(&state.preferences.retention.as_str()),
        "日志保留天数必须为 7、14 或 30"
    );
    let mut ids = std::collections::BTreeSet::new();
    let mut total_sources = 0usize;
    let services = state
        .rules
        .iter()
        .map(|rule| {
            ensure!(!rule.id.trim().is_empty(), "规则 id 不能为空");
            ensure!(ids.insert(rule.id.as_str()), "规则 id 重复：{}", rule.id);
            ensure!(!rule.name.trim().is_empty(), "规则名称不能为空");
            ensure!(!rule.updated_at.trim().is_empty(), "规则更新时间不能为空");
            ensure!(
                !rule.sources.is_empty(),
                "规则「{}」至少需要一个白名单来源",
                rule.name
            );
            total_sources += rule.sources.len();
            let protocols = rule
                .protocols
                .iter()
                .map(|value| match value.as_str() {
                    "tcp" => Ok(Protocol::Tcp),
                    "udp" => Ok(Protocol::Udp),
                    other => bail!("规则「{}」包含未知协议：{}", rule.name, other),
                })
                .collect::<Result<Vec<_>>>()?;
            ensure!(
                !protocols.is_empty(),
                "规则「{}」必须选择 TCP 或 UDP",
                rule.name
            );
            Ok(Service {
                port: rule.port,
                protocols,
                allow: rule
                    .sources
                    .iter()
                    .map(|source| source.address.clone())
                    .collect(),
                enabled: rule.enabled,
            })
        })
        .collect::<Result<Vec<_>>>()?;
    ensure!(total_sources <= 2000, "白名单来源总数超过原型上限 2000");

    Policy {
        interface: state.preferences.interface.clone(),
        log_interface: state.preferences.log_interface.clone(),
        services,
    }
    .compile()
}

fn validate(state: &PreviewState) -> Result<()> {
    compiled_policy(state)?;
    ensure!(state.operations.len() <= 200, "操作日志超过原型上限 200 条");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    fn sample() -> PreviewState {
        PreviewState {
            rules: vec![Rule {
                id: "web".into(),
                name: "实验 Web 服务".into(),
                port: 18080,
                protocols: vec!["tcp".into()],
                sources: vec![Source {
                    address: "192.0.2.0/24".into(),
                    label: "文档网段".into(),
                }],
                enabled: true,
                updated_at: "2026-11-12 11:00".into(),
            }],
            operations: vec![Operation {
                id: "op-1".into(),
                time: "2026-11-12 11:00".into(),
                action: "创建端口规则".into(),
                detail: "实验 Web 服务".into(),
                port: Some(18080),
                result: "成功".into(),
            }],
            preferences: Preferences::defaults(),
        }
    }

    #[test]
    fn renders_isolated_anchor() {
        let compiled = compiled_policy(&sample()).unwrap();
        let text = compiled.render();
        assert!(text.contains("fp_18080_tcp_allow"));
        assert!(text.contains("block drop in"));
        assert!(text.contains("table <fp_18080_tcp_4> persist"));
    }

    #[test]
    fn rejects_unknown_protocol_and_bad_address() {
        let mut state = sample();
        state.rules[0].protocols = vec!["icmp".into()];
        assert!(compiled_policy(&state).is_err());

        let mut state = sample();
        state.rules[0].sources[0].address = "not-an-ip".into();
        assert!(compiled_policy(&state).is_err());
    }

    #[test]
    fn persists_and_loads_state() {
        let directory = tempdir().unwrap();
        let store = Store::open(directory.path().join("port-guard.sqlite3")).unwrap();
        assert!(store.load().unwrap().is_none());

        store.save(&sample()).unwrap();
        let loaded = store.load().unwrap().unwrap();
        assert_eq!(loaded.rules.len(), 1);
        assert_eq!(loaded.rules[0].port, 18080);
        assert_eq!(loaded.rules[0].sources[0].address, "192.0.2.0/24");
        assert_eq!(loaded.operations.len(), 1);
        assert_eq!(loaded.preferences.log_interface, "pflog0");

        store.reset().unwrap();
        assert!(store.load().unwrap().is_none());
    }
}
