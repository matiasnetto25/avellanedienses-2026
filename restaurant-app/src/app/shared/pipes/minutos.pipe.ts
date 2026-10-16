import { Pipe, PipeTransform } from '@angular/core';
import { formatearMinutos } from '../../core/utils/minutos';

/** `{{ 25 | minutos }}` → «25 minutos» (y «1 minuto»). */
@Pipe({ name: 'minutos', standalone: true })
export class MinutosPipe implements PipeTransform {
  transform(cantidad: number): string {
    return formatearMinutos(cantidad);
  }
}