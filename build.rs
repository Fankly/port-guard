fn main() {
    println!("cargo:rerun-if-changed=native/pf_native.c");
    cc::Build::new()
        .file("native/pf_native.c")
        .flag_if_supported("-std=c11")
        .warnings(true)
        .extra_warnings(true)
        .compile("pf_native");
}
