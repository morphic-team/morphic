import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchResultDetailComponent } from './search-result-detail.component';

describe('SearchResultDetailComponent', () => {
  let component: SearchResultDetailComponent;
  let fixture: ComponentFixture<SearchResultDetailComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchResultDetailComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SearchResultDetailComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
