import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MorphicDateComponent } from './morphic-date.component';

describe('MorphicDateComponent', () => {
  let component: MorphicDateComponent;
  let fixture: ComponentFixture<MorphicDateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MorphicDateComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(MorphicDateComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
