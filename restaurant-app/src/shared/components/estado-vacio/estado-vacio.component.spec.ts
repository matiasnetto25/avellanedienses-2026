import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { EstadoVacioComponent } from './estado-vacio.component';

describe('EstadoVacioComponent', () => {
  let component: EstadoVacioComponent;
  let fixture: ComponentFixture<EstadoVacioComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [EstadoVacioComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(EstadoVacioComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
