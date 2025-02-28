import {
    Agents,
    AxiosFormData,
} from '@scrapoxy/backend-sdk';
import axios, { AxiosError } from 'axios';
import { getAzureErrorMessage } from './azure.helpers';
import { EAzureProvisioningState } from './azure.interface';
import { AzureResourceGroupState } from './state';
import type {
    IAzureDeployment,
    IAzureDeploymentRequest,
    IAzureDisk,
    IAzureError,
    IAzureLocation,
    IAzureNetworkInterface,
    IAzurePublicIpAddress,
    IAzureResourceGroup,
    IAzureValue,
    IAzureVirtualMachine,
    IAzureVmSize,
} from './azure.interface';
import type { IOAuthToken } from '@scrapoxy/common';
import type {
    AxiosInstance,
    AxiosRequestConfig,
    AxiosResponse,
} from 'axios';


export class AzureError extends Error {
    constructor(
        public code: string,
        message: string
    ) {
        super(message);
    }
}


export class AzureApi {
    private readonly instanceAuth: AxiosInstance;

    private readonly instanceManagement: AxiosInstance;

    private token: string | undefined = void 0;

    private tokenExpirationTs = 0;

    private loginPromise: Promise<void> | undefined = void 0;

    constructor(
        tenantId: string,
        private readonly clientId: string,
        private readonly secret: string,
        subscriptionId: string,
        agents: Agents
    ) {
        // Auth client
        this.instanceAuth = axios.create({
            ...agents.axiosDefaults,
            baseURL: `https://login.microsoftonline.com/${tenantId}`,
        });

        this.instanceAuth.interceptors.response.use(
            (response) => response,
            async(err: any) => {
                if (err instanceof AxiosError) {
                    const errAxios = err as AxiosError;
                    const response = errAxios.response as AxiosResponse;
                    const data = response?.data;

                    if (data) {
                        throw new AzureError(
                            data.error,
                            data.error_description
                        );
                    }
                }

                throw err;
            }
        );

        // Management client
        this.instanceManagement = axios.create({
            ...agents.axiosDefaults,
            baseURL: `https://management.azure.com/subscriptions/${subscriptionId}`,
        });

        this.instanceManagement.interceptors.request.use(async(config) => {
            // Update authentication if necessary
            if (this.tokenExpirationTs < Date.now()) {
                if (!this.loginPromise) {
                    this.loginPromise = this.login();
                }

                await this.loginPromise;
            }

            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${this.token}`;

            return config;
        });

        this.instanceManagement.interceptors.response.use(
            (response) => response,
            async(err: any) => {
                if (err instanceof AxiosError) {
                    const errAxios = err as AxiosError;
                    const response = errAxios.response as AxiosResponse;
                    const error = response?.data?.error as IAzureError;

                    if (error) {
                        throw new AzureError(
                            error.code,
                            getAzureErrorMessage(error) as string
                        );
                    }
                }

                throw err;
            }
        );
    }

    //////////// LOCATIONS ////////////
    async listLocations(): Promise<IAzureLocation[]> {
        const response = await this.instanceManagement.get<IAzureValue<IAzureLocation[]>>(
            'locations',
            {
                params: {
                    'api-version': '2016-06-01',
                },
            }
        );

        return response.data.value;
    }

    //////////// VM SIZES ////////////
    async listVmSizes(location: string): Promise<IAzureVmSize[]> {
        const response = await this.instanceManagement.get<IAzureValue<IAzureVmSize[]>>(
            `providers/Microsoft.Compute/locations/${location}/vmSizes`,
            {
                params: {
                    'api-version': '2023-03-01',
                },
            }
        );

        return response.data.value;
    }

    //////////// RESOURCE GROUPS ////////////
    async getResourceGroup(resourceGroupName: string): Promise<IAzureResourceGroup> {
        const response = await this.instanceManagement.get<IAzureResourceGroup>(
            `resourcegroups/${resourceGroupName}`,
            {
                params: {
                    'api-version': '2021-04-01',
                },
            }
        );

        return response.data;
    }

    async createResourceGroup(
        resourceGroupName: string, location: string
    ): Promise<void> {
        const payload = {
            location,
        };

        await this.instanceManagement.put(
            `resourcegroups/${resourceGroupName}`,
            payload,
            {
                params: {
                    'api-version': '2021-04-01',
                },
            }
        );
    }

    async getResourceGroupState(
        resourceGroupName: string,
        prefix: string
    ): Promise<AzureResourceGroupState> {
        const [
            deployments,
            vms,
            nics,
            ips,
            disks,
        ] = await Promise.all([
            this.listDeployments(
                resourceGroupName,
                EAzureProvisioningState.Running
            ),
            this.listVirtualMachines(),
            this.listNetworkInterfaces(resourceGroupName),
            this.listPublicIpAddresses(resourceGroupName),
            this.listDisks(resourceGroupName),
        ]);

        return new AzureResourceGroupState(
            prefix,
            resourceGroupName,
            disks,
            ips,
            nics,
            vms,
            deployments
        );
    }

    async cleanResourceGroupState(state: AzureResourceGroupState): Promise<void> {
        const promises: Promise<any>[] = [];

        for (const nic of state.networkInterfaces) {
            promises.push(this.deleteNetworkInterface(
                state.resourceGroupName,
                nic.name as string
            ));
        }

        for (const ip of state.publicIpAddresses) {
            promises.push(this.deletePublicIpAddress(
                state.resourceGroupName,
                ip.name as string
            ));
        }

        for (const disk of state.disks) {
            promises.push(this.deleteDisk(
                state.resourceGroupName,
                disk.name as string
            ));
        }

        await Promise.all(promises);
    }

    //////////// DISKS ////////////
    async listDisks(resourceGroupName: string): Promise<IAzureDisk[]> {
        const response = await this.instanceManagement.get<IAzureValue<IAzureDisk[]>>(
            `resourceGroups/${resourceGroupName}/providers/Microsoft.Compute/disks`,
            {
                params: {
                    'api-version': '2022-07-02',
                },
            }
        );

        return response.data.value;
    }

    async deleteDisk(
        resourceGroupName: string, diskName: string
    ): Promise<string> {
        const response = await this.instanceManagement.delete(
            `resourceGroups/${resourceGroupName}/providers/Microsoft.Compute/disks/${diskName}`,
            {
                params: {
                    'api-version': '2022-07-02',
                },
            }
        );
        const id = response.headers[ 'x-ms-request-id' ];

        return id;
    }

    //////////// NETWORK INTERFACES ////////////
    async listNetworkInterfaces(resourceGroupName: string): Promise<IAzureNetworkInterface[]> {
        const response = await this.instanceManagement.get<IAzureValue<IAzureNetworkInterface[]>>(
            `resourceGroups/${resourceGroupName}/providers/Microsoft.Network/networkInterfaces`,
            {
                params: {
                    'api-version': '2022-11-01',
                },
            }
        );

        return response.data.value;
    }

    async deleteNetworkInterface(
        resourceGroupName: string, networkInterfaceName: string
    ): Promise<string> {
        const response = await this.instanceManagement.delete(
            `resourceGroups/${resourceGroupName}/providers/Microsoft.Network/networkInterfaces/${networkInterfaceName}`,
            {
                params: {
                    'api-version': '2022-11-01',
                },
            }
        );
        const id = response.headers[ 'x-ms-request-id' ];

        return id;
    }


    //////////// PUBLIC IP ADDRESSES ////////////
    async listPublicIpAddresses(resourceGroupName: string): Promise<IAzurePublicIpAddress[]> {
        const response = await this.instanceManagement.get<IAzureValue<IAzurePublicIpAddress[]>>(
            `resourceGroups/${resourceGroupName}/providers/Microsoft.Network/publicIPAddresses`,
            {
                params: {
                    'api-version': '2022-11-01',
                },
            }
        );

        return response.data.value;
    }

    async deletePublicIpAddress(
        resourceGroupName: string, publicIpAddressName: string
    ): Promise<string> {
        const response = await this.instanceManagement.delete(
            `resourceGroups/${resourceGroupName}/providers/Microsoft.Network/publicIPAddresses/${publicIpAddressName}`,
            {
                params: {
                    'api-version': '2022-11-01',
                },
            }
        );
        const id = response.headers[ 'x-ms-request-id' ];

        return id;
    }

    //////////// VIRTUAL MACHINES ////////////
    async listVirtualMachines(resourceGroupName?: string): Promise<IAzureVirtualMachine[]> {
        const response = await this.instanceManagement.get<IAzureValue<IAzureVirtualMachine[]>>(
            resourceGroupName && resourceGroupName.length > 0 ?
                `resourceGroups/${resourceGroupName}/providers/Microsoft.Compute/virtualMachines` :
                'providers/Microsoft.Compute/virtualMachines',
            {
                params: {
                    'api-version': '2023-03-01',
                    statusOnly: true,
                },
            }
        );

        return response.data.value;
    }

    async startVirtualMachine(
        resourceGroupName: string, virtualMachineName: string
    ): Promise<string> {
        const response = await this.instanceManagement.post(
            `resourceGroups/${resourceGroupName}/providers/Microsoft.Compute/virtualMachines/${virtualMachineName}/start`,
            {},
            {
                params: {
                    'api-version': '2023-03-01',
                    skipShutdown: false,
                },
            }
        );
        const id = response.headers[ 'x-ms-request-id' ];

        return id;
    }

    async deleteVirtualMachine(
        resourceGroupName: string, virtualMachineName: string
    ): Promise<string> {
        const response = await this.instanceManagement.delete(
            `resourceGroups/${resourceGroupName}/providers/Microsoft.Compute/virtualMachines/${virtualMachineName}`,
            {
                params: {
                    'api-version': '2023-03-01',
                    forceDeletion: true,
                },
            }
        );
        const id = response.headers[ 'x-ms-request-id' ];

        return id;
    }

    //////////// DEPLOYMENTS ////////////
    async listDeployments(
        resourceGroupName: string,
        provisioningState?: EAzureProvisioningState
    ): Promise<IAzureDeployment[]> {
        const config: AxiosRequestConfig = {
            params: {
                'api-version': '2021-04-01',
            },
        };

        if (provisioningState) {
            config.params.$filter = `provisioningState eq '${provisioningState}'`;
        }

        const response = await this.instanceManagement.get<IAzureValue<IAzureDeployment[]>>(
            `resourceGroups/${resourceGroupName}/providers/Microsoft.Resources/deployments`,
            config
        );

        return response.data.value;
    }

    async createDeployment(
        resourceGroupName: string,
        deploymentName: string,
        template: IAzureDeploymentRequest
    ): Promise<IAzureDeployment> {
        const response = await this.instanceManagement.put<IAzureDeployment>(
            `resourceGroups/${resourceGroupName}/providers/Microsoft.Resources/deployments/${deploymentName}`,
            template,
            {
                params: {
                    'api-version': '2021-04-01',
                },
            }
        );
        const deployment = response.data;

        if (deployment.properties.provisioningState !== EAzureProvisioningState.Accepted) {
            throw new AzureError(
                'DeploymentNotAccepted',
                getAzureErrorMessage(deployment.properties.error) ?? `Deployment ${deploymentName} is not accepted`
            );
        }

        return response.data;
    }

    //////////// AUTH ////////////
    private async login(): Promise<void> {
        const form = new AxiosFormData({
            client_id: this.clientId,
            client_secret: this.secret,
            scope: 'https://management.azure.com/.default',
            grant_type: 'client_credentials',
        });
        const response = await this.instanceAuth.post<IOAuthToken>(
            'oauth2/v2.0/token',
            form.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );

        this.tokenExpirationTs = Date.now() + response.data.expires_in * 1000;
        this.token = response.data.access_token;

        this.loginPromise = void 0;
    }
}
