use crate::policy::{Protocol, valid_interface};
use anyhow::{Result, ensure};
use std::{ffi::CString, net::IpAddr};

unsafe extern "C" {
    fn fp_prepare(
        family: u8,
        protocol: u8,
        reverse: u8,
        source: *const u8,
        local: *const u8,
        port: u16,
        interface: *const libc::c_char,
        output: *mut u8,
        capacity: usize,
    ) -> i32;
    fn fp_device_read_check() -> i32;
    fn fp_experimental_kill(
        family: u8,
        protocol: u8,
        source: *const u8,
        local: *const u8,
        port: u16,
        interface: *const libc::c_char,
        expected_release: *const libc::c_char,
        kernel_count: *mut u32,
    ) -> i32;
}
pub const REQUEST_LEN: usize = 216;
#[derive(Debug)]
pub struct KillTarget {
    pub source: IpAddr,
    pub local: IpAddr,
    pub port: u16,
    pub protocol: Protocol,
    pub interface: String,
}
fn octets(ip: IpAddr) -> [u8; 16] {
    let mut out = [0; 16];
    match ip {
        IpAddr::V4(v) => out[..4].copy_from_slice(&v.octets()),
        IpAddr::V6(v) => out = v.octets(),
    };
    out
}
fn concrete_unicast(ip: IpAddr) -> bool {
    !ip.is_unspecified()
        && !ip.is_multicast()
        && match ip {
            IpAddr::V4(v) => v.octets() != [255; 4],
            _ => true,
        }
}
impl KillTarget {
    pub fn validate(&self) -> Result<()> {
        ensure!(
            self.source.is_ipv4() == self.local.is_ipv4(),
            "来源和本地 IP 必须属于同一地址族"
        );
        ensure!(
            concrete_unicast(self.source) && concrete_unicast(self.local),
            "状态清理必须指定具体单播 IP"
        );
        ensure!(
            ![self.source, self.local]
                .iter()
                .any(|ip| matches!(ip, IpAddr::V6(v) if v.is_unicast_link_local())),
            "实验性撤权暂不接受 IPv6 link-local 地址；省略状态接口过滤时无法保证 scope 唯一"
        );
        ensure!(
            self.port > 0 && valid_interface(&self.interface),
            "必须指定有效端口和接口"
        );
        Ok(())
    }
    pub fn request(&self, reverse: bool) -> Result<[u8; REQUEST_LEN]> {
        self.validate()?;
        let iface = CString::new(self.interface.clone())?;
        let mut bytes = [0; REQUEST_LEN];
        let code = unsafe {
            fp_prepare(
                if self.source.is_ipv4() { 4 } else { 6 },
                self.protocol.number(),
                u8::from(reverse),
                octets(self.source).as_ptr(),
                octets(self.local).as_ptr(),
                self.port,
                iface.as_ptr(),
                bytes.as_mut_ptr(),
                bytes.len(),
            )
        };
        ensure!(
            code == 0,
            "native encoding: {}",
            std::io::Error::from_raw_os_error(code)
        );
        Ok(bytes)
    }
    pub fn experiment(&self, release: &str) -> Result<[u32; 2]> {
        self.validate()?;
        let iface = CString::new(self.interface.clone())?;
        let expected = CString::new(release)?;
        let mut count = [0; 2];
        let code = unsafe {
            fp_experimental_kill(
                if self.source.is_ipv4() { 4 } else { 6 },
                self.protocol.number(),
                octets(self.source).as_ptr(),
                octets(self.local).as_ptr(),
                self.port,
                iface.as_ptr(),
                expected.as_ptr(),
                count.as_mut_ptr(),
            )
        };
        ensure!(
            code == 0,
            "实验性状态清理未完成: {} (需要管理员权限、匹配的系统版本和本地接口地址)",
            std::io::Error::from_raw_os_error(code)
        );
        Ok(count)
    }
}
pub fn device_read_check() -> Result<()> {
    let code = unsafe { fp_device_read_check() };
    ensure!(code == 0, "{}", std::io::Error::from_raw_os_error(code));
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn target(source: &str, local: &str, port: u16) -> KillTarget {
        KillTarget {
            source: source.parse().unwrap(),
            local: local.parse().unwrap(),
            port,
            protocol: Protocol::Tcp,
            interface: "en0".into(),
        }
    }
    #[test]
    fn exact_ipv4_scope_and_network_byte_order() {
        let b = target("192.0.2.20", "192.0.2.10", 8080)
            .request(false)
            .unwrap();
        assert_eq!(&b[0..4], &[2, 6, 0, 0]);
        assert_eq!(&b[8..12], &[192, 0, 2, 20]);
        assert_eq!(&b[24..28], &[255; 4]);
        assert_eq!(&b[72..76], &[192, 0, 2, 10]);
        assert_eq!(&b[88..92], &[255; 4]);
        assert_eq!(&b[124..128], &[0x1f, 0x90, 0x1f, 0x90]);
        assert_eq!(b[128], 2);
        assert!(b[136..].iter().all(|x| *x == 0));
    }
    #[test]
    fn ipv6_mask_is_exact_128_bits() {
        let b = target("2001:db8::20", "2001:db8::10", 8080)
            .request(false)
            .unwrap();
        assert_eq!(b[0], 30);
        assert_eq!(&b[24..40], &[255; 16]);
        assert_eq!(&b[88..104], &[255; 16]);
    }
    #[test]
    fn malformed_or_broad_requests_fail() {
        for (source, local, port) in [
            ("0.0.0.0", "192.0.2.10", 8080),
            ("192.0.2.20", "::1", 8080),
            ("224.0.0.1", "192.0.2.10", 8080),
            ("192.0.2.20", "192.0.2.10", 0),
        ] {
            assert!(target(source, local, port).request(false).is_err());
        }
    }
    #[test]
    fn different_ports_encode_different_exact_requests() {
        let a = target("192.0.2.20", "192.0.2.10", 8080)
            .request(false)
            .unwrap();
        let b = target("192.0.2.20", "192.0.2.10", 8081)
            .request(false)
            .unwrap();
        let different: Vec<_> = (0..REQUEST_LEN).filter(|i| a[*i] != b[*i]).collect();
        assert_eq!(different, vec![125, 127]);
    }
    #[test]
    fn scoped_ipv6_is_rejected_until_interface_state_scope_is_proven() {
        assert!(target("fe80::20", "fe80::10", 8080).request(false).is_err());
    }
    #[test]
    fn reverse_state_has_local_source_port_and_remote_destination() {
        let b = target("192.0.2.20", "192.0.2.10", 8080)
            .request(true)
            .unwrap();
        assert_eq!(&b[8..12], &[192, 0, 2, 10]);
        assert_eq!(&b[72..76], &[192, 0, 2, 20]);
        assert_eq!(&b[60..64], &[0x1f, 0x90, 0x1f, 0x90]);
        assert_eq!(b[64], 2);
        assert!(b[124..132].iter().all(|x| *x == 0));
        assert!(b[136..].iter().all(|x| *x == 0));
    }
}
