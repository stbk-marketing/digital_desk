import { expect, test } from '@playwright/test';

test('project action menu remains reachable after returning from a long task list', async ({
    page,
}) => {
    await page.goto('/login');
    await page.locator('input[name=email]').fill('erika@example.test');
    await page.locator('input[name=password]').fill('Browser-test-123!');
    await page.locator('button[type=submit]').click();
    await expect(
        page.getByRole('heading', { name: 'Schreibtisch', exact: true }),
    ).toBeVisible();
    for (let index = 0; index < 8; index++) {
        const title = `Menü-Layout Aufgabenbestand ${index}`;
        await page.getByLabel('Neue Aufgabe', { exact: true }).fill(title);
        await page.getByLabel('Neue Aufgabe', { exact: true }).press('Enter');
        await expect(
            page.getByRole('button', {
                name: `Details: ${title}`,
                exact: true,
            }),
        ).toBeEnabled();
    }
    await page.getByRole('button', { name: 'Projekte', exact: true }).click();
    await page
        .getByLabel('Neues Projekt', { exact: true })
        .fill('Menü Layoutprüfung');
    await page.getByLabel('Neues Projekt', { exact: true }).press('Enter');
    const card = page.locator('.project-card').filter({
        has: page.locator(
            'input[aria-label=Projektname][value="Menü Layoutprüfung"]',
        ),
    });
    await card
        .getByRole('button', { name: 'Aufgaben öffnen / erfassen →' })
        .click();
    await page
        .getByLabel('Neue Aufgabe', { exact: true })
        .fill('Menü Layoutprüfung Aufgabe');
    await page.getByLabel('Neue Aufgabe', { exact: true }).press('Enter');
    await expect(
        page.locator(
            'input[aria-label=Aufgabentitel][value="Menü Layoutprüfung Aufgabe"]',
        ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Projekte', exact: true }).click();
    for (const colorScheme of ['light', 'dark'] as const) {
        await page.emulateMedia({ colorScheme });
        await card
            .getByRole('button', {
                name: 'Aktionen: Menü Layoutprüfung',
                exact: true,
            })
            .click();
        const item = page.getByRole('menuitem', {
            name: 'Löschen',
            exact: true,
        });
        await expect(item).toBeInViewport();
        await page.screenshot({
            path: `storage/test-results/design-${colorScheme}-menu.png`,
            animations: 'disabled',
        });
        await item.click();
        await expect(page.getByRole('dialog')).toContainText(
            'Zugehörige Aufgaben werden nicht gelöscht',
        );
        await page.screenshot({
            path: `storage/test-results/design-${colorScheme}-dialog.png`,
            animations: 'disabled',
        });
        await page
            .getByRole('button', { name: 'Abbrechen', exact: true })
            .click();
    }
});
