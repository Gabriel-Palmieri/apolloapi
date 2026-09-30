import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
@Injectable()
export class SupabaseService {
  constructor(private readonly config: ConfigService) {}
  // Every operation gets isolated in-memory auth state.
  create() {
    return createClient(
      this.config.getOrThrow<string>('SUPABASE_URL'),
      this.config.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  }

  async authenticatedRequest(
    path: string,
    token: string,
    method: string,
    body?: object,
  ) {
    return fetch(
      this.config.getOrThrow<string>('SUPABASE_URL') + '/auth/v1/' + path,
      {
        method,
        headers: {
          apikey: this.config.getOrThrow<string>('SUPABASE_PUBLISHABLE_KEY'),
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(10000),
      },
    );
  }
}
