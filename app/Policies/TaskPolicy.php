<?php

namespace App\Policies;

use App\Models\User;

class TaskPolicy
{
    public function before(User $user): bool
    {
        return $user->is_active && $user->hasVerifiedEmail();
    }
}
