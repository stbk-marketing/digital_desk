<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class WorkspaceAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_internal_code_and_verification_notification(): void
    {
        Notification::fake();
        config(['workspace.registration_enabled' => true, 'workspace.registration_code' => str_repeat('x', 32)]);
        $data = ['name' => 'Kollegin', 'email' => 'team@example.org', 'password' => 'password', 'password_confirmation' => 'password'];
        $this->post('/register', $data + ['registration_code' => 'wrong'])->assertSessionHasErrors('registration_code');
        $this->assertDatabaseCount('users', 0);
        $this->post('/register', $data + ['registration_code' => str_repeat('x', 32)])->assertRedirect('/workspace');
        Notification::assertSentTo(User::first(), VerifyEmail::class);
        $this->get('/workspace')->assertRedirect('/email/verify');
    }

    public function test_disabled_user_loses_existing_session(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        $this->artisan('workspace:user:disable', ['email' => $user->email])->assertSuccessful();
        $this->get('/workspace')->assertForbidden();
        $this->assertGuest();
    }
}
