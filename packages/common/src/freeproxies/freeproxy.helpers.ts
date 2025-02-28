import {
    EProxyType,
    PROXY_TYPE_KEYS,
} from '../proxies';
import type { IFreeproxyBase } from './freeproxy.interface';
import type { IProxyTransportAuth } from '../proxies';


export function formatFreeproxyId(
    connectorId: string, freeproxy: IFreeproxyBase
) {
    return `${connectorId}:${freeproxy.key}`;
}


function hashCode(str: string): number {
    let hash = 0;

    if (str.length <= 0) {
        return hash;
    }

    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }

    return Math.abs(hash % 100000);
}


export function parseFreeproxy(raw: string | undefined | null): IFreeproxyBase | undefined {
    if (!raw || raw.length <= 0) {
        return;
    }

    const protocolMatch = /^(.*):\/\//i.exec(raw);
    let
        rawWithoutProtocol: string,
        type: EProxyType | undefined;

    if (protocolMatch) {
        const protocolStr = protocolMatch[ 1 ];

        // Normalize SOCKS protocol
        if (protocolStr.startsWith('socks4')) {
            type = EProxyType.SOCKS4;
        } else if (protocolStr.startsWith('socks')) {
            type = EProxyType.SOCKS5;
        } else {
            if (!PROXY_TYPE_KEYS.includes(protocolStr)) {
                return;
            }
            type = protocolStr as EProxyType;
        }

        rawWithoutProtocol = raw.substring(protocolMatch[ 0 ].length);
    } else {
        type = EProxyType.HTTP;
        rawWithoutProtocol = raw;
    }

    const atSplit = rawWithoutProtocol.split('@');

    if (atSplit.length > 2) {
        return;
    }

    let auth: IProxyTransportAuth | null,
        hostStr: string;

    if (atSplit.length === 2) {
        const authStr = atSplit[ 0 ];
        hostStr = atSplit[ 1 ];

        const authStrInd = authStr.indexOf(':');

        if (authStrInd >= 0) {
            auth = {
                username: authStr.substring(
                    0,
                    authStrInd
                ),
                password: authStr.substring(authStrInd + 1),
            };
        } else {
            auth = {
                username: authStr,
                password: '',
            };
        }
    } else {
        hostStr = atSplit[ 0 ];
        auth = null;
    }

    const hostStrSplit = hostStr.split(':');
    let hostname: string;
    let portStr: string;

    switch (hostStrSplit.length) {
        case 2: {
            [
                hostname, portStr,
            ] = hostStrSplit;
            break;
        }

        case 4: {
            let
                password: string,
                username: string;
            [
                hostname,
                portStr,
                username,
                password,
            ] = hostStrSplit;
            auth = {
                username,
                password,
            };
            break;
        }

        default: {
            return;
        }
    }

    let port: number;
    try {
        port = parseInt(
            portStr,
            10
        );

        if (
            !port ||
            port < 1 ||
            port > 65535
        ) {
            return;
        }
    } catch (err: any) {
        return;
    }

    let hash: number;

    if (auth) {
        hash = hashCode(`${port}:${auth.username}:${auth.password}`);
    } else {
        hash = port;
    }

    return {
        key: `${hostname}#${hash}`,
        type,
        address: {
            hostname,
            port,
        },
        auth,
    };
}
