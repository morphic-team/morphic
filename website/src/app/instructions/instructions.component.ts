import { Component } from '@angular/core';
import { ExtensionService, StoreListing } from '../services/extension.service';

@Component({
    selector: 'app-instructions',
    imports: [],
    templateUrl: './instructions.component.html',
    styleUrl: './instructions.component.css'
})
export class InstructionsComponent {
  readonly stores: StoreListing[];

  constructor(extensionService: ExtensionService) {
    this.stores = extensionService.publishedStores();
  }
}
