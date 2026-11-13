use anyhow::Result;

#[derive(Debug, serde::Serialize)]
pub struct CaptureBatch {
    pub events: Vec<crate::pflog::Event>,
    pub undecodable: u32,
    pub statistics_available: bool,
    pub kernel_dropped: Option<u32>,
}

pub fn capture(interface: &str, port: u16, seconds: u64, limit: u32) -> Result<()> {
    anyhow::ensure!(port != 0, "端口不合法");
    let batch = collect(interface, Some(port), seconds, limit)?;
    for event in &batch.events {
        println!("{}", serde_json::to_string(event)?);
    }
    eprintln!(
        "{}",
        serde_json::json!({"kind":"capture_summary","events":batch.events.len(),"undecodable":batch.undecodable,"statistics_available":batch.statistics_available,"kernel_dropped":batch.kernel_dropped,"payload_saved":false})
    );
    Ok(())
}

#[cfg(target_os = "macos")]
pub fn collect(
    interface: &str,
    port: Option<u16>,
    seconds: u64,
    limit: u32,
) -> Result<CaptureBatch> {
    use anyhow::{bail, ensure};
    use std::{
        ffi::{CStr, CString},
        ptr,
        time::{Duration, Instant},
    };
    // We only read the stable prefix of the libpcap-owned header. Apple's SDK
    // appends a comment array; no caller-allocated header is passed to libpcap.
    #[repr(C)]
    struct Header {
        ts: libc::timeval,
        caplen: u32,
        len: u32,
    }
    #[repr(C)]
    struct Stats {
        recv: u32,
        drop: u32,
        ifdrop: u32,
    }
    #[link(name = "pcap")]
    unsafe extern "C" {
        fn pcap_open_live(
            dev: *const libc::c_char,
            snap: i32,
            promisc: i32,
            timeout: i32,
            err: *mut libc::c_char,
        ) -> *mut libc::c_void;
        fn pcap_datalink(p: *mut libc::c_void) -> i32;
        fn pcap_setnonblock(p: *mut libc::c_void, value: i32, err: *mut libc::c_char) -> i32;
        fn pcap_next_ex(p: *mut libc::c_void, h: *mut *const Header, data: *mut *const u8) -> i32;
        fn pcap_geterr(p: *mut libc::c_void) -> *const libc::c_char;
        fn pcap_stats(p: *mut libc::c_void, s: *mut Stats) -> i32;
        fn pcap_close(p: *mut libc::c_void);
    }
    struct Handle(*mut libc::c_void);
    impl Drop for Handle {
        fn drop(&mut self) {
            unsafe { pcap_close(self.0) }
        }
    }
    ensure!(
        port != Some(0) && seconds > 0 && seconds <= 300 && limit > 0 && limit <= 10000,
        "端口、秒数或事件上限不合法"
    );
    let suffix = interface.strip_prefix("pflog").unwrap_or("");
    ensure!(
        !suffix.is_empty() && suffix.bytes().all(|c| c.is_ascii_digit()),
        "只能读取 pflogN；网卡抓包不能证明防火墙结果"
    );
    let dev = CString::new(interface)?;
    let mut err = [0 as libc::c_char; 256];
    let raw = unsafe { pcap_open_live(dev.as_ptr(), 512, 0, 100, err.as_mut_ptr()) };
    ensure!(
        !raw.is_null(),
        "打开 PF 日志接口失败: {}",
        unsafe { CStr::from_ptr(err.as_ptr()) }.to_string_lossy()
    );
    let handle = Handle(raw);
    ensure!(
        unsafe { pcap_datalink(handle.0) } == 117,
        "接口并非 DLT_PFLOG"
    );
    ensure!(
        unsafe { pcap_setnonblock(handle.0, 1, err.as_mut_ptr()) } == 0,
        "设置非阻塞采集失败"
    );
    let start = Instant::now();
    let mut events = Vec::new();
    let mut skipped = 0;
    while start.elapsed() < Duration::from_secs(seconds) && events.len() < limit as usize {
        let mut h = ptr::null();
        let mut data = ptr::null();
        match unsafe { pcap_next_ex(handle.0, &mut h, &mut data) } {
            0 => std::thread::sleep(Duration::from_millis(20)),
            1 => {
                ensure!(
                    !h.is_null() && !data.is_null(),
                    "libpcap returned null packet"
                );
                let header = unsafe { &*h };
                ensure!(
                    header.caplen <= 512,
                    "capture exceeds configured snapshot size"
                );
                let packet = unsafe { std::slice::from_raw_parts(data, header.caplen as usize) };
                let timestamp = (u64::try_from(header.ts.tv_sec)?) * 1_000_000_000
                    + (u64::try_from(header.ts.tv_usec)?) * 1000;
                match crate::pflog::decode(packet, timestamp) {
                    Ok(event)
                        if port.is_none_or(|port| {
                            event.source_port == port || event.destination_port == port
                        }) =>
                    {
                        events.push(event);
                    }
                    Ok(_) => {}
                    Err(_) => skipped += 1,
                }
            }
            -2 => break,
            _ => bail!(
                "pcap read: {}",
                unsafe { CStr::from_ptr(pcap_geterr(handle.0)) }.to_string_lossy()
            ),
        }
    }
    let mut stats = Stats {
        recv: 0,
        drop: 0,
        ifdrop: 0,
    };
    let stats_ok = unsafe { pcap_stats(handle.0, &mut stats) } == 0;
    Ok(CaptureBatch {
        events,
        undecodable: skipped,
        statistics_available: stats_ok,
        kernel_dropped: stats_ok.then_some(stats.drop),
    })
}

#[cfg(not(target_os = "macos"))]
pub fn collect(_: &str, _: Option<u16>, _: u64, _: u32) -> Result<CaptureBatch> {
    anyhow::bail!("当前采集原型只支持 macOS")
}
