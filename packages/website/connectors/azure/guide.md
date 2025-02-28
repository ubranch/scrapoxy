# Microsoft Azure Connector

![Azure](/assets/images/azure.svg){width=230, nozoom}

[Microsoft Azure](/l/azure) is a cloud computing service created by Microsoft.


## Prerequisites

An active Microsoft Azure subscription is required.


## Azure Portal

Connect to [Azure Portal](/l/azure-portal).


### Step 1: Register a new application

![Search Entra](azure_entra_search.png)

Search the Microsoft Entra ID (aka Active Directory).

---

![New Registration](azure_app_registration.png)

1. Click on `App registrations`;
2. And click `New registration`.

---

![App register](azure_app_register.png)

Complete the form with the following information:
- Name: `scrapoxy`
- Supported account types: `Accounts in this organizational directory only (Microsoft only - Single tenant)`

And click on `Register`.

---

![App Info](azure_app_info.png)

Remember:
1. the `Application (client) ID`;
2. and the `Directory (tenant) ID`.


### Step 2: Create a client secret

![App Secret](azure_app_secret.png)

1. Click on `Certificates & secrets`;
2. Click on `New client secret`;
3. Enter a description, select the maximum expiration time;
4. Click on `Add`.

---

![App Secret Value](azure_app_secret_value.png)

Remember the `Value` of the secret.


### Step 3: Get your subscription ID

![Subscription Search](azure_subscription_search.png)

Search the Subscription.

---

![Subscription Select](azure_subscription_select.png)

Select the first subscription.

---

![Subscription Info](azure_subscription_info.png)

Remember the `Subscription ID` value.


### Step 4: Add a role to the application

![IAM Add](azure_iam_add.png)

On the subscription:
1. Click on `Access control (IAM)`;
2. And click on `Add`.

---

![IAM Role](azure_iam_add_role.png)

1. On tab `Role`;
2. Select `Privileged administrator roles`;
3. Select `Contributor`;
4. Click on `Next`.

---

![IAM Member](azure_iam_add_member.png)

1. On tab `Members`;
2. Click on `Select members`;
3. Select the application you created;
4. Click on `Select`:

---

![IAM Review](azure_iam_add_review.png)

Finally, click on `Review + assign` 2 times.


## Scrapoxy

Open Scrapoxy User Interface and select `Marketplace`:


### Step 1: Create a new credential

![Credential Select](spx_credential_select.png)

Select `Azure` to create a new credential (use search if necessary).

---

![Credential Form](spx_credential_create.png)

Complete the form with the following information:
1. **Name**: The name of the credential;
2. **Application (client) ID**: The Application ID (aka Client ID) of the application;
3. **Directory (tenant) ID**: The Directory ID (aka Tenant ID) of the application;
4. **Secret value**: The Client Secret of the application;
5. **Subscription ID**: The Subscription ID.

And click on `Create`.

::: info
It may take Azure up to 10 minutes to reflect the changes.
:::


### Step 2: Create a new connector

Create a new connector:

![Connector Create](spx_connector_create.png)

Complete the form with the following information:
1. **Credential**: The previous credential;
2. **Name**: The name of the connector;
3. **# Proxies**: The number of instances to create;
4. **Proxies Timeout**: Maximum duration for connecting to a proxy before considering it as offline;
5. **Proxies Kick**: If enabled, maximum duration for a proxy to be offline before being removed from the pool;
6. **Location**: The region where the instances will be created;
7. **Port**: The port of the proxy (on Azure);
8. **Resource Group Name**: The resource group to host the instances;
9. **VM size**: The size of the VM;
10. **Spot Instance**: If enabled, the VM will be a spot instance;
11. **Storage Type**: The type of storage;
12. **Prefix**: The prefix for all resources created on Azure;
13. **Image Resource Group Name**: The resource group where the image is stored.

And click on `Create`.

Most default values can be retained if suitable for the use case.

::: warning
When setting up the connector in multiple locations, assign a unique **Resource Group Name**, **Image Resource Group Name** and distinct **Prefix** for each location.
Without this, connectors may interfere with each other, shutting down instances from the same provider.
:::


### Step 3: Start the connector

![Connector Start](spx_connector_start.png)

1. Start the project;
2. Start the connector.


### Step 4: Start the connector (optional)

![Connector Stop](spx_connector_stop.png)

1. Stop the connector;
2. Wait for proxies to be removed.
