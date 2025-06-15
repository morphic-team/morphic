import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportResultsComponent } from './export-results.component';

describe('ExportResultsComponent', () => {
  let component: ExportResultsComponent;
  let fixture: ComponentFixture<ExportResultsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportResultsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExportResultsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
