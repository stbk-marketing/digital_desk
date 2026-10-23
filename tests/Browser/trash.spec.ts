import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function login(page: Page, user: string) {
    await page.goto('/login');
    await page.locator('input[name=email]').fill(`${user}@example.test`);
    await page.locator('input[name=password]').fill('Browser-test-123!');
    await page.locator('button[type=submit]').click();
    await expect(
        page.getByRole('heading', { name: 'Schreibtisch', exact: true }),
    ).toBeVisible();
}

async function navigate(page: Page, view: string) {
    await page.getByRole('button', { name: view, exact: true }).click();
    await expect(
        page.getByRole('heading', { name: view, exact: true }),
    ).toBeVisible();
}

async function removeTask(page: Page, title: string, details = false) {
    if (details)
        await page
            .getByRole('button', { name: `Details: ${title}`, exact: true })
            .click();
    await (details ? page.locator('[data-slot=sheet-content]') : page)
        .getByRole('button', { name: `Aktionen: ${title}`, exact: true })
        .click();
    await page.getByRole('menuitem', { name: 'Löschen', exact: true }).click();
    await expect(
        page
            .locator('.task-row')
            .filter({ has: page.locator(`input[value="${title}"]`) }),
    ).toHaveCount(0);
}

test('task trash, undo, restore, purge confirmation and team synchronization', async ({
    page,
    browser,
}) => {
    test.setTimeout(90000);
    await login(page, 'erika');
    const context = await browser.newContext();
    const colleague = await context.newPage();
    try {
        await login(colleague, 'fiona');
        const title = 'Papierkorb Aufgabe vertraulich';
        await page.getByLabel('Neue Aufgabe', { exact: true }).fill(title);
        await page.getByLabel('Neue Aufgabe', { exact: true }).press('Enter');
        const otherRow = colleague
            .locator('.task-row')
            .filter({ has: colleague.locator(`input[value="${title}"]`) });
        await expect(otherRow).toBeVisible({ timeout: 20000 });
        await removeTask(page, title);
        await page
            .getByRole('button', { name: 'Rückgängig', exact: true })
            .click();
        await expect(page.locator(`input[value="${title}"]`)).toBeVisible();
        await expect(otherRow).toBeVisible({ timeout: 20000 });
        await removeTask(page, title);
        await expect(otherRow).toHaveCount(0, { timeout: 20000 });
        await navigate(page, 'Papierkorb');
        const entry = page.locator('.trash-record').filter({ hasText: title });
        await expect(entry).toContainText('Erika');
        await page.screenshot({
            path: 'storage/test-results/trash-light.png',
            fullPage: true,
        });
        await page.emulateMedia({ colorScheme: 'dark' });
        await page.setViewportSize({ width: 390, height: 844 });
        await expect
            .poll(() =>
                page.evaluate(
                    () => document.documentElement.scrollWidth <= innerWidth,
                ),
            )
            .toBe(true);
        await page.screenshot({
            path: 'storage/test-results/trash-dark-mobile.png',
            fullPage: true,
        });
        await page.setViewportSize({ width: 1280, height: 720 });
        await page.emulateMedia({ colorScheme: 'light' });
        await entry
            .getByRole('button', { name: 'Verlauf', exact: true })
            .click();
        await expect(page.getByRole('dialog')).toContainText(
            'In den Papierkorb verschoben',
        );
        await page.keyboard.press('Escape');
        await entry
            .getByRole('button', { name: 'Wiederherstellen', exact: true })
            .click();
        await page
            .getByRole('button', {
                name: 'Jetzt wiederherstellen',
                exact: true,
            })
            .click();
        await expect(entry).toHaveCount(0);
        await expect(otherRow).toBeVisible({ timeout: 20000 });
        await navigate(page, 'Schreibtisch');
        await removeTask(page, title, true);
        await navigate(page, 'Papierkorb');
        await entry
            .getByRole('button', { name: 'Endgültig löschen', exact: true })
            .click();
        await page
            .getByRole('button', { name: 'Abbrechen', exact: true })
            .click();
        await expect(entry).toBeVisible();
        await entry
            .getByRole('button', { name: 'Endgültig löschen', exact: true })
            .click();
        await page
            .getByRole('button', {
                name: 'Jetzt endgültig löschen',
                exact: true,
            })
            .click();
        await expect(entry).toHaveCount(0);
        await expect(otherRow).toHaveCount(0, { timeout: 20000 });
        await page.reload();
        await expect(entry).toHaveCount(0);
    } finally {
        await context.close();
    }
});

