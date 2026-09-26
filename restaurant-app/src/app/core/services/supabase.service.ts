import { Injectable } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

/**
 * Cliente único de Supabase para todo el proyecto.
 * Cualquier servicio que necesite consultar/escribir en la base
 * debe inyectar este servicio y usar `supabase.client`,
 * en vez de crear un `createClient(...)` propio.
 *
 * autoRefreshToken: false — a propósito. Por defecto, Supabase renueva
 * el token de sesión solo en segundo plano indefinidamente, así que la
 * sesión nunca "expira" de verdad mientras se use la app. Acá queremos
 * lo contrario: que la sesión dure 1 hora real y después pida loguearse
 * de nuevo (ver Auth.ts, que arma el resto del mecanismo de expiración).
 */
@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly client: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseKey,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: false,
      },
    }
  );
}
