<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ActiveUser
{
    public function handle(Request $request, Closure $next): mixed
    {
        if ($request->user() && ! $request->user()->fresh()?->is_active) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            abort(403, 'Dieses Konto ist deaktiviert.');
        }

        return $next($request);
    }
}
