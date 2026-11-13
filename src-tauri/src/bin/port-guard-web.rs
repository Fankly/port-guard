//! JSONL worker owned by tools/web.py. Never opens a public network socket.
use port_guard_desktop::{backend, store::Store};
use serde_json::{Value, json};
use std::io::{self, BufRead, Write};

fn main() -> anyhow::Result<()> {
    let path = std::env::args_os().nth(1).ok_or_else(|| anyhow::anyhow!("database path required"))?;
    let store = Store::open(path.into())?;
    let mut output = io::stdout().lock();
    writeln!(output, "{}", json!({"ready": true}))?;
    output.flush()?;
    for line in io::stdin().lock().lines() {
        let result = serde_json::from_str::<Value>(&line?).map_err(|error| error.to_string())
            .and_then(|request| backend::invoke(&store, request["command"].as_str().unwrap_or(""), request["args"].clone()));
        let response = match result {
            Ok(value) => json!({"ok": true, "data": value}),
            Err(error) => json!({"ok": false, "error": error}),
        };
        writeln!(output, "{response}")?;
        output.flush()?;
    }
    Ok(())
}
