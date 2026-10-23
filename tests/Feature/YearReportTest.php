<?php

namespace Tests\Feature;

use App\Actions\MutateWorkspace;
use App\Actions\YearReport;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class YearReportTest extends TestCase
{
    use RefreshDatabase;

    public function test_exact_inclusive_day_bars_clipping_leap_year_and_no_invented_dates(): void
    {
        $user = User::factory()->create();
        $action = new MutateWorkspace;
        $action->execute('project', ['name' => 'Jahreswechsel', 'starts_on' => '2025-12-20', 'ends_on' => '2026-01-02'], $user->id);
        $action->execute('project', ['name' => 'Eintägig', 'starts_on' => '2026-12-31', 'ends_on' => '2026-12-31'], $user->id);
        $action->execute('project', ['name' => 'Noch offen'], $user->id);
        $data = (new YearReport)->data(2026);
        $this->assertCount(2, $data['scheduled']);
        $this->assertEqualsWithDelta(2 / 365 * 100, $data['scheduled'][0]['width'], 0.000001);
        $this->assertEquals(0, $data['scheduled'][0]['left']);
        $this->assertEqualsWithDelta(364 / 365 * 100, $data['scheduled'][1]['left'], 0.000001);
        $this->assertEqualsWithDelta(1 / 365 * 100, $data['scheduled'][1]['width'], 0.000001);
        $this->assertCount(1, $data['unscheduled']);
        $this->assertEqualsWithDelta(31 / 366 * 100, (new YearReport)->data(2028)['months'][0]['width'], 0.000001);
    }

    public function test_print_with_40_long_names_and_csv_with_bom_semicolon_and_formula_protection(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        for ($i = 0; $i < 40; $i++) (new MutateWorkspace)->execute('project', ['name' => 'Äußerst langer Projektname für die Stadtbäckerei Kühl '.$i, 'starts_on' => '2026-01-01', 'ends_on' => '2026-12-31'], $user->id);
        (new MutateWorkspace)->execute('project', ['name' => '=HYPERLINK("test")'], $user->id);
        $this->get('/reports/year/2026/print')->assertOk()->assertSee('A3 landscape', false)->assertSee('table-header-group', false)->assertSee('Stadtbäckerei Kühl 39')->assertDontSee('workspace-nav');
        $csv = $this->get('/reports/year/2026.csv')->assertOk()->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBFProjekt;Start;Ende;Status;Beschreibung;", $csv);
        $this->assertStringContainsString('Stadtbäckerei Kühl 39', $csv);
        $this->assertStringContainsString("'=HYPERLINK", $csv);
        $this->get('/reports/activities.csv')->assertOk()->assertHeader('Content-Type', 'text/csv; charset=UTF-8');
    }

    public function test_all_report_urls_require_verification_and_active_account(): void
    {
        foreach (['/reports/year/2026', '/reports/year/2026/print', '/reports/year/2026.csv', '/reports/activities.csv', '/api/workspace/year/2026'] as $url) {
            $this->get($url)->assertRedirect('/login');
            $user = User::factory()->unverified()->create();
            $this->actingAs($user)->get($url)->assertRedirect('/email/verify');
            auth()->logout();
        }
    }
}
