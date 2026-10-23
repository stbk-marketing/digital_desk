import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function login(page: Page, name = 'anna') {
    await page.goto('/login');
    await page.locator('input[name=email]').fill(`${name}@example.test`);
    await page.locator('input[name=password]').fill('Browser-test-123!');
    await page.locator('button[type=submit]').click();
    await expect(
        page.getByRole('heading', { name: 'Schreibtisch', exact: true }),
    ).toBeVisible();
}

test('project autosave, project capture and task dates remain independent', async ({
    page,
}) => {
    await login(page);
    await page.getByRole('button', { name: 'Projekte', exact: true }).click();
    await page
        .getByLabel('Neues Projekt', { exact: true })
        .fill('Firmen-Event Abnahme');
    await page.getByLabel('Neues Projekt', { exact: true }).press('Enter');
    const card = page.locator('.project-card').filter({
        has: page.locator(
            'input[aria-label="Projektname"][value="Firmen-Event Abnahme"]',
        ),
    });
    await expect(card).toBeVisible();
    await card.getByLabel('Projektstart', { exact: true }).fill('2026-12-28');
    await expect(
        card.getByText('Wird gespeichert …', { exact: true }),
    ).toHaveCount(0);
    await card.getByLabel('Projektende', { exact: true }).fill('2027-01-04');
    await expect(
        card.getByText('Wird gespeichert …', { exact: true }),
    ).toHaveCount(0);
    await card
        .getByRole('button', { name: 'Aufgaben öffnen / erfassen →' })
        .click();
    await page
        .getByLabel('Neue Aufgabe', { exact: true })
        .fill('Einzelfrist des Firmen-Events');
    await page.getByLabel('Neue Aufgabe', { exact: true }).press('Enter');
    await expect(
        page.getByText('Wird gespeichert …', { exact: true }),
    ).toHaveCount(0);
    const row = page.locator('.task-row').filter({
        has: page.locator('input[value="Einzelfrist des Firmen-Events"]'),
    });
    await expect(row.getByLabel('Projekt zuordnen')).toHaveValue(
        await page.getByLabel('Projektfilter').inputValue(),
    );
    await row.getByLabel('Frist', { exact: true }).fill('2026-10-25');
    await expect(
        page.getByText('Wird gespeichert …', { exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: 'Kalender', exact: true }).click();
    await expect(
        page.getByRole('button', {
            name: '○ Einzelfrist des Firmen-Events',
            exact: true,
        }),
    ).toBeVisible();
    await page
        .getByRole('button', {
            name: '○ Einzelfrist des Firmen-Events',
            exact: true,
        })
        .click();
    await page
        .getByRole('complementary', { name: 'Aufgabendetails' })
        .getByLabel('Frist', { exact: true })
        .fill('2026-10-26');
    await page
        .getByRole('button', { name: 'Schließen ×', exact: true })
        .click();
    await page.getByRole('button', { name: 'Projekte', exact: true }).click();
    await expect(card.getByLabel('Projektstart', { exact: true })).toHaveValue(
        '2026-12-28',
    );
    await expect(card.getByLabel('Projektende', { exact: true })).toHaveValue(
        '2027-01-04',
    );
});

test('real HTTP CSRF protection and registration verification gate', async ({
    page,
}) => {
    await login(page);
    // Laravel 13 permits browser requests with verified Sec-Fetch-Site: same-origin.
    // A session-bearing client without that signal must supply a valid CSRF token.
    const response = await page.request.post('/api/workspace/tasks', {
        data: { title: 'Darf nicht gespeichert werden' },
        headers: { Accept: 'application/json' },
    });
    expect(response.status()).toBe(419);
    await page.getByRole('button', { name: 'Abmelden', exact: true }).click();
    await page.goto('/register');
    await page.locator('[name=name]').fill('Clara');
    await page.locator('[name=email]').fill('clara@example.test');
    await page.locator('[name=password]').fill('Browser-test-123!');
    await page
        .locator('[name=password_confirmation]')
        .fill('Browser-test-123!');
    await page.locator('[name=registration_code]').fill('falsch');
    await page.locator('button[type=submit]').click();
    await expect(
        page.getByText(
            'Registrierung nicht möglich. Bitte interne Zugangsdaten prüfen.',
        ),
    ).toBeVisible();
    await page
        .locator('[name=registration_code]')
        .fill('browser-test-code-32-characters-only');
    await page.locator('[name=password]').fill('Browser-test-123!');
    await page
        .locator('[name=password_confirmation]')
        .fill('Browser-test-123!');
    await page.locator('button[type=submit]').click();
    await expect(
        page.getByRole('heading', {
            name: 'E-Mail-Adresse bestätigen',
            exact: true,
        }),
    ).toBeVisible();
    const forbidden = await page.evaluate(
        async () =>
            (
                await fetch('/api/workspace/tasks', {
                    headers: { Accept: 'application/json' },
                })
            ).status,
    );
    expect(forbidden).toBe(403);
});

test('conflict preserves local text through polling and explicit retry', async ({
    page,
}) => {
    await login(page);
    await page.getByLabel('Neue Aufgabe', { exact: true }).fill('Konflikttest');
    await page.getByLabel('Neue Aufgabe', { exact: true }).press('Enter');
    await expect(
        page.getByText('Wird gespeichert …', { exact: true }),
    ).toHaveCount(0);
    await page.getByLabel('Alle Aufgaben durchsuchen').fill('Konflikttest');
    await expect(page.getByLabel('Aufgabentitel', { exact: true })).toHaveCount(
        1,
    );
    await expect(page.getByLabel('Aufgabentitel', { exact: true })).toHaveValue(
        'Konflikttest',
    );
    await page.route('**/api/workspace/tasks/*', async (route) => {
        if (route.request().method() !== 'PATCH') {
            await route.continue();
            return;
        }
        const original = await page.request.get(
            '/api/workspace/tasks?q=Konflikttest',
        );
        const current = (await original.json()).tasks.data[0];
        await route.fulfill({
            status: 409,
            contentType: 'application/json',
            body: JSON.stringify({
                message: 'Zwischenzeitlich geändert.',
                current,
            }),
        });
    });
    await page
        .getByLabel('Aufgabentitel', { exact: true })
        .fill('Mein lokaler Text');
    await expect(
        page.getByText('Nicht synchronisiert.', { exact: true }),
    ).toBeVisible();
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(page.getByLabel('Aufgabentitel', { exact: true })).toHaveValue(
        'Mein lokaler Text',
    );
    await page.unroute('**/api/workspace/tasks/*');
    await page
        .getByRole('button', {
            name: 'Entwurf auf aktueller Serverversion erneut senden',
        })
        .click();
    await expect(
        page.getByText('Nicht synchronisiert.', { exact: true }),
    ).toHaveCount(0);
    await page
        .getByLabel('Alle Aufgaben durchsuchen')
        .fill('Mein lokaler Text');
    await expect(page.getByLabel('Aufgabentitel', { exact: true })).toHaveValue(
        'Mein lokaler Text',
    );
});

test('two browser sessions synchronize capture, completion, reopening and history', async ({
    browser,
}) => {
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const a = await contextA.newPage();
    const b = await contextB.newPage();
    await login(a);
    await login(b, 'britta');
    await a.getByLabel('Alle Aufgaben durchsuchen').fill('9100');
    await b.getByLabel('Alle Aufgaben durchsuchen').fill('9100');
    await expect(a.getByLabel('Aufgabentitel', { exact: true })).toHaveCount(0);
    await expect(b.getByLabel('Aufgabentitel', { exact: true })).toHaveCount(0);
    await a
        .getByLabel('Neue Aufgabe', { exact: true })
        .fill('Klamotten Filiale 9100 Jarmen packen');
    await a.getByLabel('Neue Aufgabe', { exact: true }).press('Enter');
    await expect(a.getByLabel('Neue Aufgabe', { exact: true })).toBeFocused();
    await expect(a.getByLabel('Aufgabentitel', { exact: true })).toHaveValue(
        'Klamotten Filiale 9100 Jarmen packen',
    );
    await expect(
        a.getByText('Wird gespeichert …', { exact: true }),
    ).toHaveCount(0);
    await a.reload();
    await a.getByLabel('Alle Aufgaben durchsuchen').fill('9100');
    await expect(a.getByLabel('Aufgabentitel', { exact: true })).toHaveCount(1);
    await expect(a.getByLabel('Aufgabentitel', { exact: true })).toHaveValue(
        'Klamotten Filiale 9100 Jarmen packen',
    );
    await b.bringToFront();
    await expect(b.getByLabel('Aufgabentitel', { exact: true })).toHaveValue(
        'Klamotten Filiale 9100 Jarmen packen',
    );
    await b.getByRole('checkbox', { name: /Klamotten.*erledigen/ }).click();
    await a.bringToFront();
    await a.getByLabel('Alle Aufgaben durchsuchen').fill('9100');
    await expect(
        a.getByRole('checkbox', { name: /Klamotten.*wieder öffnen/ }),
    ).toBeChecked();
    await a.getByRole('checkbox', { name: /Klamotten.*wieder öffnen/ }).click();
    await a
        .getByRole('button', {
            name: 'Details: Klamotten Filiale 9100 Jarmen packen',
        })
        .click();
    await expect(
        a.getByText('Als erledigt markiert', { exact: true }),
    ).toBeVisible();
    await expect(a.getByText('Wieder geöffnet', { exact: true })).toBeVisible();
    await expect(
        a.locator('.activity').filter({ hasText: 'Britta' }),
    ).toBeVisible();
    await a.screenshot({
        path: 'storage/test-results/schreibtisch.png',
        fullPage: true,
    });
    await contextA.close();
    await contextB.close();
});

test('failed capture remains visible and can be retried; keyboard and mobile stay usable', async ({
    page,
}) => {
    await login(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('**/api/workspace/tasks', (route) =>
        route.request().method() === 'POST' ? route.abort() : route.continue(),
    );
    await page
        .getByLabel('Neue Aufgabe', { exact: true })
        .fill('Offline Entwurf erhalten');
    await page.getByLabel('Neue Aufgabe', { exact: true }).press('Enter');
    await expect(
        page.getByText('Nicht synchronisiert.', { exact: true }),
    ).toBeVisible();
    await expect(
        page.locator(
            'input[aria-label="Aufgabentitel"][value="Offline Entwurf erhalten"]',
        ),
    ).toHaveValue('Offline Entwurf erhalten');
    await page.unroute('**/api/workspace/tasks');
    await page
        .getByRole('button', { name: 'Erneut versuchen', exact: true })
        .click();
    await expect(
        page.getByText('Nicht synchronisiert.', { exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(
        page.getByText('Wird gespeichert …', { exact: true }),
    ).toHaveCount(0);
    await page.keyboard.press('Control+k');
    await expect(
        page.getByLabel('Neue Aufgabe', { exact: true }),
    ).toBeFocused();
    expect(
        await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
    ).toBeTruthy();
    await page.screenshot({
        path: 'storage/test-results/mobile.png',
        fullPage: true,
    });
});

test('calendar project bars and printable 40-project year plan fit the page', async ({
    page,
}) => {
    await login(page, 'britta');
    await page.getByRole('button', { name: 'Kalender', exact: true }).click();
    await expect(page.locator('.calendar-bars button').first()).toBeVisible();
    await page.getByRole('button', { name: 'Jahresplan', exact: true }).click();
    await expect(
        page
            .locator('.year-table tbody tr')
            .filter({ hasText: 'visuellen Drucktest' }),
    ).toHaveCount(40);
    await page.goto('/reports/year/2026/print');
    await page.emulateMedia({ media: 'print' });
    await expect(
        page
            .locator('table')
            .first()
            .locator('tbody tr')
            .filter({ hasText: 'visuellen Drucktest' }),
    ).toHaveCount(40);
    const geometry = await page
        .locator('table')
        .first()
        .locator('tbody tr')
        .evaluateAll((rows) =>
            rows.every((row) => {
                const cells = Array.from(row.querySelectorAll('td'));
                const bar = row.querySelector('.bar')!.getBoundingClientRect();
                const timeline = cells[3].getBoundingClientRect();
                return (
                    bar.left >= timeline.left - 1 &&
                    bar.right <= timeline.right + 1 &&
                    cells[0].scrollWidth <= cells[0].clientWidth + 1
                );
            }),
        );
    expect(geometry).toBeTruthy();
    await page.pdf({
        path: 'storage/test-results/jahresplan-2026-A3.pdf',
        format: 'A3',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: true,
    });
    await page.pdf({
        path: 'storage/test-results/jahresplan-2026-A4.pdf',
        format: 'A4',
        landscape: true,
        printBackground: true,
        preferCSSPageSize: false,
    });
    await page.screenshot({
        path: 'storage/test-results/jahresplan.png',
        fullPage: true,
    });
});
