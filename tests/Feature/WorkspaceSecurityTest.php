<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Tests\TestCase;

class WorkspaceSecurityTest extends TestCase
{
    use RefreshDatabase;

    public function test_closed_registration_does_not_disable_reset_and_reset_link_expires(): void
    {
        Notification::fake();
        config(['workspace.registration_enabled' => false]);
        $user = User::factory()->create();
        $this->post('/forgot-password', ['email' => $user->email])->assertSessionHasNoErrors();
        Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
            $this->post('/reset-password', ['token' => $notification->token, 'email' => $user->email, 'password' => 'new-password-123', 'password_confirmation' => 'new-password-123'])->assertSessionHasNoErrors();
            $this->assertTrue(Hash::check('new-password-123', $user->fresh()->password));

            return true;
        });
        $this->travel(2)->minutes();
        Notification::fake();
        $this->post('/forgot-password', ['email' => $user->email]);
        Notification::assertSentTo($user, ResetPassword::class, function ($notification) use ($user) {
            $this->travel(61)->minutes();
            $this->post('/reset-password', ['token' => $notification->token, 'email' => $user->email, 'password' => 'expired-password', 'password_confirmation' => 'expired-password'])->assertSessionHasErrors('email');

            return true;
        });
    }

    public function test_registration_and_password_reset_are_rate_limited(): void
    {
        config(['workspace.registration_enabled' => true, 'workspace.registration_code' => str_repeat('x', 32)]);
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/register', ['registration_code' => 'wrong'])->assertUnprocessable();
        }
        $this->postJson('/register', ['registration_code' => 'wrong'])->assertTooManyRequests();
        for ($i = 0; $i < 6; $i++) {
            $this->postJson('/forgot-password', ['email' => 'unknown@example.test'])->assertOk();
        }
        $this->postJson('/forgot-password', ['email' => 'unknown@example.test'])->assertTooManyRequests();
    }

    public function test_inactive_accounts_cannot_access_any_data_or_report_routes(): void
    {
        $user = User::factory()->create();
        $user->forceFill(['is_active' => false])->save();
        foreach (['/workspace', '/api/workspace/tasks', '/api/workspace/projects', '/api/workspace/changes?since=0', '/api/workspace/activities?subject_id=01AAAAAAAAAAAAAAAAAAAAAAAA', '/reports/year/2026/print', '/reports/year/2026.csv', '/reports/activities.csv'] as $url) {
            $this->actingAs($user)->getJson($url)->assertForbidden();
        }
    }

    public function test_security_page_keeps_standard_password_confirmation_without_extra_auth_features(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user)->get('/settings/security')->assertRedirect('/user/confirm-password');
        $this->withSession(['auth.password_confirmed_at' => time()])->get('/settings/security')->assertOk();
    }

    public function test_audit_cannot_be_updated_or_deleted_through_models(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/workspace/tasks', ['title' => 'Audit bleibt'])->assertCreated();
        $activity = Activity::firstOrFail();
        foreach (['update', 'delete'] as $method) {
            try {
                if ($method === 'update') {
                    $activity->update(['event' => 'changed']);
                } else {
                    $activity->delete();
                }
                $this->fail('Audit-Mutation wurde nicht verhindert.');
            } catch (\LogicException $exception) {
                $this->assertSame('Audit ist unveränderlich.', $exception->getMessage());
            }
        }
        $this->assertDatabaseHas('activities', ['event' => 'created']);
    }
}
