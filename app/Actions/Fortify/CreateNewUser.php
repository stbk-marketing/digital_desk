<?php

namespace App\Actions\Fortify;

use App\Concerns\PasswordValidationRules;
use App\Concerns\ProfileValidationRules;
use App\Models\User;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules, ProfileValidationRules;

    /**
     * Validate and create a newly registered user.
     *
     * @param  array<string, string>  $input
     */
    public function create(array $input): User
    {
        $code = (string) config('workspace.registration_code');
        abort_unless(config('workspace.registration_enabled') && strlen($code) >= 24 && hash_equals($code, $input['registration_code'] ?? ''), 403);
        Validator::make($input, [
            ...$this->profileRules(),
            'password' => $this->passwordRules(),
        ], ['email.unique' => 'Registrierung nicht möglich. Bitte interne Zugangsdaten prüfen.'])->validate();

        return User::create([
            'name' => $input['name'],
            'email' => $input['email'],
            'password' => $input['password'],
        ]);
    }
}
