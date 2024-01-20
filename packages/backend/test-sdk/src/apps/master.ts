import { Test } from '@nestjs/testing';
import {
    LogExceptionFilter,
    MasterModule,
    MasterService,
    RefreshConnectorsModule,
    RefreshFreeproxiesModule,
    RefreshMetricsModule,
    RefreshProxiesModule,
    RefreshProxiesService,
    RefreshTasksModule,
} from '@scrapoxy/backend-sdk';
import { ONE_SECOND_IN_MS } from '@scrapoxy/common';
import { ConnectorDatacenterLocalModule } from '@scrapoxy/connector-datacenter-local-backend';
import { ConnectorProxyLocalModule } from '@scrapoxy/connector-proxy-local-backend';
import { CommanderApp } from './commander';
import { VERSION_TEST } from '../info';
import type {
    DynamicModule,
    ForwardReference,
    INestApplication,
    LoggerService,
    Type,
} from '@nestjs/common';


export interface IMasterAppOptions {
    datacenterLocalAppUrl?: string;
    commanderApp?: CommanderApp;
    fingerprintUrl?: string;
    fingerprintTimeout?: number;
    imports?: (Type | DynamicModule | Promise<DynamicModule> | ForwardReference)[];
    logger: LoggerService;
    proxyLocalAppUrl?: string;
}


export class MasterApp {
    public static defaults(options: IMasterAppOptions): MasterApp {
        options.imports = options.imports ?? [];

        if (options.commanderApp) {
            options.imports.push(
                MasterModule.forRootFromEnv(
                    options.commanderApp.url,
                    VERSION_TEST,
                    true,
                    0,
                    ONE_SECOND_IN_MS

                ),
                RefreshConnectorsModule.forRoot(
                    options.commanderApp.url,
                    VERSION_TEST
                ),
                RefreshMetricsModule.forRoot(
                    options.commanderApp.url,
                    VERSION_TEST,
                    ONE_SECOND_IN_MS
                ),
                RefreshTasksModule.forRoot(
                    options.commanderApp.url,
                    VERSION_TEST
                )
            );

            if (options.fingerprintUrl) {
                options.imports.push(
                    RefreshFreeproxiesModule.forRoot(
                        options.commanderApp.url,
                        VERSION_TEST,
                        options.fingerprintUrl,
                        options.fingerprintTimeout
                    ),
                    RefreshProxiesModule.forRoot(
                        options.commanderApp.url,
                        VERSION_TEST,
                        true,
                        options.fingerprintUrl,
                        options.fingerprintTimeout
                    )
                );
            }
        }

        return new MasterApp(options);
    }

    get masterPort(): number {
        if (!this.app) {
            throw new Error('app not initialized');
        }

        return this.app.get<MasterService>(MasterService).port as number;
    }

    private app: INestApplication | undefined = void 0;

    constructor(private readonly options: IMasterAppOptions) {}

    get proxiesSocketsSize(): number {
        if (!this.app) {
            throw new Error('App is not defined');
        }

        const service = this.app.get<RefreshProxiesService>(RefreshProxiesService);

        return service.socketsSize;
    }

    async start(): Promise<void> {
        const imports: (Type | DynamicModule | Promise<DynamicModule> | ForwardReference)[] = [
            ...this.options.imports ?? [],
        ];

        if (this.options.datacenterLocalAppUrl) {
            imports.push(ConnectorDatacenterLocalModule.forRoot({
                url: this.options.datacenterLocalAppUrl,
            }));
        }

        if (this.options.proxyLocalAppUrl) {
            imports.push(ConnectorProxyLocalModule.forRoot({
                url: this.options.proxyLocalAppUrl,
            }));
        }

        const moduleRef = await Test.createTestingModule({
            imports,
        })
            .setLogger(this.options.logger)
            .compile();

        this.app = moduleRef.createNestApplication();
        this.app.enableShutdownHooks();
        this.app.useGlobalFilters(new LogExceptionFilter());
        await this.app.init();
    }

    async stop(): Promise<void> {
        if (this.app) {
            await this.app.close();
        }
    }
}
