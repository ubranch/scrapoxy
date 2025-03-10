import { NgModule } from '@angular/core';
import {
    FormsModule,
    ReactiveFormsModule,
} from '@angular/forms';
import {
    ButtonModule,
    FormModule,
    GridModule,
    TooltipModule,
} from '@coreui/angular';
import { IconModule } from '@coreui/icons-angular';
import { ConnectorprovidersModule } from '@scrapoxy/frontend-sdk';
import { ConnectorAwsFactory } from './aws.factory';
import { ConnectorAwsComponent } from './connector/connector.component';
import { CredentialAwsComponent } from './credential/credential.component';


@NgModule({
    imports: [
        ButtonModule,
        ConnectorprovidersModule,
        FormModule,
        FormsModule,
        GridModule,
        IconModule,
        ReactiveFormsModule,
        TooltipModule,
    ],
    declarations: [
        ConnectorAwsComponent, CredentialAwsComponent,
    ],
    providers: [
        ConnectorAwsFactory,
    ],
})
export class ConnectorAwsModule {
    constructor(private readonly factory: ConnectorAwsFactory) {
        this.factory.init();
    }
}
