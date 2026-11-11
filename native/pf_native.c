/* Experimental Darwin PF wire-layout adapter, written for this prototype.
 * Field layout checked against Apple XNU xnu-8792.61.2 and main pfvar.h.
 * This is NOT a public-SDK ABI or a claim of runtime compatibility.
 * Sources and restrictions are documented in SOURCES.md. */
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <errno.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/utsname.h>
#include <sys/ioctl.h>
#include <sys/socket.h>
#include <arpa/inet.h>
#include <net/if.h>
#include <ifaddrs.h>

typedef struct { uint8_t address_mask[32]; uint64_t reserved_pointer; uint8_t type, flags; } address_wire;
typedef union { struct { uint16_t ports[2]; uint8_t op; } range; uint32_t spi; } transport_wire;
typedef struct { address_wire address; uint8_t reserved[3], neg; transport_wire transport; } endpoint_wire;
typedef struct { uint8_t af, protocol, variant, pad; endpoint_wire source, local; char interface[16], owner[64]; } kill_wire;
_Static_assert(sizeof(address_wire) == 48, "address ABI");
_Static_assert(sizeof(endpoint_wire) == 64, "endpoint ABI");
_Static_assert(sizeof(kill_wire) == 216, "request ABI");
_Static_assert(offsetof(kill_wire, source) == 8, "source offset");
_Static_assert(offsetof(kill_wire, local) == 72, "destination offset");
_Static_assert(offsetof(endpoint_wire, transport) == 52, "port offset");
_Static_assert(offsetof(kill_wire, interface) == 136, "interface offset");

static int valid_interface(const char *s) {
    if (!s || !*s || strlen(s) >= 16) return 0;
    for (const char *p=s; *p; p++) {
        if (!((*p>='a'&&*p<='z')||(*p>='A'&&*p<='Z')||(*p>='0'&&*p<='9')||*p=='_')) return 0;
    }
    return 1;
}

int fp_prepare(uint8_t family, uint8_t protocol, uint8_t reverse, const uint8_t *source,
               const uint8_t *local, uint16_t port, const char *interface,
               uint8_t *output, size_t capacity) {
    if (!source || !local || !output || capacity != sizeof(kill_wire) || !valid_interface(interface)) return EINVAL;
    if ((family != 4 && family != 6) || (protocol != 6 && protocol != 17) || port == 0 || reverse > 1) return EINVAL;
    kill_wire request; memset(&request, 0, sizeof(request));
    request.af = family == 4 ? 2 : 30; /* Darwin AF_INET / AF_INET6 */
    request.protocol = protocol;
    size_t width = family == 4 ? 4 : 16;
    memcpy(request.source.address.address_mask, reverse ? local : source, width);
    memcpy(request.local.address.address_mask, reverse ? source : local, width);
    memset(request.source.address.address_mask + 16, 0xff, width);
    memset(request.local.address.address_mask + 16, 0xff, width);
    transport_wire *local_transport = reverse ? &request.source.transport : &request.local.transport;
    local_transport->range.ports[0] = htons(port);
    local_transport->range.ports[1] = htons(port);
    local_transport->range.op = 2; /* PF_OP_EQ */
    /* Keep state-interface filter empty: old floating states may be attached to
     * 'all', not en0. The exact local address/port still scopes both requests.
     * interface is used separately to validate the local destination address. */
    memcpy(output, &request, sizeof(request));
    return 0;
}

int fp_device_read_check(void) {
#ifdef __APPLE__
    int fd=open("/dev/pf",O_RDONLY|O_CLOEXEC);
    if (fd<0) return errno;
    close(fd); return 0;
#else
    return ENOTSUP;
#endif
}

/* Explicit experiment only. Does not enable PF, add rules, or flush states.
 * Caller must first apply and verify an appropriately scoped blocking policy.
 * A request always targets one exact source and local endpoint, never a network.
 * Runtime release acknowledgement prevents accidentally using a saved experiment
 * command after an OS update. It does NOT certify the ABI. */
int fp_experimental_kill(uint8_t family, uint8_t protocol, const uint8_t *source,
                         const uint8_t *local, uint16_t port, const char *interface,
                         const char *expected_release, unsigned *kernel_counts) {
#ifdef __APPLE__
    if (geteuid()!=0) return EPERM;
    struct utsname sys;
    if (!expected_release || uname(&sys)!=0 || strcmp(sys.release,expected_release)!=0) return ENOTSUP;
    kill_wire requests[2];
    for (uint8_t reverse=0;reverse<2;reverse++) {
        int result=fp_prepare(family,protocol,reverse,source,local,port,interface,(uint8_t *)&requests[reverse],sizeof(kill_wire));
        if (result) return result;
    }
    /* Require the destination to belong to the explicitly named local interface. */
    struct ifaddrs *list=NULL;
    if (getifaddrs(&list)!=0) return errno;
    int found=0;
    for (struct ifaddrs *a=list;a;a=a->ifa_next) {
        if (!a->ifa_addr || strcmp(a->ifa_name,interface)!=0) continue;
        if (family==4 && a->ifa_addr->sa_family==AF_INET &&
            memcmp(&((struct sockaddr_in *)a->ifa_addr)->sin_addr,local,4)==0) found=1;
        if (family==6 && a->ifa_addr->sa_family==AF_INET6 &&
            memcmp(&((struct sockaddr_in6 *)a->ifa_addr)->sin6_addr,local,16)==0) found=1;
    }
    freeifaddrs(list);
    if (!found) return EADDRNOTAVAIL;
    int fd=open("/dev/pf",O_RDWR|O_CLOEXEC);
    if (fd<0) return errno;
    int saved=0;
    for (unsigned i=0;i<2;i++) {
        if (ioctl(fd,_IOWR('D',41,kill_wire),&requests[i])<0) {saved=errno;break;}
        if (kernel_counts) kernel_counts[i]=requests[i].af;
    }
    close(fd);
    return saved;
#else
    (void)family;(void)protocol;(void)source;(void)local;(void)port;(void)interface;(void)expected_release;(void)kernel_counts;
    return ENOTSUP;
#endif
}
