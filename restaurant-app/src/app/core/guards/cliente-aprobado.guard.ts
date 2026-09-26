import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

export const clienteAprobadoGuard: CanActivateFn = async () => {
  const supabase = inject(SupabaseService);
  const router = inject(Router);

  const { data: sessionData } = await supabase.client.auth.getSession();
  const userId = sessionData.session?.user?.id;

  if (!userId) {
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }

  const { data, error } = await supabase.client
    .from('clientes')
    .select('estado')
    .eq('auth_customer_id', userId)
    .maybeSingle();

  if (error || !data || data.estado !== 'aprobado') {
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }

  return true;
};