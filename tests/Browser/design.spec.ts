import { expect, test } from '@playwright/test';

for (const mode of ['light', 'dark'] as const) {
    test(`design: ${mode}, desktop and mobile`, async ({ page }) => {
        test.setTimeout(90000);
        const externalFonts: string[] = [];
        page.on('request', (request) => {
            if (
                request.resourceType() === 'font' &&
                new URL(request.url()).hostname !== '127.0.0.1'
            )
                externalFonts.push(request.url());
        });
        await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto('/register');
        await expect(
            page.getByRole('heading', { name: 'Konto erstellen', exact: true }),
        ).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({
            animations: 'disabled',
            path: `storage/test-results/design-${mode}-register.png`,
        });
        await page.setViewportSize({ width: 390, height: 1000 });
        await page.screenshot({
            animations: 'disabled',
            path: `storage/test-results/design-${mode}-390-register.png`,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto('/login');
        await page.screenshot({
            animations: 'disabled',
            path: `storage/test-results/design-${mode}-login.png`,
        });
        await page.setViewportSize({ width: 390, height: 1000 });
        await page.screenshot({
            animations: 'disabled',
            path: `storage/test-results/design-${mode}-390-login.png`,
        });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.locator('input[name=email]').fill('britta@example.test');
        await page.locator('input[name=password]').fill('Browser-test-123!');
        await page.locator('button[type=submit]').click();
        await expect(
            page.getByRole('heading', { name: 'Schreibtisch', exact: true }),
        ).toBeVisible();
        await expect(page.locator('.workspace-shell')).toHaveCSS(
            'color',
            'rgb(24, 53, 47)',
        );
        await expect(page.locator('.workspace-shell')).toHaveCSS(
            'color-scheme',
            'light',
        );

        const taskTitle = `Darstellungsprobe ${mode}`;
        const today = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Europe/Berlin',
        }).format(new Date());
        for (const [suffix, offset] of [
            ['', null],
            [' – heute', 0],
            [' – überfällig', -1],
            [' – demnächst', 3],
        ] as const) {
            const title = taskTitle + suffix;
            await page.getByLabel('Neue Aufgabe', { exact: true }).fill(title);
            await page
                .getByLabel('Neue Aufgabe', { exact: true })
                .press('Enter');
            await expect(
                page.getByRole('button', {
                    name: `Details: ${title}`,
                    exact: true,
                }),
            ).toBeEnabled();
            const row = page.locator('.task-row').filter({
                has: page.locator(
                    `textarea[aria-label="Aufgabentitel"]:text-is("${title}")`,
                ),
            });
            if (offset !== null) {
                await row
                    .getByRole('button', {
                        name: `Details: ${title}`,
                        exact: true,
                    })
                    .click();
                const due = new Date(`${today}T12:00:00Z`);
                due.setUTCDate(due.getUTCDate() + offset);
                await page
                    .getByRole('complementary', { name: 'Aufgabendetails' })
                    .getByLabel('Frist', { exact: true })
                    .fill(due.toISOString().slice(0, 10));
            }
            if (offset === 0) {
                await page
                    .getByRole('complementary', { name: 'Aufgabendetails' })
                    .getByLabel('Zuständig', { exact: true })
                    .selectOption({ label: 'Britta' });
                await page
                    .getByRole('complementary', { name: 'Aufgabendetails' })
                    .getByLabel('Projekt', { exact: true })
                    .selectOption({ label: 'Noch nicht terminiert' });
            }
            await expect(row.locator('.sync-state')).toHaveCount(0);
            if (offset !== null)
                await page
                    .getByRole('button', { name: 'Schließen', exact: true })
                    .click();
        }
        await page.reload();
        await expect(
            page.getByRole('button', {
                name: `Details: ${taskTitle}`,
                exact: true,
            }),
        ).toBeEnabled();
        let currentView = 'Schreibtisch';
        for (const width of [1440, 820, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const view of [
                'Schreibtisch',
                'Projekte',
                'Kalender',
                'Wochencheck',
                'Jahresplan',
                'Papierkorb',
            ]) {
                if (width === 390)
                    await page
                        .getByRole('button', { name: 'Navigation umschalten' })
                        .click();
                const loaded =
                    view === currentView
                        ? null
                        : page.waitForResponse((response) => {
                              const url = new URL(response.url());
                              return (
                                  url.pathname === '/api/workspace/tasks' &&
                                  !url.searchParams.has('from') &&
                                  url.searchParams.get('check') ===
                                      (view === 'Wochencheck'
                                          ? 'overdue'
                                          : null) &&
                                  response.status() === 200
                              );
                          });
                await page
                    .getByRole('button', { name: view, exact: true })
                    .click();
                if (loaded) await loaded;
                currentView = view;
                await page.evaluate(() => window.scrollTo(0, 0));
                await expect(
                    page.getByRole('heading', { name: view, exact: true }),
                ).toBeVisible();
                if (view === 'Jahresplan') {
                    await expect
                        .poll(() =>
                            page
                                .locator('.year-table th')
                                .first()
                                .evaluate(
                                    (element) =>
                                        element.scrollWidth <=
                                        element.clientWidth + 1,
                                ),
                        )
                        .toBe(true);
                }
                await expect
                    .poll(() =>
                        page.evaluate(
                            () =>
                                document.documentElement.scrollWidth <=
                                innerWidth,
                        ),
                    )
                    .toBe(true);
                await page.screenshot({
                    animations: 'disabled',
                    path: `storage/test-results/design-${mode}-${width}-${view}.png`,
                    fullPage: view === 'Schreibtisch',
                });
                if (view === 'Kalender') {
                    await page
                        .getByLabel('Kalenderansicht')
                        .selectOption('week');
                    await expect(
                        page.getByRole('heading', { name: /^Woche / }),
                    ).toBeVisible();
                    await expect
                        .poll(() =>
                            page.evaluate(
                                () =>
                                    document.documentElement.scrollWidth <=
                                    innerWidth,
                            ),
                        )
                        .toBe(true);
                    await page.screenshot({
                        animations: 'disabled',
                        path: `storage/test-results/design-${mode}-${width}-Woche.png`,
                    });
                    await page
                        .getByLabel('Kalenderansicht')
                        .selectOption('month');
                }
            }
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page
            .getByRole('button', { name: 'Schreibtisch', exact: true })
            .click();
        await page
            .getByRole('button', { name: `Details: ${taskTitle}`, exact: true })
            .click();
        const sheet = page.locator('[data-slot=sheet-content]');
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            await expect(sheet).toBeVisible();
            await expect
                .poll(() =>
                    sheet.evaluate(
                        (element) =>
                            element.scrollWidth <= element.clientWidth + 1,
                    ),
                )
                .toBe(true);
            await page.screenshot({
                animations: 'disabled',
                path: `storage/test-results/design-${mode}-${width}-Details.png`,
            });
        }
        await page.keyboard.press('Escape');
        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const route of ['profile', 'password', 'appearance']) {
                await page.goto(`/settings/${route}`);
                await expect(page).toHaveURL(new RegExp(`/settings/${route}$`));
                await page.evaluate(() => document.fonts.ready);
                await page.screenshot({
                    animations: 'disabled',
                    path: `storage/test-results/design-${mode}-${width}-settings-${route}.png`,
                });
            }
        }
        expect(externalFonts).toEqual([]);
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto('/reports/year/2026/print');
        await page.emulateMedia({ media: 'print' });
        await expect(page.locator('html')).not.toHaveClass(/dark/);
        await expect(page.locator('body')).toHaveCSS('box-shadow', 'none');
        await page.screenshot({
            animations: 'disabled',
            path: `storage/test-results/design-${mode}-print.png`,
            fullPage: true,
        });
    });
}
