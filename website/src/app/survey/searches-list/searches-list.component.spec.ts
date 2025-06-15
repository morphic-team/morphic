import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchesListComponent } from './searches-list.component';

describe('SearchesListComponent', () => {
  let component: SearchesListComponent;
  let fixture: ComponentFixture<SearchesListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchesListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchesListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
