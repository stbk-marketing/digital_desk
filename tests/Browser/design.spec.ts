import { expect, test } from '@playwright/test';

for (const mode of ['light', 'dark'] as const) {
    test(`design: ${mode}, desktop and mobile`, async ({ page }) => {
        await page.emulateMedia({ colorScheme: mode, reducedMotion: 'reduce' });
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto('/login');
        await page.screenshot({
            path: `storage/test-results/design-${mode}-login.png`,
        });
        await page.locator('input[name=email]').fill('britta@example.test');
        await page.locator('input[name=password]').fill('Browser-test-123!');
        await page.locator('button[type=submit]').click();
        await expect(
            page.getByRole('heading', { name: 'Schreibtisch', exact: true }),
        ).toBeVisible();
        await expect(page.locator('html')).toHaveClass(
            mode === 'dark' ? /dark/ : /^(?!.*dark).*$/,
        );

        for (const width of [1440, 390]) {
            await page.setViewportSize({ width, height: 1000 });
            for (const view of [
                'Schreibtisch',
                'Projekte',
                'Kalender',
                'Wochencheck',
                'Jahresplan',
            ]) {
                if (width === 390)
                    await page
                        .getByRole('button', { name: 'Navigation umschalten' })
                        .click();
                await page
                    .getByRole('button', { name: view, exact: true })
                    .click();
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
                    path: `storage/test-results/design-${mode}-${width}-${view}.png`,
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
        const title = `Darstellungsprobe ${mode}`;
        await page.getByLabel('Neue Aufgabe', { exact: true }).fill(title);
        await page.getByLabel('Neue Aufgabe', { exact: true }).press('Enter');
        await page
            .getByRole('button', { name: `Details: ${title}`, exact: true })
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
                path: `storage/test-results/design-${mode}-${width}-Details.png`,
            });
        }
    });
}
