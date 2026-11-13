//! Shared JSON command transport for the local browser service.
use crate::store::{PreviewState, Store, compiled_policy};
use serde_json::{Value, json};

pub fn invoke(store: &Store, command: &str, args: Value) -> Result<Value, String> {
    let result = (|| -> anyhow::Result<Value> {
        Ok(match command {
            "load_state" => serde_json::to_value(store.load()?)?,
            "save_state" => {
                let state: PreviewState = serde_json::from_value(args["payload"].clone())?;
                store.save(&state)?;
                Value::Null
            }
            "reset_state" => { store.reset()?; Value::Null }
            "read_system_rules" => serde_json::to_value(crate::system_rules::read_system_rules())?,
            "read_access_logs" => serde_json::to_value(crate::access_logs::read_access_logs(store)?)?,
            "preview_policy" => {
                anyhow::ensure!(std::env::consts::OS == "macos", "PF 规则预览仅支持 macOS；Windows WFP 尚未接入");
                let state: PreviewState = serde_json::from_value(args["payload"].clone())?;
                json!(compiled_policy(&state)?.render())
            }
            "app_info" => json!({
                "version": env!("CARGO_PKG_VERSION"),
                "platform": std::env::consts::OS,
                "arch": std::env::consts::ARCH,
                "database": store.path().display().to_string(),
                "runtime": "rust-http",
            }),
            _ => anyhow::bail!("未知命令：{command}"),
        })
    })();
    result.map_err(|error| error.to_string())
}
