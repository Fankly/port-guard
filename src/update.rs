//! Offline policy-transition evidence for explicitly listed lab endpoints.
//! No state enumeration or PF writes occur here.
use crate::{native::KillTarget, policy::CompiledPolicy};
use anyhow::{Result, ensure};
use serde_json::{Value, json};
use std::{collections::BTreeSet, net::IpAddr};

pub fn plan_update(
    before: &CompiledPolicy,
    after: &CompiledPolicy,
    sources: &[IpAddr],
    locals: &[IpAddr],
) -> Result<Value> {
    ensure!(
        before.interface == after.interface,
        "当前撤权预览只支持同一网络接口；接口迁移需要单独验证"
    );
    ensure!(!sources.is_empty() && !locals.is_empty(), "必须列出实验来源和本机 IP");
    let sources: BTreeSet<_> = sources.iter().copied().collect();
    let locals: BTreeSet<_> = locals.iter().copied().collect();
    for ip in sources.iter().chain(&locals) {
        // Reuse the exact-request constraints even when the policy has no services.
        KillTarget {
            source: *ip,
            local: *ip,
            port: 1,
            protocol: crate::policy::Protocol::Tcp,
            interface: after.interface.clone(),
        }
        .validate()?;
    }
    ensure!(
        sources.iter().all(|s| locals.iter().any(|l| s.is_ipv4() == l.is_ipv4()))
            && locals.iter().all(|l| sources.iter().any(|s| s.is_ipv4() == l.is_ipv4())),
        "每个来源和本机 IP 都必须有同地址族的对应地址"
    );
    let keys: BTreeSet<_> = before
        .services
        .iter()
        .chain(&after.services)
        .map(|s| (s.port, s.protocol))
        .collect();
    let mut changes = vec![];
    let mut cleanup = vec![];
    for (port, protocol) in keys {
        let old = before.services.iter().find(|s| (s.port, s.protocol) == (port, protocol));
        let new = after.services.iter().find(|s| (s.port, s.protocol) == (port, protocol));
        for source in &sources {
            let was_allowed = old.map(|s| s.allows(*source));
            let now_allowed = new.map(|s| s.allows(*source));
            let transition = match (was_allowed, now_allowed) {
                (_, None) => "released_unmanaged",
                (None, Some(true)) => "enabled_allowed",
                (None, Some(false)) => "enabled_denied",
                (Some(true), Some(true)) => "still_allowed",
                (Some(false), Some(true)) => "newly_allowed",
                (Some(true), Some(false)) => "revoked",
                (Some(false), Some(false)) => "still_denied",
            };
            changes.push(json!({
                "source": source, "port": port, "protocol": protocol,
                "before_whitelisted": was_allowed, "after_whitelisted": now_allowed,
                "transition": transition,
                "requires_state_cleanup": now_allowed == Some(false),
            }));
            // Also cover pre-existing states on newly managed ports and states
            // left behind by an earlier unsuccessful cleanup. Membership alone
            // cannot establish the contents of the live kernel state table.
            if now_allowed == Some(false) {
                for local in locals.iter().filter(|l| l.is_ipv4() == source.is_ipv4()) {
                    let target = KillTarget {
                        source: *source,
                        local: *local,
                        port,
                        protocol,
                        interface: after.interface.clone(),
                    };
                    let hex = |bytes: &[u8]| bytes.iter().map(|b| format!("{b:02x}")).collect::<String>();
                    cleanup.push(json!({
                        "source": source, "local": local, "port": port, "protocol": protocol,
                        "interface": after.interface,
                        "request_hex_inbound": hex(&target.request(false)?),
                        "request_hex_reverse": hex(&target.request(true)?),
                    }));
                }
            }
        }
    }
    Ok(json!({
        "kind": "policy_update_plan", "applied": false,
        "interface": after.interface, "sources": sources, "locals": locals,
        "scope": "explicit_lab_endpoints_only",
        "live_states_inspected": false, "all_affected_sources_enumerated": false,
        "local_address_ownership_verified": false, "native_abi_runtime_verified": false,
        "traffic_revocation_verified": false, "state_interface_filter": null,
        "changes": changes, "state_cleanup": cleanup,
        "after_anchor_rules": after.render(),
        "required_order": ["apply_and_verify_scoped_rules", "clear_exact_states", "verify_protected_and_control_traffic"],
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::policy::Policy;

    fn policy(services: Value) -> CompiledPolicy {
        serde_json::from_value::<Policy>(json!({
            "interface": "en0", "log_interface": "pflog7", "services": services,
        })).unwrap().compile().unwrap()
    }

    fn plan(before: Value, after: Value) -> Value {
        plan_update(&policy(before), &policy(after),
            &["192.0.2.20".parse().unwrap()], &["192.0.2.10".parse().unwrap()]).unwrap()
    }

    #[test]
    fn covering_cidr_survives_deletion_of_single_ip() {
        let result = plan(
            json!([{"port": 18080, "protocols": ["tcp"], "allow": ["192.0.2.20", "192.0.2.0/24"]}]),
            json!([{"port": 18080, "protocols": ["tcp"], "allow": ["192.0.2.0/24"]}]),
        );
        assert_eq!(result["changes"][0]["transition"], "still_allowed");
        assert_eq!(result["state_cleanup"], json!([]));
    }

    #[test]
    fn revoke_only_managed_protocol_and_leave_released_port_alone() {
        let result = plan(
            json!([
                {"port": 18080, "protocols": ["tcp", "udp"], "allow": ["192.0.2.20"]},
                {"port": 18081, "protocols": ["tcp"], "allow": ["192.0.2.20"]}
            ]),
            json!([{"port": 18080, "protocols": ["tcp"], "allow": []}]),
        );
        assert_eq!(result["changes"][0]["transition"], "revoked");
        assert_eq!(result["changes"][1]["transition"], "released_unmanaged");
        assert_eq!(result["changes"][2]["transition"], "released_unmanaged");
        let cleanup = result["state_cleanup"].as_array().unwrap();
        assert_eq!(cleanup.len(), 1);
        assert_eq!(cleanup[0]["port"], 18080);
        assert_eq!(cleanup[0]["protocol"], "tcp");
        assert_eq!(cleanup[0]["request_hex_reverse"].as_str().unwrap().len(), 432);
    }

    #[test]
    fn enabling_empty_whitelist_includes_preexisting_states() {
        let result = plan(json!([]), json!([{"port": 18080, "protocols": ["tcp", "udp"], "allow": []}]));
        assert_eq!(result["changes"][0]["transition"], "enabled_denied");
        assert_eq!(result["state_cleanup"].as_array().unwrap().len(), 2);
        assert_eq!(result["all_affected_sources_enumerated"], false);
    }

    #[test]
    fn disabled_and_deleted_services_release_management() {
        let before = json!([{"port": 18080, "protocols": ["tcp"], "allow": []}]);
        for after in [json!([]), json!([{"port": 18080, "protocols": ["tcp"], "allow": [], "enabled": false}])] {
            let result = plan(before.clone(), after);
            assert_eq!(result["changes"][0]["transition"], "released_unmanaged");
            assert_eq!(result["state_cleanup"], json!([]));
            assert!(!result["after_anchor_rules"].as_str().unwrap().contains("port ="));
        }
        // Disabled input must still pass backend validation.
        let invalid = serde_json::from_value::<Policy>(json!({"interface": "en0", "log_interface": "pflog7",
            "services": [{"port": 18080, "protocols": ["tcp"], "allow": ["any"], "enabled": false}]})).unwrap();
        assert!(invalid.compile().is_err());
    }

    #[test]
    fn ipv6_and_duplicate_endpoints_stay_exact() {
        let before = policy(json!([]));
        let after = policy(json!([{"port": 18080, "protocols": ["udp"], "allow": ["192.0.2.20"]}]));
        let result = plan_update(&before, &after,
            &["192.0.2.20".parse().unwrap(), "2001:db8::20".parse().unwrap(), "2001:db8::20".parse().unwrap()],
            &["192.0.2.10".parse().unwrap(), "2001:db8::10".parse().unwrap()]).unwrap();
        let cleanup = result["state_cleanup"].as_array().unwrap();
        assert_eq!(cleanup.len(), 1);
        assert_eq!(cleanup[0]["source"], "2001:db8::20");
        assert_eq!(cleanup[0]["local"], "2001:db8::10");
    }

    #[test]
    fn unsupported_scopes_fail_without_a_partial_plan() {
        let before = policy(json!([]));
        let mut after = policy(json!([]));
        for (source, local) in [("::1", "192.0.2.10"), ("0.0.0.0", "192.0.2.10"), ("fe80::20", "fe80::10")] {
            assert!(plan_update(&before, &after, &[source.parse().unwrap()], &[local.parse().unwrap()]).is_err());
        }
        after.interface = "en1".into();
        assert!(plan_update(&before, &after, &["192.0.2.20".parse().unwrap()], &["192.0.2.10".parse().unwrap()]).is_err());
    }
}
