<?php

namespace App\Policies;

use App\Models\User;

class TaskPolicy
{
    public function before(User $user): bool
    {
        return $user->fresh()->is_active && $user->hasVerifiedEmail();
    }

    public function write(User $user): bool
    {
        return $this->before($user);
    }
}
