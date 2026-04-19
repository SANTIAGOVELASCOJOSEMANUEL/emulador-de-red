// engine/switching.js — Switching L2, MAC address table, VLANs 802.1Q
'use strict';

// ═══════════════════════════════════════════════════════════════════
// MAC ADDRESS TABLE
// ═══════════════════════════════════════════════════════════════════

class MACTable {
    constructor() {
        this.table = {};
        this.ttlMs = 300000;
    }

    learn(mac, intfName, deviceId) {
        this.table[mac] = { port: intfName, deviceId: deviceId, learnedAt: Date.now() };
    }

    lookup(mac) {
        var e = this.table[mac];
        if (!e) return null;
        if (Date.now() - e.learnedAt > this.ttlMs) { delete this.table[mac]; return null; }
        return e;
    }

    flush() { this.table = {}; }
    entries() { return Object.entries(this.table).map(function(pair) { return Object.assign({ mac: pair[0] }, pair[1]); }); }
}

// ═══════════════════════════════════════════════════════════════════
// SWITCH FRAME PROCESSING
// ═══════════════════════════════════════════════════════════════════

function switchFrame(frame, device) {
    if (!device._macTable) device._macTable = new MACTable();

    if (frame.srcMAC && frame.port) {
        device._macTable.learn(frame.srcMAC, frame.port, frame.srcDeviceId);
    }

    if (frame.dstMAC) {
        var entry = device._macTable.lookup(frame.dstMAC);
        if (entry) {
            return { port: entry.port, packet: frame };
        }
    }

    return { broadcast: true, packet: frame };
}

// ═══════════════════════════════════════════════════════════════════
// VLAN ENGINE — 802.1Q
// ═══════════════════════════════════════════════════════════════════

class VLANEngine {
    constructor(switchDevice) {
        this.sw = switchDevice;
        this.portConfig = {};
    }

    setAccess(intfName, vlanId) {
        if (!this.sw.vlans[vlanId]) {
            return { ok: false, reason: 'VLAN ' + vlanId + ' no existe en ' + this.sw.name };
        }
        this.portConfig[intfName] = {
            mode: 'access',
            vlan: vlanId,
            allowedVlans: new Set([vlanId]),
            nativeVlan: vlanId
        };
        return { ok: true };
    }

    setTrunk(intfName, allowedVlans, nativeVlan) {
        if (!allowedVlans) allowedVlans = [];
        if (!nativeVlan)   nativeVlan   = 1;
        var allowed = allowedVlans.length
            ? new Set(allowedVlans)
            : new Set(Object.keys(this.sw.vlans).map(Number));
        this.portConfig[intfName] = {
            mode: 'trunk',
            vlan: nativeVlan,
            allowedVlans: allowed,
            nativeVlan: nativeVlan
        };
        return { ok: true };
    }

    getPort(intfName) {
        return this.portConfig[intfName] || {
            mode: 'access',
            vlan: 1,
            allowedVlans: new Set([1]),
            nativeVlan: 1
        };
    }

    getVlanForPort(intfName) {
        return this.getPort(intfName).vlan;
    }

    allowsVlan(intfName, vlanId) {
        var cfg = this.getPort(intfName);
        if (cfg.mode === 'access') return cfg.vlan === vlanId;
        return cfg.allowedVlans.has(vlanId) || cfg.allowedVlans.size === 0;
    }

    canForward(inIntf, outIntf, vlanId) {
        if (inIntf === outIntf) return false;
        return this.allowsVlan(outIntf, vlanId);
    }

    ingressVlan(inIntf, packetVlanTag) {
        var cfg = this.getPort(inIntf);
        if (cfg.mode === 'access') return cfg.vlan;
        return packetVlanTag || cfg.nativeVlan;
    }

    summary() {
        var lines = [];
        var self  = this;
        lines.push('VLANs definidas en ' + this.sw.name + ':');
        Object.entries(this.sw.vlans).forEach(function(pair) {
            var id = pair[0], v = pair[1];
            lines.push('  VLAN ' + id + ': ' + v.name + '  ' + v.network + '  gw=' + v.gateway);
        });
        lines.push('Puertos configurados:');
        this.sw.interfaces.forEach(function(intf) {
            var cfg  = self.getPort(intf.name);
            var conn = intf.connectedTo ? intf.connectedTo.name : '—';
            if (cfg.mode === 'trunk') {
                var allowed = Array.from(cfg.allowedVlans).join(',') || 'todas';
                lines.push('  ' + intf.name.padEnd(10) + ' TRUNK  native=' + cfg.nativeVlan + ' allowed=' + allowed + '  -> ' + conn);
            } else {
                lines.push('  ' + intf.name.padEnd(10) + ' ACCESS VLAN ' + cfg.vlan + '  -> ' + conn);
            }
        });
        return lines;
    }
}

