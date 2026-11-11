use anyhow::{Context, Result, ensure};
use clap::{Parser, Subcommand};
use pf_probe::{
    native::KillTarget,
    policy::{Policy, parse_protocol},
};
use std::{fs, io::Write, net::IpAddr, path::PathBuf, process::Command};

#[derive(Parser)]
#[command(
    name = "pf-probe",
    about = "Mac PF 可审查原型：规则预览、语法检查、精确撤权实验、真实 PF 日志"
)]
struct Cli {
    #[command(subcommand)]
    command: Action,
}
#[derive(Subcommand)]
enum Action {
    /// Read-only OS/PF prerequisites; does not enable PF.
    Doctor,
    /// Print an isolated anchor body. Does not install it.
    Render {
        #[arg(long)]
        policy: PathBuf,
        #[arg(long)]
        out: Option<PathBuf>,
    },
    /// Run the installed pfctl parser in -n (no-action) mode.
    Check {
        #[arg(long)]
        policy: PathBuf,
    },
    /// Print exact request bytes; mutation requires both explicit flags.
    Kill {
        #[arg(long)]
        source: IpAddr,
        #[arg(long)]
        local: IpAddr,
        #[arg(long)]
        port: u16,
        #[arg(long,value_parser=["tcp","udp"])]
        protocol: String,
        #[arg(long)]
        interface: String,
        #[arg(long, requires = "experimental_abi")]
        execute: bool,
        /// Exact uname -r output. Acknowledges an ABI experiment, NOT verified support.
        #[arg(long, requires = "execute")]
        experimental_abi: Option<String>,
    },
    /// Decode classic pcap DLT_PFLOG. Ordinary Ethernet captures are rejected.
    Decode {
        #[arg(long)]
        pcap: PathBuf,
    },
    /// Read an existing pflog device and emit metadata only.
    Capture {
        #[arg(long)]
        interface: String,
        #[arg(long)]
        port: u16,
        #[arg(long, default_value_t = 10)]
        seconds: u64,
        #[arg(long, default_value_t = 100)]
        limit: u32,
    },
}
fn policy(path: &PathBuf) -> Result<pf_probe::policy::CompiledPolicy> {
    ensure!(fs::metadata(path)?.len() <= 1024 * 1024, "policy too large");
    serde_json::from_slice::<Policy>(&fs::read(path)?)
        .context("无法读取策略 JSON")?
        .compile()
}
fn command_text(program: &str, args: &[&str]) -> String {
    match Command::new(program).args(args).output() {
        Ok(o) => String::from_utf8_lossy(&o.stdout).trim().to_owned(),
        Err(e) => e.to_string(),
    }
}
fn run() -> Result<()> {
    match Cli::parse().command {
        Action::Doctor => {
            let read = pf_probe::native::device_read_check();
            let root_config = fs::read_to_string("/etc/pf.conf").unwrap_or_default();
            println!(
                "{}",
                serde_json::to_string_pretty(
                    &serde_json::json!({"kind":"read_only_preflight","system":std::env::consts::OS,
                "darwin_release":command_text("/usr/bin/uname",&["-r"]),"effective_uid":unsafe{libc::geteuid()},
                "pf_device_readable":read.is_ok(),"pf_device_error":read.err().map(|e|e.to_string()),
                "source_config_has_example_anchor":root_config.lines().any(|l|l.trim()=="anchor \"pf_probe\""),
                "source_config_is_not_live_ruleset":true,"native_request_bytes":pf_probe::native::REQUEST_LEN,
                "native_abi_runtime_verified":false,"firewall_modified":false,"packets_captured":false,
                "capture_devices":command_text("/usr/sbin/tcpdump",&["-D"])})
                )?
            );
        }
        Action::Render { policy: path, out } => {
            let compiled = policy(&path)?;
            if let Some(path) = out {
                // Prevent accidentally overwriting an existing system/user configuration.
                let mut f = fs::OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(&path)?;
                f.write_all(compiled.render().as_bytes())?;
                println!("{}", serde_json::json!({"created":path,"applied":false}));
            } else {
                print!("{}", compiled.render());
            }
        }
        Action::Check { policy: path } => {
            let mut file = tempfile::NamedTempFile::new()?;
            file.write_all(policy(&path)?.render().as_bytes())?;
            file.flush()?;
            let output = Command::new("/sbin/pfctl")
                .args(["-n", "-a", "pf_probe", "-f"])
                .arg(file.path())
                .output()?;
            let report = serde_json::json!({"kind":"pfctl_syntax_check","success":output.status.success(),"applied":false,
                "stdout":String::from_utf8_lossy(&output.stdout),"stderr":String::from_utf8_lossy(&output.stderr)});
            println!("{}", serde_json::to_string_pretty(&report)?);
            ensure!(output.status.success(), "pfctl syntax check did not pass");
        }
        Action::Kill {
            source,
            local,
            port,
            protocol,
            interface,
            execute,
            experimental_abi,
        } => {
            let target = KillTarget {
                source,
                local,
                port,
                protocol: parse_protocol(&protocol)?,
                interface,
            };
            let inbound = target.request(false)?;
            let reverse = target.request(true)?;
            if execute {
                let release = experimental_abi.context("必须明确指定实验性 ABI 的系统版本")?;
                let count = target.experiment(&release)?;
                println!(
                    "{}",
                    serde_json::json!({"kind":"state_kill_experiment","ioctl_succeeded":true,"kernel_counts_u8_inbound_reverse":count,
                    "count_may_wrap_at_256":true,"traffic_revocation_verified":false})
                );
            } else {
                println!(
                    "{}",
                    serde_json::to_string_pretty(
                        &serde_json::json!({"kind":"exact_state_kill_plan","applied":false,
                    "source":source,"local":local,"port":port,"protocol":protocol,"interface":target.interface,
                    "interface_used_for_local_address_check":true,"state_interface_filter":null,
                    "native_abi_runtime_verified":false,
                    "request_hex_inbound":inbound.iter().map(|b|format!("{b:02x}")).collect::<String>(),
                    "request_hex_reverse":reverse.iter().map(|b|format!("{b:02x}")).collect::<String>()})
                    )?
                );
            }
        }
        Action::Decode { pcap } => {
            ensure!(
                fs::metadata(&pcap)?.len() <= 64 * 1024 * 1024,
                "offline capture exceeds 64 MiB limit"
            );
            let result = pf_probe::pflog::decode_pcap(&fs::read(pcap)?)?;
            for event in &result.events {
                println!("{}", serde_json::to_string(event)?);
            }
            eprintln!(
                "{}",
                serde_json::json!({"kind":"decode_summary","events":result.events.len(),"skipped":result.skipped})
            );
        }
        Action::Capture {
            interface,
            port,
            seconds,
            limit,
        } => pf_probe::capture::capture(&interface, port, seconds, limit)?,
    }
    Ok(())
}
fn main() {
    if let Err(e) = run() {
        eprintln!("error: {e:#}");
        std::process::exit(1)
    }
}
