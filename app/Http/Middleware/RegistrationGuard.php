<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class RegistrationGuard
{
    public function handle(Request $request, Closure $next): mixed
    {
        if ($request->isMethod('post') && $request->is('forgot-password', 'reset-password')) {
            $key = 'workspace-reset:'.$request->ip();
            abort_if(RateLimiter::tooManyAttempts($key, 6), 429);
            RateLimiter::hit($key, 60);
        }
        if ($request->isMethod('post') && $request->is('register')) {
            $key = 'workspace-register:'.$request->ip();
            abort_if(RateLimiter::tooManyAttempts($key, 5), 429);
            RateLimiter::hit($key, 60);
            $code = (string) config('workspace.registration_code');
            if (! config('workspace.registration_enabled') || strlen($code) < 24 ||
                ! hash_equals($code, (string) $request->input('registration_code'))) {
                throw ValidationException::withMessages(['registration_code' => 'Registrierung nicht möglich. Bitte interne Zugangsdaten prüfen.']);
            }
        }

        return $next($request);
    }
}