// ═══════════════════════════════════════════════════════════════════
// INTER-VLAN ROUTING — Router-on-a-stick
// ═══════════════════════════════════════════════════════════════════

class InterVLANRouter {
    static findRouter(sw, vlanSrc, vlanDst, allDevices, connections) {
        var routerTypes = ['Router', 'RouterWifi', 'Firewall', 'SDWAN'];

        var candidates = connections
            .filter(function(c) { return c.from === sw || c.to === sw; })
            .map(function(c)    { return c.from === sw ? c.to : c.from; })
            .filter(function(d) { return routerTypes.includes(d.type); });

        for (var i = 0; i < candidates.length; i++) {
            var router     = candidates[i];
            var srcVlanCfg = sw.vlans[vlanSrc];
            var dstVlanCfg = sw.vlans[vlanDst];
            if (!srcVlanCfg || !dstVlanCfg) continue;

            var hasSrcNet = router.interfaces.some(function(intf) {
                var ip = intf.ipConfig && intf.ipConfig.ipAddress;
                if (!ip || ip === '0.0.0.0') return false;
                return NetUtils.inSameSubnet(ip, srcVlanCfg.gateway, intf.ipConfig.subnetMask || '255.255.255.0');
            });

            var hasDstNet = router.interfaces.some(function(intf) {
                var ip = intf.ipConfig && intf.ipConfig.ipAddress;
                if (!ip || ip === '0.0.0.0') return false;
                return NetUtils.inSameSubnet(ip, dstVlanCfg.gateway, intf.ipConfig.subnetMask || '255.255.255.0');
            });

            if (hasSrcNet && hasDstNet) return router;

            if (router.routingTable instanceof RoutingTable) {
                var r1 = router.routingTable.lookup(srcVlanCfg.gateway);
                var r2 = router.routingTable.lookup(dstVlanCfg.gateway);
                if (r1 && r2) return router;
            }
        }
        return null;
    }

    static check(src, dst, allDevices, connections) {
        var switchTypes = ['Switch', 'SwitchPoE'];

        var srcSwitch = connections
            .filter(function(c) { return c.from === src || c.to === src; })
            .map(function(c)    { return c.from === src ? c.to : c.from; })
            .find(function(d)   { return switchTypes.includes(d.type); });

        var dstSwitch = connections
            .filter(function(c) { return c.from === dst || c.to === dst; })
            .map(function(c)    { return c.from === dst ? c.to : c.from; })
            .find(function(d)   { return switchTypes.includes(d.type); });

        if (!srcSwitch || srcSwitch !== dstSwitch) return { needed: false };

        var sw = srcSwitch;
        if (!sw._vlanEngine) return { needed: false };

        var srcConn = connections.find(function(c) {
            return (c.from === src && c.to === sw) || (c.to === src && c.from === sw);
        });
        var dstConn = connections.find(function(c) {
            return (c.from === dst && c.to === sw) || (c.to === dst && c.from === sw);
        });

        if (!srcConn || !dstConn) return { needed: false };

        var srcIntf = srcConn.from === sw
            ? (srcConn.fromInterface && srcConn.fromInterface.name)
            : (srcConn.toInterface   && srcConn.toInterface.name);

        var dstIntf = dstConn.from === sw
            ? (dstConn.fromInterface && dstConn.fromInterface.name)
            : (dstConn.toInterface   && dstConn.toInterface.name);

        var vlanSrc = sw._vlanEngine.getVlanForPort(srcIntf);
        var vlanDst = sw._vlanEngine.getVlanForPort(dstIntf);

        if (vlanSrc === vlanDst) return { needed: false };

        return {
            needed    : true,
            vlanSrc   : vlanSrc,
            vlanDst   : vlanDst,
            switchDev : sw,
            srcIntf   : srcIntf,
            dstIntf   : dstIntf
        };
    }
}