# Native API and fixture provenance

The C adapter is a small, independently named representation of the Darwin PF ioctl data layout. It does not include a copied XNU header or kernel implementation. Its constants, sizes and offsets were checked against these public Apple sources:

- https://github.com/apple-oss-distributions/xnu/blob/xnu-8792.61.2/bsd/net/pfvar.h
- https://github.com/apple-oss-distributions/xnu/blob/main/bsd/net/pfvar.h
- https://github.com/apple-oss-distributions/xnu/blob/main/bsd/net/pf_ioctl.c
- https://github.com/apple-oss-distributions/xnu/blob/xnu-8792.61.2/bsd/net/if_pflog.h
- https://github.com/apple-oss-distributions/xnu/blob/main/bsd/net/if_pflog.c

Relevant layout: address wrapper 48 bytes; state endpoint 64 bytes; request 216 bytes; source offset 8, local endpoint offset 72, interface offset 136; destination port pair at offsets 124/126, comparison operator at 128. PF_OP_EQ is 2. DIOCKILLSTATES uses ioctl group D, operation 41, with the request size encoded by the local Darwin SDK macro.

These are private implementation details, not a supported stable SDK promise. Compile-time assertions and byte-level tests establish encoding consistency only; they do not establish running-kernel ABI compatibility or correct behavior under NAT and existing state.

The experimental operation issues two exact endpoint requests, because PF state direction can begin with either side of the communication. The reverse request puts the local service port in the source-port slot (offsets 60/62, operator at 64). The state-interface field is empty to include floating states; the separately supplied interface is used to validate that the chosen local address belongs to the machine before any ioctl.

Darwin pfloghdr has a 61-byte declared prefix rounded to 64-byte capture alignment. The tested header includes a 16-byte interface and a 16-byte ruleset, followed by network-order rule numbers. IPv6 uses Darwin AF_INET6 value 30. Raw payload is not emitted by the decoder.

All packet fixtures in tests are synthetic. The Python loopback test generates only this project's own TCP/UDP fixture traffic. Neither is a captured proof of firewall enforcement.