test('project trash detaches tasks, restores safe links and purges without deleting tasks', async ({
    page,
}) => {
    await login(page, 'erika');
    await navigate(page, 'Projekte');
    const name = 'Papierkorb Projekt';
    await page.getByLabel('Neues Projekt', { exact: true }).fill(name);
    await page.getByLabel('Neues Projekt', { exact: true }).press('Enter');
    const card = page.locator('.project-card').filter({
        has: page.locator(`input[aria-label="Projektname"][value="${name}"]`),
    });
    await card
        .getByRole('button', { name: 'Aufgaben öffnen / erfassen →' })
        .click();
    const title = 'Aufgabe bleibt erhalten';
    await page.getByLabel('Neue Aufgabe', { exact: true }).fill(title);
    await page.getByLabel('Neue Aufgabe', { exact: true }).press('Enter');
    const row = page
        .locator('.task-row')
        .filter({ has: page.locator(`input[value="${title}"]`) });
    await expect(row).toBeVisible();
    const projectId = await row.getByLabel('Projekt zuordnen').inputValue();
    await navigate(page, 'Projekte');
    await card.getByRole('button', { name: `Aktionen: ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Löschen', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText(
        'Zugehörige Aufgaben werden nicht gelöscht',
    );
    await page
        .getByRole('button', { name: 'Projekt löschen', exact: true })
        .click();
    await expect(card).toHaveCount(0);
    await navigate(page, 'Schreibtisch');
    await expect(row.getByLabel('Projekt zuordnen')).toHaveValue('');
    await navigate(page, 'Papierkorb');
    const entry = page.locator('.trash-record').filter({ hasText: name });
    await entry.getByRole('button', { name: 'Frühere Zuordnungen' }).click();
    await expect(page.getByRole('dialog')).toContainText(title);
    await page.keyboard.press('Escape');
    await entry
        .getByRole('button', { name: 'Wiederherstellen', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Jetzt wiederherstellen', exact: true })
        .click();
    await navigate(page, 'Schreibtisch');
    await expect(row.getByLabel('Projekt zuordnen')).toHaveValue(projectId);
    await navigate(page, 'Projekte');
    await card.getByRole('button', { name: `Aktionen: ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Löschen', exact: true }).click();
    await page
        .getByRole('button', { name: 'Projekt löschen', exact: true })
        .click();
    await navigate(page, 'Papierkorb');
    await entry
        .getByRole('button', { name: 'Endgültig löschen', exact: true })
        .click();
    await page
        .getByRole('button', { name: 'Jetzt endgültig löschen', exact: true })
        .click();
    await expect(entry).toHaveCount(0);
    await navigate(page, 'Schreibtisch');
    await expect(row.getByLabel('Projekt zuordnen')).toHaveValue('');
});

test('team deletion hides a conflicting local draft without discarding its text', async ({
    page,
    browser,
}) => {
    await login(page, 'erika');
    const context = await browser.newContext();
    const colleague = await context.newPage();
    try {
        await login(colleague, 'fiona');
        const title = 'Parallel gelöschte Aufgabe';
        await page.getByLabel('Neue Aufgabe', { exact: true }).fill(title);
        await page.getByLabel('Neue Aufgabe', { exact: true }).press('Enter');
        const input = colleague.locator(
            `input[aria-label="Aufgabentitel"][value="${title}"]`,
        );
        await expect(input).toBeVisible({ timeout: 20000 });
        await colleague.route('**/api/workspace/tasks/*', (route) =>
            route.request().method() === 'PATCH'
                ? route.abort()
                : route.continue(),
        );
        await input.fill('Mein erhaltener Text');
        await colleague.keyboard.press('Tab');
        await expect(
            colleague.getByText('Nicht synchronisiert.', { exact: true }),
        ).toBeVisible();
        await removeTask(page, title);
        await expect(
            colleague.getByLabel('Erhaltener lokaler Entwurf'),
        ).toHaveValue('Mein erhaltener Text', { timeout: 20000 });
        await expect(
            colleague.locator(
                'input[aria-label="Aufgabentitel"][value="Mein erhaltener Text"]',
            ),
        ).toHaveCount(0);
        await colleague
            .getByRole('button', { name: 'Lokalen Entwurf verwerfen' })
            .click();
        await expect(
            colleague.getByLabel('Erhaltener lokaler Entwurf'),
        ).toHaveCount(0);
    } finally {
        await context.close();
    }
});

test('project deletion preserves a colleague’s unsent project draft outside the project list', async ({
    page,
    browser,
}) => {
    await login(page, 'erika');
    await navigate(page, 'Projekte');
    const title = 'Parallel gelöschtes Projekt';
    await page.getByLabel('Neues Projekt', { exact: true }).fill(title);
    await page.getByLabel('Neues Projekt', { exact: true }).press('Enter');
    const card = page
        .locator('.project-card')
        .filter({ has: page.locator(`input[value="${title}"]`) });
    await expect(card).toBeVisible();
    const context = await browser.newContext();
    const colleague = await context.newPage();
    try {
        await login(colleague, 'fiona');
        await navigate(colleague, 'Projekte');
        const input = colleague.locator(
            `input[aria-label="Projektname"][value="${title}"]`,
        );
        await expect(input).toBeVisible();
        await colleague.route('**/api/workspace/projects/*', (route) =>
            route.request().method() === 'PATCH'
                ? route.abort()
                : route.continue(),
        );
        await input.fill('Mein erhaltener Projekttext');
        await colleague.keyboard.press('Tab');
        await expect(colleague.locator('.sync-state')).toContainText(
            'Nicht synchronisiert',
        );
        await card
            .getByRole('button', { name: `Aktionen: ${title}`, exact: true })
            .click();
        await page
            .getByRole('menuitem', { name: 'Löschen', exact: true })
            .click();
        await page
            .getByRole('button', { name: 'Projekt löschen', exact: true })
            .click();
        await expect(
            colleague.getByLabel('Erhaltener lokaler Projektentwurf'),
        ).toHaveValue('Name: Mein erhaltener Projekttext', { timeout: 20000 });
        await expect(
            colleague.locator(
                'input[aria-label="Projektname"][value="Mein erhaltener Projekttext"]',
            ),
        ).toHaveCount(0);
        await colleague
            .getByRole('button', { name: 'Lokalen Projektentwurf verwerfen' })
            .click();
        await expect(
            colleague.getByLabel('Erhaltener lokaler Projektentwurf'),
        ).toHaveCount(0);
    } finally {
        await context.close();
    }
});
