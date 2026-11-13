fn main() {
    println!("cargo:rerun-if-changed=native/pf_native.c");
    // The wire-layout adapter in native/ is Darwin-only. Other platforms build
    // the portable policy/log core and the Tauri shell without it.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        cc::Build::new()
            .file("native/pf_native.c")
            .flag_if_supported("-std=c11")
            .warnings(true)
            .extra_warnings(true)
            .compile("pf_native");
    }
}
